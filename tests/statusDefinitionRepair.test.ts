import { describe, expect, it } from "vitest";

import { repairIds } from "../src/domain/gameIdRepair";
import { repairStatusDefinitionsAndReferences } from "../src/domain/statusDefinitionRepair";
import { createTestGame } from "./fixtures";

describe("repairStatusDefinitionsAndReferences", () => {
	it("erzeugt den Laufzeitindex ausschließlich aus dem RuleSet-Snapshot", () => {
		const game = createTestGame();
		const snapshotOnly = { id: "d_snapshot", name: "Snapshot only" };
		const snapshotConflict = {
			id: "d_conflict",
			name: "Old snapshot name",
			names: { de: "Alter Name" },
		};
		const runtimeOnly = { id: "d_runtime", name: "Runtime only" };
		const runtimeConflict = {
			id: "d_conflict",
			name: "Runtime name",
			names: { de: "Laufzeitname", en: "Runtime name" },
		};
		game.ruleSetSnapshot.statuses = [snapshotOnly, snapshotConflict];
		game.statusDefinitionsById = {
			d_runtime: runtimeOnly,
			d_conflict: runtimeConflict,
		};

		expect(repairStatusDefinitionsAndReferences(game)).toBe(3);
		expect(game.statusDefinitionsById.d_snapshot).toEqual(snapshotOnly);
		expect(game.statusDefinitionsById).toEqual({
			d_snapshot: snapshotOnly,
			d_conflict: snapshotConflict,
		});
		expect(game.statusDefinitionsById.d_conflict).not.toBe(snapshotConflict);
		expect(game.ruleSetSnapshot.statuses).toEqual([
			snapshotOnly,
			snapshotConflict,
		]);
		expect(repairStatusDefinitionsAndReferences(game)).toBe(0);
	});

	it("erstellt fehlende Definitionen aus Rollen und Spielerzuständen", () => {
		const game = createTestGame();
		const role = game.ruleSetSnapshot.roles[0];
		const player = game.playersById.p_player1;
		expect(role).toBeDefined();
		expect(player).toBeDefined();
		if (!role || !player) return;

		role.apply_status_effect = ["poisoned", "Sleeping"];
		player.statuses = [
			{
				id: "s_drunk_1",
				statusId: "drunk",
				fromNight: 0,
				untilNight: null,
			},
			{
				id: "s_poisoned_1",
				statusId: "poisoned",
				fromNight: 0,
				untilNight: null,
			},
		];

		expect(repairStatusDefinitionsAndReferences(game)).toBe(7);
		expect(role.apply_status_effect).toEqual(["d_poisoned", "d_sleeping"]);
		expect(player.statuses.map((status) => status.statusId)).toEqual([
			"d_drunk",
			"d_poisoned",
		]);
		expect(Object.keys(game.statusDefinitionsById).sort()).toEqual([
			"d_drunk",
			"d_poisoned",
			"d_sleeping",
		]);
		expect(
			game.ruleSetSnapshot.statuses?.map((definition) => definition.id).sort(),
		).toEqual(["d_drunk", "d_poisoned", "d_sleeping"]);
		expect(repairStatusDefinitionsAndReferences(game)).toBe(0);
	});

	it("verwendet eine vorhandene Definition mit passendem Namen", () => {
		const game = createTestGame();
		const role = game.ruleSetSnapshot.roles[0];
		expect(role).toBeDefined();
		if (!role) return;
		const definition = { id: "d_custom_poison", name: "Poisoned" };
		game.statusDefinitionsById.d_custom_poison = definition;
		game.ruleSetSnapshot.statuses = [{ ...definition }];
		role.apply_status_effect = ["poisoned"];

		expect(repairStatusDefinitionsAndReferences(game)).toBe(1);
		expect(role.apply_status_effect).toEqual(["d_custom_poison"]);
		expect(Object.keys(game.statusDefinitionsById)).toEqual([
			"d_custom_poison",
		]);
	});

	it("ist innerhalb der Sammelreparatur idempotent", () => {
		const game = createTestGame();
		const role = game.ruleSetSnapshot.roles[0];
		expect(role).toBeDefined();
		if (!role) return;
		role.apply_status_effect = ["poisoned"];

		expect(repairIds(game)).not.toBe(0);
		const repairedState = JSON.stringify(game);
		expect(repairIds(game)).toBe(0);
		expect(JSON.stringify(game)).toBe(repairedState);
	});
});
