import type { DomainServices } from "../../domain/domainServices";
import type { ObjectPersistenceCapabilities } from "../../persistence/ports/objectPersistenceCapabilities";
import { GamePreparationService } from "../gamePreparationService";
import type {
	GamePersistenceService,
	GameSessionService,
	GameUseCases,
} from "../gameUseCaseContracts";
import type { ObjectReadProblemService } from "../objectReadProblemService";
import { ScenarioEditorFactory } from "../scenarioEditor";
import { ApplicationObjectWriter } from "./applicationObjectWriter";
import { bindMethods } from "./bindMethods";
import { DefaultGameImportService } from "./defaultGameImportService";
import { DefaultGameLoadService } from "./defaultGameLoadService";
import { DefaultGameManagementService } from "./defaultGameManagementService";
import { DefaultGameRecoveryService } from "./defaultGameRecoveryService";
import { DefaultGameSaveService } from "./defaultGameSaveService";
import { DefaultGameSessionService } from "./defaultGameSessionService";
import { DefaultGameTemplateService } from "./defaultGameTemplateService";
import { DefaultObjectReadProblemService } from "./defaultObjectReadProblemService";
import { GameCatalog } from "./gameCatalog";
import { LoadedGameSession } from "./loadedGameSession";
import { PendingGameSaveWorkflow } from "./pendingGameSaveWorkflow";
import { PersistenceOperationRegistry } from "./persistenceOperationRegistry";
import { WriteRecoveryCoordinator } from "./writeRecoveryCoordinator";

const sessionMethods = [
	"getLoadedGame",
	"setPreparedGame",
	"isLoadedGameDirty",
	"replaceLoadedGameWithEditedCopy",
	"moveLoadedSeat",
	"shuffleLoadedPlayers",
	"moveLoadedShownRole",
	"changeLoadedShownRole",
	"saveLoadedPlayer",
	"deleteLoadedEmptySeat",
	"deleteLoadedPlayerAtSeat",
	"deleteLoadedGameLogEntry",
	"clearLoadedGameLog",
	"useLoadedPlayerAbility",
	"advanceLoadedGameTime",
	"rewindLoadedGameTime",
	"assignLoadedGameRolesByTeamCounts",
	"assignLoadedGameRolesByRoleCounts",
	"getLoadedRolesForShowingEditorModel",
	"createLoadedRolesForShowingPresentation",
	"updateLoadedRolesForShowing",
] as const satisfies readonly (keyof GameSessionService)[];

const catalogMethods = [
	"listObjects",
	"findLatestStoredGame",
	"clearBrowseCache",
] as const satisfies readonly (keyof GamePersistenceService)[];

const loadMethods = [
	"createGameFromTemplate",
	"loadTemplateDocument",
	"loadGame",
] as const satisfies readonly (keyof GamePersistenceService)[];

const saveMethods = [
	"saveLoadedGame",
	"suggestLoadedGameSaveAsName",
	"saveLoadedGameAs",
] as const satisfies readonly (keyof GamePersistenceService)[];

const managementMethods = [
	"suggestSavedGameCopyName",
	"renameSavedGame",
	"duplicateSavedGame",
	"exportSavedGame",
	"shareSavedGame",
	"deleteSavedGame",
] as const satisfies readonly (keyof GamePersistenceService)[];

const templateMethods = [
	"suggestLoadedGameTemplateName",
	"saveLoadedGameAsTemplate",
] as const satisfies readonly (keyof GamePersistenceService)[];

const pendingSaveMethods = [
	"continuePendingCreatedDocument",
] as const satisfies readonly (keyof GamePersistenceService)[];

const recoveryMethods = [
	"listWriteRecoveries",
	"resolveWriteRecovery",
	"finishInternalStorageCommand",
	"retryLoadedGameSave",
	"exportFailedWrite",
] as const satisfies readonly (keyof GamePersistenceService)[];

const importMethods = [
	"importSavedGame",
	"resolveSavedGameImport",
] as const satisfies readonly (keyof GamePersistenceService)[];

