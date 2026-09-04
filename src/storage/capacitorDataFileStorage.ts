import { registerPlugin } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type {
	DataFileReadResult,
	DataFileVersion,
	DataFileWriteOptions,
	ExternalDataFileReadPort,
	ExternalDataFileWritePort,
	InternalDataFileReadPort,
	InternalDataFileWritePort,
	InternalStorageCommandPort,
	StoredByteDocument,
	StoredFileMetadata,
} from "../persistence/ports/dataFileStorage";
import { RecoverableStorageWriteError } from "../persistence/ports/dataFileStorage";
import type {
	DataFileCategory,
	DataFileReference,
	StandaloneDataFileCategory,
} from "../persistence/ports/dataFileTypes";
import { DATA_FILE_CATEGORIES } from "../persistence/ports/dataFileTypes";
import type {
	StorageCommandContinuation,
	StorageCommandDecision,
} from "../persistence/ports/storageCommand";
import {
	type StorageOperationResult,
	storageFailure,
	storageFailureCapabilities,
} from "../persistence/ports/storageFailure";
import type {
	RecoverySource,
	StorageRecoveryCandidate,
	StorageRecoveryPort,
	StorageRecoveryRequestResult,
	StorageRecoveryResolution,
} from "../persistence/ports/storageRecovery";
import {
	createStorageCommandId,
	InternalStorageCommandQueue,
} from "./internalStorageCommandQueue";
import {
	classifyStorageFailureReason,
	externalErrorDiagnostic,
	InternalStorageError,
} from "./storageError";

const APP_ROOT = "social-deduction-game";
const SEED_MARKER = `${APP_ROOT}/.initial-data-copied`;

type SeedManifest = { files: string[] };

type PendingWriteState = {
	file: DataFileReference;
	bytes: Uint8Array;
	options: DataFileWriteOptions;
	overwriteExisting: boolean;
	retryIncompleteNewFile: boolean;
	failureKind?: "newFile" | "overwrite" | "targetExists";
};

type NativeExternalWriteResult =
	| { status: "success" }
	| { status: "cancelled" };

export interface NativeDataFilePlugin {
	writeExternal(options: {
		bytesBase64: string;
		suggestedFileName: string;
		description?: string;
	}): Promise<NativeExternalWriteResult>;
}

export interface NativeSharePlugin {
	share(options: {
		title?: string;
		dialogTitle?: string;
		files: string[];
	}): Promise<unknown>;
}

const nativeDataFilePlugin =
	registerPlugin<NativeDataFilePlugin>("NativeDataFile");

