import type { DomainFailureReason } from "../domain/domainFailure";
import type { GameState } from "../domain/gameFactory";
import type {
	LibraryRepairChange,
	LibraryRepairReport,
} from "../domain/libraryContainerRepair";
import type { RuleSet } from "../domain/ruleSet";
import type {
	ObjectPersistenceProblemReason,
	ObjectSerializationErrorReason,
} from "../persistence/objectPersistenceError";
import type {
	ObjectContentProblem,
	ObjectReadProblemForKind,
	ObjectRecoveryResolution,
	ObjectRecoverySource,
	ObjectStoreImportResolution,
} from "../persistence/objectPersistenceTypes";
import type {
	ApplicationDecisionRequired,
	ApplicationProblemReference,
} from "./applicationDecision";
import type { ApplicationExportResult, ExportDecision } from "./exportTypes";
import type { LoadProblemAction } from "./loadProblemQueue";
import type {
	ApplicationObjectListResult,
	ApplicationObjectReadProblem,
	ApplicationRuleSetObjectMetadata,
} from "./objectList";
import type { ObjectReadProblemService } from "./objectReadProblemService";
import type {
	LibraryRepairSuccess,
	NamedObjectImportSuccess,
	ObjectRecoverySuccess,
	ObjectRestoreSuccess,
	RenameObjectSuccess,
} from "./objectSuccess";
import type { ScenarioEditorFactory } from "./scenarioEditor";
import type { StorageRecoverySummary } from "./storageRecovery";

export type { LibraryRepairChange, LibraryRepairReport, RuleSet };

export type RuleSetSummary = ApplicationRuleSetObjectMetadata;

export type RuleSetReadProblem = ApplicationObjectReadProblem<"ruleSet">;

export type ScenarioImportSuccess = NamedObjectImportSuccess<
	"ruleSet" | "template"
>;

export type ScenarioImportConflict = ApplicationDecisionRequired<
	"importConflict",
	"overwrite" | "keepBoth" | "cancel",
	{
		reason: "targetExists";
		type: "ruleSet" | "template";
		availableActions: readonly ["overwrite", "keepBoth", "cancel"];
		existing: { id: string; name: string; schemaVersion?: number };
		imported: { id: string; name: string; schemaVersion?: number };
	}
>;

export type ScenarioImportResult =
	| ScenarioImportSuccess
	| ScenarioImportConflict
	| ApplicationDecisionRequired<
			"serializationRepair",
			"repair" | "cancel",
			{
				reason: DomainFailureReason | ObjectSerializationErrorReason;
				diagnostic?: string;
				availableActions: readonly ["repair", "cancel"];
			}
	  >;

export type LibraryRestorePreview = {
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

export type LibraryRestoreSuccess = ObjectRestoreSuccess & {
	preview: LibraryRestorePreview;
};

export type LibraryLoadProblem = {
	problemId: string;
	source: "storage" | "serialization";
	operation: "load";
	subject: "library";
	reference: ApplicationProblemReference;
	reason: ObjectPersistenceProblemReason;
	invalidDocumentKind?: "ruleSet" | "library";
	recoverySource?: ObjectRecoverySource;
	hasReadableOriginal: boolean;
	hasReadableBackup: boolean;
	canRestoreBackup: boolean;
	canRepair: boolean;
	canExport: boolean;
	availableActions: LoadProblemAction[];
	backupProblem?: ObjectContentProblem;
	repairProblem?: ObjectContentProblem;
};

export interface LibraryBrowseService {
	listObjects(kind: "ruleSet"): Promise<ApplicationObjectListResult<"ruleSet">>;
	loadRuleSet(ruleSetId: string): Promise<RuleSet>;
}

export interface ScenarioImportService {
	importScenario(selection: unknown): Promise<ScenarioImportResult>;
	resolveScenarioImport(
		commandId: string,
		resolution: "overwrite" | "keepBoth" | "repair" | "cancel",
	): Promise<ScenarioImportResult | undefined>;
}

export type RenameScenarioRequest =
	| {
			type: "ruleSet";
			oldId: string;
			newName: string;
			document: RuleSet;
	  }
	| {
			type: "template";
			oldId: string;
			newName: string;
			document: GameState;
	  };

export interface ScenarioManagementService {
	saveRuleSet(ruleSet: RuleSet): Promise<void>;
	saveTemplate(document: GameState): Promise<void>;
	exportTemplate(
		document: GameState,
		decision?: Exclude<ExportDecision, "cancel">,
	): Promise<ApplicationExportResult>;
	shareTemplate(document: GameState): Promise<ApplicationExportResult>;
	renameScenario(request: RenameScenarioRequest): Promise<RenameObjectSuccess>;
	deleteScenario(type: "ruleSet" | "template", id: string): Promise<void>;
}

export interface LibraryBackupService {
	exportLibraryBackup(
		decision?: Exclude<ExportDecision, "cancel">,
	): Promise<ApplicationExportResult>;
	shareLibraryBackup(): Promise<ApplicationExportResult>;
	restoreLibraryBackup(selection: unknown): Promise<LibraryRestoreSuccess>;
	prepareLibraryBackupRestore(
		selection: unknown,
	): Promise<LibraryRestorePreview>;
	resolveLibraryBackupRestore(
		commandId: string,
		resolution: ObjectStoreImportResolution,
	): Promise<LibraryRestoreSuccess | undefined>;
}

export interface LibraryRecoveryService {
	inspectLibraryLoadProblem(): Promise<LibraryLoadProblem | undefined>;
	restoreInternalBackup(): Promise<ObjectRestoreSuccess>;
	repairInternalLibrary(): Promise<LibraryRepairSuccess>;
	createAndStoreEmptyLibrary(): Promise<void>;
	useEmptyLibraryInMemory(): Promise<void>;
	exportInternalLibraryRaw(): Promise<void>;
	listWriteRecoveries(): Promise<StorageRecoverySummary[]>;
	resolveWriteRecovery(
		commandId: string,
		resolution: ObjectRecoveryResolution,
	): Promise<ObjectRecoverySuccess>;
	finishInternalStorageCommand(commandId: string): Promise<void>;
	exportFailedWrite(recoveryKey: string): Promise<void>;
}

export type LibraryUseCases = {
	editor: ScenarioEditorFactory;
	objectProblems: ObjectReadProblemService;
	browse: LibraryBrowseService;
	import: ScenarioImportService;
	management: ScenarioManagementService;
	backup: LibraryBackupService;
	recovery: LibraryRecoveryService;
};
