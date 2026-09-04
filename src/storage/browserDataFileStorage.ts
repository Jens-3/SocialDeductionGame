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
	isStorageOperationError,
	type StorageFailureReason,
	type StorageOperation,
	type StorageOperationResult,
	storageFailure,
	storageFailureCapabilities,
} from "../persistence/ports/storageFailure";
import type {
	RecoverySource,
	StorageRecoveryCandidate,
	StorageRecoveryPort,
	StorageRecoveryRequestResult,
} from "../persistence/ports/storageRecovery";
import {
	classifyStorageFailureReason,
	externalErrorDiagnostic,
	sanitizeExternalDiagnostic,
} from "./storageError";

const DATA_FILES_API_PATH = "/api/dev/data-files";

async function fetchStorage(
	input: RequestInfo | URL,
	init: RequestInit | undefined,
	operation: StorageOperation,
	context: {
		category?: DataFileCategory;
		file?: DataFileReference;
		targetFile?: DataFileReference;
	} = {},
): Promise<Response> {
	try {
		return init ? await fetch(input, init) : await fetch(input);
	} catch (error) {
		if (isAbortError(error)) throw error;
		const reason = classifyStorageFailureReason(error, "storageUnavailable");
		const diagnostic = externalErrorDiagnostic(error);
		throw storageFailure(operation, reason, {
			...context,
			...(diagnostic ? { diagnostic } : {}),
		});
	}
}

