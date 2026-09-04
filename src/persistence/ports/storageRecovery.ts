import type { DataFileCategory, DataFileReference } from "./dataFileTypes";

export type RecoverySource = "temporary" | "backup";

export type StorageRecoveryCandidate = DataFileReference & {
	recoveryKey: string;
	recoverySource?: RecoverySource;
	oldBytes: Uint8Array;
	newBytes?: Uint8Array;
};

export type StorageRecoveryResolution = "keepOld" | "keepNew" | "keepBoth";

export type StorageRecoveryRequestResult =
	| { status: "discarded" }
	| {
			status: "decisionRequired";
			commandId: string;
			candidate: StorageRecoveryCandidate;
	  };

export interface StorageRecoveryPort {
	listRecoveries(
		category?: DataFileCategory,
	): Promise<StorageRecoveryCandidate[]>;
	requestRecovery(recoveryKey: string): Promise<StorageRecoveryRequestResult>;
}
