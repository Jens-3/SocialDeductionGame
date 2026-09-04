import { describe, expect, it } from "vitest";

import {
	repairDuplicatePlayerIdsInSeatOrder,
	repairOrphanedPlayerIdsInSeatOrder,
	repairOrphanedPlayerRoleIds,
	repairOrphanedRolesForShowingRoleIds,
	repairOrphanedRoleTeamIds,
	repairResolvableGameEntityReferenceIds,
} from "../src/domain/gameReferenceRepair";
import { Role } from "../src/domain/models";
import { createTestGame } from "./fixtures";

describe("repairDuplicatePlayerIdsInSeatOrder", () => {
	it("ändert eine eindeutige Platzreihenfolge nicht", () => {
		const game = createTestGame();

		expect(repairDuplicatePlayerIdsInSeatOrder(game)).toBe(0);
		expect(game.seatOrder).toEqual(["p_player1", "p_player2", "p_player3"]);
	});

	it("behält nur das erste Vorkommen jeder Player-ID", () => {
		const game = createTestGame();
		game.seatOrder = [
			"p_player1",
			"p_player2",
			"p_player1",
			"p_player3",
			"p_player2",
			"p_player1",
		];

		expect(repairDuplicatePlayerIdsInSeatOrder(game)).toBe(3);
		expect(game.seatOrder).toEqual(["p_player1", "p_player2", "p_player3"]);
	});

	it("behält den mehrfach erlaubten Platzhalter p_empty", () => {
		const game = createTestGame();
		game.seatOrder = ["p_player1", "p_empty", "p_empty", "p_player2"];

		expect(repairDuplicatePlayerIdsInSeatOrder(game)).toBe(0);
		expect(game.seatOrder).toEqual([
			"p_player1",
			"p_empty",
			"p_empty",
			"p_player2",
		]);
	});
});

describe("repairResolvableGameEntityReferenceIds", () => {
	it("normalisiert ausschließlich Referenzen auf tatsächlich vorhandene Ziele", () => {
		const game = createTestGame();
		const role = game.ruleSetSnapshot.roles[0];
		const player = game.playersById.p_player1;
		expect(role).toBeDefined();
		expect(player).toBeDefined();
		if (!role || !player) return;

		role.teamId = "good";
		player.roles = {
			actualRoleId: "seer",
			shownRoleIds: ["villager"],
			nightRoleId: "p_wolf",
			claimedRoleId: "r_seer",
		};
		player.statuses = [
			{
				id: "s_marked_1",
				statusId: "d_marked",
				fromNight: 0,
				untilNight: null,
				source: {
					playerId: "player2",
					roleIdAtTime: "seer",
				},
			},
		];

		expect(repairResolvableGameEntityReferenceIds(game)).toBe(6);
		expect(role.teamId).toBe("t_good");
		expect(player.roles).toEqual({
			actualRoleId: "r_seer",
			shownRoleIds: ["r_villager"],
			nightRoleId: "r_wolf",
			claimedRoleId: "r_seer",
		});
		expect(player.statuses[0]?.source).toMatchObject({
			playerId: "p_player2",
			roleIdAtTime: "r_seer",
		});
		expect(repairResolvableGameEntityReferenceIds(game)).toBe(0);
	});

	it("bewahrt nicht auflösbare historische Referenzen", () => {
		const game = createTestGame();
		const player = game.playersById.p_player1;
		expect(player).toBeDefined();
		if (!player) return;
		player.statuses = [
			{
				id: "s_legacy_1",
				statusId: "d_legacy",
				fromNight: 0,
				untilNight: null,
				source: {
					playerId: "deleted_player",
					roleIdAtTime: "deleted_role",
				},
			},
		];

		expect(repairResolvableGameEntityReferenceIds(game)).toBe(0);
		expect(player.statuses[0]?.source).toMatchObject({
			playerId: "deleted_player",
			roleIdAtTime: "deleted_role",
		});
	});
});

