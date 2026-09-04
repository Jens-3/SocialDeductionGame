import type {
	GameObjectMetadata,
	ObjectReadProblemForKind,
	ObjectStoreReadProblem,
	PersistedGameObjectKind,
	PersistedObjectKind,
	RuleSetObjectMetadata,
} from "../persistence/objectPersistenceTypes";
import type {
	ApplicationExpectedProblem,
	ApplicationProblemReference,
} from "./applicationDecision";
import type { NormalizedApplicationProblemCapabilities } from "./applicationError";
import type { LoadProblemAction } from "./loadProblemQueue";

export type ApplicationObjectMetadataByKind = {
	game: ApplicationGameObjectMetadata;
	template: ApplicationGameObjectMetadata;
	ruleSet: ApplicationRuleSetObjectMetadata;
};

export type ApplicationGameObjectMetadata = Omit<
	GameObjectMetadata,
	"names" | "ruleSetNames"
>;

export type ApplicationRuleSetObjectMetadata = Omit<
	RuleSetObjectMetadata,
	"names"
>;

export type ApplicationObjectReadProblem<
	K extends PersistedObjectKind = PersistedObjectKind,
> = ObjectReadProblemForKind<K> & {
	problemId: string;
	source: "storage" | "serialization" | "domain";
	operation: "load";
	subject: K;
	reference: ApplicationProblemReference;
	availableActions: LoadProblemAction[];
} & ApplicationExpectedProblem<LoadProblemAction> &
	NormalizedApplicationProblemCapabilities &
	(K extends PersistedGameObjectKind
		? { canExport: true }
		: Record<never, never>);

export type ApplicationStoreReadProblem<
	K extends PersistedObjectKind = PersistedObjectKind,
> = ObjectStoreReadProblem<K> & {
	problemId: string;
	source: "storage" | "serialization";
	operation: "list";
	subject: "game" | "template" | "library";
	reference: ApplicationProblemReference;
	retryable: boolean;
	repairable: boolean;
	availableActions: readonly LoadProblemAction[];
} & ApplicationExpectedProblem<LoadProblemAction>;

export type ApplicationObjectListResult<K extends PersistedObjectKind> =
	| {
			status: "loaded";
			metadata: ApplicationObjectMetadataByKind[K][];
			problems: ApplicationObjectReadProblem<K>[];
			ids: string[];
	  }
	| {
			status: "expectedFailure";
			problem: ApplicationStoreReadProblem<K>;
	  };

export class ApplicationObjectListError extends Error {
	constructor(readonly problem: ApplicationStoreReadProblem) {
		super(problem.reason);
		this.name = "ApplicationObjectListError";
	}
}
