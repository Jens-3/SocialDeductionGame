import {
	ObjectPersistenceError,
	ObjectStorageError,
} from "./objectPersistenceError";
import { ObjectSaveInterruptedError } from "./objectSaveInterruptedError";
import { isRecoverableStorageWriteError } from "./ports/dataFileStorage";
import {
	isStorageOperationError,
	type StorageOperationResult,
} from "./ports/storageFailure";
import {
	requireStorageOperationSuccess,
	translateStorageFailure,
} from "./storageFailureTranslation";

/** Übersetzt erwartete Low-Level-Schreibfehler an die Persistence-Grenze. */
export async function translateStorageWriteError<T>(
	operation: () => Promise<T | StorageOperationResult<T>> | undefined,
	storageOperation: "save" | "delete" | "export" = "save",
): Promise<T> {
	try {
		const result = operation();
		if (!result)
			throw new ObjectStorageError(undefined, storageOperation, false);
		return await requireStorageOperationSuccess(result, storageOperation);
	} catch (error) {
		if (isRecoverableStorageWriteError(error))
			throw new ObjectSaveInterruptedError(
				error.diagnostic,
				error.commandId,
				error.reason,
				undefined,
				error.file,
			);
		if (error instanceof ObjectPersistenceError) throw error;
		if (isStorageOperationError(error))
			throw translateStorageFailure(error.failure, storageOperation);
		throw error;
	}
}