describe("repairOrphanedPlayerIdsInSeatOrder", () => {
	it("entfernt Sitzordnungseinträge ohne vorhandenen Spieler", () => {
		const game = createTestGame();
		game.seatOrder = ["missing", "p_player1", "p_player2", "also_missing"];

		expect(repairOrphanedPlayerIdsInSeatOrder(game)).toBe(2);
		expect(game.seatOrder).toEqual(["p_player1", "p_player2"]);
	});

	it("behält p_empty ohne zugehöriges Player-Objekt", () => {
		const game = createTestGame();
		game.seatOrder = ["p_empty", "p_player1", "p_empty"];

		expect(repairOrphanedPlayerIdsInSeatOrder(game)).toBe(0);
		expect(game.seatOrder).toEqual(["p_empty", "p_player1", "p_empty"]);
	});
});

describe("repairOrphanedRoleTeamIds", () => {
	it("ändert gültige Team-Referenzen nicht", () => {
		const game = createTestGame();

		expect(repairOrphanedRoleTeamIds(game)).toBe(0);
		expect(game.ruleSetSnapshot.roles[0]?.teamId).toBe("t_good");
	});

	it("verschiebt eine Rolle mit unbekannter Team-ID nach unknown", () => {
		const game = createTestGame();
		const role = new Role({
			id: "orphan",
			name: "Orphan",
			teamId: "missing_team",
		});
		game.ruleSetSnapshot.roles.push(role);

		expect(repairOrphanedRoleTeamIds(game)).toBe(1);
		expect(role.teamId).toBe("t_unknown");
	});

	it("repariert auch eine fehlende teamId", () => {
		const game = createTestGame();
		const role = new Role({
			id: "legacy",
			name: "Legacy",
			teamId: "t_good",
		});
		delete (role as unknown as { teamId?: string }).teamId;
		game.ruleSetSnapshot.roles.push(role);

		expect(repairOrphanedRoleTeamIds(game)).toBe(1);
		expect(role.teamId).toBe("t_unknown");
	});
});

describe("repairOrphanedPlayerRoleIds", () => {
	it("repariert ungültige Rollenreferenzen in abhängiger Reihenfolge", () => {
		const game = createTestGame();
		const player = game.playersById.p_player1;
		expect(player).toBeDefined();
		if (!player) return;
		player.roles = {
			actualRoleId: "missing_actual",
			shownRoleIds: ["missing_shown"],
			nightRoleId: "missing_night",
			claimedRoleId: "missing_claim",
		};

		expect(repairOrphanedPlayerRoleIds(game)).toBe(4);
		expect(player.roles).toEqual({
			actualRoleId: null,
			shownRoleIds: [],
			nightRoleId: null,
			claimedRoleId: undefined,
		});
	});

	it("übernimmt bei ungültiger Anzeige- und Nachtrolle die vorherige Stufe", () => {
		const game = createTestGame();
		const player = game.playersById.p_player1;
		expect(player).toBeDefined();
		if (!player) return;
		player.roles = {
			actualRoleId: "r_seer",
			shownRoleIds: ["missing_shown"],
			nightRoleId: "missing_night",
			claimedRoleId: "r_villager",
		};

		expect(repairOrphanedPlayerRoleIds(game)).toBe(2);
		expect(player.roles).toEqual({
			actualRoleId: "r_seer",
			shownRoleIds: ["r_seer"],
			nightRoleId: "r_seer",
			claimedRoleId: "r_villager",
		});
	});
});

describe("repairOrphanedRolesForShowingRoleIds", () => {
	it("entfernt unbekannte Rollen und bewahrt Reihenfolge sowie Duplikate", () => {
		const game = createTestGame();
		game.rolesForShowing = {
			roles: ["r_seer", "r_missing", "r_seer", "r_wolf", "r_missing"],
			showRoleSymbols: false,
		};

		expect(repairOrphanedRolesForShowingRoleIds(game)).toBe(2);
		expect(game.rolesForShowing.roles).toEqual(["r_seer", "r_seer", "r_wolf"]);
		expect(repairOrphanedRolesForShowingRoleIds(game)).toBe(0);
	});

	it("ändert einen Spielstand ohne Zeigeliste nicht", () => {
		const game = createTestGame();

		expect(repairOrphanedRolesForShowingRoleIds(game)).toBe(0);
		expect(game.rolesForShowing).toBeUndefined();
	});
});
