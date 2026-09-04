import { language } from "../../config";
import type { DomainServices } from "../../domain/domainServices";
import {
	type ChangeShownRoleCommand,
	changeShownRole,
	deleteEmptySeat,
	type MoveSeatCommand,
	type MoveShownRoleCommand,
	moveSeat,
	moveShownRole,
	type SavePlayerCommand,
	savePlayer,
} from "../../domain/gameEditing";
import type { GameState } from "../../domain/gameFactory";
import { clearGameLog, deleteGameLogEntry } from "../../domain/gameLog";
import { advanceGameTime, rewindGameTime } from "../../domain/gameProgression";
import { repairGameState } from "../../domain/gameRepair";
import { saveRolesForShowing } from "../../domain/gameRolesForShowing";
import {
	type PlayerAbilityAction,
	type PlayerActionResult,
	usePlayerAbility,
} from "../../domain/playerActions";
import { EMPTY_PLAYER_ID } from "../../domain/reservedIds";
import {
	assignRandomRolesByRoleCounts,
	assignRandomRolesByTeamCounts,
	type SelectedRoleCounts,
	type TeamRoleCounts,
} from "../../domain/roleDistribution";
import { renameGame } from "../../domain/scenarioRenaming";
import { shufflePlayers } from "../../domain/seatOrder";
import { deletePlayer } from "../../domain/sessionEditing";
import { expectedApplicationError } from "../applicationError";
import type { LoadedGameDocument } from "../gameTypes";
import type { GameSessionService } from "../gameUseCaseContracts";
import {
	createRolesForShowingEditorModel,
	createRolesForShowingPresentation,
	type RolesForShowingDraft,
	type RolesForShowingEditorModel,
	type RolesForShowingPresentation,
} from "../rolesForShowing";
import { executeApplicationOperationSync } from "./applicationErrorMapping";
import type { LoadedGameSession } from "./loadedGameSession";

/** Konkrete Application-Use-Cases für das aktuell geladene Spiel. */
export class DefaultGameSessionService implements GameSessionService {
	readonly #session: LoadedGameSession;
	readonly #domainServices: DomainServices;

	constructor(session: LoadedGameSession, domainServices: DomainServices) {
		this.#session = session;
		this.#domainServices = domainServices;
	}

	getLoadedGame(): LoadedGameDocument | undefined {
		return this.#session.getLoadedGame();
	}

	setPreparedGame(game: GameState): LoadedGameDocument {
		return this.#session.setPreparedGame(game);
	}

	isLoadedGameDirty(): boolean {
		return this.#session.isLoadedGameDirty();
	}

	replaceLoadedGameWithEditedCopy(document: GameState): LoadedGameDocument {
		return executeApplicationOperationSync(() => {
			this.#session.requireLoadedGame();
			const repairedGame = repairGameState(document, "game").document;
			const hydratedGame = renameGame(repairedGame, repairedGame.name);
			return this.#session.replaceDocument(hydratedGame);
		}, "repair");
	}

	moveLoadedSeat(command: MoveSeatCommand): LoadedGameDocument {
		return this.updateDocument(
			(document) => moveSeat(document, command, this.#domainServices),
			"resolve",
		);
	}

	shuffleLoadedPlayers(): LoadedGameDocument {
		return this.updateDocument(
			(document) =>
				shufflePlayers(document, this.#domainServices, { language }),
			"resolve",
		);
	}

	moveLoadedShownRole(command: MoveShownRoleCommand): LoadedGameDocument {
		return this.updateDocument(
			(document) => moveShownRole(document, command),
			"resolve",
		);
	}

	changeLoadedShownRole(command: ChangeShownRoleCommand): LoadedGameDocument {
		return this.updateDocument(
			(document) => changeShownRole(document, command),
			"resolve",
		);
	}

	saveLoadedPlayer(command: SavePlayerCommand): LoadedGameDocument {
		return this.updateDocument(
			(document) => savePlayer(document, command),
			"save",
		);
	}

	deleteLoadedEmptySeat(seatNumber: number): LoadedGameDocument {
		return this.updateDocument(
			(document) => deleteEmptySeat(document, seatNumber, this.#domainServices),
			"delete",
		);
	}

	deleteLoadedPlayerAtSeat(seatNumber: number): LoadedGameDocument {
		return this.updateDocument((document) => {
			const playerId = document.seatOrder[seatNumber - 1];
			if (!playerId || playerId === EMPTY_PLAYER_ID)
				throw expectedApplicationError(
					"delete",
					"game",
					"entityNotFound",
					`seatNumber=${seatNumber}`,
				);
			return deletePlayer(document, playerId, language).game;
		}, "delete");
	}

	deleteLoadedGameLogEntry(logEntryId: string): LoadedGameDocument {
		return this.updateDocument(
			(document) => deleteGameLogEntry(document, logEntryId),
			"delete",
		);
	}

	clearLoadedGameLog(): LoadedGameDocument {
		return this.updateDocument(clearGameLog, "delete");
	}

	useLoadedPlayerAbility(
		actorPlayerId: string,
		targetPlayerId: string,
		action: PlayerAbilityAction,
		statusId?: string,
	): { game: LoadedGameDocument; result: PlayerActionResult } {
		return executeApplicationOperationSync(() => {
			const current = this.#session.requireLoadedGame();
			const game = current.document;
			const result = usePlayerAbility(
				game,
				this.#domainServices,
				actorPlayerId,
				targetPlayerId,
				action,
				statusId,
				true,
				language,
			);
			if (result.changed) this.#session.replaceDocument(game);
			return { game: this.#session.requireLoadedGame(), result };
		}, "resolve");
	}

	advanceLoadedGameTime(): LoadedGameDocument {
		return this.updateDocument(
			(document) => advanceGameTime(document, this.#domainServices),
			"resolve",
		);
	}

	rewindLoadedGameTime(): LoadedGameDocument {
		return this.updateDocument(
			(document) => rewindGameTime(document, this.#domainServices),
			"resolve",
		);
	}

	assignLoadedGameRolesByTeamCounts(
		counts: TeamRoleCounts,
	): LoadedGameDocument {
		return this.updateDocument(
			(document) =>
				assignRandomRolesByTeamCounts(document, counts, this.#domainServices, {
					language,
				}).game,
			"resolve",
		);
	}

	assignLoadedGameRolesByRoleCounts(
		counts: SelectedRoleCounts,
	): LoadedGameDocument {
		return this.updateDocument(
			(document) =>
				assignRandomRolesByRoleCounts(document, counts, this.#domainServices, {
					language,
				}).game,
			"resolve",
		);
	}

	getLoadedRolesForShowingEditorModel(): RolesForShowingEditorModel {
		return createRolesForShowingEditorModel(
			this.#session.requireLoadedGame().document,
			language,
		);
	}

	createLoadedRolesForShowingPresentation(
		draft: RolesForShowingDraft,
	): RolesForShowingPresentation {
		return createRolesForShowingPresentation(
			this.#session.requireLoadedGame().document,
			draft,
			language,
		);
	}

	updateLoadedRolesForShowing(draft: RolesForShowingDraft): LoadedGameDocument {
		return this.updateDocument(
			(document) => saveRolesForShowing(document, draft),
			"save",
		);
	}

	private updateDocument(
		update: (document: GameState) => GameState,
		operation: "save" | "delete" | "resolve",
	): LoadedGameDocument {
		return executeApplicationOperationSync(() => {
			const current = this.#session.requireLoadedGame();
			const updatedDocument = update(current.document);
			return updatedDocument === current.document
				? current
				: this.#session.replaceDocument(updatedDocument);
		}, operation);
	}
}
