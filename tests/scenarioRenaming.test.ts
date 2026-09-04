import { describe, expect, it } from "vitest";
import { Role, Team } from "../src/domain/models";
import {
	renameGame,
	renameRuleSet,
	renameTemplate,
} from "../src/domain/scenarioRenaming";
import { createTemplateFromGame } from "../src/domain/templateFactory";
import { fixedDomainServices } from "./fixedClock";
import { createTestGame, createTestRuleSet } from "./fixtures";

describe("scenarioRenaming", () => {
	it("benennt ein Game bereinigt um und erzeugt die ID aus dem neuen Namen", () => {
		const game = createTestGame();
		game.names = { en: "Old name" };

		const renamed = renameGame(game, "  Neue\u202e\nRunde  ");

		expect(renamed).toMatchObject({
			id: "game_neue_runde",
			name: "Neue Runde",
			isTemplate: false,
			names: { en: "Old name" },
		});
		expect(game.name).not.toBe("Neue Runde");
	});

	it("verwendet für Vorlagen den Template-Präfix und aktualisiert optional die Sprache", () => {
		const template = createTemplateFromGame({
			services: fixedDomainServices,
			game: createTestGame(),
			name: "Alt",
		}).template;

		const renamed = renameTemplate(template, " Neue Vorlage ", {
			language: "de",
		});

		expect(renamed).toMatchObject({
			id: "template_neue_vorlage",
			name: "Neue Vorlage",
			isTemplate: true,
			names: { de: "Neue Vorlage" },
		});
		expect(() => renameGame(template, "Falsch")).toThrow("Vorlage");
	});

	it("validiert ein umbenanntes RuleSet erneut als vollständiges Domain-Objekt", () => {
		const renamed = renameRuleSet(createTestRuleSet(), " Neues Regelwerk ", {
			language: "de",
		});

		expect(renamed).toMatchObject({
			id: "ruleset_neues_regelwerk",
			name: "Neues Regelwerk",
			names: { de: "Neues Regelwerk" },
		});
		expect(renamed.teams[0]).toBeInstanceOf(Team);
		expect(renamed.roles[0]).toBeInstanceOf(Role);
	});
});
