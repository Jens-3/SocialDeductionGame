import type {
	DataFileReadResult,
	DataFileReference,
} from "../src/persistence/ports/dataFileStorage";
import type { StorageFailureReason } from "../src/persistence/ports/storageFailure";

export function failedRead(
	file: DataFileReference,
	reason: Extract<
		StorageFailureReason,
		"notFound" | "permissionDenied" | "unreadable" | "storageUnavailable"
	>,
	diagnostic?: string,
): DataFileReadResult {
	return {
		status: "error",
		error: {
			source: "storage",
			operation: "read",
			reason,
			retryable: reason !== "notFound",
			repairable: false,
			category: file.category,
			file,
			...(diagnostic ? { diagnostic } : {}),
		},
	};
}

export function missingRead(file: DataFileReference): DataFileReadResult {
	return failedRead(file, "notFound");
}