export class CapacitorDataFileStorage
	implements
		InternalDataFileReadPort,
		InternalDataFileWritePort,
		ExternalDataFileReadPort,
		ExternalDataFileWritePort,
		StorageRecoveryPort,
		InternalStorageCommandPort
{
	readonly #commandQueue = new InternalStorageCommandQueue();
	readonly #pendingRecoveryRequests = new Map<
		string,
		{ recoveryKey: string; candidate: StorageRecoveryCandidate }
	>();

	constructor(
		private readonly externalFiles: NativeDataFilePlugin = nativeDataFilePlugin,
		private readonly nativeShare: NativeSharePlugin = Share,
	) {}
	async initializeFromBundle(): Promise<void> {
		if (await pathExists(SEED_MARKER)) return;
		const response = await fetch(capacitorBundleUrl("manifest.json"));
		if (!response.ok)
			throw new Error(
				"Der mitgelieferte Datenbestand konnte nicht gelesen werden.",
			);
		const manifest = (await response.json()) as unknown;
		if (!isSeedManifest(manifest))
			throw new Error("Der mitgelieferte Datenbestand ist ungültig.");
		for (const relativePath of manifest.files) {
			validateSeedPath(relativePath);
			const target = `${APP_ROOT}/${relativePath}`;
			if (await pathExists(target)) continue;
			const fileResponse = await fetch(capacitorBundleUrl(relativePath));
			if (!fileResponse.ok)
				throw new Error(
					`Startdatei "${relativePath}" konnte nicht gelesen werden.`,
				);
			await writeBytes(
				target,
				new Uint8Array(await fileResponse.arrayBuffer()),
			);
		}
		await writeBytes(SEED_MARKER, new TextEncoder().encode("1\n"));
	}

	async listInternalFileNames(
		category: StandaloneDataFileCategory,
	): Promise<string[]> {
		return this.#commandQueue.enqueue({
			key: `${category}:list-file-names`,
			execute: async () =>
				(await this.#listCategory(category))
					.filter((file) => isAllowedFileName(file.name, category))
					.map((file) => file.name)
					.sort((left, right) => left.localeCompare(right)),
		});
	}

	async listInternalFiles(
		category: DataFileCategory,
	): Promise<StoredFileMetadata[]> {
		return this.#commandQueue.enqueue({
			key: `${category}:list-files`,
			execute: async () =>
				(await this.#listCategory(category))
					.filter((file) => isNormalJsonFileName(file.name, category))
					.map((file) => ({
						category,
						fileName: file.name,
						modifiedAt: file.mtime,
					})),
		});
	}

	async readAllInternal(
		category: DataFileCategory,
	): Promise<StoredByteDocument[]> {
		return this.#commandQueue.enqueue({
			key: `${category}:read-all`,
			execute: async () => {
				const fileNames = (await this.#listCategory(category))
					.filter((file) => isNormalJsonFileName(file.name, category))
					.map((file) => file.name);
				return await Promise.all(
					fileNames.map(async (fileName) => ({
						category,
						fileName,
						bytes: await readBytes(pathFor({ category, fileName })),
					})),
				);
			},
		});
	}

	async readInternal(
		file: DataFileReference,
		version: DataFileVersion = "primary",
	): Promise<DataFileReadResult> {
		const normalized = normalizeReference(file);
		return this.#commandQueue.enqueue({
			key: `${recoveryKey(normalized)}:read:${version}`,
			execute: async () => {
				try {
					return {
						status: "success" as const,
						bytes: await readBytes(
							version === "backup"
								? backupPath(normalized)
								: pathFor(normalized),
						),
					};
				} catch (error) {
					const diagnostic = externalErrorDiagnostic(error);
					const reason = classifyStorageFailureReason(
						error,
						"storageUnavailable",
					);
					return {
						status: "error" as const,
						error: {
							source: "storage" as const,
							operation: "read" as const,
							reason,
							...storageFailureCapabilities(reason),
							category: normalized.category,
							file: normalized,
							...(diagnostic ? { diagnostic } : {}),
						},
					};
				}
			},
		});
	}

	async writeInternal(
		file: DataFileReference,
		bytes: Uint8Array,
		options: DataFileWriteOptions,
	): Promise<void> {
		const normalized = normalizeReference(file);
		const state: PendingWriteState = {
			file: normalized,
			bytes,
			options,
			overwriteExisting: false,
			retryIncompleteNewFile: false,
		};
		return this.#commandQueue.enqueue({
			key: `${recoveryKey(normalized)}:write`,
			recoveryKey: recoveryKey(normalized),
			execute: () => this.#writeInternalRaw(state),
			recover: (decision, continuation) =>
				this.#continueWriteRaw(state, decision, continuation),
		});
	}

	async #writeInternalRaw(state: PendingWriteState): Promise<void> {
		const { file, bytes, options } = state;
		const previousFile = options.previousFile
			? normalizeReference(options.previousFile)
			: undefined;
		if (previousFile && previousFile.category !== file.category)
			throw new Error(
				"Dateien können nur innerhalb einer Kategorie ersetzt werden.",
			);
		const changesFile =
			previousFile !== undefined && previousFile.fileName !== file.fileName;
		try {
			await writeBytesWithRecovery(bytes, {
				file,
				createOnly: changesFile ? true : options.createOnly,
				backup: !changesFile && options.backup === true,
				overwriteExisting: state.overwriteExisting,
				retryIncompleteNewFile: state.retryIncompleteNewFile,
			});
			if (changesFile)
				await finishChangedFileWrite(
					previousFile,
					file,
					options.backup === true,
				);
		} catch (error) {
			if (error instanceof NativeTargetExistsError) {
				state.failureKind = "targetExists";
				throw new RecoverableStorageWriteError(
					error.message,
					undefined,
					"targetExists",
					file,
				);
			}
			if (error instanceof NativeWriteRecoveryError) {
				state.failureKind = error.kind;
				state.retryIncompleteNewFile = error.kind === "newFile";
				const diagnostic = externalErrorDiagnostic(error.cause);
				throw new RecoverableStorageWriteError(
					error.message,
					undefined,
					classifyStorageFailureReason(error.cause, "writeFailure") ===
						"diskFull"
						? "diskFull"
						: "writeFailure",
					file,
					diagnostic,
				);
			}
			throw error;
		}
	}

	async #continueWriteRaw(
		state: PendingWriteState,
		decision: Exclude<StorageCommandDecision, "retry" | "finishLater">,
		continuation?: StorageCommandContinuation,
	): Promise<"complete" | "retry"> {
		if (decision === "cancel") {
			if (state.failureKind === "newFile")
				await deleteIfExists(pathFor(state.file));
			else if (state.failureKind === "overwrite")
				await this.#cancelWriteRaw(state.file);
			return "complete";
		}
		if (decision === "overwrite") {
			state.overwriteExisting = true;
			state.retryIncompleteNewFile = false;
			state.failureKind = undefined;
			return "retry";
		}
		if (decision === "keepBoth" && continuation) {
			state.file = normalizeReference(continuation.file);
			state.bytes = continuation.bytes;
			state.options = {
				...state.options,
				createOnly: true,
				...(state.options.previousFile ? {} : { backup: false }),
			};
			state.overwriteExisting = false;
			state.retryIncompleteNewFile = false;
			state.failureKind = undefined;
			return "retry";
		}
		await this.#resolveRecoveryRaw(recoveryKey(state.file), decision);
		return "complete";
	}

	async #cancelWriteRaw(file: DataFileReference): Promise<void> {
		if (await pathExists(temporaryPath(file))) {
			await resolveRecoveryBytes(file, "keepOld");
			return;
		}
		await deleteIfExists(pathFor(file));
	}

	async deleteInternal(
		file: DataFileReference,
		options: { includeBackup?: boolean; includeRecovery?: boolean } = {},
	): Promise<void> {
		const normalized = normalizeReference(file);
		return this.#commandQueue.enqueue({
			key: `${recoveryKey(normalized)}:delete`,
			execute: async () => {
				await deleteIfExists(pathFor(normalized));
				if (options.includeBackup) await deleteIfExists(backupPath(normalized));
				if (options.includeRecovery)
					await deleteIfExists(temporaryPath(normalized));
			},
		});
	}

	async renameInternal(
		oldFile: DataFileReference,
		newFile: DataFileReference,
	): Promise<void | StorageOperationResult<void>> {
		const source = normalizeRenameReference(oldFile);
		const target = normalizeRenameReference(newFile);
		if (source.category !== target.category)
			throw new Error(
				"Dateien können nur innerhalb einer Kategorie umbenannt werden.",
			);
		if (source.fileName === target.fileName) return;
		return this.#commandQueue.enqueue({
			key: `${source.category}:rename:${source.fileName}:${target.fileName}`,
			execute: async () => {
				if (await pathExists(pathFor(target)))
					return {
						status: "conflict" as const,
						reason: "targetExists" as const,
						file: source,
						targetFile: target,
					};
				await renamePath(pathFor(source), pathFor(target));
			},
		});
	}

	async readExternal(
		selection: unknown,
	): Promise<Uint8Array | StorageOperationResult<Uint8Array>> {
		if (selection === undefined || selection === null)
			return { status: "cancelled" };
		if (!(selection instanceof File))
			throw new TypeError("Die externe Dateiauswahl ist keine Datei.");
		try {
			return new Uint8Array(await selection.arrayBuffer());
		} catch (error) {
			if (isAbortError(error)) return { status: "cancelled" };
			const reason = classifyStorageFailureReason(error, "storageUnavailable");
			const diagnostic = externalErrorDiagnostic(error);
			throw storageFailure("import", reason, {
				...(diagnostic ? { diagnostic } : {}),
			});
		}
	}

	async writeExternal(
		bytes: Uint8Array,
		options: {
			suggestedFileName: string;
			description?: string;
			conflictPolicy?: "reject" | "overwrite";
			targetPolicy?: "suggested" | "choose";
			delivery?: "save" | "share";
		},
	): Promise<void | StorageOperationResult<void>> {
		try {
			if (options.delivery === "share") {
				await this.#shareExternal(bytes, options);
				return;
			}
			const result = await this.externalFiles.writeExternal({
				bytesBase64: toBase64(bytes),
				suggestedFileName: options.suggestedFileName,
				...(options.description ? { description: options.description } : {}),
			});
			if (result.status === "cancelled") return result;
		} catch (error) {
			if (isAbortError(error)) return { status: "cancelled" };
			const reason = classifyStorageFailureReason(error, "storageUnavailable");
			const diagnostic = externalErrorDiagnostic(error);
			throw storageFailure("export", reason, {
				...(diagnostic ? { diagnostic } : {}),
			});
		}
	}

	async #shareExternal(
		bytes: Uint8Array,
		options: { suggestedFileName: string; description?: string },
	): Promise<void> {
		const path = `shared-exports/${options.suggestedFileName}`;
		await Filesystem.writeFile({
			path,
			data: toBase64(bytes),
			directory: Directory.Cache,
			recursive: true,
		});
		try {
			const { uri } = await Filesystem.getUri({
				path,
				directory: Directory.Cache,
			});
			await this.nativeShare.share({
				files: [uri],
				...(options.description
					? {
							title: options.description,
							dialogTitle: options.description,
						}
					: {}),
			});
		} finally {
			await Filesystem.deleteFile({
				path,
				directory: Directory.Cache,
			}).catch(() => undefined);
		}
	}

	async listRecoveries(
		requestedCategory?: DataFileCategory,
	): Promise<StorageRecoveryCandidate[]> {
		return this.#commandQueue.enqueue({
			key: `${requestedCategory ?? "all"}:list-recoveries`,
			execute: () => this.#listRecoveriesRaw(requestedCategory),
		});
	}

	async requestRecovery(key: string): Promise<StorageRecoveryRequestResult> {
		const candidate = await this.#commandQueue.enqueue({
			key: `${key}:request-recovery`,
			execute: () => this.#readRecoveryCandidateRaw(key),
		});
		if (!candidate) return { status: "discarded" };
		const commandId = createStorageCommandId();
		this.#pendingRecoveryRequests.set(commandId, {
			recoveryKey: key,
			candidate,
		});
		return { status: "decisionRequired", commandId, candidate };
	}

	async continueInternalCommand(
		commandId: string,
		decision: StorageCommandDecision,
		continuation?: StorageCommandContinuation,
	): Promise<"completed" | "discarded"> {
		if (await this.#commandQueue.continue(commandId, decision, continuation))
			return "completed";
		const request = this.#pendingRecoveryRequests.get(commandId);
		if (!request) return "discarded";
		this.#pendingRecoveryRequests.delete(commandId);
		if (decision === "finishLater") return "completed";
		if (
			decision === "retry" ||
			decision === "cancel" ||
			decision === "overwrite"
		)
			return "discarded";
		return this.#commandQueue.enqueue({
			key: `${request.recoveryKey}:resolve-recovery`,
			execute: async () => {
				const current = await this.#readRecoveryCandidateRaw(
					request.recoveryKey,
				);
				if (!current || !sameRecoveryCandidate(current, request.candidate))
					return "discarded" as const;
				await this.#resolveRecoveryRaw(request.recoveryKey, decision);
				return "completed" as const;
			},
		});
	}

	async #listRecoveriesRaw(
		requestedCategory?: DataFileCategory,
	): Promise<StorageRecoveryCandidate[]> {
		const candidates: StorageRecoveryCandidate[] = [];
		const categories = requestedCategory
			? [requestedCategory]
			: DATA_FILE_CATEGORIES;
		for (const category of categories) {
			for (const stored of await this.#listCategory(category)) {
				const source = recoverySource(stored.name, category);
				const fileName = recoveredFileName(stored.name, category);
				if (!source || !fileName) continue;
				const file = normalizeReference({ category, fileName });
				if (source === "backup" && (await pathExists(pathFor(file)))) continue;
				if (source === "backup" && (await pathExists(temporaryPath(file))))
					continue;
				candidates.push({
					category,
					recoveryKey: recoveryKey(file, source),
					fileName,
					recoverySource: source,
					oldBytes: await readBytes(recoveryPath(file, source)),
					newBytes: (await pathExists(pathFor(file)))
						? await readBytes(pathFor(file))
						: undefined,
				});
			}
		}
		return candidates;
	}

	async #readRecoveryCandidateRaw(
		key: string,
	): Promise<StorageRecoveryCandidate | undefined> {
		const { file, source } = recoveryReferenceFromKey(key);
		const storedRecoveryPath = recoveryPath(file, source);
		if (!(await pathExists(storedRecoveryPath))) return undefined;
		return {
			category: file.category,
			recoveryKey: key,
			fileName: file.fileName,
			recoverySource: source,
			oldBytes: await readBytes(storedRecoveryPath),
			newBytes: (await pathExists(pathFor(file)))
				? await readBytes(pathFor(file))
				: undefined,
		};
	}

	async #resolveRecoveryRaw(
		key: string,
		resolution: StorageRecoveryResolution,
	): Promise<void> {
		const { file, source } = recoveryReferenceFromKey(key);
		await resolveRecoveryBytes(
			file,
			resolution,
			source,
			resolution === "keepBoth" ? await firstFreeRestoredPath(file) : undefined,
		);
	}

	async #listCategory(category: DataFileCategory) {
		try {
			return (
				await Filesystem.readdir({
					path: categoryDirectory(category),
					directory: Directory.Data,
				})
			).files.filter((file) => file.type === "file");
		} catch (error) {
			if (isMissingError(error)) return [];
			throw error;
		}
	}
}

