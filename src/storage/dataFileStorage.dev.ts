import { randomUUID } from "node:crypto";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import type {
	DataFileReadResult,
	DataFileVersion,
	DataFileWriteOptions,
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
	FileTargetExistsError,
	FileWriteRecoveryError,
	pathExists,
	readBytesDev,
	resolveRecoveryBytesDev,
	writeBytesDev,
} from "./fileByteStorage.dev";
import { internalStorageCommandQueue } from "./internalStorageCommandQueue";
import {
	classifyStorageFailureReason,
	externalErrorDiagnostic,
} from "./storageError";

const DATA_ROOT = "dev-data";

type PendingWriteState = {
	file: DataFileReference;
	bytes: Uint8Array;
	options: DataFileWriteOptions;
	overwriteExisting: boolean;
	retryIncompleteNewFile: boolean;
	failureKind?: "newFile" | "overwrite" | "targetExists";
};

export class DevDataFileStorage
	implements
		InternalDataFileReadPort,
		InternalDataFileWritePort,
		StorageRecoveryPort,
		InternalStorageCommandPort
{
	readonly #pendingRecoveryRequests = new Map<
		string,
		{ recoveryKey: string; candidate: StorageRecoveryCandidate }
	>();
	async listInternalFileNames(
		category: StandaloneDataFileCategory,
	): Promise<string[]> {
		return internalStorageCommandQueue.enqueue({
			key: `${category}:list-file-names`,
			execute: async () => {
				try {
					return (
						await readdir(categoryDirectory(category), { withFileTypes: true })
					)
						.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
						.map((entry) => entry.name)
						.sort((left, right) => left.localeCompare(right));
				} catch (error) {
					if (hasCode(error, "ENOENT")) return [];
					throw error;
				}
			},
		});
	}
	async listInternalFiles(
		category: DataFileCategory,
	): Promise<StoredFileMetadata[]> {
		return internalStorageCommandQueue.enqueue({
			key: `${category}:list-files`,
			execute: async () => {
				const directory = categoryDirectory(category);
				try {
					const fileNames = await readdir(directory);
					const files = fileNames.filter((fileName) =>
						isNormalJsonFileName(fileName, category),
					);
					return await Promise.all(
						files.map(async (fileName) => ({
							category,
							fileName,
							modifiedAt: (await stat(path.join(directory, fileName))).mtimeMs,
						})),
					);
				} catch (error) {
					if (hasCode(error, "ENOENT")) return [];
					throw error;
				}
			},
		});
	}
	async readAllInternal(
		category: DataFileCategory,
	): Promise<StoredByteDocument[]> {
		return internalStorageCommandQueue.enqueue({
			key: `${category}:read-all`,
			execute: () => this.#readAllInternalRaw(category),
		});
	}

	async #readAllInternalRaw(
		category: DataFileCategory,
	): Promise<StoredByteDocument[]> {
		const directory = categoryDirectory(category);
		try {
			const files = await readBytesDev({
				mode: "all",
				directoryPath: directory,
				acceptFile: (fileName) => isNormalJsonFileName(fileName, category),
			});
			return files.map(({ fileName, bytes }) => ({
				category,
				fileName,
				bytes,
			}));
		} catch (error) {
			if (hasCode(error, "ENOENT")) return [];
			throw error;
		}
	}

	async readInternal(
		file: DataFileReference,
		version: DataFileVersion = "primary",
	): Promise<DataFileReadResult> {
		const normalized = normalizeReference(file);
		return internalStorageCommandQueue.enqueue({
			key: `${recoveryKey(normalized)}:read:${version}`,
			execute: () => readFileResult(normalized, version),
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
		return internalStorageCommandQueue.enqueue({
			key: `${source.category}:rename:${source.fileName}:${target.fileName}`,
			execute: async () => {
				const sourcePath = primaryPath(source);
				const targetPath = primaryPath(target);
				if (await pathExists(targetPath))
					return {
						status: "conflict" as const,
						reason: "targetExists" as const,
						file: source,
						targetFile: target,
					};
				await rename(sourcePath, targetPath);
			},
		});
	}

	async writeInternal(
		file: DataFileReference,
		bytes: Uint8Array,
		options: DataFileWriteOptions,
	): Promise<void> {
		const normalized = normalizeReference(file);
		const key = recoveryKey(normalized);
		const state: PendingWriteState = {
			file: normalized,
			bytes,
			options,
			overwriteExisting: false,
			retryIncompleteNewFile: false,
		};
		return internalStorageCommandQueue.enqueue({
			key: `${key}:write`,
			recoveryKey: key,
			execute: () => this.#writeInternalRaw(state),
			recover: (decision, continuation) =>
				this.#continueWriteRaw(state, decision, continuation),
		});
	}

	async #writeInternalRaw(state: PendingWriteState): Promise<void> {
		const { file, bytes, options } = state;
		const targetPath = primaryPath(file);
		const previousFile = options.previousFile
			? normalizeReference(options.previousFile)
			: undefined;
		if (previousFile && previousFile.category !== file.category)
			throw new Error(
				"Dateien können nur innerhalb einer Kategorie ersetzt werden.",
			);
		const changesFile =
			previousFile !== undefined && previousFile.fileName !== file.fileName;
		await mkdir(path.dirname(targetPath), { recursive: true });
		try {
			await writeBytesDev(bytes, {
				targetPath,
				createOnly: changesFile ? true : options.createOnly,
				recoveryPath: temporaryPath(file),
				...(!changesFile && options.backup
					? { backupPath: backupPath(file) }
					: {}),
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
			if (error instanceof FileWriteRecoveryError) {
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
			if (error instanceof FileTargetExistsError) {
				state.failureKind = "targetExists";
				throw new RecoverableStorageWriteError(
					error.message,
					undefined,
					"targetExists",
					file,
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
				await rm(primaryPath(state.file), { force: true });
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
		const recovery = temporaryPath(file);
		if (await pathExists(recovery)) {
			await resolveRecoveryBytesDev({
				targetPath: primaryPath(file),
				recoveryPath: recovery,
				resolution: "keepOld",
			});
			return;
		}
		await rm(primaryPath(file), { force: true });
	}

	async deleteInternal(
		file: DataFileReference,
		options: { includeBackup?: boolean; includeRecovery?: boolean } = {},
	): Promise<void> {
		const normalized = normalizeReference(file);
		return internalStorageCommandQueue.enqueue({
			key: `${recoveryKey(normalized)}:delete`,
			execute: async () => {
				await rm(primaryPath(normalized), { force: true });
				if (options.includeBackup)
					await rm(backupPath(normalized), { force: true });
				if (options.includeRecovery)
					await rm(temporaryPath(normalized), { force: true });
			},
		});
	}

	async listRecoveries(
		requestedCategory?: DataFileCategory,
	): Promise<StorageRecoveryCandidate[]> {
		const candidates: StorageRecoveryCandidate[] = [];
		const categories = requestedCategory
			? [requestedCategory]
			: DATA_FILE_CATEGORIES;
		for (const category of categories) {
			const directory = categoryDirectory(category);
			try {
				const files = await readBytesDev({
					mode: "all",
					directoryPath: directory,
					acceptFile: (fileName) =>
						recoveryFileName(fileName, category) !== undefined ||
						backupFileName(fileName, category) !== undefined,
				});
				for (const { fileName: storedName, bytes: oldBytes } of files) {
					const source = backupFileName(storedName, category)
						? "backup"
						: "temporary";
					const fileName =
						recoveryFileName(storedName, category) ??
						backupFileName(storedName, category);
					if (!fileName) continue;
					const file = normalizeReference({ category, fileName });
					const target = primaryPath(file);
					if (source === "backup" && (await pathExists(target))) continue;
					if (source === "backup" && (await pathExists(temporaryPath(file))))
						continue;
					candidates.push({
						category,
						recoveryKey: recoveryKey(file, source),
						fileName,
						recoverySource: source,
						oldBytes,
						newBytes: (await pathExists(target))
							? await readBytesDev({ mode: "single", filePath: target })
							: undefined,
					});
				}
			} catch (error) {
				if (!hasCode(error, "ENOENT")) throw error;
			}
		}
		return candidates;
	}

	async requestRecovery(key: string): Promise<StorageRecoveryRequestResult> {
		const candidate = await internalStorageCommandQueue.enqueue({
			key: `${key}:request-recovery`,
			execute: () => this.#readRecoveryCandidateRaw(key),
		});
		if (!candidate) return { status: "discarded" };
		const commandId = randomUUID();
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
		if (
			await internalStorageCommandQueue.continue(
				commandId,
				decision,
				continuation,
			)
		)
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
		return internalStorageCommandQueue.enqueue({
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

	async #readRecoveryCandidateRaw(
		key: string,
	): Promise<StorageRecoveryCandidate | undefined> {
		const file = referenceFromRecoveryKey(key);
		const recoveryPath = recoveryPathFromKey(key, file);
		if (!(await pathExists(recoveryPath))) return undefined;
		const target = primaryPath(file);
		return {
			category: file.category,
			recoveryKey: key,
			fileName: file.fileName,
			recoverySource: key.endsWith(":backup") ? "backup" : "temporary",
			oldBytes: await readBytesDev({ mode: "single", filePath: recoveryPath }),
			newBytes: (await pathExists(target))
				? await readBytesDev({ mode: "single", filePath: target })
				: undefined,
		};
	}

	async #resolveRecoveryRaw(
		key: string,
		resolution: StorageRecoveryResolution,
	): Promise<void> {
		const file = referenceFromRecoveryKey(key);
		await resolveRecoveryBytesDev({
			targetPath: primaryPath(file),
			recoveryPath: recoveryPathFromKey(key, file),
			resolution,
			restoredPath:
				resolution === "keepBoth"
					? await firstFreeRestoredPath(file)
					: undefined,
		});
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

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
	return (
		left.byteLength === right.byteLength &&
		left.every((value, index) => value === right[index])
	);
}

function categoryDirectory(category: DataFileCategory): string {
	return path.resolve(
		process.cwd(),
		DATA_ROOT,
		...(category === "library" ? [] : [category]),
	);
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
	if (
		path.basename(file.fileName) !== file.fileName ||
		!file.fileName.endsWith(".json") ||
		file.fileName.includes("\0")
	)
		throw new Error("Ungültiger Dateiname.");
	return file;
}

function primaryPath(file: DataFileReference): string {
	return path.join(categoryDirectory(file.category), file.fileName);
}

function backupPath(file: DataFileReference): string {
	return primaryPath(file).replace(/\.json$/, ".backup.json");
}

async function finishChangedFileWrite(
	previousFile: DataFileReference,
	targetFile: DataFileReference,
	keepBackup: boolean,
): Promise<void> {
	const previousPrimary = primaryPath(previousFile);
	if (keepBackup && (await pathExists(previousPrimary))) {
		await rm(backupPath(targetFile), { force: true });
		await rename(previousPrimary, backupPath(targetFile));
	} else {
		await rm(previousPrimary, { force: true });
	}
	await rm(backupPath(previousFile), { force: true });
	await rm(temporaryPath(previousFile), { force: true });
}

function temporaryPath(file: DataFileReference): string {
	return primaryPath(file).replace(/\.json$/, ".temp.json");
}

function recoveryFileName(
	storedName: string,
	category: DataFileCategory,
): string | undefined {
	const base = storedName.match(/^(.+)\.temp\.json$/)?.[1];
	const fileName = base ? `${base}.json` : undefined;
	return fileName && isAllowedFileName(fileName, category)
		? fileName
		: undefined;
}

function backupFileName(
	storedName: string,
	category: DataFileCategory,
): string | undefined {
	const base = storedName.match(/^(.+)\.backup\.json$/)?.[1];
	const fileName = base ? `${base}.json` : undefined;
	return fileName && isAllowedFileName(fileName, category)
		? fileName
		: undefined;
}

function isAllowedFileName(
	storedFileName: string,
	category: DataFileCategory,
): boolean {
	return (
		path.basename(storedFileName) === storedFileName &&
		storedFileName.endsWith(".json") &&
		!/[<>:"/\\|?*]/.test(storedFileName) &&
		![...storedFileName].some((character) => character.charCodeAt(0) < 32) &&
		(category !== "library" || storedFileName === "library.json")
	);
}

function isNormalJsonFileName(
	storedFileName: string,
	category: DataFileCategory,
): boolean {
	return (
		isAllowedFileName(storedFileName, category) &&
		recoveryFileName(storedFileName, category) === undefined &&
		backupFileName(storedFileName, category) === undefined
	);
}

function recoveryKey(
	file: DataFileReference,
	source: RecoverySource = "temporary",
): string {
	return `${file.category}:${encodeURIComponent(file.fileName)}${source === "backup" ? ":backup" : ""}`;
}

function referenceFromRecoveryKey(key: string): DataFileReference {
	const [category, encodedFileName, ...rest] = key.split(":");
	if (
		(rest.length > 0 && !(rest.length === 1 && rest[0] === "backup")) ||
		!encodedFileName ||
		!isDataFileCategory(category)
	)
		throw new Error("Ungültiger Recovery-Schlüssel.");
	return normalizeReference({
		category,
		fileName: decodeURIComponent(encodedFileName),
	});
}

function recoveryPathFromKey(key: string, file: DataFileReference): string {
	return key.endsWith(":backup") ? backupPath(file) : temporaryPath(file);
}

function isDataFileCategory(value: string): value is DataFileCategory {
	return DATA_FILE_CATEGORIES.includes(value as DataFileCategory);
}

async function firstFreeRestoredPath(file: DataFileReference): Promise<string> {
	for (let restoredIndex = 1; ; restoredIndex += 1) {
		const suffix =
			restoredIndex === 1 ? ".restored" : `.restored_${restoredIndex}`;
		const candidate = primaryPath({
			...file,
			fileName: file.fileName.replace(/\.json$/, `${suffix}.json`),
		});
		if (!(await pathExists(candidate))) return candidate;
	}
}

function hasCode(error: unknown, code: string): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === code
	);
}

async function readFileResult(
	file: DataFileReference,
	version: DataFileVersion,
): Promise<DataFileReadResult> {
	try {
		return {
			status: "success",
			bytes: await readBytesDev({
				mode: "single",
				filePath: version === "backup" ? backupPath(file) : primaryPath(file),
			}),
		};
	} catch (error) {
		const diagnostic = externalErrorDiagnostic(error);
		const classifiedReason = classifyStorageFailureReason(
			error,
			"storageUnavailable",
		);
		if (classifiedReason === "notFound")
			return {
				status: "error",
				error: {
					source: "storage",
					operation: "read",
					reason: "notFound",
					...storageFailureCapabilities("notFound"),
					category: file.category,
					file,
					...(diagnostic ? { diagnostic } : {}),
				},
			};
		if (classifiedReason === "permissionDenied")
			return {
				status: "error",
				error: {
					source: "storage",
					operation: "read",
					reason: "permissionDenied",
					...storageFailureCapabilities("permissionDenied"),
					category: file.category,
					file,
					...(diagnostic ? { diagnostic } : {}),
				},
			};
		const reason = hasCode(error, "EISDIR") ? "unreadable" : classifiedReason;
		return {
			status: "error",
			error: {
				source: "storage",
				operation: "read",
				reason,
				...storageFailureCapabilities(reason),
				category: file.category,
				file,
				...(diagnostic ? { diagnostic } : {}),
			},
		};
	}
}