export function createGameUseCases(
	objectPersistence: ObjectPersistenceCapabilities,
	domainServices: DomainServices,
): GameUseCases {
	const loadedGameSession = new LoadedGameSession();
	const persistenceOperations = new PersistenceOperationRegistry();
	const gameSessionService = new DefaultGameSessionService(
		loadedGameSession,
		domainServices,
	);
	const gameCatalog = new GameCatalog(objectPersistence);
	const objectWriter = new ApplicationObjectWriter(
		objectPersistence.write,
		() => gameCatalog.clearBrowseCache(),
	);
	const loadService = new DefaultGameLoadService(
		objectPersistence,
		loadedGameSession,
		persistenceOperations,
	);
	const pendingSaveWorkflow = new PendingGameSaveWorkflow(
		objectPersistence.recovery,
		loadedGameSession,
		gameCatalog,
		persistenceOperations,
	);
	const saveService = new DefaultGameSaveService(
		loadedGameSession,
		gameCatalog,
		objectWriter,
		pendingSaveWorkflow,
		persistenceOperations,
	);
	const managementService = new DefaultGameManagementService(
		objectPersistence,
		loadedGameSession,
		gameCatalog,
		objectWriter,
		persistenceOperations,
	);
	const templateService = new DefaultGameTemplateService(
		domainServices,
		loadedGameSession,
		gameCatalog,
		objectWriter,
		pendingSaveWorkflow,
		persistenceOperations,
	);
	const writeRecoveryCoordinator = new WriteRecoveryCoordinator(
		objectPersistence.recovery,
	);
	const recoveryService = new DefaultGameRecoveryService(
		objectPersistence.recovery,
		loadedGameSession,
		gameCatalog,
		writeRecoveryCoordinator,
		pendingSaveWorkflow,
		persistenceOperations,
	);
	const importService = new DefaultGameImportService(
		objectPersistence,
		domainServices,
		gameCatalog,
		objectWriter,
	);
	const protectedImportService = {
		importSavedGame: (selection: unknown) =>
			persistenceOperations.run(
				`import:game:${persistenceOperations.argumentKey(selection)}`,
				() => importService.importSavedGame(selection),
				{
					decisionCommandId: (result) =>
						result.status === "decisionRequired" ? result.commandId : undefined,
				},
			),
		resolveSavedGameImport: (
			commandId: string,
			resolution: "overwrite" | "keepBoth" | "repair" | "cancel",
		) =>
			persistenceOperations.continue(
				commandId,
				() => importService.resolveSavedGameImport(commandId, resolution),
				{
					decisionCommandId: (result) =>
						result?.status === "decisionRequired"
							? result.commandId
							: undefined,
				},
			),
	};
	const protectedCatalog = {
		findLatestStoredGame: () =>
			persistenceOperations.run("find-latest:game", () =>
				gameCatalog.findLatestStoredGame(),
			),
		listObjects: <K extends "game" | "template">(kind: K) =>
			persistenceOperations.run(`list:${kind}`, () =>
				gameCatalog.listObjects(kind),
			),
		clearBrowseCache: () => gameCatalog.clearBrowseCache(),
	};
	const session: GameSessionService = bindMethods(
		gameSessionService,
		sessionMethods,
	);
	const persistence: GamePersistenceService = {
		...bindMethods(protectedCatalog, catalogMethods),
		...bindMethods(loadService, loadMethods),
		...bindMethods(saveService, saveMethods),
		...bindMethods(managementService, managementMethods),
		...bindMethods(templateService, templateMethods),
		...bindMethods(pendingSaveWorkflow, pendingSaveMethods),
		...bindMethods(recoveryService, recoveryMethods),
		...bindMethods(protectedImportService, importMethods),
	};
	const objectProblems: ObjectReadProblemService =
		new DefaultObjectReadProblemService(objectPersistence.recovery);
	return {
		editor: new ScenarioEditorFactory(),
		objectProblems,
		preparation: new GamePreparationService(domainServices),
		session,
		persistence,
	};
}
