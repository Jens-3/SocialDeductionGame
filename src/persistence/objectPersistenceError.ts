import type {
	SerializationFailure,
	SerializationFailureReason,
} from "../serialization/serializationFailure";
import type {
	StorageFailure,
	StorageFailureReason,
} from "./ports/storageFailure";

export type ObjectStorageOperation =
	| "load"
	| "save"
	| "delete"
	| "import"
	| "export";

export type ObjectSerializationOperation = "decode" | "encode" | "repair";

export type ObjectStorageProblemReason =
	| "invalidFileName"
	| "interruptedWrite"
	| "orphanedRecovery"
	| "missingLibrary";

export type ObjectSerializationProblemReason =
	| "decodeFailed"
	| "invalidJson"
	| "invalidDocument";

export type ObjectPersistenceProblemReason =
	| ObjectStorageProblemReason
	| ObjectSerializationProblemReason;

export type ObjectStorageErrorReason =
	| ObjectStorageProblemReason
	| "targetExists"
	| "storageFailure"
	| StorageFailureReason;

export type ObjectSerializationErrorReason =
	| ObjectSerializationProblemReason
	| "serializationFailure"
	| SerializationFailureReason;

export type ObjectStorageErrorContext = {
	kind: "game" | "template" | "ruleSet";
	id?: string;
	storageKey?: string;
};

export type ObjectSerializationErrorContext = {
	kind: "game" | "template" | "ruleSet";
	id?: string;
};

export abstract class ObjectPersistenceError extends Error {
	abstract readonly kind: "storage" | "serialization";
}

export class ObjectStorageError extends ObjectPersistenceError {
	readonly kind = "storage";
	readonly code: string = "OBJECT_STORAGE_ERROR";

	constructor(
		readonly diagnostic: string | undefined,
		readonly operation: ObjectStorageOperation,
		readonly retryable: boolean,
		readonly reason: ObjectStorageErrorReason = "storageFailure",
		readonly storageFailure?: StorageFailure,
		readonly context?: ObjectStorageErrorContext,
		readonly repairable = false,
	) {
		super(diagnostic);
		this.name = "ObjectStorageError";
	}
}

export class ObjectSerializationError extends ObjectPersistenceError {
	readonly kind = "serialization";
	readonly code = "OBJECT_SERIALIZATION_ERROR";

	constructor(
		readonly diagnostic: string | undefined,
		readonly operation: ObjectSerializationOperation,
		readonly repairable: boolean,
		readonly details?: string,
		readonly reason: ObjectSerializationErrorReason = "serializationFailure",
		readonly serializationFailure?: SerializationFailure,
		readonly context?: ObjectSerializationErrorContext,
	) {
		super(diagnostic ?? details);
		this.name = "ObjectSerializationError";
	}
}

export function isObjectStorageError(
	error: unknown,
): error is ObjectStorageError {
	return (
		error instanceof ObjectStorageError ||
		(typeof error === "object" &&
			error !== null &&
			"kind" in error &&
			error.kind === "storage")
	);
}

export function isObjectSerializationError(
	error: unknown,
): error is ObjectSerializationError {
	return (
		error instanceof ObjectSerializationError ||
		(typeof error === "object" &&
			error !== null &&
			"kind" in error &&
			error.kind === "serialization")
	);
}

export function isObjectPersistenceProblemReason(
	reason: unknown,
): reason is ObjectPersistenceProblemReason {
	return (
		reason === "invalidFileName" ||
		reason === "interruptedWrite" ||
		reason === "orphanedRecovery" ||
		reason === "missingLibrary" ||
		reason === "decodeFailed" ||
		reason === "invalidJson" ||
		reason === "invalidDocument"
	);
}

export function getObjectPersistenceProblemReason(
	error: unknown,
): ObjectPersistenceProblemReason | undefined {
	if (!isObjectStorageError(error) && !isObjectSerializationError(error))
		return undefined;
	return isObjectPersistenceProblemReason(error.reason)
		? error.reason
		: undefined;
}
