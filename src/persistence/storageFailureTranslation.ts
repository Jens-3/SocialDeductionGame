import { parseInternalDocumentFileName } from "./internalDocumentFileName";
import {
	ObjectStorageError,
	type ObjectStorageOperation,
} from "./objectPersistenceError";
import { ObjectSaveInterruptedError } from "./objectSaveInterruptedError";
import type { StorageFailure } from "./ports/storageFailure";
import {
	StorageOperationConflictError,
	StorageOperationError,
	type StorageOperationResult,
} from "./ports/storageFailure";

export async function requireStorageOperationSuccess<T>(
	operation: Promise<T | StorageOperationResult<T>>,
	objectOperation: ObjectStorageOperation = "save",
): Promise<T> {
	const result = await operation;
	if (!isStorageOperationResult(result)) return result;
	if (result.status === "error") throw new StorageOperationError(result.error);
	if (result.status === "cancelled") {
		const error = new Error("Der Speichervorgang wurde abgebrochen.");
		error.name = "AbortError";
		throw error;
	}
	if (result.status === "conflict")
		throw translateStorageConflict(
			new StorageOperationConflictError(result),
			objectOperation,
		);
	return result.value;
}

function isStorageOperationResult<T>(
	value: T | StorageOperationResult<T>,
): value is StorageOperationResult<T> {
	return (
		typeof value === "object" &&
		value !== null &&
		"status" in value &&
		(value.status === "success" ||
			value.status === "cancelled" ||
			value.status === "conflict" ||
			value.status === "error")
	);
}

export function translateStorageFailure(
	failure: StorageFailure,
	operation: ObjectStorageOperation,
): ObjectStorageError {
	if (
		operation === "save" &&
		failure.reason === "writeFailure" &&
		failure.commandId
	)
		return new ObjectSaveInterruptedError(
			failure.diagnostic,
			failure.commandId,
			failure.reason,
			failure,
			failure.file,
		);
	return new ObjectStorageError(
		failure.diagnostic,
		operation,
		failure.retryable,
		failure.reason,
		failure,
		objectContextFromStorageFailure(failure),
		failure.repairable,
	);
}

export function translateStorageConflict(
	error: StorageOperationConflictError,
	operation: ObjectStorageOperation,
): ObjectStorageError {
	const { conflict } = error;
	if (operation === "save" && conflict.commandId)
		return new ObjectSaveInterruptedError(
			conflict.diagnostic,
			conflict.commandId,
			"targetExists",
			undefined,
			conflict.file ?? conflict.targetFile,
		);
	return new ObjectStorageError(
		conflict.diagnostic,
		operation,
		false,
		"targetExists",
		undefined,
		objectContextFromFile(conflict.file ?? conflict.targetFile),
	);
}

function objectContextFromStorageFailure(failure: StorageFailure):
	| {
			kind: "game" | "template" | "ruleSet";
			id?: string;
			storageKey?: string;
	  }
	| undefined {
	const category = failure.file?.category ?? failure.category;
	if (category === "library") return { kind: "ruleSet" };
	if (category !== "game" && category !== "template") return undefined;
	const parsed = failure.file
		? parseInternalDocumentFileName(category, failure.file.fileName)
		: undefined;
	return {
		kind: category,
		...(parsed ? { id: parsed.id, storageKey: parsed.storageKey } : {}),
	};
}

function objectContextFromFile(
	file: StorageOperationConflictError["conflict"]["file"],
):
	| {
			kind: "game" | "template" | "ruleSet";
			id?: string;
			storageKey?: string;
	  }
	| undefined {
	if (!file) return undefined;
	if (file.category === "library") return { kind: "ruleSet" };
	const parsed = parseInternalDocumentFileName(file.category, file.fileName);
	return {
		kind: file.category,
		...(parsed ? { id: parsed.id, storageKey: parsed.storageKey } : {}),
	};
}
