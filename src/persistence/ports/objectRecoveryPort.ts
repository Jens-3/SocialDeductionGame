import type { GameState } from "../../domain/gameFactory";
import type {
	ObjectDecodingOptions,
	ObjectReadProblem,
	ObjectRecoveryKind,
	ObjectRecoveryResolution,
	ObjectSaveContinuationDecision,
	ObjectSaveContinuationResult,
	ObjectStoreRecoveryInspection,
	PersistedObjectKind,
	PreparedWriteRecovery,
	RepairedObjectStore,
} from "../objectPersistenceTypes";

/** Erkennen und Auflösen technischer Lade- und Schreibprobleme. */
export interface ObjectRecoveryPort {
	prepareWriteRecoveries(
		kinds: ObjectRecoveryKind[],
		options: ObjectDecodingOptions,
	): Promise<PreparedWriteRecovery[]>;
	resolveWriteRecovery(
		commandId: string,
		resolution: ObjectRecoveryResolution | "cancel",
	): Promise<void>;
	finishStorageCommand(commandId: string): Promise<void>;
	continueObjectSave(
		commandId: string,
		decision: ObjectSaveContinuationDecision,
		continuationObject?: GameState,
	): Promise<ObjectSaveContinuationResult>;
	exportFailedWrite(recoveryKey: string): Promise<void>;
	inspectObjectStoreRecovery(
		kind: PersistedObjectKind,
		options: ObjectDecodingOptions,
	): Promise<ObjectStoreRecoveryInspection | undefined>;
	repairObjectStore(
		kind: PersistedObjectKind,
		options: ObjectDecodingOptions,
	): Promise<RepairedObjectStore>;
	restoreObjectStoreBackup(
		kind: PersistedObjectKind,
		options: ObjectDecodingOptions,
	): Promise<void>;
	createEmptyObjectStore(
		kind: PersistedObjectKind,
		mode: "stored" | "temporary",
	): Promise<void>;
	exportUnreadableObjectStore(kind: PersistedObjectKind): Promise<void>;
	deleteObjectReadProblem(
		problem: ObjectReadProblem,
		options: ObjectDecodingOptions,
	): Promise<void>;
	exportObjectReadProblem(problem: ObjectReadProblem): Promise<void>;
	repairObjectReadProblem(
		problem: ObjectReadProblem,
		options: ObjectDecodingOptions,
		keepBoth?: boolean,
	): Promise<RepairedObjectStore | undefined>;
}
