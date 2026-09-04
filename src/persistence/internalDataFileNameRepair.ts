import { createUniqueId, isIdForArea } from "../domain/stringSanitizer";
import type { InternalFileNameRepairResult } from "./objectPersistenceInternalTypes";
import type {
	InternalDataFileReadPort,
	InternalDataFileWritePort,
} from "./ports/dataFileStorage";
import {
	STANDALONE_DATA_FILE_CATEGORIES,
	type StandaloneDataFileCategory,
} from "./ports/dataFileTypes";
import { requireStorageOperationSuccess } from "./storageFailureTranslation";

type InternalFileNamePersistence = Pick<
	InternalDataFileReadPort,
	"listInternalFileNames"
> &
	Pick<InternalDataFileWritePort, "renameInternal">;

export type InvalidInternalIdGroup = {
	oldId: string;
	oldFileNames: string[];
};

export type InternalFileNameAnalysis = {
	validIds: Set<string>;
	invalidIds: InvalidInternalIdGroup[];
};

export async function repairInternalDataFileNames(
	storage: InternalFileNamePersistence,
): Promise<InternalFileNameRepairResult> {
	let renamedFiles = 0;
	let repairedIds = 0;
	for (const category of STANDALONE_DATA_FILE_CATEGORIES) {
		const fileNames = await storage.listInternalFileNames(category);
		const analysis = analyzeInternalFileNames(fileNames, category);
		for (const invalidId of analysis.invalidIds) {
			const newId = createUniqueInternalDocumentId(
				invalidId.oldId,
				category,
				analysis.validIds,
			);
			// Die neue ID wird vor der inneren Schleife reserviert, damit alle
			// folgenden Gruppen sie bereits als belegt behandeln.
			analysis.validIds.add(newId);
			renamedFiles += await normalizeFileNameGroup(
				storage,
				category,
				invalidId.oldFileNames,
				newId,
			);
			repairedIds += 1;
		}
		const normalizedIdFileNames =
			analysis.invalidIds.length > 0
				? await storage.listInternalFileNames(category)
				: fileNames;
		for (const [id, groupedFileNames] of groupValidInternalFileNames(
			normalizedIdFileNames,
			category,
		)) {
			renamedFiles += await normalizeFileNameGroup(
				storage,
				category,
				groupedFileNames,
				id,
			);
		}
	}
	return { renamedFiles, repairedIds };
}

export function analyzeInternalFileNames(
	fileNames: Iterable<string>,
	category: StandaloneDataFileCategory,
): InternalFileNameAnalysis {
	const validIds = new Set<string>();
	const invalidById = new Map<string, InvalidInternalIdGroup>();

	for (const fileName of [...fileNames].sort((left, right) =>
		left.localeCompare(right),
	)) {
		if (!fileName.endsWith(".json")) continue;
		const oldId = extractInternalId(fileName);
		if (isIdForArea(oldId, category)) {
			validIds.add(oldId);
			continue;
		}
		const group = invalidById.get(oldId);
		if (group) group.oldFileNames.push(fileName);
		else invalidById.set(oldId, { oldId, oldFileNames: [fileName] });
	}

	return { validIds, invalidIds: [...invalidById.values()] };
}

export function createUniqueInternalDocumentId(
	input: string,
	category: StandaloneDataFileCategory,
	validIds: ReadonlySet<string>,
): string {
	return createUniqueId(input, category, validIds, {
		firstSuffix: 2,
	}).id;
}

export function extractInternalId(fileName: string): string {
	const stem = fileName.endsWith(".json")
		? fileName.slice(0, -".json".length)
		: fileName;
	const firstPoint = stem.indexOf(".");
	return firstPoint < 0 ? stem : stem.slice(0, firstPoint);
}

export function extractInternalStorageVariant(
	fileName: string,
): string | undefined {
	const stem = fileName.endsWith(".json")
		? fileName.slice(0, -".json".length)
		: fileName;
	const firstPoint = stem.indexOf(".");
	return firstPoint < 0 ? undefined : stem.slice(firstPoint + 1);
}

