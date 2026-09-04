import type { ObjectPersistenceProblemReason } from "../persistence/objectPersistenceError";
import type {
	ObjectContentProblem,
	ObjectRecoverySource,
	PersistedObjectKind,
} from "../persistence/objectPersistenceTypes";
import type { ApplicationDecisionRequired } from "./applicationDecision";
import type { LoadProblemAction } from "./loadProblemQueue";

export type {
	ObjectContentProblem,
	ObjectRecoveryResolution,
	ObjectRecoverySource,
} from "../persistence/objectPersistenceTypes";
export { isObjectSaveInterruptedError } from "../persistence/objectSaveInterruptedError";

export type StorageRecoverySummary = ApplicationDecisionRequired<
	"writeRecovery",
	LoadProblemAction,
	{
		decisionKind: "writeRecovery";
		recoveryKey: string;
		id: string;
		kind: PersistedObjectKind;
		hasNew: boolean;
		canKeepNew: boolean;
		availableActions: readonly LoadProblemAction[];
		validationProblem?: ObjectContentProblem;
		reason: ObjectPersistenceProblemReason;
		recoverySource?: ObjectRecoverySource;
	}
>;
