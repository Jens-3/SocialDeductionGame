import { describe, expect, it } from "vitest";
import {
	changeShownRole,
	deleteEmptySeat,
	moveSeat,
	moveShownRole,
	type PlayerDraft,
	savePlayer as savePlayerInDomain,
} from "../src/domain/gameEditing";
import type { GameState } from "../src/domain/gameFactory";
import { EMPTY_PLAYER_ID } from "../src/domain/reservedIds";
import { fixedDomainServices } from "./fixedClock";
import { createTestGame } from "./fixtures";

const savePlayer = (
	game: GameState,
	command: Parameters<typeof savePlayerInDomain>[1],
	services: typeof fixedDomainServices,
) => {
	void services;
	return savePlayerInDomain(game, command);
};

describe("gameEditing", () => {
	it("verschiebt einen Sitzeintrag exakt auf eine höhere oder niedrigere Position", () => {
		const game = createEditorGame();
		const movedDown = moveSeat(
			game,
			{ fromSeatNumber: 2, toSeatNumber: 4 },
			fixedDomainServices,
		);
		expect(movedDown.seatOrder).toEqual([
			EMPTY_PLAYER_ID,
			"p_player2",
			"p_player3",
			"p_player1",
		]);
		expect(game.seatOrder).toEqual([
			EMPTY_PLAYER_ID,
			"p_player1",
			"p_player2",
			"p_player3",
		]);

		const movedUp = moveSeat(
			game,
			{ fromSeatNumber: 4, toSeatNumber: 2 },
			fixedDomainServices,
		);
		expect(movedUp.seatOrder).toEqual([
			EMPTY_PLAYER_ID,
			"p_player3",
			"p_player1",
			"p_player2",
		]);
	});

	it("weist ungültige Sitznummern zurück", () => {
		expect(() =>
			moveSeat(
				createEditorGame(),
				{ fromSeatNumber: 0, toSeatNumber: 2 },
				fixedDomainServices,
			),
		).toThrow("außerhalb");
	});

	it("verschiebt gezeigte Rollen ausschließlich in der Domain", () => {
		const game = createEditorGame();
		game.playersById.p_player1.roles.shownRoleIds = [
			"r_seer",
			"r_villager",
			"r_wolf",
		];

		const moved = moveShownRole(game, {
			playerId: "p_player1",
			fromIndex: 0,
			toInsertionIndex: 3,
		});

		expect(moved.playersById.p_player1.roles.shownRoleIds).toEqual([
			"r_villager",
			"r_wolf",
			"r_seer",
		]);
		expect(game.playersById.p_player1.roles.shownRoleIds).toEqual([
			"r_seer",
			"r_villager",
			"r_wolf",
		]);

		const movedBetween = moveShownRole(game, {
			playerId: "p_player1",
			fromIndex: 2,
			toInsertionIndex: 1,
		});
		expect(movedBetween.playersById.p_player1.roles.shownRoleIds).toEqual([
			"r_seer",
			"r_wolf",
			"r_villager",
		]);

		const movedBeforeFirst = moveShownRole(game, {
			playerId: "p_player1",
			fromIndex: 2,
			toInsertionIndex: 0,
		});
		expect(movedBeforeFirst.playersById.p_player1.roles.shownRoleIds).toEqual([
			"r_wolf",
			"r_seer",
			"r_villager",
		]);
	});

	it("ersetzt eine gezeigte Rolle und verhindert Duplikate", () => {
		const game = createEditorGame();
		game.playersById.p_player1.roles.shownRoleIds = ["r_seer", "r_villager"];

		const changed = changeShownRole(game, {
			playerId: "p_player1",
			index: 1,
			roleId: "r_wolf",
		});
		expect(changed.playersById.p_player1.roles.shownRoleIds).toEqual([
			"r_seer",
			"r_wolf",
		]);
		expect(() =>
			changeShownRole(game, {
				playerId: "p_player1",
				index: 1,
				roleId: "r_seer",
			}),
		).toThrow("bereits ausgewählt");
	});

	it("speichert den vollständigen Rollenstatus eines Spielers", () => {
		const game = createEditorGame();
		const player = draftOf(game, "p_player3");
		player.roles = {
			actualRoleId: "r_seer",
			shownRoleIds: ["r_seer"],
			nightRoleId: "r_seer",
		};
		const changed = savePlayer(
			game,
			{ originalPlayerId: "p_player3", player, seatNumber: 4 },
			fixedDomainServices,
		);

		expect(changed.playersById.p_player_3?.roles).toEqual(player.roles);
	});

	it("erstellt und bearbeitet konkrete Zustandsinstanzen", () => {
		const game = createEditorGame();
		const player = draftOf(game, "p_player3");
		player.statuses.push({
			id: "",
			statusId: "d_poisoned",
			fromNight: 999,
			untilNight: null,
		});
		const created = savePlayer(
			game,
			{ originalPlayerId: "p_player3", player, seatNumber: 4 },
			fixedDomainServices,
		);
		const status = created.playersById.p_player_3?.statuses[0];
		expect(status).toMatchObject({
			id: "s_poisoned_1",
			statusId: "d_poisoned",
			fromNight: 1,
			untilNight: 2,
		});
		if (!status) return;

		const updatedPlayer = draftOf(created, "p_player_3");
		updatedPlayer.statuses[0] = {
			...updatedPlayer.statuses[0],
			fromNight: 2,
			untilNight: null,
			note: "Bleibt",
		};
		const updated = savePlayer(
			created,
			{
				originalPlayerId: "p_player_3",
				player: updatedPlayer,
				seatNumber: 4,
			},
			fixedDomainServices,
		);
		expect(updated.playersById.p_player_3?.statuses[0]).toMatchObject({
			fromNight: 2,
			untilNight: null,
			note: "Bleibt",
		});
	});

	it("ignoriert player.id, erzeugt die ID aus dem Namen und zieht Referenzen nach", () => {
		const game = createEditorGame();
		game.playersById.p_player1?.statuses.push({
			id: "s_poisoned_1",
			statusId: "d_poisoned",
			fromNight: 1,
			untilNight: 2,
			source: { playerId: "p_player2" },
		});
		const player = draftOf(game, "p_player2");
		player.id = "p_diese_id_wird_ignoriert";
		player.name = "  Änne\nTest  ";
		const renamed = savePlayer(
			game,
			{ originalPlayerId: "p_player2", player, seatNumber: 3 },
			fixedDomainServices,
		);

		expect(renamed.seatOrder[2]).toBe("p_anne_test");
		expect(renamed.playersById.p_anne_test).toMatchObject({
			id: "p_anne_test",
			name: "Änne Test",
		});
		expect(renamed.playersById.p_diese_id_wird_ignoriert).toBeUndefined();
		expect(renamed.playersById.p_player1?.statuses[0]?.source?.playerId).toBe(
			"p_anne_test",
		);
	});

	it("verschiebt oder entfernt einen vorhandenen Spieler über seatNumber", () => {
		const game = createEditorGame();
		const player = draftOf(game, "p_player1");
		const moved = savePlayer(
			game,
			{ originalPlayerId: "p_player1", player, seatNumber: 4 },
			fixedDomainServices,
		);
		expect(moved.seatOrder).toEqual([
			EMPTY_PLAYER_ID,
			"p_player2",
			"p_player3",
			"p_player_1",
		]);

		const unseated = savePlayer(
			game,
			{ originalPlayerId: "p_player1", player, seatNumber: null },
			fixedDomainServices,
		);
		expect(unseated.seatOrder).toEqual([
			EMPTY_PLAYER_ID,
			EMPTY_PLAYER_ID,
			"p_player2",
			"p_player3",
		]);
		expect(unseated.playersById.p_player_1).toBeDefined();
		expect(unseated.playersById.p_player1).toBeUndefined();
	});

	it("setzt einen ungesetzten Spieler über denselben Speicherbefehl", () => {
		const game = createTestGame(2);
		game.seatOrder = ["p_player1", EMPTY_PLAYER_ID];
		const assigned = savePlayer(
			game,
			{
				originalPlayerId: "p_player2",
				player: draftOf(game, "p_player2"),
				seatNumber: 2,
			},
			fixedDomainServices,
		);
		expect(assigned.seatOrder).toEqual(["p_player1", "p_player_2"]);
	});

	it("erzeugt neue Spieler mit leerer oder beliebiger ignorierter Draft-ID", () => {
		const emptyIdGame = createTestGame(1);
		emptyIdGame.seatOrder.push(EMPTY_PLAYER_ID);
		const emptyIdPlayer = newPlayerDraft("Neue Person", "");
		const createdWithEmptyId = savePlayer(
			emptyIdGame,
			{ originalPlayerId: null, player: emptyIdPlayer, seatNumber: 2 },
			fixedDomainServices,
		);
		expect(createdWithEmptyId.seatOrder).toEqual([
			"p_player1",
			"p_neue_person",
		]);

		const arbitraryIdGame = createTestGame(1);
		arbitraryIdGame.seatOrder.push(EMPTY_PLAYER_ID);
		const arbitraryIdPlayer = newPlayerDraft("Neue Person", "p_zufall_123");
		const createdWithArbitraryId = savePlayer(
			arbitraryIdGame,
			{ originalPlayerId: null, player: arbitraryIdPlayer, seatNumber: 2 },
			fixedDomainServices,
		);
		expect(createdWithArbitraryId.seatOrder).toEqual([
			"p_player1",
			"p_neue_person",
		]);
		expect(createdWithArbitraryId.playersById.p_zufall_123).toBeUndefined();
	});

	it("prüft Kollisionen erst für die aus dem Namen erzeugte ID", () => {
		const game = createTestGame(1);
		const created = savePlayer(
			game,
			{
				originalPlayerId: null,
				player: newPlayerDraft("Player1", "p_unbenutzt"),
				seatNumber: null,
			},
			fixedDomainServices,
		);
		expect(created.playersById.p_player1_1).toBeDefined();
	});

	it("prüft GUI-Spielerdaten gezielt ohne Vollhydrierung des Games", () => {
		const game = createEditorGame();
		const invalidLifeState = draftOf(game, "p_player1");
		invalidLifeState.lifeState = "unknown";
		expect(() =>
			savePlayer(
				game,
				{
					originalPlayerId: "p_player1",
					player: invalidLifeState,
					seatNumber: 2,
				},
				fixedDomainServices,
			),
		).toThrow("lifeState");

		const unknownRole = draftOf(game, "p_player1");
		unknownRole.roles.actualRoleId = "r_unknown";
		expect(() =>
			savePlayer(
				game,
				{
					originalPlayerId: "p_player1",
					player: unknownRole,
					seatNumber: 2,
				},
				fixedDomainServices,
			),
		).toThrow("unbekannte Rolle");

		const invalidStatusDuration = draftOf(game, "p_player1");
		invalidStatusDuration.statuses = [
			{
				id: "s_poisoned_1",
				statusId: "d_poisoned",
				fromNight: 2,
				untilNight: 1,
			},
		];
		expect(() =>
			savePlayer(
				game,
				{
					originalPlayerId: "p_player1",
					player: invalidStatusDuration,
					seatNumber: 2,
				},
				fixedDomainServices,
			),
		).toThrow("untilNight");
	});

	it("löscht einen leeren Sitz als eigenständige Strukturänderung", () => {
		const game = createTestGame(2);
		game.seatOrder = ["p_player1", EMPTY_PLAYER_ID];
		const deleted = deleteEmptySeat(game, 2, fixedDomainServices);
		expect(deleted.seatOrder).toEqual(["p_player1"]);
		expect(deleted.playersById).toEqual(game.playersById);
	});
});