export function capacitorBundleUrl(relativePath: string): string {
	validateSeedPath(relativePath);
	return new URL(
		`native-seed/${relativePath.split("/").map(encodeURIComponent).join("/")}`,
		document.baseURI,
	).toString();
}

function categoryDirectory(category: DataFileCategory): string {
	return category === "library" ? APP_ROOT : `${APP_ROOT}/${category}`;
}

function pathFor(file: DataFileReference): string {
	return `${categoryDirectory(file.category)}/${file.fileName}`;
}

function backupPath(file: DataFileReference): string {
	return pathFor(file).replace(/\.json$/, ".backup.json");
}

async function finishChangedFileWrite(
	previousFile: DataFileReference,
	targetFile: DataFileReference,
	keepBackup: boolean,
): Promise<void> {
	const previousPrimary = pathFor(previousFile);
	if (keepBackup && (await pathExists(previousPrimary))) {
		await deleteIfExists(backupPath(targetFile));
		await Filesystem.rename({
			from: previousPrimary,
			to: backupPath(targetFile),
			directory: Directory.Data,
		});
	} else {
		await deleteIfExists(previousPrimary);
	}
	await deleteIfExists(backupPath(previousFile));
	await deleteIfExists(temporaryPath(previousFile));
}

function temporaryPath(file: DataFileReference): string {
	return pathFor(file).replace(/\.json$/, ".temp.json");
}