export class BrowserDataFileStorage
	implements
		InternalDataFileReadPort,
		InternalDataFileWritePort,
		ExternalDataFileReadPort,
		ExternalDataFileWritePort,
		StorageRecoveryPort,
		InternalStorageCommandPort
{
	async listInternalFileNames(
		category: StandaloneDataFileCategory,
	): Promise<string[]> {
		const query = new URLSearchParams({ category, names: "1" });
		const response = await fetchStorage(
			`${DATA_FILES_API_PATH}?${query}`,
			undefined,
			"list",
			{ category },
		);
		if (!response.ok) throw await responseError(response, "list", { category });
		const value = (await response.json()) as unknown;
		if (
			!Array.isArray(value) ||
			!value.every((entry) => typeof entry === "string")
		)
			throw storageFailure("list", "storageUnavailable", {
				category,
			});
		return value;
	}
	async listInternalFiles(
		category: DataFileCategory,
	): Promise<StoredFileMetadata[]> {
		const query = new URLSearchParams({ category, metadata: "1" });
		const response = await fetchStorage(
			`${DATA_FILES_API_PATH}?${query}`,
			undefined,
			"list",
			{ category },
		);
		if (!response.ok) throw await responseError(response, "list", { category });
		const value = (await response.json()) as unknown;
		if (!Array.isArray(value) || !value.every(isStoredFileMetadata))
			throw storageFailure("list", "storageUnavailable", {
				category,
			});
		return value;
	}
	async readAllInternal(
		category: DataFileCategory,
	): Promise<StoredByteDocument[]> {
		const response = await fetchStorage(
			`${DATA_FILES_API_PATH}?${new URLSearchParams({ category })}`,
			undefined,
			"read",
			{ category },
		);
		if (!response.ok) throw await responseError(response, "read", { category });
		const value = (await response.json()) as unknown;
		if (!Array.isArray(value) || !value.every(isEncodedStoredDocument))
			throw storageFailure("read", "storageUnavailable", {
				category,
			});
		return value.map(({ category: storedCategory, fileName, bytesBase64 }) => ({
			category: storedCategory,
			fileName,
			bytes: decodeBase64(bytesBase64),
		}));
	}

	async readInternal(
		file: DataFileReference,
		version: DataFileVersion = "primary",
	): Promise<DataFileReadResult> {
		let response: Response;
		try {
			response = await fetchStorage(
				`${dataFileUrl(file)}&version=${version}`,
				undefined,
				"read",
				{ file },
			);
		} catch (error) {
			if (isStorageOperationError(error))
				return { status: "error", error: error.failure };
			const reason = classifyStorageFailureReason(error, "storageUnavailable");
			const diagnostic = externalErrorDiagnostic(error);
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
		if (response.ok)
			return {
				status: "success",
				bytes: new Uint8Array(await response.arrayBuffer()),
			};
		const result = await readDataFileResult(response, file);
		if (result) return result;
		throw await responseError(response, "read", { file });
	}

	async writeInternal(
		file: DataFileReference,
		bytes: Uint8Array,
		options: DataFileWriteOptions,
	): Promise<void> {
		const query = fileQuery(file);
		if (options.createOnly) query.set("createOnly", "1");
		if (options.backup) query.set("backup", "1");
		if (options.previousFile) {
			query.set("previousFileName", options.previousFile.fileName);
			query.set("previousCategory", options.previousFile.category);
		}
		const response = await fetchStorage(
			`${DATA_FILES_API_PATH}?${query}`,
			{
				method: "PUT",
				body: bytes.slice().buffer,
			},
			"write",
			{ file },
		);
		if (!response.ok) {
			const error = await readStorageError(response);
			if (error.code === "FILE_WRITE_RECOVERY_REQUIRED")
				throw new RecoverableStorageWriteError(
					undefined,
					error.commandId,
					recoverableWriteReason(error.reason),
					file,
					error.message,
				);
			throw storageFailure(
				"write",
				responseFailureReason(
					error.reason,
					error.message,
					"storageUnavailable",
				),
				{
					file,
					...(error.message ? { diagnostic: error.message } : {}),
				},
			);
		}
	}

	async deleteInternal(
		file: DataFileReference,
		options: { includeBackup?: boolean; includeRecovery?: boolean } = {},
	): Promise<void> {
		const query = fileQuery(file);
		if (options.includeBackup) query.set("includeBackup", "1");
		if (options.includeRecovery) query.set("includeRecovery", "1");
		const response = await fetchStorage(
			`${DATA_FILES_API_PATH}?${query}`,
			{ method: "DELETE" },
			"delete",
			{ file },
		);
		if (!response.ok) throw await responseError(response, "delete", { file });
	}

	async renameInternal(
		oldFile: DataFileReference,
		newFile: DataFileReference,
	): Promise<void> {
		const query = fileQuery(oldFile);
		query.set("newFileName", newFile.fileName);
		query.set("newCategory", newFile.category);
		const response = await fetchStorage(
			`${DATA_FILES_API_PATH}?${query}`,
			{ method: "PATCH" },
			"rename",
			{ file: oldFile, targetFile: newFile },
		);
		if (!response.ok)
			throw await responseError(response, "rename", {
				file: oldFile,
				targetFile: newFile,
			});
	}

	async listRecoveries(
		category?: DataFileCategory,
	): Promise<StorageRecoveryCandidate[]> {
		const query = category ? `?category=${encodeURIComponent(category)}` : "";
		const response = await fetchStorage(
			`/api/dev/storage-recoveries${query}`,
			undefined,
			"list",
			category ? { category } : {},
		);
		if (!response.ok)
			throw await responseError(response, "list", category ? { category } : {});
		const value = (await response.json()) as unknown;
		if (!Array.isArray(value) || !value.every(isEncodedRecoveryCandidate))
			throw storageFailure("list", "storageUnavailable", {
				...(category ? { category } : {}),
			});
		return value.map(
			({
				category,
				recoveryKey,
				fileName,
				recoverySource,
				oldBytesBase64,
				newBytesBase64,
			}) => ({
				category,
				recoveryKey,
				fileName,
				...(recoverySource ? { recoverySource } : {}),
				oldBytes: decodeBase64(oldBytesBase64),
				newBytes: newBytesBase64 ? decodeBase64(newBytesBase64) : undefined,
			}),
		);
	}

	async requestRecovery(
		recoveryKey: string,
	): Promise<StorageRecoveryRequestResult> {
		const query = new URLSearchParams({ recoveryKey });
		const response = await fetchStorage(
			`/api/dev/storage-recoveries?${query}`,
			{ method: "POST" },
			"read",
		);
		if (!response.ok) throw await responseError(response, "read");
		const value = (await response.json()) as unknown;
		if (isDiscardedRecoveryRequest(value)) return value;
		if (!isEncodedRecoveryRequest(value))
			throw storageFailure("read", "storageUnavailable");
		return {
			status: "decisionRequired",
			commandId: value.commandId,
			candidate: decodeRecoveryCandidate(value.candidate),
		};
	}

	async continueInternalCommand(
		commandId: string,
		decision: StorageCommandDecision,
		continuation?: StorageCommandContinuation,
	): Promise<"completed" | "discarded"> {
		const operation = storageOperationForCommandDecision(decision);
		const query = new URLSearchParams({ commandId, decision });
		if (continuation) {
			query.set("continuation", "1");
			query.set("category", continuation.file.category);
			query.set("fileName", continuation.file.fileName);
		}
		const response = await fetchStorage(
			`/api/dev/storage-command?${query}`,
			{
				method: "PATCH",
				body: continuation?.bytes.slice().buffer,
			},
			operation,
			continuation ? { file: continuation.file } : {},
		);
		if (!response.ok)
			throw await responseError(
				response,
				operation,
				continuation ? { file: continuation.file } : {},
			);
		const value = (await response.json()) as { status?: unknown };
		if (value.status !== "completed" && value.status !== "discarded")
			throw storageFailure(operation, "storageUnavailable");
		return value.status;
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
		options: { suggestedFileName: string; description?: string },
	): Promise<void | StorageOperationResult<void>> {
		const picker = (
			window as Window & {
				showSaveFilePicker?: (pickerOptions: {
					suggestedName: string;
					types: Array<{
						description: string;
						accept: Record<string, string[]>;
					}>;
				}) => Promise<{
					createWritable(): Promise<{
						write(data: ArrayBuffer): Promise<void>;
						close(): Promise<void>;
					}>;
				}>;
			}
		).showSaveFilePicker;
		if (!picker) throw storageFailure("export", "unsupported");
		try {
			const handle = await picker.call(window, {
				suggestedName: options.suggestedFileName,
				types: [
					{
						description: options.description ?? "JSON-Datei",
						accept: { "application/json": [".json"] },
					},
				],
			});
			const writable = await handle.createWritable();
			await writable.write(bytes.slice().buffer);
			await writable.close();
		} catch (error) {
			if (isAbortError(error)) return { status: "cancelled" };
			const reason = classifyStorageFailureReason(error, "storageUnavailable");
			const diagnostic = externalErrorDiagnostic(error);
			throw storageFailure("export", reason, {
				...(diagnostic ? { diagnostic } : {}),
			});
		}
	}
}

function storageOperationForCommandDecision(
	decision: StorageCommandDecision,
): StorageOperation {
	switch (decision) {
		case "keepOld":
		case "keepBoth":
			return "rename";
		case "keepNew":
			return "delete";
		case "retry":
		case "overwrite":
			return "write";
		// Diese Entscheidungen schließen den unterbrochenen Schreibbefehl ab;
		// eine persistente Recovery-Auflösung verwendet dagegen die Fälle oben.
		case "cancel":
		case "finishLater":
			return "write";
	}
}

function fileQuery(file: DataFileReference): URLSearchParams {
	return new URLSearchParams({
		category: file.category,
		fileName: file.fileName,
	});
}

function dataFileUrl(file: DataFileReference): string {
	return `${DATA_FILES_API_PATH}?${fileQuery(file)}`;
}

async function responseError(
	response: Response,
	operation: StorageOperation,
	context: {
		category?: DataFileCategory;
		file?: DataFileReference;
		targetFile?: DataFileReference;
	} = {},
): Promise<Error> {
	const error = await readStorageError(response);
	if (error.code === "FILE_WRITE_RECOVERY_REQUIRED")
		return new RecoverableStorageWriteError(
			undefined,
			error.commandId,
			recoverableWriteReason(error.reason),
			context.file,
			error.message,
		);
	return storageFailure(
		operation,
		responseFailureReason(error.reason, error.message, "storageUnavailable"),
		{
			...context,
			...(error.message ? { diagnostic: error.message } : {}),
		},
	);
}

function responseFailureReason(
	reason: string | undefined,
	diagnostic: string | undefined,
	fallback: StorageFailureReason,
): StorageFailureReason {
	if (
		reason === "notFound" ||
		reason === "permissionDenied" ||
		reason === "unreadable" ||
		reason === "storageUnavailable" ||
		reason === "diskFull" ||
		reason === "writeFailure" ||
		reason === "unsupported"
	)
		return reason;
	return classifyStorageFailureReason(
		diagnostic === undefined ? undefined : new Error(diagnostic),
		fallback,
	);
}

function recoverableWriteReason(
	reason: string | undefined,
): "diskFull" | "targetExists" | "writeFailure" {
	if (reason === "diskFull" || reason === "targetExists") return reason;
	return "writeFailure";
}

async function readStorageError(response: Response): Promise<{
	message?: string;
	code?: string;
	commandId?: string;
	reason?: string;
}> {
	try {
		const value = (await response.json()) as {
			error?: unknown;
			code?: unknown;
			commandId?: unknown;
			reason?: unknown;
		};
		return {
			message: sanitizeExternalDiagnostic(value.error),
			code: typeof value.code === "string" ? value.code : undefined,
			commandId:
				typeof value.commandId === "string" ? value.commandId : undefined,
			reason: typeof value.reason === "string" ? value.reason : undefined,
		};
	} catch {
		return {};
	}
}

function isEncodedStoredDocument(value: unknown): value is {
	category: DataFileCategory;
	fileName: string;
	bytesBase64: string;
} {
	return (
		typeof value === "object" &&
		value !== null &&
		"category" in value &&
		isDataFileCategory(value.category) &&
		"fileName" in value &&
		typeof value.fileName === "string" &&
		"bytesBase64" in value &&
		typeof value.bytesBase64 === "string"
	);
}

function isStoredFileMetadata(value: unknown): value is StoredFileMetadata {
	return (
		typeof value === "object" &&
		value !== null &&
		"category" in value &&
		isDataFileCategory(value.category) &&
		"fileName" in value &&
		typeof value.fileName === "string" &&
		(!("modifiedAt" in value) ||
			value.modifiedAt === undefined ||
			typeof value.modifiedAt === "number")
	);
}

function isEncodedRecoveryCandidate(value: unknown): value is {
	category: DataFileCategory;
	recoveryKey: string;
	fileName: string;
	recoverySource?: RecoverySource;
	oldBytesBase64: string;
	newBytesBase64?: string;
} {
	return (
		typeof value === "object" &&
		value !== null &&
		"category" in value &&
		isDataFileCategory(value.category) &&
		"recoveryKey" in value &&
		typeof value.recoveryKey === "string" &&
		"fileName" in value &&
		typeof value.fileName === "string" &&
		(!("recoverySource" in value) ||
			value.recoverySource === "temporary" ||
			value.recoverySource === "backup") &&
		"oldBytesBase64" in value &&
		typeof value.oldBytesBase64 === "string" &&
		(!("newBytesBase64" in value) || typeof value.newBytesBase64 === "string")
	);
}

type EncodedRecoveryCandidate = {
	category: DataFileCategory;
	recoveryKey: string;
	fileName: string;
	recoverySource?: RecoverySource;
	oldBytesBase64: string;
	newBytesBase64?: string;
};

function decodeRecoveryCandidate(
	value: EncodedRecoveryCandidate,
): StorageRecoveryCandidate {
	return {
		category: value.category,
		recoveryKey: value.recoveryKey,
		fileName: value.fileName,
		...(value.recoverySource ? { recoverySource: value.recoverySource } : {}),
		oldBytes: decodeBase64(value.oldBytesBase64),
		newBytes: value.newBytesBase64
			? decodeBase64(value.newBytesBase64)
			: undefined,
	};
}

function isDiscardedRecoveryRequest(
	value: unknown,
): value is { status: "discarded" } {
	return (
		typeof value === "object" &&
		value !== null &&
		"status" in value &&
		value.status === "discarded"
	);
}

function isEncodedRecoveryRequest(value: unknown): value is {
	status: "decisionRequired";
	commandId: string;
	candidate: EncodedRecoveryCandidate;
} {
	return (
		typeof value === "object" &&
		value !== null &&
		"status" in value &&
		value.status === "decisionRequired" &&
		"commandId" in value &&
		typeof value.commandId === "string" &&
		"candidate" in value &&
		isEncodedRecoveryCandidate(value.candidate)
	);
}

function isDataFileCategory(value: unknown): value is DataFileCategory {
	return (
		typeof value === "string" &&
		DATA_FILE_CATEGORIES.includes(value as DataFileCategory)
	);
}

function decodeBase64(value: string): Uint8Array {
	return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function isAbortError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		error.name === "AbortError"
	);
}

async function readDataFileResult(
	response: Response,
	file: DataFileReference,
): Promise<Exclude<DataFileReadResult, { status: "success" }> | undefined> {
	try {
		const value = (await response.clone().json()) as Record<string, unknown>;
		if (
			value.status === "error" &&
			typeof value.error === "object" &&
			value.error !== null &&
			"reason" in value.error &&
			(value.error.reason === "notFound" ||
				value.error.reason === "permissionDenied" ||
				value.error.reason === "unreadable" ||
				value.error.reason === "storageUnavailable")
		) {
			const diagnostic =
				"diagnostic" in value.error &&
				typeof value.error.diagnostic === "string"
					? sanitizeExternalDiagnostic(value.error.diagnostic)
					: undefined;
			return {
				status: "error",
				error: {
					source: "storage",
					operation: "read",
					reason: value.error.reason,
					...storageFailureCapabilities(value.error.reason),
					category: file.category,
					file,
					...(diagnostic ? { diagnostic } : {}),
				},
			};
		}
	} catch {
		// Kein strukturierter Lesezustand: Der allgemeine HTTP-Fehler folgt.
	}
	return undefined;
}