function createEditorGame(): GameState {
	const game = createTestGame(3);
	game.seatOrder = [EMPTY_PLAYER_ID, "p_player1", "p_player2", "p_player3"];
	game.time = { currentNight: 1, phase: "night" };
	game.ruleSetSnapshot.statuses = [
		{
			id: "d_poisoned",
			name: "Poisoned",
			defaultDuration: 2,
		},
	];
	game.statusDefinitionsById.d_poisoned = {
		id: "d_poisoned",
		name: "Poisoned",
		defaultDuration: 2,
	};
	return game;
}

function draftOf(game: GameState, playerId: string): PlayerDraft {
	const player = game.playersById[playerId];
	if (!player) throw new Error(`Testspieler "${playerId}" fehlt.`);
	return {
		id: player.id,
		name: player.name,
		names: player.names ? { ...player.names } : undefined,
		lifeState: player.lifeState,
		roles: { ...player.roles },
		statuses: player.statuses.map((status) => ({
			...status,
			source: status.source ? { ...status.source } : undefined,
		})),
		note: player.note,
		removed: player.removed ? { ...player.removed } : undefined,
	};
}

function newPlayerDraft(name: string, id: string): PlayerDraft {
	return {
		id,
		name,
		lifeState: "alive",
		roles: {
			actualRoleId: null,
			shownRoleIds: [],
			nightRoleId: null,
		},
		statuses: [],
	};
}
