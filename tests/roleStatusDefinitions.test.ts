import { describe, expect, it } from "vitest";

import {
	createMissingStatusDefinitionsFromRoles,
	normalizeRoleApplyStatusEffectIds,
} from "../src/domain/roleStatusDefinitions";
import { createTestGame } from "./fixtures";

describe("createMissingStatusDefinitionsFromRoles", () => {
	it("erstellt fehlende Definitionen und vermeidet Duplikate", () => {
		const game = createTestGame();
		game.statusDefinitionsById.d_poisoned = {
			id: "d_poisoned",
			name: "Poisoned",
		};
		const seer = game.ruleSetSnapshot.roles[0];
		const villager = game.ruleSetSnapshot.roles[1];
		expect(seer).toBeDefined();
		expect(villager).toBeDefined();
		if (!seer || !villager) return;
		seer.apply_status_effect = ["Poisoned", "Sleeping"];
		villager.apply_status_effect = ["Sleeping"];

		expect(createMissingStatusDefinitionsFromRoles(game)).toBe(1);
		expect(game.statusDefinitionsById.d_sleeping).toMatchObject({
			id: "d_sleeping",
			name: "Sleeping",
		});
		expect(game.ruleSetSnapshot.statuses?.map((status) => status.id)).toContain(
			"d_sleeping",
		);
	});

	it("löst eine Kollision mit einer Rollen-ID über den Statusnamen auf", () => {
		const game = createTestGame();
		const role = game.ruleSetSnapshot.roles.find(
			(candidate) => candidate.id === "r_seer",
		);
		expect(role).toBeDefined();
		if (!role) return;
		role.apply_status_effect = ["Seer"];

		expect(createMissingStatusDefinitionsFromRoles(game)).toBe(1);
		expect(game.statusDefinitionsById.d_seer).toMatchObject({
			id: "d_seer",
			name: "Seer",
		});
		expect(normalizeRoleApplyStatusEffectIds(game)).toBe(1);
		expect(role.apply_status_effect).toEqual(["d_seer"]);
	});
});

describe("normalizeRoleApplyStatusEffectIds", () => {
	it("ersetzt Namen durch vorhandene Status-IDs", () => {
		const game = createTestGame();
		game.statusDefinitionsById.d_drunk_status = {
			id: "d_drunk_status",
			name: "Drunk",
		};
		const role = game.ruleSetSnapshot.roles[0];
		expect(role).toBeDefined();
		if (!role) return;
		role.apply_status_effect = ["Drunk", "unknown effect"];

		expect(normalizeRoleApplyStatusEffectIds(game)).toBe(2);
		expect(role.apply_status_effect).toEqual([
			"d_drunk_status",
			"d_unknown_effect",
		]);
	});

	it("ändert bereits normalisierte IDs nicht", () => {
		const game = createTestGame();
		game.statusDefinitionsById.d_poisoned = {
			id: "d_poisoned",
			name: "Poisoned",
		};
		const role = game.ruleSetSnapshot.roles[0];
		expect(role).toBeDefined();
		if (!role) return;
		role.apply_status_effect = ["d_poisoned"];

		expect(normalizeRoleApplyStatusEffectIds(game)).toBe(0);
		expect(role.apply_status_effect).toEqual(["d_poisoned"]);
	});
});