class NativeWriteRecoveryError extends Error {
	constructor(
		cause: unknown,
		readonly kind: "newFile" | "overwrite",
	) {
		super(
			kind === "overwrite"
				? "Die neue Datei konnte nicht sicher geschrieben werden. Die alte Datei wurde zur Wiederherstellung aufbewahrt."
				: "Die neue Datei konnte nicht sicher geschrieben und gegengelesen werden.",
			{ cause },
		);
		this.name = "NativeWriteRecoveryError";
	}
}

class NativeTargetExistsError extends Error {
	constructor(fileName: string) {
		super(`Datei "${fileName}" existiert bereits.`);
		this.name = "NativeTargetExistsError";
	}
}

async function writeBytesWithRecovery(
	bytes: Uint8Array,
	options: {
		file: DataFileReference;
		createOnly?: boolean;
		backup: boolean;
		overwriteExisting: boolean;
		retryIncompleteNewFile: boolean;
	},
): Promise<void> {
	const target = pathFor(options.file);
	const targetExists = await pathExists(target);
	if (
		targetExists &&
		options.createOnly &&
		!options.overwriteExisting &&
		!options.retryIncompleteNewFile
	)
		throw new NativeTargetExistsError(options.file.fileName);

	if (
		targetExists &&
		!options.retryIncompleteNewFile &&
		(!options.createOnly || options.overwriteExisting)
	) {
		await overwriteBytesWithRecovery(bytes, options.file, options.backup);
		return;
	}

	try {
		await writeAndVerify(target, bytes);
	} catch (error) {
		throw new NativeWriteRecoveryError(error, "newFile");
	}
}

