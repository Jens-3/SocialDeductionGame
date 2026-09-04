import { describe, expect, it } from "vitest";

import {
	repairIds,
	repairInvalidGameEntityIdPrefixes,
	repairInvalidGameEntityIds,
	repairMismatchedGameEntityRecordIds,
	repairReservedEmptyPlayerId,
} from "../src/domain/gameIdRepair";
import { Player, Role, Team } from "../src/domain/models";
import { isIdForArea } from "../src/domain/stringSanitizer";
import { createTestGame } from "./fixtures";

describe("repairReservedEmptyPlayerId", () => {
	it("benennt einen echten Player p_empty um und bewahrt leere Sitze", () => {
		const game = createTestGame();
		const player = new Player({ id: "p_empty", name: "Empty" });
		game.playersById.p_empty = player;
		game.seatOrder = ["p_empty", "p_player1", "p_empty"];

		expect(repairReservedEmptyPlayerId(game)).toBe(1);
		expect(game.playersById.p_empty).toBeUndefined();
		expect(player.id).toBe("p_empty_1");
		expect(game.playersById.p_empty_1).toBe(player);
		expect(game.seatOrder).toEqual(["p_empty", "p_player1", "p_empty"]);
	});
});

describe("repairIds", () => {
	it("ändert einen konsistenten Spielstand nicht", () => {
		const game = createTestGame();

		expect(repairIds(game)).toBe(0);
	});

	it("repariert unknown-Belegungen vor dem Anlegen des unknown-Teams", () => {
		const game = createTestGame();
		game.ruleSetSnapshot.teams = game.ruleSetSnapshot.teams.filter(
			(team) => team.id !== "t_unknown",
		);
		const role = new Role({
			id: "t_unknown",
			name: "Unknown role",
			teamId: "t_good",
		});
		game.ruleSetSnapshot.roles.push(role);
		game.playersById.t_unknown = new Player({
			id: "t_unknown",
			name: "Unknown player",
		});

		expect(repairIds(game)).not.toBe(0);
		expect(
			game.ruleSetSnapshot.roles.find(({ name }) => name === "Unknown role")
				?.id,
		).toBe("r_unknown");
		expect(game.playersById.p_unknown?.id).toBe("p_unknown");
		expect(game.ruleSetSnapshot.teams).toContainEqual(
			expect.objectContaining({ id: "t_unknown", isSystem: true }),
		);
	});

	it("repariert kombinierte Inkonsistenzen in abhängiger Reihenfolge", () => {
		const game = createTestGame();
		const originalUnknown = game.ruleSetSnapshot.teams.find(
			(team) => team.id === "t_unknown",
		);
		expect(originalUnknown).toBeDefined();
		if (!originalUnknown) return;
		const preferredUnknown = new Team({
			id: "t_unknown",
			name: "Preferred unknown",
			teamOrder: 1_200,
			isSystem: true,
		});
		const duplicateGood = new Team({
			id: "t_good",
			name: "Duplicate good",
			teamOrder: 30,
		});
		game.ruleSetSnapshot.teams.push(preferredUnknown, duplicateGood);
		const orphan = new Role({
			id: "r_orphan",
			name: "Orphan",
			teamId: "t_missing_team",
		});
		game.ruleSetSnapshot.roles.push(orphan);
		game.seatOrder.push("p_player1", "p_player2");

		expect(repairIds(game)).not.toBe(0);
		expect(
			game.ruleSetSnapshot.teams.find(
				({ name }) => name === "Preferred unknown",
			),
		).toMatchObject({
			id: "t_unknown",
			isSystem: true,
		});
		expect(
			game.ruleSetSnapshot.teams.find(
				({ name }) => name === originalUnknown.name,
			),
		).toMatchObject({
			id: "t_unknown_1",
			isSystem: false,
		});
		expect(
			game.ruleSetSnapshot.teams.find(({ name }) => name === duplicateGood.name)
				?.id,
		).toBe("t_good_1");
		expect(
			game.ruleSetSnapshot.roles.find(({ name }) => name === orphan.name)
				?.teamId,
		).toBe("t_unknown");
		expect(game.seatOrder).toEqual(["p_player1", "p_player2", "p_player3"]);
	});

	it("ist bei wiederholter Anwendung idempotent", () => {
		const game = createTestGame();
		game.ruleSetSnapshot.teams.push(
			new Team({ id: "t_good", name: "Duplicate good", teamOrder: 30 }),
		);
		game.ruleSetSnapshot.roles.push(
			new Role({
				id: "t_unknown",
				name: "Unknown orphan",
				teamId: "t_missing_team",
			}),
		);
		game.playersById.legacy_duplicate = new Player({
			id: "p_player1",
			name: "Duplicate player",
		});
		game.ruleSetSnapshot.statuses = [{ id: "d_poisoned", name: "Poisoned" }];
		game.statusDefinitionsById.d_poisoned = {
			id: "d_poisoned",
			name: "Poisoned",
		};
		const player = game.playersById.p_player2;
		expect(player).toBeDefined();
		if (!player) return;
		player.roles = {
			actualRoleId: "r_missing_actual",
			shownRoleIds: ["r_missing_shown"],
			nightRoleId: "r_missing_night",
			claimedRoleId: "r_missing_claim",
		};
		player.statuses = [
			{
				id: "d_poisoned",
				statusId: "d_poisoned",
				fromNight: 0,
				untilNight: null,
			},
		];
		game.seatOrder.push(
			"p_player1",
			"legacy_duplicate",
			"p_player2",
			"missing_player",
		);

		expect(repairIds(game)).not.toBe(0);
		const stateAfterFirstRepair = JSON.stringify(game);

		expect(repairIds(game)).toBe(0);
		expect(JSON.stringify(game)).toBe(stateAfterFirstRepair);
	});
});