export function sanitizeInternalStorageVariant(input: string): string {
	return input
		.replace(/\s+/gu, "_")
		.replace(/[^a-zA-Z0-9_]/g, "")
		.replace(/_+/g, "_")
		.toLowerCase();
}

function groupValidInternalFileNames(
	fileNames: Iterable<string>,
	category: StandaloneDataFileCategory,
): Map<string, string[]> {
	const groups = new Map<string, string[]>();
	for (const fileName of fileNames) {
		const id = extractInternalId(fileName);
		if (!isIdForArea(id, category)) continue;
		const group = groups.get(id);
		if (group) group.push(fileName);
		else groups.set(id, [fileName]);
	}
	return groups;
}

async function normalizeFileNameGroup(
	storage: InternalFileNamePersistence,
	category: StandaloneDataFileCategory,
	oldFileNames: string[],
	newId: string,
): Promise<number> {
	const usedStorageVariants = new Set(["temp", "backup"]);
	const assignedSpecialStorageVariants = new Set<string>();
	let renamedFiles = 0;

	const sortedFileNames = [...oldFileNames].sort((left, right) => {
		const priorityDifference =
			storageVariantPriority(extractInternalStorageVariant(left)) -
			storageVariantPriority(extractInternalStorageVariant(right));
		return priorityDifference || left.localeCompare(right);
	});
	for (const oldFileName of sortedFileNames) {
		const storageVariant = extractInternalStorageVariant(oldFileName);
		let newFileName: string;
		if (storageVariant === undefined) newFileName = `${newId}.json`;
		else {
			const lowerStorageVariant = storageVariant.toLowerCase();
			const sanitizedStorageVariant =
				sanitizeInternalStorageVariant(storageVariant) || "v";
			let normalizedStorageVariant: string;
			if (isSpecialStorageVariant(storageVariant)) {
				normalizedStorageVariant = storageVariant;
				usedStorageVariants.add(storageVariant);
				assignedSpecialStorageVariants.add(storageVariant);
			} else if (
				isSpecialStorageVariant(lowerStorageVariant) &&
				sanitizedStorageVariant === lowerStorageVariant &&
				!assignedSpecialStorageVariants.has(lowerStorageVariant)
			) {
				normalizedStorageVariant = lowerStorageVariant;
				usedStorageVariants.add(lowerStorageVariant);
				assignedSpecialStorageVariants.add(lowerStorageVariant);
			} else {
				const safeBaseStorageVariant = isRestoredStorageVariant(
					sanitizedStorageVariant,
				)
					? `v_${sanitizedStorageVariant}`
					: sanitizedStorageVariant;
				normalizedStorageVariant = createUniqueStorageVariant(
					safeBaseStorageVariant,
					usedStorageVariants,
				);
				usedStorageVariants.add(normalizedStorageVariant);
			}
			newFileName = `${newId}.${normalizedStorageVariant}.json`;
		}
		if (oldFileName === newFileName) continue;
		await requireStorageOperationSuccess(
			storage.renameInternal(
				{ category, fileName: oldFileName },
				{ category, fileName: newFileName },
			),
		);
		renamedFiles += 1;
	}
	return renamedFiles;
}

function storageVariantPriority(storageVariant: string | undefined): number {
	if (storageVariant === undefined) return 0;
	if (isSpecialStorageVariant(storageVariant)) return 1;
	if (sanitizeInternalStorageVariant(storageVariant) === storageVariant)
		return 2;
	if (isSpecialStorageVariant(storageVariant.toLowerCase())) return 3;
	return 4;
}

function isSpecialStorageVariant(value: string): boolean {
	return (
		value === "temp" || value === "backup" || isRestoredStorageVariant(value)
	);
}

function isRestoredStorageVariant(value: string): boolean {
	return /^restored(?:_[1-9]\d*)?$/.test(value);
}

function createUniqueStorageVariant(
	baseStorageVariant: string,
	usedStorageVariants: ReadonlySet<string>,
): string {
	if (!usedStorageVariants.has(baseStorageVariant)) return baseStorageVariant;
	for (let index = 2; ; index += 1) {
		const candidate = `${baseStorageVariant}_${index}`;
		if (!usedStorageVariants.has(candidate)) return candidate;
	}
}