async function overwriteBytesWithRecovery(
	bytes: Uint8Array,
	file: DataFileReference,
	keepBackup: boolean,
): Promise<void> {
	const target = pathFor(file);
	const temporary = temporaryPath(file);
	let hasRecoverableOldFile = await pathExists(temporary);
	if (!hasRecoverableOldFile && (await pathExists(target))) {
		await renamePath(target, temporary);
		hasRecoverableOldFile = true;
	}
	try {
		await writeAndVerify(target, bytes);
	} catch (error) {
		throw new NativeWriteRecoveryError(
			error,
			hasRecoverableOldFile ? "overwrite" : "newFile",
		);
	}
	if (!hasRecoverableOldFile) return;
	if (keepBackup) {
		await deleteIfExists(backupPath(file));
		await renamePath(temporary, backupPath(file));
	} else {
		await deleteIfExists(temporary);
	}
}

async function writeAndVerify(path: string, bytes: Uint8Array): Promise<void> {
	await writeBytes(path, bytes);
	const verified = await readBytes(path);
	if (!sameBytes(bytes, verified))
		throw new InternalStorageError(
			"Geschriebene Datei konnte nicht verifiziert werden.",
		);
}

async function resolveRecoveryBytes(
	file: DataFileReference,
	resolution: StorageRecoveryResolution,
	source: RecoverySource = "temporary",
	restoredPath?: string,
): Promise<void> {
	const storedRecoveryPath = recoveryPath(file, source);
	if (!(await pathExists(storedRecoveryPath)))
		throw new Error("Die alte Wiederherstellungsdatei existiert nicht mehr.");
	if (resolution === "keepOld") {
		await deleteIfExists(pathFor(file));
		await renamePath(storedRecoveryPath, pathFor(file));
		return;
	}
	if (!(await pathExists(pathFor(file))))
		throw new Error("Die neue Datei existiert nicht.");
	if (resolution === "keepNew") {
		await deleteIfExists(storedRecoveryPath);
		return;
	}
	if (!restoredPath)
		throw new Error("Für beide Dateien fehlt ein Wiederherstellungsname.");
	await renamePath(storedRecoveryPath, restoredPath);
}