describe("repairInvalidGameEntityIds", () => {
	it("repariert Spiel-, Template-, Regelwerk- und Log-IDs", () => {
		const game = createTestGame();
		game.id = "Legacy Game";
		game.ruleSetSnapshot.id = "Legacy Rules";
		game.log = [
			{
				id: "Old Log",
				night: 0,
				phase: "setup",
				createdAt: "2026-01-02T03:04:05.000Z",
				type: "test",
				text: "First",
			},
			{
				id: "Old Log",
				night: 0,
				phase: "setup",
				createdAt: "2026-01-02T03:04:05.000Z",
				type: "test",
				text: "Second",
			},
		];

		expect(repairInvalidGameEntityIds(game)).toBe(4);
		expect(game.id).toBe("game_legacy_game");
		expect(game.ruleSetSnapshot.id).toBe("ruleset_legacy_rules");
		expect(game.log.map((entry) => entry.id)).toEqual([
			"log_old_log",
			"log_old_log_1",
		]);

		game.isTemplate = true;
		game.id = "Legacy Template";
		expect(repairInvalidGameEntityIds(game)).toBe(1);
		expect(game.id).toBe("template_legacy_template");
	});

	it("repariert alle ID-Arten und zieht ihre Referenzen nach", () => {
		const game = createTestGame();
		const team = game.ruleSetSnapshot.teams[0];
		const role = game.ruleSetSnapshot.roles[0];
		const player = game.playersById.p_player1;
		expect(team).toBeDefined();
		expect(role).toBeDefined();
		expect(player).toBeDefined();
		if (!team || !role || !player) return;

		setReadonlyIdForTest(team, "Bad Team");
		role.teamId = "Bad Team";
		role.id = "Bad Role";
		role.apply_status_effect = ["Bad Status"];
		player.roles = {
			actualRoleId: "Bad Role",
			shownRoleIds: ["Bad Role"],
			nightRoleId: "Bad Role",
			claimedRoleId: "Bad Role",
		};
		delete game.playersById.p_player1;
		setReadonlyIdForTest(player, "Bad Player");
		game.playersById["Bad Player"] = player;
		game.seatOrder = game.seatOrder.map((id) =>
			id === "p_player1" ? "Bad Player" : id,
		);
		const runtimeDefinition = { id: "Bad Status", name: "Bad Status" };
		game.statusDefinitionsById["Bad Status"] = runtimeDefinition;
		game.ruleSetSnapshot.statuses = [{ id: "Bad Status", name: "Bad Status" }];
		player.statuses = [
			{
				id: "Bad Instance",
				statusId: "Bad Status",
				fromNight: 0,
				untilNight: 0,
				source: { playerId: "Bad Player" },
			},
		];

		expect(repairIds(game)).not.toBe(0);
		expect(
			game.ruleSetSnapshot.teams.find(({ name }) => name === team.name)?.id,
		).toBe("t_bad_team");
		expect(
			game.ruleSetSnapshot.roles.find(({ name }) => name === role.name),
		).toMatchObject({
			id: "r_bad_role",
			teamId: "t_bad_team",
			apply_status_effect: ["d_bad_status"],
		});
		expect(player.roles).toEqual({
			actualRoleId: "r_bad_role",
			shownRoleIds: ["r_bad_role"],
			nightRoleId: "r_bad_role",
			claimedRoleId: "r_bad_role",
		});
		expect(game.playersById["Bad Player"]).toBeUndefined();
		expect(game.playersById.p_bad_player).toBe(player);
		expect(game.seatOrder).toContain("p_bad_player");
		expect(game.statusDefinitionsById.d_bad_status?.id).toBe("d_bad_status");
		expect(game.ruleSetSnapshot.statuses[0]?.id).toBe("d_bad_status");
		expect(player.statuses[0]).toMatchObject({
			id: "s_bad_instance",
			statusId: "d_bad_status",
			source: { playerId: "p_bad_player" },
		});
		expect(repairIds(game)).toBe(0);
	});

	it("nummeriert eine normalisierte ID bei einer Kollision", () => {
		const game = createTestGame();
		const duplicate = new Team({
			id: "temporary",
			name: "Duplicate good",
			teamOrder: 30,
		});
		setReadonlyIdForTest(duplicate, "Good!");
		const role = new Role({
			id: "r_follower",
			name: "Follower",
			teamId: "t_good",
		});
		role.teamId = "Good!";
		game.ruleSetSnapshot.teams.push(duplicate);
		game.ruleSetSnapshot.roles.push(role);

		expect(repairInvalidGameEntityIds(game)).toBe(1);
		expect(duplicate.id).toBe("t_good_1");
		expect(role.teamId).toBe("t_good_1");
	});

	it("normalisiert verbliebene ungültige Sitzordnungseinträge", () => {
		const game = createTestGame();
		game.seatOrder.push("Loose Seat");

		expect(repairInvalidGameEntityIds(game)).toBe(1);
		expect(game.seatOrder.at(-1)).toBe("p_loose_seat");
	});
});

