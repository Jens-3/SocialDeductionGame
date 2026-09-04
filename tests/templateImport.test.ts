import { describe, expect, it } from "vitest";
import { convertTemplateToGame } from "../src/domain/gameValidation";
import { renameGame } from "../src/domain/scenarioRenaming";
import { createTestGame } from "./fixtures";

function createTemplate() {
	const template = createTestGame(2);
	template.id = "template_testvorlage_2";
	template.name = "Testvorlage";
	template.isTemplate = true;
	template.time = { currentNight: 3, phase: "day" };
	return template;
}

describe("fachliche Template-zu-Spiel-Umwandlung", () => {
	it("validiert die vollständige Vorlage und ändert im RAM nur Art und ID", () => {
		const template = createTemplate();

		const game = convertTemplateToGame(template);

		expect(game).toMatchObject({
			name: "Testvorlage",
			id: "game_testvorlage",
			isTemplate: false,
		});
		expect(Object.keys(game.playersById)).toEqual(["p_player1", "p_player2"]);
		expect(template).toMatchObject({
			id: "template_testvorlage_2",
			isTemplate: true,
		});
	});

	it("führt eine optionale Umbenennung nach der Umwandlung aus", () => {
		const game = renameGame(
			convertTemplateToGame(createTemplate()),
			"Neues Spiel",
		);

		expect(game).toMatchObject({
			id: "game_neues_spiel",
			name: "Neues Spiel",
			isTemplate: false,
		});
	});

	it("lehnt ein Game als Quelle der Template-Umwandlung ab", () => {
		const game = createTemplate();
		game.id = "game_test";
		game.isTemplate = false;

		expect(() => convertTemplateToGame(game)).toThrow("keine Vorlage");
	});

	it("lehnt fachlich ungültige Werte in der gemeinsamen Domain-Prüfung ab", () => {
		const template = createTemplate();
		template.time.currentNight = -1;

		expect(() => convertTemplateToGame(template)).toThrow(
			"time.currentNight muss eine ganze Zahl >= 0 sein",
		);
	});
});
