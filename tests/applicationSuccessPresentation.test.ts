import { describe, expect, it } from "vitest";
import type { ApplicationObjectSuccess } from "../src/application/objectSuccess";
import { applicationObjectSuccessText } from "../src/gui/applicationSuccessPresentation";
import { createGuiTranslator } from "../src/gui/i18n/translate";

const de = createGuiTranslator("de");
const en = createGuiTranslator("en");

describe("Application-Erfolgsdarstellung", () => {
	it.each<[ApplicationObjectSuccess, string]>([
		[
			{ status: "imported", kind: "game", id: "game_1", name: "Nacht" },
			"Spielstand „Nacht“ importiert.",
		],
		[
			{
				status: "imported",
				kind: "template",
				id: "template_1",
				name: "Vorlage 1",
			},
			"Vorlage „Vorlage 1“ importiert.",
		],
		[
			{
				status: "imported",
				kind: "ruleSet",
				id: "ruleset_1",
				name: "Regeln",
			},
			"Regelwerk „Regeln“ importiert.",
		],
		[{ status: "imported", kind: "library" }, "Bibliothek importiert."],
		[
			{ status: "recovered", kind: "game", id: "game_1", name: "Nacht" },
			"Spielstand „Nacht“ wiederhergestellt.",
		],
		[{ status: "recovered", kind: "library" }, "Bibliothek wiederhergestellt."],
		[
			{ status: "restored", kind: "library", source: "backup" },
			"Bibliothek aus dem Backup wiederhergestellt.",
		],
		[
			{
				status: "repaired",
				kind: "ruleSet",
				id: "ruleset_1",
				name: "Regeln",
			},
			"Regelwerk „Regeln“ repariert.",
		],
	])("erzeugt den deutschen Text für %j", (success, expected) => {
		expect(applicationObjectSuccessText(success, de)).toBe(expected);
	});

	it("erzeugt den englischen Text aus derselben Erfolgsrückgabe", () => {
		expect(
			applicationObjectSuccessText(
				{ status: "repaired", kind: "game", id: "game_1", name: "Night" },
				en,
			),
		).toBe("Saved game “Night” repaired.");
	});
});
