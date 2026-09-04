import type { DomainFailureReason } from "../domain/domainFailure";
import type { GamePhase, GameState } from "../domain/gameFactory";
import type { LibraryRepairReport } from "../domain/libraryContainerRepair";
import type { RuleSet } from "../domain/ruleSet";
import type {
	ObjectSerializationErrorReason,
	ObjectStorageErrorReason,
	ObjectStorageProblemReason,
} from "./objectPersistenceError";

export type PersistedGameObjectKind = "game" | "template";
export type PersistedObjectKind = PersistedGameObjectKind | "ruleSet";
export type ObjectRecoveryKind = PersistedObjectKind;

export type ObjectRecoverySource = "temporary" | "backup";

export type ObjectDecodingOptions = {
	ansiFallbackLocale: string;
};

export type ObjectRecoveryResolution = "keepOld" | "keepNew" | "keepBoth";

export type ObjectSaveContinuationDecision =
	| ObjectRecoveryResolution
	| "retry"
	| "finishLater"
	| "cancel"
	| "overwrite";

export type PersistedObjectReference =
	| {
			kind: "ruleSet";
			id: string;
	  }
	| {
			kind: PersistedGameObjectKind;
			id: string;
			storageVariant?: string;
	  };

/**
 * Logische Referenz eines erfolgreich geschriebenen Domainobjekts.
 * `storageKey` bleibt gegenüber der Application und GUI undurchsichtig und
 * verrät nicht, ob das Objekt in einer eigenen Datei oder einem Store liegt.
 */
export type StoredObjectReference<
	K extends PersistedObjectKind = PersistedObjectKind,
> = {
	kind: K;
	id: string;
	storageKey: string;
};

export type PersistedObjectWriteResult<K extends PersistedObjectKind, T> = {
	document: T;
	reference: StoredObjectReference<K>;
};

export type LoadedStoredGameObject = {
	document: GameState;
	id: string;
	storageKey: string;
	storageVariant?: string;
	restoredIndex: number;
};

export type SavedStoredGameObject = {
	document: GameState;
	storageKey: string;
	storageVariant?: string;
	restoredIndex: number;
	storedAt: string;
	previousStorageKey?: string;
	changesFile: boolean;
};

export type GameObjectSaveOptions = {
	previousStorageKey?: string | null;
	conflictPolicy?: "reject" | "replace";
	identityPolicy?: "deriveFromName" | "preserve";
};

export type RuleSetSaveOptions = {
	conflictPolicy?: "reject" | "replace";
};

export type ObjectSaveContinuationResult =
	| { status: "discarded" }
	| { status: "completed"; savedObject?: SavedStoredGameObject };

export type LatestStoredGameObject = {
	id: string;
	storageKey: string;
};

export type GameObjectMetadata = {
	storageKey?: string;
	storageVariant?: string;
	id: string;
	restoredIndex?: number;
	name: string;
	names?: Record<string, string>;
	storedAt: string;
	playerCount: number;
	ruleSetName: string;
	ruleSetNames?: Record<string, string>;
	currentNight: number;
	phase: GamePhase;
};

export type ImportTargetMetadata =
	| { status: "notFound" }
	| {
			status: "exists";
			id: string;
			name: string;
			schemaVersion?: number;
	  };

export type RuleSetObjectMetadata = {
	id: string;
	name: string;
	names?: Record<string, string>;
	version: number;
	teamCount: number;
	roleCount: number;
};

type ObjectMetadataByKind = {
	game: GameObjectMetadata;
	template: GameObjectMetadata;
	ruleSet: RuleSetObjectMetadata;
};

type StandaloneObjectReadContext<K extends PersistedGameObjectKind> = {
	scope: "object";
	id: string;
	kind: K;
	/** Tatsächlicher interner Dateiname ohne abschließendes `.json`. */
	storageKey: string;
	restoredIndex?: number;
	sourceBytes?: Uint8Array;
	suggestedFileName?: string;
	canRepairFileName?: boolean;
	canKeepBoth?: boolean;
};

export type StandaloneObjectReadProblem<K extends PersistedGameObjectKind> =
	| (StandaloneObjectReadContext<K> & {
			category: "storage";
			reason: Extract<ObjectStorageProblemReason, "invalidFileName">;
			diagnostic?: string;
	  })
	| (StandaloneObjectReadContext<K> & {
			category: "serialization";
			reason: ObjectSerializationErrorReason;
			repairable: boolean;
			diagnostic?: string;
			details?: string;
			componentKind?: "ruleSet";
	  })
	| (StandaloneObjectReadContext<K> & {
			category: "domain";
			reason: DomainFailureReason;
			repairable: boolean;
			componentKind?: "ruleSet";
			diagnostic?: string;
			details?: string;
	  });