describe("repairInvalidGameEntityIdPrefixes", () => {
	it("korrigiert ausschließlich die Bereichspräfixe aller ID-Arten", () => {
		const game = createTestGame();
		game.id = "x_session";
		game.ruleSetSnapshot.id = "x_rules";
		game.log = [
			{
				id: "x_entry",
				night: 0,
				phase: "setup",
				createdAt: "2026-01-02T03:04:05.000Z",
				type: "test",
				text: "Entry",
			},
		];

		const outsider = new Team({
			id: "p_outsider",
			name: "Outsider",
			teamOrder: 30,
		});
		const outsiderRole = new Role({
			id: "t_outsider_role",
			name: "Outsider role",
			teamId: "p_outsider",
			apply_status_effect: ["p_poisoned"],
		});
		game.ruleSetSnapshot.teams.push(outsider);
		game.ruleSetSnapshot.roles.push(outsiderRole);

		const player = game.playersById.p_player1;
		expect(player).toBeDefined();
		if (!player) return;
		delete game.playersById.p_player1;
		setReadonlyIdForTest(player, "t_alice");
		game.playersById.t_alice = player;
		game.seatOrder = ["t_alice", "t_unassigned_seat"];

		const definition = { id: "p_poisoned", name: "Poisoned" };
		game.statusDefinitionsById.p_poisoned = { ...definition };
		game.ruleSetSnapshot.statuses = [definition];
		player.statuses = [
			{
				id: "d_poisoned_instance",
				statusId: "p_poisoned",
				fromNight: 0,
				untilNight: null,
				source: { playerId: "t_alice" },
			},
		];

		expect(repairInvalidGameEntityIdPrefixes(game)).toBe(8);
		expect(
			game.ruleSetSnapshot.teams.find(({ name }) => name === outsider.name)?.id,
		).toBe("t_outsider");
		expect(
			game.ruleSetSnapshot.roles.find(({ name }) => name === outsiderRole.name),
		).toMatchObject({
			id: "r_outsider_role",
			teamId: "t_outsider",
			apply_status_effect: ["p_poisoned"],
		});
		expect(game.playersById.p_alice).toBe(player);
		expect(game.seatOrder).toEqual(["p_alice", "p_unassigned_seat"]);
		expect(player.statuses[0]).toMatchObject({
			id: "s_poisoned_instance",
			statusId: "p_poisoned",
			source: { playerId: "p_alice" },
		});

		expect(isIdForArea(game.id, "game")).toBe(true);
		expect(isIdForArea(game.ruleSetSnapshot.id, "ruleSet")).toBe(true);
		expect(game.log.every((entry) => isIdForArea(entry.id, "log"))).toBe(true);
		expect(
			game.ruleSetSnapshot.teams.every((team) => isIdForArea(team.id, "team")),
		).toBe(true);
		expect(
			game.ruleSetSnapshot.roles.every((role) => isIdForArea(role.id, "role")),
		).toBe(true);
		expect(
			Object.values(game.playersById).every((entry) =>
				isIdForArea(entry.id, "player"),
			),
		).toBe(true);
	});

	it("bewahrt gültige Log-IDs und nummeriert kollidierende Reparaturen", () => {
		const game = createTestGame();
		game.log = [
			{
				id: "x_entry",
				night: 0,
				phase: "setup",
				createdAt: "2026-01-02T03:04:05.000Z",
				type: "legacy",
				text: "Legacy",
			},
			{
				id: "log_entry",
				night: 0,
				phase: "setup",
				createdAt: "2026-01-02T03:04:05.000Z",
				type: "current",
				text: "Current",
			},
		];

		expect(repairInvalidGameEntityIdPrefixes(game)).toBe(1);
		expect(game.log.map(({ id }) => id)).toEqual(["log_entry_1", "log_entry"]);
		expect(repairInvalidGameEntityIdPrefixes(game)).toBe(0);
	});

	it("bewahrt bei einer Player-Präfixkollision Sitz und Statusquelle", () => {
		const game = createTestGame();
		const current = new Player({ id: "p_alice", name: "Current Alice" });
		const legacy = new Player({ id: "t_alice", name: "Legacy Alice" });
		const sourceOwner = game.playersById.p_player1;
		expect(sourceOwner).toBeDefined();
		if (!sourceOwner) return;
		game.playersById.p_alice = current;
		game.playersById.t_alice = legacy;
		game.seatOrder = ["t_alice", "p_alice"];
		sourceOwner.statuses = [
			{
				id: "s_legacy_source",
				statusId: "d_marked",
				fromNight: 0,
				untilNight: null,
				source: { playerId: "t_alice" },
			},
		];

		expect(repairInvalidGameEntityIdPrefixes(game)).toBe(1);
		expect(game.playersById.p_alice).toBe(current);
		expect(game.playersById.p_alice_1).toBe(legacy);
		expect(game.seatOrder).toEqual(["p_alice_1", "p_alice"]);
		expect(sourceOwner.statuses[0]?.source?.playerId).toBe("p_alice_1");
		expect(repairInvalidGameEntityIdPrefixes(game)).toBe(0);
	});
});

