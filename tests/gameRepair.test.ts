import { describe, expect, it } from "vitest";

import { repairGameDocument, repairGameState } from "../src/domain/gameRepair";
import { createGameExportDocument } from "../src/serialization/gameExport";
import { createTestGame } from "./fixtures";

describe("Game-/Template-Reparatur in Domain", () => {
	it.each([
		{ isTemplate: false, kind: "game" as const, id: "game_repair" },
		{
			isTemplate: true,
			kind: "template" as const,
			id: "template_repair",
		},
	])("verwendet für $kind dieselbe Reparaturpipeline", (variant) => {
		const source = createTestGame();
		source.id = variant.id;
		source.isTemplate = variant.isTemplate;
		const document = createGameExportDocument(source);
		const role = document.ruleSetSnapshot.roles[0];
		const player = document.players[0];
		expect(role).toBeDefined();
		expect(player).toBeDefined();
		if (!role || !player) return;
		role.id = "Bad Role";
		player.roles.actualRoleId = "Bad Role";

		const result = repairGameDocument(document, variant.kind);

		expect(result.report.kind).toBe(variant.kind);
		expect(typeof result.report.changeCount).toBe("number");
		expect(result.report.changeCount).toBeGreaterThan(0);
		expect(result.document.ruleSetSnapshot.roles[0]?.id).toBe("r_bad_role");
		expect(result.document.playersById.p_player1?.roles.actualRoleId).toBe(
			"r_bad_role",
		);
	});

	it("validiert die erwartete Dokumentart in Application", () => {
		const document = createGameExportDocument(createTestGame());

		expect(() => repairGameDocument(document, "template")).toThrow(
			"keine Vorlage",
		);
	});

	it("repariert einen hydrierten Arbeitsstand idempotent", () => {
		const game = createTestGame();
		const role = game.ruleSetSnapshot.roles[0];
		expect(role).toBeDefined();
		if (!role) return;
		role.id = "Bad Role";

		const first = repairGameState(game, "game");
		const second = repairGameState(first.document, "game");

		expect(first.report.changeCount).toBeGreaterThan(0);
		expect(second.document).toEqual(first.document);
		expect(second.report.changeCount).toBe(0);
	});

	it("entfernt verwaiste Zeigerollen über beide Reparaturgrenzen", () => {
		const source = createTestGame();
		source.rolesForShowing = {
			roles: ["seer", "r_missing", "r_seer", "r_seer"],
			showRoleSymbols: false,
		};

		const repairedState = repairGameState(source, "game");
		expect(repairedState.document.rolesForShowing?.roles).toEqual([
			"r_seer",
			"r_seer",
			"r_seer",
		]);

		const draft = createGameExportDocument(source);
		const repairedDocument = repairGameDocument(draft, "game");
		expect(repairedDocument.document.rolesForShowing?.roles).toEqual([
			"r_seer",
			"r_seer",
			"r_seer",
		]);
	});

	it("repariert Spielerfarben durch Großschreibung oder Entfernen", () => {
		const source = createTestGame();
		const players = Object.values(source.playersById);
		expect(players.length).toBeGreaterThanOrEqual(2);
		(players[0] as unknown as { color?: string }).color = "a1b2c3";
		(players[1] as unknown as { color?: string }).color = "nicht-gültig";

		const repaired = repairGameState(source, "game").document;

		expect(Object.values(repaired.playersById)[0]?.color).toBe("A1B2C3");
		expect(Object.values(repaired.playersById)[1]?.color).toBeUndefined();
	});

	it("normalisiert die Sprachschlüssel von Spielern", () => {
		const source = createTestGame();
		const player = Object.values(source.playersById)[0];
		expect(player).toBeDefined();
		if (!player) return;
		player.names = {
			"en-gb": "Player",
			"iu-cans": "ᐱᙳᐊᖅᑎ",
			"iu-latn": "Innguaqti",
		};

		const repaired = repairGameState(source, "game").document;

		expect(repaired.playersById[player.id]?.names).toEqual({
			"en-GB": "Player",
			"iu-Cans": "ᐱᙳᐊᖅᑎ",
			"iu-Latn": "Innguaqti",
		});
	});
});