export type ObjectReadProblem =
	| StandaloneObjectReadProblem<"game">
	| StandaloneObjectReadProblem<"template">
	| {
			scope: "object";
			category: "serialization";
			kind: "ruleSet";
			id: string;
			reason: ObjectSerializationErrorReason;
			repairable: boolean;
			diagnostic?: string;
			details?: string;
	  }
	| {
			scope: "object";
			category: "domain";
			kind: "ruleSet";
			id: string;
			reason: DomainFailureReason;
			repairable: boolean;
			diagnostic?: string;
			details?: string;
	  };

export type GameObjectReadProblem =
	| StandaloneObjectReadProblem<"game">
	| StandaloneObjectReadProblem<"template">;

export type ObjectReadProblemForKind<K extends PersistedObjectKind> =
	K extends PersistedGameObjectKind
		? StandaloneObjectReadProblem<K>
		: Extract<ObjectReadProblem, { kind: "ruleSet" }>;

export type ObjectStoreReadProblem<
	K extends PersistedObjectKind = PersistedObjectKind,
> =
	| {
			scope: "store";
			category: "storage";
			kind: K;
			reason: Extract<
				ObjectStorageErrorReason,
				"missingLibrary" | "storageFailure"
			>;
			retryable?: boolean;
			repairable?: boolean;
			diagnostic?: string;
	  }
	| {
			scope: "store";
			category: "serialization";
			kind: K;
			reason: ObjectSerializationErrorReason;
			repairable: boolean;
			diagnostic?: string;
			details?: string;
	  };

export type ObjectContentProblem =
	| {
			category: "serialization";
			reason: ObjectSerializationErrorReason;
			repairable: boolean;
			diagnostic?: string;
			details?: string;
	  }
	| {
			category: "domain";
			reason: DomainFailureReason;
			repairable: boolean;
			diagnostic?: string;
			details?: string;
	  };

export type ObjectListResult<K extends PersistedObjectKind> =
	| {
			status: "loaded";
			metadata: ObjectMetadataByKind[K][];
			problems: ObjectReadProblemForKind<K>[];
			ids: string[];
	  }
	| {
			status: "failed";
			problem: ObjectStoreReadProblem<K>;
	  };

export type PreparedObjectStoreRestore = {
	commandId: string;
	currentStorageVersion?: number;
	importedStorageVersion: 1;
	totalObjectCount: number;
	validObjectCount: number;
	discardedObjectCount: number;
	discardedRuleSetIds: string[];
	problems: ObjectReadProblemForKind<"ruleSet">[];
	availableDecisions:
		| readonly ["replace", "cancel"]
		| readonly ["repair", "cancel"]
		| readonly ["repair", "importValidObjects", "cancel"];
};

export type ObjectStoreImportResolution =
	| "replace"
	| "repair"
	| "importValidObjects"
	| "cancel";

export type PreparedWriteRecovery = {
	commandId: string;
	recoveryKey: string;
	id: string;
	kind: ObjectRecoveryKind;
	hasNew: boolean;
	validationProblem?: ObjectContentProblem;
	recoverySource?: ObjectRecoverySource;
};

export type ObjectStoreRecoveryInspection = {
	hasPrimary: boolean;
	hasBackup: boolean;
	backupProblem?: ObjectContentProblem;
	repairProblem?: ObjectContentProblem;
};

export type DocumentSyntaxRepair =
	| {
			kind: "insertedMissingQuote";
			position: number;
	  }
	| {
			kind: "addedClosingBraces";
			count: number;
	  }
	| {
			kind: "addedOpeningBraces";
			count: number;
	  };

export type RepairedObjectStore = {
	report: LibraryRepairReport;
	syntaxRepairs: DocumentSyntaxRepair[];
};

export type ImportSourceMetadata = {
	schemaVersion?: number;
};

export type ImportedObject =
	| {
			kind: "ruleSet";
			object: RuleSet;
			sourceMetadata: ImportSourceMetadata;
	  }
	| {
			kind: "game";
			object: GameState;
			sourceMetadata: ImportSourceMetadata;
	  }
	| {
			kind: "template";
			object: GameState;
			sourceMetadata: ImportSourceMetadata;
	  };

type ObjectImportRepairDecision = {
	status: "decisionRequired";
	decisionKind: "serializationRepair";
	commandId: string;
	problem: ObjectContentProblem;
	availableDecisions: readonly ["repair", "cancel"];
};

export type ObjectImportPreparation =
	| ImportedObject
	| ObjectImportRepairDecision;

export type ObjectExportOptions = {
	conflictPolicy?: "reject" | "overwrite";
	targetPolicy?: "suggested" | "choose";
	delivery?: "save" | "share";
};

export type ObjectExportResult =
	| { status: "exported" }
	| {
			status: "conflict";
			reason: "targetExists";
			continuation: "restart";
			diagnostic?: string;
	  };