describe("repairMismatchedGameEntityRecordIds", () => {
	it("gleicht Record-Schlüssel an Objekt-IDs an und führt Referenzen mit", () => {
		const game = createTestGame();
		const player = game.playersById.p_player1;
		const sourceOwner = game.playersById.p_player2;
		const role = game.ruleSetSnapshot.roles[0];
		expect(player).toBeDefined();
		expect(sourceOwner).toBeDefined();
		expect(role).toBeDefined();
		if (!player || !sourceOwner || !role) return;

		delete game.playersById.p_player1;
		setReadonlyIdForTest(player, "p_anna");
		game.playersById.p_alice = player;
		game.seatOrder = game.seatOrder.map((id) =>
			id === "p_player1" ? "p_alice" : id,
		);
		sourceOwner.statuses = [
			{
				id: "s_marked_1",
				statusId: "d_marked",
				fromNight: 0,
				untilNight: null,
				source: { playerId: "p_alice" },
			},
		];

		const definition = { id: "d_drunk", name: "Drunk" };
		game.statusDefinitionsById.d_poisoned = definition;
		game.ruleSetSnapshot.statuses = [{ ...definition }];
		role.apply_status_effect = ["d_poisoned"];
		player.statuses = [
			{
				id: "s_drunk_1",
				statusId: "d_poisoned",
				fromNight: 0,
				untilNight: null,
			},
		];

		expect(repairMismatchedGameEntityRecordIds(game)).toBe(1);
		expect(game.playersById.p_alice).toBeUndefined();
		expect(game.playersById.p_anna).toBe(player);
		expect(game.seatOrder).toContain("p_anna");
		expect(sourceOwner.statuses[0]?.source?.playerId).toBe("p_anna");
		// Der Statusindex ist abgeleitet und wird nur vom zentralen repairIds()-Pfad
		// aus ruleSetSnapshot.statuses neu aufgebaut.
		expect(game.statusDefinitionsById.d_poisoned).toBe(definition);
		expect(repairMismatchedGameEntityRecordIds(game)).toBe(0);
	});

	it("überschreibt bei einem belegten Zielschlüssel kein Objekt", () => {
		const game = createTestGame();
		const mismatchedPlayer = new Player({ id: "p_anna", name: "Other Anna" });
		const existingPlayer = new Player({ id: "p_anna", name: "Anna" });
		game.playersById.p_alice = mismatchedPlayer;
		game.playersById.p_anna = existingPlayer;
		game.seatOrder.push("p_alice", "p_anna");

		const mismatchedDefinition = { id: "d_drunk", name: "Other drunk" };
		const existingDefinition = { id: "d_drunk", name: "Drunk" };
		game.statusDefinitionsById.d_poisoned = mismatchedDefinition;
		game.statusDefinitionsById.d_drunk = existingDefinition;

		expect(repairMismatchedGameEntityRecordIds(game)).toBe(1);
		expect(game.playersById.p_anna).toBe(existingPlayer);
		expect(game.playersById.p_anna_1).toBe(mismatchedPlayer);
		expect(mismatchedPlayer.id).toBe("p_anna_1");
		expect(game.seatOrder).toContain("p_anna_1");
		expect(game.statusDefinitionsById.d_drunk).toBe(existingDefinition);
		expect(game.statusDefinitionsById.d_poisoned).toBe(mismatchedDefinition);
	});
});

function setReadonlyIdForTest(entity: object, id: string): void {
	(entity as { id: string }).id = id;
}
