import type { SerializationFailure } from "../serialization/serializationFailure";
import {
	ObjectSerializationError,
	type ObjectSerializationErrorContext,
} from "./objectPersistenceError";

export function translateSerializationFailure(
	failure: SerializationFailure,
	context?: ObjectSerializationErrorContext,
): ObjectSerializationError {
	return new ObjectSerializationError(
		failure.diagnostic,
		failure.operation,
		failure.repairable,
		failure.details,
		failure.reason,
		failure,
		context ??
			(failure.documentId
				? { kind: "ruleSet", id: failure.documentId }
				: undefined),
	);
}
