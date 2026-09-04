import type { DataFileReference } from "./dataFileTypes";
import type { StorageRecoveryResolution } from "./storageRecovery";

export type StorageCommandDecision =
	| StorageRecoveryResolution
	| "retry"
	| "finishLater"
	| "cancel"
	| "overwrite";

export type StorageCommandContinuation = {
	file: DataFileReference;
	bytes: Uint8Array;
};
