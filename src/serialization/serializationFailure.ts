export type SerializationOperation = "decode" | "encode" | "repair";

export type SerializationFailureReason =
	| "invalidJson"
	| "invalidDocument"
	| "unsupportedVersion"
	| "encodingFailure";

export type SerializationFailure = {
	source: "serialization";
	operation: SerializationOperation;
	reason: SerializationFailureReason;
	repairable: boolean;
	documentId?: string;
	componentKind?: "ruleSet";
	diagnostic?: string;
	details?: string;
};

export type SerializationResult<T> =
	| { status: "success"; value: T }
	| { status: "error"; error: SerializationFailure };

export class SerializationOperationError extends Error {
	readonly source = "serialization";

	constructor(readonly failure: SerializationFailure) {
		super(failure.diagnostic ?? failure.details);
		this.name = "SerializationOperationError";
	}
}

export function isSerializationOperationError(
	error: unknown,
): error is SerializationOperationError {
	return (
		error instanceof SerializationOperationError ||
		(typeof error === "object" &&
			error !== null &&
			"source" in error &&
			error.source === "serialization" &&
			"failure" in error)
	);
}

export function serializationFailure(
	operation: SerializationOperation,
	reason: SerializationFailureReason,
	repairable: boolean,
	diagnostic?: string,
	details?: string,
): SerializationOperationError {
	return new SerializationOperationError({
		source: "serialization",
		operation,
		reason,
		repairable,
		...(diagnostic ? { diagnostic } : {}),
		...(details ? { details } : {}),
	});
}

export function captureSerialization<T>(
	operation: () => T,
): SerializationResult<T> {
	try {
		return { status: "success", value: operation() };
	} catch (error) {
		if (!isSerializationOperationError(error)) throw error;
		return { status: "error", error: error.failure };
	}
}
