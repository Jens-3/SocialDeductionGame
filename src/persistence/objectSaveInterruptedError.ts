import { ObjectStorageError } from "./objectPersistenceError";
import type { DataFileReference } from "./ports/dataFileTypes";
import type { StorageFailure } from "./ports/storageFailure";

export type ObjectSaveInterruptionReason =
	| "diskFull"
	| "writeFailure"
	| "targetExists";

/**
 * High-Level-Fehler für einen unterbrochenen Objekt-Speichervorgang.
 *
 * Application kann über die Command-ID eine fachliche Recovery-Entscheidung
 * treffen, ohne den zugrunde liegenden DataFileStorage-Fehler zu kennen.
 */
export class ObjectSaveInterruptedError extends ObjectStorageError {
	readonly code = "OBJECT_SAVE_INTERRUPTED";
	override readonly reason: ObjectSaveInterruptionReason;

	constructor(
		diagnostic: string | undefined,
		readonly commandId?: string,
		reason: ObjectSaveInterruptionReason = "writeFailure",
		storageFailure?: StorageFailure,
		readonly file?: DataFileReference,
	) {
		super(diagnostic, "save", true, reason, storageFailure);
		this.name = "ObjectSaveInterruptedError";
		this.reason = reason;
	}
}

export function isObjectSaveInterruptedError(
	error: unknown,
): error is ObjectSaveInterruptedError {
	return (
		error instanceof ObjectSaveInterruptedError ||
		(typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "OBJECT_SAVE_INTERRUPTED")
	);
}
