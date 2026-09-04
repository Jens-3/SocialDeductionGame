import type { DataFileCategory, DataFileReference } from "./dataFileTypes";

export type StorageOperation =
	| "initialize"
	| "list"
	| "read"
	| "write"
	| "delete"
	| "rename"
	| "import"
	| "export";

export type StorageFailureReason =
	| "notFound"
	| "permissionDenied"
	| "unreadable"
	| "storageUnavailable"
	| "diskFull"
	| "writeFailure"
	| "unsupported";

/**
 * Technischer Fehler an der Persistence→Storage-Grenze.
 * `file.category` beschreibt dabei bewusst den physischen Ablageort.
 */
export type StorageFailure = {
	source: "storage";
	operation: StorageOperation;
	reason: StorageFailureReason;
	retryable: boolean;
	repairable: boolean;
	category?: DataFileCategory;
	file?: DataFileReference;
	targetFile?: DataFileReference;
	commandId?: string;
	diagnostic?: string;
};

export type StorageOperationResult<T> =
	| { status: "success"; value: T }
	| { status: "cancelled" }
	| {
			status: "conflict";
			reason: "targetExists";
			file?: DataFileReference;
			targetFile?: DataFileReference;
			commandId?: string;
			diagnostic?: string;
	  }
	| { status: "error"; error: StorageFailure };

export class StorageOperationConflictError extends Error {
	readonly reason = "targetExists";

	constructor(
		readonly conflict: Extract<
			StorageOperationResult<unknown>,
			{ status: "conflict" }
		>,
	) {
		super(conflict.diagnostic);
		this.name = "StorageOperationConflictError";
	}
}

export function isStorageOperationConflictError(
	error: unknown,
): error is StorageOperationConflictError {
	return (
		error instanceof StorageOperationConflictError ||
		(typeof error === "object" &&
			error !== null &&
			"name" in error &&
			error.name === "StorageOperationConflictError" &&
			"conflict" in error)
	);
}

export class StorageOperationError extends Error {
	readonly source = "storage";

	constructor(readonly failure: StorageFailure) {
		super(failure.diagnostic);
		this.name = "StorageOperationError";
	}
}

export function isStorageOperationError(
	error: unknown,
): error is StorageOperationError {
	return (
		error instanceof StorageOperationError ||
		(typeof error === "object" &&
			error !== null &&
			"source" in error &&
			error.source === "storage" &&
			"failure" in error)
	);
}

export function storageFailure(
	operation: StorageOperation,
	reason: StorageFailureReason,
	options: Omit<
		StorageFailure,
		"source" | "operation" | "reason" | "retryable" | "repairable"
	> &
		Partial<Pick<StorageFailure, "retryable" | "repairable">> = {},
): StorageOperationError {
	return new StorageOperationError({
		source: "storage",
		operation,
		reason,
		...storageFailureCapabilities(reason),
		...options,
		...(options.category || !options.file
			? {}
			: { category: options.file.category }),
	});
}

export function storageFailureCapabilities(
	reason: StorageFailureReason,
): Pick<StorageFailure, "retryable" | "repairable"> {
	return {
		retryable: reason !== "notFound" && reason !== "unsupported",
		repairable: false,
	};
}

export function isStorageDiskFullError(error: unknown): boolean {
	let current = error;
	const visited = new Set<unknown>();
	for (let depth = 0; depth < 6 && current !== undefined; depth++) {
		if (visited.has(current)) return false;
		visited.add(current);
		if (hasDiskFullMarker(current)) return true;
		current =
			typeof current === "object" && current !== null && "cause" in current
				? current.cause
				: undefined;
	}
	return false;
}

function hasDiskFullMarker(error: unknown): boolean {
	if (typeof error !== "object" || error === null)
		return /no space left|disk full|datenträger voll|speicherplatz.*voll|quota exceeded/i.test(
			String(error),
		);
	const code =
		"code" in error && typeof error.code === "string" ? error.code : undefined;
	const name =
		"name" in error && typeof error.name === "string" ? error.name : undefined;
	const message =
		"message" in error && typeof error.message === "string"
			? error.message
			: undefined;
	return (
		code === "ENOSPC" ||
		code === "EDQUOT" ||
		name === "QuotaExceededError" ||
		(message !== undefined &&
			/no space left|disk full|datenträger voll|speicherplatz.*voll|quota exceeded/i.test(
				message,
			))
	);
}