function recoveryKey(
	file: DataFileReference,
	source: RecoverySource = "temporary",
): string {
	return `${file.category}:${encodeURIComponent(file.fileName)}${source === "backup" ? ":backup" : ""}`;
}

function recoveryReferenceFromKey(key: string): {
	file: DataFileReference;
	source: RecoverySource;
} {
	const [category, encodedFileName, ...rest] = key.split(":");
	if (
		(rest.length > 0 && !(rest.length === 1 && rest[0] === "backup")) ||
		!encodedFileName ||
		!isDataFileCategory(category)
	)
		throw new Error("Ungültiger Recovery-Schlüssel.");
	return {
		file: normalizeReference({
			category,
			fileName: decodeURIComponent(encodedFileName),
		}),
		source: rest[0] === "backup" ? "backup" : "temporary",
	};
}

function recoveryPath(file: DataFileReference, source: RecoverySource): string {
	return source === "backup" ? backupPath(file) : temporaryPath(file);
}

function recoverySource(
	storedName: string,
	category: DataFileCategory,
): RecoverySource | undefined {
	if (recoveredFileNameForSuffix(storedName, category, ".temp.json"))
		return "temporary";
	if (recoveredFileNameForSuffix(storedName, category, ".backup.json"))
		return "backup";
	return undefined;
}

function recoveredFileName(
	storedName: string,
	category: DataFileCategory,
): string | undefined {
	return (
		recoveredFileNameForSuffix(storedName, category, ".temp.json") ??
		recoveredFileNameForSuffix(storedName, category, ".backup.json")
	);
}

function recoveredFileNameForSuffix(
	storedName: string,
	category: DataFileCategory,
	suffix: ".temp.json" | ".backup.json",
): string | undefined {
	if (!storedName.endsWith(suffix)) return undefined;
	const fileName = `${storedName.slice(0, -suffix.length)}.json`;
	return isAllowedFileName(fileName, category) ? fileName : undefined;
}

