import { describe, expect, it } from "vitest";
import { applicationFailureReasonText } from "../src/gui/applicationFailurePresentation";
import {
	createGuiTranslator,
	formatGuiMessage,
} from "../src/gui/i18n/translate";
import { libraryRepairChangeText } from "../src/gui/libraryRepairPresentation";
import { playerActionWarningText } from "../src/gui/playerActionWarningPresentation";

const de = createGuiTranslator("de");
const en = createGuiTranslator("en");

describe("Lokalisierung von Anwendungsberichten", () => {
	it("stellt denselben Fehlercode auf Deutsch und Englisch dar", () => {
		expect(applicationFailureReasonText("diskFull", de)).toBe(
			"Der Speicherplatz ist voll. Bitte geben Sie Speicherplatz frei und versuchen Sie es erneut.",
		);
		expect(applicationFailureReasonText("diskFull", en)).toBe(
			"Storage is full. Free some space and try again.",
		);
	});

	it("lokalisiert feste Beschriftungen für technische Importangaben", () => {
		expect(de("common.detailsParenthetical")).toBe("(Details)");
		expect(en("common.detailsParenthetical")).toBe("(Details)");
		expect(de("common.schemaVersion")).toBe("Schemaversion");
		expect(en("common.schemaVersion")).toBe("Schema version");
	});

	it.each([
		["kill", "Töten", "kill"],
		["resurrect", "Wiederbeleben", "resurrect"],
		["apply_status", "Zustand anwenden", "apply status"],
	])(
		"zeigt den Aktionscode %s in Warnungen lokalisiert an",
		(action, germanAction, englishAction) => {
			const warning = {
				code: "ABILITY_NOT_ALLOWED",
				parameters: { roleName: "Testrolle", action },
			};

			expect(playerActionWarningText(warning, de)).toBe(
				`Rolle „Testrolle“ erlaubt die Aktion „${germanAction}“ nicht.`,
			);
			expect(playerActionWarningText(warning, en)).toBe(
				`Role “Testrolle” does not allow the action “${englishAction}”.`,
			);
		},
	);

	it("zeigt unbekannte Aktionscodes für die Fehlerdiagnose an", () => {
		const warning = {
			code: "ABILITY_NOT_ALLOWED",
			parameters: { roleName: "Testrolle", action: "internal_action_code" },
		};

		expect(playerActionWarningText(warning, de)).toContain(
			"unbekannte Aktion (interner Code: internal_action_code)",
		);
		expect(playerActionWarningText(warning, en)).toContain(
			"unknown action (internal code: internal_action_code)",
		);
	});

	it("lokalisiert strukturierte Reparaturänderungen", () => {
		const change = {
			kind: "ruleSetIdCollisionResolved" as const,
			storedId: "ruleset_a",
			newId: "ruleset_a_1",
		};
		expect(libraryRepairChangeText(change, de)).toBe(
			"Regelwerk ruleset_a: kollidierende ID wurde zu „ruleset_a_1“ geändert.",
		);
		expect(libraryRepairChangeText(change, en)).toBe(
			"Rule set ruleset_a: changed colliding ID to “ruleset_a_1”.",
		);
	});

	it("verwendet sprachabhängige Singular- und Pluraltexte", () => {
		expect(
			libraryRepairChangeText({ kind: "addedClosingBraces", count: 1 }, en),
		).toBe("Added one missing closing brace.");
		expect(
			libraryRepairChangeText({ kind: "addedClosingBraces", count: 2 }, en),
		).toBe("Added 2 missing closing braces.");
	});

	it.each([
		[0, "0 players"],
		[1, "1 player"],
		[2, "2 players"],
	])("wählt für Englisch bei %i die passende Pluralform", (count, text) => {
		expect(en("loadGame.players", { count })).toBe(text);
	});

	it.each([
		[0, "0 Spieler"],
		[1, "1 Spieler"],
		[2, "2 Spieler"],
	])("wählt für Deutsch bei %i die passende Pluralform", (count, text) => {
		expect(de("loadGame.players", { count })).toBe(text);
	});

	it("unterstützt ohne neue Programmlogik Sprachen mit komplexeren Pluralformen", () => {
		const russianMessage = {
			plural: {
				one: "{count} игрок",
				few: "{count} игрока",
				many: "{count} игроков",
				other: "{count} игрока",
			},
		} as const;

		expect(formatGuiMessage(russianMessage, "ru", { count: 1 })).toBe(
			"1 игрок",
		);
		expect(formatGuiMessage(russianMessage, "ru", { count: 2 })).toBe(
			"2 игрока",
		);
		expect(formatGuiMessage(russianMessage, "ru", { count: 5 })).toBe(
			"5 игроков",
		);
	});

	it("verwendet other als Rückfallwert und formatiert Zahlen sprachabhängig", () => {
		expect(
			formatGuiMessage({ plural: { other: "{count} Einträge" } }, "de", {
				count: 1234,
			}),
		).toBe("1.234 Einträge");
	});
});
