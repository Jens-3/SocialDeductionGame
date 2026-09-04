import { describe, expect, it } from "vitest";

import { repairDuplicateGameEntityIds } from "../src/domain/gameEntityIdRepair";
import { repairIds } from "../src/domain/gameIdRepair";
import { Player, Role, Team } from "../src/domain/models";
import { createTestGame } from "./fixtures";

describe("repairDuplicateGameEntityIds", () => {
	it("ändert einen konsistenten Spielstand nicht", () => {
		const game = createTestGame();

		expect(repairDuplicateGameEntityIds(game)).toBe(0);
	});

	it("nummeriert doppelte Log-IDs im separaten Log-Namensraum", () => {
		const game = createTestGame();
		game.log = [
			{
				id: "log_event",
				night: 0,
				phase: "setup",
				createdAt: "2026-01-02T03:04:05.000Z",
				type: "first",
				text: "First",
			},
			{
				id: "log_event",
				night: 0,
				phase: "setup",
				createdAt: "2026-01-02T03:04:05.000Z",
				type: "duplicate",
				text: "Duplicate",
			},
			{
				id: "log_event_1",
				night: 0,
				phase: "setup",
				createdAt: "2026-01-02T03:04:05.000Z",
				type: "reserved",
				text: "Reserved",
			},
		];

		expect(repairDuplicateGameEntityIds(game)).toBe(1);
		expect(game.log.map(({ id }) => id)).toEqual([
			"log_event",
			"log_event_2",
			"log_event_1",
		]);
		expect(repairDuplicateGameEntityIds(game)).toBe(0);
	});

	it("nummeriert doppelte Team-IDs und lässt Rollenreferenzen unverändert", () => {
		const game = createTestGame();
		const original = game.ruleSetSnapshot.teams[0];
		const duplicate = new Team({
			id: "t_good",
			name: "Good duplicate",
			teamOrder: 30,
		});
		game.ruleSetSnapshot.teams.push(duplicate);

		expect(repairDuplicateGameEntityIds(game)).toBe(1);
		expect(original?.id).toBe("t_good");
		expect(duplicate.id).toBe("t_good_1");
		expect(game.ruleSetSnapshot.roles[0]?.teamId).toBe("t_good");
	});

	it("überspringt bereits vergebene Nummern", () => {
		const game = createTestGame();
		const duplicate = new Team({
			id: "t_good",
			name: "Good duplicate",
			teamOrder: 30,
		});
		game.ruleSetSnapshot.teams.push(
			new Team({ id: "t_good_1", name: "Reserved", teamOrder: 40 }),
			duplicate,
		);

		repairDuplicateGameEntityIds(game);
		expect(duplicate.id).toBe("t_good_2");
	});

	it("nummeriert doppelte Rollen-IDs und lässt Spielerreferenzen unverändert", () => {
		const game = createTestGame();
		const duplicate = new Role({
			id: "r_seer",
			name: "Seer duplicate",
			teamId: "t_evil",
		});
		game.ruleSetSnapshot.roles.push(duplicate);
		const player = game.playersById.p_player1;
		expect(player).toBeDefined();
		if (!player) return;
		player.roles.actualRoleId = "r_seer";

		expect(repairDuplicateGameEntityIds(game)).toBe(1);
		expect(game.ruleSetSnapshot.roles[0]?.id).toBe("r_seer");
		expect(duplicate.id).toBe("r_seer_1");
		expect(player.roles.actualRoleId).toBe("r_seer");
	});

	it("repariert doppelte Player-IDs samt eindeutig zuordenbaren Referenzen", () => {
		const game = createTestGame();
		game.playersById.legacy_duplicate = new Player({
			id: "p_player1",
			name: "Duplicate Player",
		});
		game.seatOrder.push("legacy_duplicate");
		const sourceOwner = game.playersById.p_player2;
		expect(sourceOwner).toBeDefined();
		if (!sourceOwner) return;
		sourceOwner.statuses.push({
			id: "s_status_1",
			statusId: "d_marked",
			fromNight: 0,
			untilNight: null,
			source: { playerId: "legacy_duplicate" },
		});

		expect(repairDuplicateGameEntityIds(game)).toBe(1);
		expect(game.playersById.p_player1?.id).toBe("p_player1");
		expect(game.playersById.legacy_duplicate).toBeUndefined();
		expect(game.playersById.p_player1_1?.id).toBe("p_player1_1");
		expect(game.seatOrder).toContain("p_player1_1");
		expect(sourceOwner.statuses[0]?.source?.playerId).toBe("p_player1_1");
	});

	it("behandelt IDs typübergreifend als gemeinsamen Namensraum", () => {
		const game = createTestGame();
		const collidingRole = new Role({
			id: "t_good",
			name: "Colliding role",
			teamId: "t_good",
		});
		game.ruleSetSnapshot.roles.push(collidingRole);
		game.playersById.legacy_player = new Player({
			id: "t_good",
			name: "Colliding player",
		});

		expect(repairDuplicateGameEntityIds(game)).toBe(2);
		expect(game.ruleSetSnapshot.teams[0]?.id).toBe("t_good");
		expect(collidingRole.id).toBe("r_good");
		expect(game.playersById.p_good?.id).toBe("p_good");
	});

	it("repariert eine Statusdefinition, die mit einer Team-ID kollidiert", () => {
		const game = createTestGame();
		const definition = { id: "t_good", name: "Marked" };
		game.ruleSetSnapshot.statuses = [definition];
		game.statusDefinitionsById.t_good = { ...definition };
		const role = game.ruleSetSnapshot.roles[0];
		const player = game.playersById.p_player1;
		expect(role).toBeDefined();
		expect(player).toBeDefined();
		if (!role || !player) return;
		role.apply_status_effect = ["t_good"];
		player.statuses = [
			{
				id: "status_instance",
				statusId: "t_good",
				fromNight: 0,
				untilNight: null,
			},
		];

		expect(repairIds(game)).not.toBe(0);
		expect(game.ruleSetSnapshot.statuses?.[0]?.id).toBe("d_good");
		expect(game.statusDefinitionsById.t_good).toBeUndefined();
		expect(game.statusDefinitionsById.d_good?.id).toBe("d_good");
		expect(
			game.ruleSetSnapshot.roles.find(({ id }) => id === role.id)
				?.apply_status_effect,
		).toEqual(["d_good"]);
		expect(player.statuses[0]?.statusId).toBe("d_good");
	});

	it("nummeriert doppelte Statusdefinitionen ohne mehrdeutige Referenzen umzubiegen", () => {
		const game = createTestGame();
		const first = { id: "d_marked", name: "First" };
		const duplicate = { id: "d_marked", name: "Duplicate" };
		game.ruleSetSnapshot.statuses = [first, duplicate];
		game.statusDefinitionsById.d_marked = { ...first };
		const role = game.ruleSetSnapshot.roles[0];
		expect(role).toBeDefined();
		if (!role) return;
		role.apply_status_effect = ["d_marked"];

		expect(repairIds(game)).not.toBe(0);
		expect(game.ruleSetSnapshot.statuses?.[0]?.id).toBe("d_marked");
		expect(game.ruleSetSnapshot.statuses?.[1]?.id).toBe("d_marked_1");
		expect(game.statusDefinitionsById.d_marked?.name).toBe("First");
		expect(game.statusDefinitionsById.d_marked_1?.name).toBe("Duplicate");
		expect(role.apply_status_effect).toEqual(["d_marked"]);
	});

	it("repariert doppelte Statusdefinitionen auch als direkter Teilschritt", () => {
		const game = createTestGame();
		const first = { id: "d_marked", name: "First" };
		const duplicate = { id: "d_marked", name: "Duplicate" };
		game.ruleSetSnapshot.statuses = [first, duplicate];
		game.statusDefinitionsById.d_marked = { ...first };

		expect(repairDuplicateGameEntityIds(game)).toBe(1);
		expect(game.ruleSetSnapshot.statuses).toEqual([
			first,
			expect.objectContaining({ id: "d_marked_1", name: "Duplicate" }),
		]);
		expect(game.statusDefinitionsById.d_marked).toEqual(first);
		expect(game.statusDefinitionsById.d_marked_1).toEqual({
			id: "d_marked_1",
			name: "Duplicate",
		});
		expect(repairDuplicateGameEntityIds(game)).toBe(0);
	});

	it("nummeriert kollidierende Statusinstanzen im gemeinsamen Namensraum", () => {
		const game = createTestGame();
		game.ruleSetSnapshot.statuses = [{ id: "d_poisoned", name: "Poisoned" }];
		game.statusDefinitionsById.d_poisoned = {
			id: "d_poisoned",
			name: "Poisoned",
		};
		const firstPlayer = game.playersById.p_player1;
		const secondPlayer = game.playersById.p_player2;
		expect(firstPlayer).toBeDefined();
		expect(secondPlayer).toBeDefined();
		if (!firstPlayer || !secondPlayer) return;
		firstPlayer.statuses = [
			{
				id: "d_poisoned",
				statusId: "d_poisoned",
				fromNight: 0,
				untilNight: null,
			},
		];
		secondPlayer.statuses = [
			{
				id: "d_poisoned",
				statusId: "d_poisoned",
				fromNight: 0,
				untilNight: null,
			},
		];

		expect(repairDuplicateGameEntityIds(game)).toBe(2);
		expect(firstPlayer.statuses[0]?.id).toBe("s_poisoned_1");
		expect(secondPlayer.statuses[0]?.id).toBe("s_poisoned_2");
	});
});
