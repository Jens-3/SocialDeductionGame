import type { DomainFailureReason } from "../domain/domainFailure";
import type { GameState } from "../domain/gameFactory";
import type { CreateTemplateFromGameResult } from "../domain/templateFactory";
import type { ObjectSerializationErrorReason } from "../persistence/objectPersistenceError";
import type { ApplicationDecisionRequired } from "./applicationDecision";
import type {
	ApplicationGameObjectMetadata,
	ApplicationObjectReadProblem,
} from "./objectList";
import type { NamedObjectImportSuccess } from "./objectSuccess";

export type SavedGameSummary = ApplicationGameObjectMetadata;

export type TemplateSummary = SavedGameSummary;

export type StoredDocumentProblem = ApplicationObjectReadProblem<
	"game" | "template"
> & {
	canExport: true;
};

export type StoredGameReference = {
	id: string;
	storageKey: string;
};

/** Vollständig validierter Spielstand im Application-Arbeitsspeicher. */
export type LoadedGameDocument = {
	storageKey: string | null;
	id: string;
	name: string;
	displayName: string;
	document: GameState;
	restored?: boolean;
	restoredIndex?: number;
	storageVariant?: string;
};

export type SaveLoadedGameAsTemplateResult = CreateTemplateFromGameResult;

export type SavedGameImportSuccess = NamedObjectImportSuccess<"game">;

export type SavedGameImportConflict = ApplicationDecisionRequired<
	"importConflict",
	"overwrite" | "keepBoth" | "cancel",
	{
		reason: "targetExists";
		availableActions: readonly ["overwrite", "keepBoth", "cancel"];
		existing: { id: string; name: string; schemaVersion?: number };
		imported: { id: string; name: string; schemaVersion?: number };
	}
>;

export type SavedGameImportRepairDecision = ApplicationDecisionRequired<
	"serializationRepair",
	"repair" | "cancel",
	{
		reason: DomainFailureReason | ObjectSerializationErrorReason;
		diagnostic?: string;
		availableActions: readonly ["repair", "cancel"];
	}
>;

export type SavedGameImportResult =
	| SavedGameImportSuccess
	| SavedGameImportConflict
	| SavedGameImportRepairDecision;
