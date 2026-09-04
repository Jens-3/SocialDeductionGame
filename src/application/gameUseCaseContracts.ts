import type {
	ChangeShownRoleCommand,
	MoveSeatCommand,
	MoveShownRoleCommand,
	PlayerDraft,
	SavePlayerCommand,
} from "../domain/gameEditing";
import type { GameState } from "../domain/gameFactory";
import type {
	PlayerAbilityAction,
	PlayerActionResult,
} from "../domain/playerActions";
import type {
	SelectedRoleCounts,
	TeamRoleCounts,
} from "../domain/roleDistribution";
import type {
	ObjectRecoveryResolution,
	PersistedGameObjectKind,
} from "../persistence/objectPersistenceTypes";
import type { ApplicationExportResult, ExportDecision } from "./exportTypes";
import type { GamePreparationService } from "./gamePreparationService";
import type {
	LoadedGameDocument,
	SavedGameImportConflict,
	SavedGameImportResult,
	SavedGameImportSuccess,
	SavedGameSummary,
	SaveLoadedGameAsTemplateResult,
	StoredDocumentProblem,
	StoredGameReference,
	TemplateSummary,
} from "./gameTypes";
import type {
	ApplicationObjectListResult,
	ApplicationObjectReadProblem,
	ApplicationStoreReadProblem,
} from "./objectList";
import type { ObjectReadProblemService } from "./objectReadProblemService";
import type {
	ObjectRecoverySuccess,
	RenameObjectSuccess,
} from "./objectSuccess";
import type {
	RolesForShowingDraft,
	RolesForShowingEditorModel,
	RolesForShowingPresentation,
} from "./rolesForShowing";
import type { ScenarioEditorFactory } from "./scenarioEditor";
import type { StorageRecoverySummary } from "./storageRecovery";

export type {
	ApplicationObjectListResult,
	ApplicationObjectReadProblem,
	ApplicationStoreReadProblem,
	ChangeShownRoleCommand,
	GameState,
	LoadedGameDocument,
	MoveSeatCommand,
	MoveShownRoleCommand,
	PlayerAbilityAction,
	PlayerActionResult,
	PlayerDraft,
	SavedGameImportConflict,
	SavedGameImportResult,
	SavedGameImportSuccess,
	SavedGameSummary,
	SaveLoadedGameAsTemplateResult,
	SavePlayerCommand,
	StoredDocumentProblem,
	StoredGameReference,
	TemplateSummary,
};

export interface GameSessionService {
	getLoadedGame(): LoadedGameDocument | undefined;
	setPreparedGame(game: GameState): LoadedGameDocument;
	isLoadedGameDirty(): boolean;
	replaceLoadedGameWithEditedCopy(document: GameState): LoadedGameDocument;
	moveLoadedSeat(command: MoveSeatCommand): LoadedGameDocument;
	shuffleLoadedPlayers(): LoadedGameDocument;
	moveLoadedShownRole(command: MoveShownRoleCommand): LoadedGameDocument;
	changeLoadedShownRole(command: ChangeShownRoleCommand): LoadedGameDocument;
	saveLoadedPlayer(command: SavePlayerCommand): LoadedGameDocument;
	deleteLoadedEmptySeat(seatNumber: number): LoadedGameDocument;
	deleteLoadedPlayerAtSeat(seatNumber: number): LoadedGameDocument;
	deleteLoadedGameLogEntry(logEntryId: string): LoadedGameDocument;
	clearLoadedGameLog(): LoadedGameDocument;
	useLoadedPlayerAbility(
		actorPlayerId: string,
		targetPlayerId: string,
		action: PlayerAbilityAction,
		statusId?: string,
	): { game: LoadedGameDocument; result: PlayerActionResult };
	advanceLoadedGameTime(): LoadedGameDocument;
	rewindLoadedGameTime(): LoadedGameDocument;
	assignLoadedGameRolesByTeamCounts(counts: TeamRoleCounts): LoadedGameDocument;
	assignLoadedGameRolesByRoleCounts(
		counts: SelectedRoleCounts,
	): LoadedGameDocument;
	getLoadedRolesForShowingEditorModel(): RolesForShowingEditorModel;
	createLoadedRolesForShowingPresentation(
		draft: RolesForShowingDraft,
	): RolesForShowingPresentation;
	updateLoadedRolesForShowing(draft: RolesForShowingDraft): LoadedGameDocument;
}

export interface GamePersistenceService {
	findLatestStoredGame(): Promise<StoredGameReference | undefined>;
	listObjects<K extends PersistedGameObjectKind>(
		kind: K,
	): Promise<ApplicationObjectListResult<K>>;
	clearBrowseCache(): void;
	createGameFromTemplate(
		storageKey: string,
		name?: string,
	): Promise<LoadedGameDocument>;
	loadTemplateDocument(storageKey: string): Promise<GameState>;
	loadGame(storageKey: string): Promise<LoadedGameDocument>;
	saveLoadedGame(): Promise<LoadedGameDocument>;
	listWriteRecoveries(
		category?: "game" | "template",
	): Promise<StorageRecoverySummary[]>;
	resolveWriteRecovery(
		commandId: string,
		resolution: ObjectRecoveryResolution | "cancel",
	): Promise<ObjectRecoverySuccess | undefined>;
	finishInternalStorageCommand(commandId: string): Promise<void>;
	retryLoadedGameSave(commandId: string): Promise<LoadedGameDocument>;
	exportFailedWrite(recoveryKey: string): Promise<void>;
	suggestLoadedGameSaveAsName(): Promise<string>;
	saveLoadedGameAs(name: string): Promise<LoadedGameDocument>;
	suggestSavedGameCopyName(storageKey: string): Promise<string>;
	renameSavedGame(
		storageKey: string,
		newName: string,
	): Promise<RenameObjectSuccess>;
	duplicateSavedGame(
		storageKey: string,
		newName: string,
	): Promise<{ id: string; storageKey: string; name: string }>;
	exportSavedGame(
		storageKey: string,
		decision?: Exclude<ExportDecision, "cancel">,
	): Promise<ApplicationExportResult>;
	shareSavedGame(storageKey: string): Promise<ApplicationExportResult>;
	importSavedGame(selection: unknown): Promise<SavedGameImportResult>;
	resolveSavedGameImport(
		commandId: string,
		resolution: "overwrite" | "keepBoth" | "repair" | "cancel",
	): Promise<SavedGameImportResult | undefined>;
	deleteSavedGame(storageKey: string): Promise<void>;
	suggestLoadedGameTemplateName(): Promise<string>;
	saveLoadedGameAsTemplate(
		name: string,
	): Promise<SaveLoadedGameAsTemplateResult>;
	continuePendingCreatedDocument(
		commandId: string,
		decision: "retry" | "cancel" | "finishLater" | "overwrite" | "keepBoth",
	): Promise<LoadedGameDocument>;
}

export type GameUseCases = {
	editor: ScenarioEditorFactory;
	objectProblems: ObjectReadProblemService;
	preparation: GamePreparationService;
	session: GameSessionService;
	persistence: GamePersistenceService;
};
