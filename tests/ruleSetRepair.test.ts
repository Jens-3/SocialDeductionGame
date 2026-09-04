import { describe, expect, it } from "vitest";
import { repairIds } from "../src/domain/gameIdRepair";
import { repairRecoveredLibrary } from "../src/domain/libraryContainerRepair";
import { repairRuleSet } from "../src/domain/ruleSetRepair";
import { recoverLibraryStructure } from "../src/serialization/libraryRepair";
import { createTestGame } from "./fixtures";

const repairLibraryDocument = (value: unknown) =>
	repairRecoveredLibrary(recoverLibraryStructure(value));

const damagedRuleSet = {
	id: "ruleset_repair_test",
	name: "Repair test",
	teams: [
		{
			id: "t_unknown",
			name: "Unknown",
			teamOrder: 99,
			isSystem: true,
		},
	],
	roles: [
		{
			id: "r_alchemist",
			name: "Alchemist",
			teamId: "t_unknown",
			apply_status_effect: ["Poison Status"],
		},
	],
	statuses: [
		{
			id: "Poison Status",
			name: "Poisoned",
			defaultDuration: -3,
		},
	],
};

describe("repairRuleSet", () => {
	it("normalisiert Sprachschlüssel regional und für unterstützte Schriften", () => {
		const repaired = repairRuleSet({
			...structuredClone(damagedRuleSet),
			names: { DE: "Regeln", "en-gb": "Rules" },
			teams: [
				{
					...damagedRuleSet.teams[0],
					names: { "de-at": "Unbekannt", "iu-cans": "ᖃᐅᔨᒪᔭᐅᙱᑦᑐᖅ" },
				},
			],
			roles: [
				{
					...damagedRuleSet.roles[0],
					names: { "en-us": "Alchemist", "iu-latn": "Alkimisti" },
				},
			],
		}).ruleSet;

		expect(repaired.names).toEqual({ de: "Regeln", "en-GB": "Rules" });
		expect(repaired.teams[0]?.names).toEqual({
			"de-AT": "Unbekannt",
			"iu-Cans": "ᖃᐅᔨᒪᔭᐅᙱᑦᑐᖅ",
		});
		expect(repaired.roles[0]?.names).toEqual({
			"en-US": "Alchemist",
			"iu-Latn": "Alkimisti",
		});
	});

	it("schreibt gültige Farben groß und entfernt weiterhin ungültige Farben", () => {
		const repaired = repairRuleSet({
			...structuredClone(damagedRuleSet),
			teams: [{ ...damagedRuleSet.teams[0], color: " #a1-b2_c3 " }],
			roles: [{ ...damagedRuleSet.roles[0], color: "##a1b2c3" }],
		}).ruleSet;

		expect(repaired.teams[0]?.color).toBe("A1B2C3");
		expect(repaired.roles[0]?.color).toBeUndefined();
	});

	it("repariert RuleSet, Library-Eintrag und Game-Snapshot identisch", () => {
		const expected = repairRuleSet(structuredClone(damagedRuleSet)).ruleSet;
		const library = repairLibraryDocument({
			storageType: "social-deduction-app-library",
			storageVersion: 1,
			ruleSetsById: {
				ruleset_repair_test: structuredClone(damagedRuleSet),
			},
		});
		const libraryRuleSet = (
			library.document.ruleSetsById as Record<string, typeof expected>
		).ruleset_repair_test;

		const game = createTestGame();
		game.ruleSetSnapshot = structuredClone(damagedRuleSet) as never;
		game.statusDefinitionsById = {
			legacy_key: { id: "legacy_status", name: "Nicht maßgeblich" },
		};
		game.rolesForShowing = undefined;
		for (const player of Object.values(game.playersById)) {
			player.roles = {
				actualRoleId: null,
				shownRoleIds: [],
				nightRoleId: null,
			};
			player.statuses = [];
		}
		const player = game.playersById.p_player1;
		expect(player).toBeDefined();
		if (!player) return;
		player.statuses = [
			{
				id: "s_poisoned_1",
				statusId: "Poison Status",
				fromNight: 0,
				untilNight: null,
			},
		];

		expect(repairIds(game)).not.toBe(0);
		expect(game.ruleSetSnapshot).toEqual(expected);
		expect(libraryRuleSet).toEqual(expected);
		expect(expected.statuses).toEqual([
			expect.objectContaining({
				id: "d_poison_status",
				defaultDuration: 1,
			}),
		]);
		expect(expected.roles[0]?.apply_status_effect).toEqual(["d_poison_status"]);
		expect(player.statuses[0]?.statusId).toBe("d_poison_status");
		expect(Object.keys(game.statusDefinitionsById)).toEqual([
			"d_poison_status",
		]);
		expect(game.statusDefinitionsById.d_poison_status?.id).toBe(
			"d_poison_status",
		);
	});
});