async function firstFreeRestoredPath(file: DataFileReference): Promise<string> {
	for (let restoredIndex = 1; ; restoredIndex += 1) {
		const suffix =
			restoredIndex === 1 ? ".restored" : `.restored_${restoredIndex}`;
		const candidate = pathFor(file).replace(/\.json$/, `${suffix}.json`);
		if (!(await pathExists(candidate))) return candidate;
	}
}

function sameRecoveryCandidate(
	left: StorageRecoveryCandidate,
	right: StorageRecoveryCandidate,
): boolean {
	return (
		left.recoveryKey === right.recoveryKey &&
		left.recoverySource === right.recoverySource &&
		sameBytes(left.oldBytes, right.oldBytes) &&
		(left.newBytes === undefined
			? right.newBytes === undefined
			: right.newBytes !== undefined &&
				sameBytes(left.newBytes, right.newBytes))
	);
}

function isDataFileCategory(value: string): value is DataFileCategory {
	return DATA_FILE_CATEGORIES.includes(value as DataFileCategory);
}

function normalizeReference(file: DataFileReference): DataFileReference {
	if (!DATA_FILE_CATEGORIES.includes(file.category))
		throw new Error("Ungültige Datei-Kategorie.");
	if (!isNormalJsonFileName(file.fileName, file.category))
		throw new Error("Ungültiger Dateiname.");
	if (file.category === "library" && file.fileName !== "library.json")
		throw new Error("Die Library-Kategorie erlaubt nur library.json.");
	return file;
}

function normalizeRenameReference(file: DataFileReference): DataFileReference {
	if (file.category !== "game" && file.category !== "template")
		throw new Error("Umbenennen wird nur für Spiele und Vorlagen unterstützt.");
	if (!isAllowedFileName(file.fileName, file.category))
		throw new Error("Ungültiger Dateiname.");
	return file;
}

function isNormalJsonFileName(
	fileName: string,
	category: DataFileCategory,
): boolean {
	return (
		isAllowedFileName(fileName, category) &&
		!fileName.endsWith(".backup.json") &&
		!fileName.endsWith(".temp.json")
	);
}

function isAllowedFileName(
	fileName: string,
	category: DataFileCategory,
): boolean {
	return (
		fileName.length > 5 &&
		fileName.endsWith(".json") &&
		!/[<>:"/\\|?*]/.test(fileName) &&
		![...fileName].some((character) => character.charCodeAt(0) < 32) &&
		(category !== "library" || fileName === "library.json")
	);
}

async function readBytes(path: string): Promise<Uint8Array> {
	const { data } = await Filesystem.readFile({
		path,
		directory: Directory.Data,
	});
	if (typeof data !== "string") return new Uint8Array(await data.arrayBuffer());
	return fromBase64(data);
}

async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
	await Filesystem.writeFile({
		path,
		data: toBase64(bytes),
		directory: Directory.Data,
		recursive: true,
	});
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await Filesystem.stat({ path, directory: Directory.Data });
		return true;
	} catch (error) {
		if (isMissingError(error)) return false;
		throw error;
	}
}

async function deleteIfExists(path: string): Promise<void> {
	try {
		await Filesystem.deleteFile({ path, directory: Directory.Data });
	} catch (error) {
		if (!isMissingError(error)) throw error;
	}
}

async function renamePath(from: string, to: string): Promise<void> {
	await Filesystem.rename({ from, to, directory: Directory.Data });
}

function isMissingError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /not found|does not exist|nicht gefunden|ENOENT/i.test(message);
}

function isAbortError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		error.name === "AbortError"
	);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
	return (
		left.byteLength === right.byteLength &&
		left.every((value, index) => value === right[index])
	);
}

function toBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += 0x8000)
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
	return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
	return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function isSeedManifest(value: unknown): value is SeedManifest {
	return (
		typeof value === "object" &&
		value !== null &&
		"files" in value &&
		Array.isArray(value.files) &&
		value.files.every((file) => typeof file === "string")
	);
}

function validateSeedPath(value: string): void {
	if (
		!value ||
		value.startsWith("/") ||
		value.includes("\\") ||
		value.split("/").some((part) => !part || part === "." || part === "..")
	)
		throw new Error("Ungültiger Pfad im mitgelieferten Datenbestand.");
}
