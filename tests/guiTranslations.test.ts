import { describe, expect, it } from "vitest";
import { supportedGuiLanguageTags } from "../src/gui/i18n/registry";
import {
	createGuiTranslator,
	normalizeGuiLanguage,
	resolveGuiLocale,
} from "../src/gui/i18n/translate";

describe("GUI-Übersetzungen", () => {
	it("registriert weder Übersetzungsgerüste noch ungeprüfte Entwürfe", () => {
		for (const languageTag of [
			"ems",
			"esu",
			"ia",
			"ie",
			"io",
			"jbo",
			"qya",
			"rm",
			"sjn",
			"tlh",
			"vo",
			"ynk",
		]) {
			expect(supportedGuiLanguageTags).not.toContain(languageTag);
		}
	});

	it("liefert deutsche und englische Texte", () => {
		expect(createGuiTranslator("de")("home.newGame")).toBe("Neues Spiel");
		expect(createGuiTranslator("en")("home.newGame")).toBe("New game");
		expect(createGuiTranslator("de")("game.sourceAndTarget")).toBe(
			"Quelle/Ziel",
		);
		expect(createGuiTranslator("en")("game.sourceAndTarget")).toBe(
			"Source/target",
		);
		expect(createGuiTranslator("de")("game.source")).toBe("Quelle");
		expect(createGuiTranslator("en")("game.source")).toBe("Source");
		expect(createGuiTranslator("de")("game.target")).toBe("Ziel");
		expect(createGuiTranslator("en")("game.target")).toBe("Target");
		expect(createGuiTranslator("de")("scenarioEditor.saveAndContinue")).toBe(
			"Speichern & Fortfahren",
		);
		expect(
			createGuiTranslator("de")("scenarioEditor.continueWithoutSaving"),
		).toBe("Fortfahren ohne Speichern");
		expect(createGuiTranslator("en")("scenarioEditor.saveAndContinue")).toBe(
			"Save & continue",
		);
		expect(
			createGuiTranslator("en")("scenarioEditor.continueWithoutSaving"),
		).toBe("Continue without saving");
		expect(createGuiTranslator("fr")("scenarioEditor.saveAndContinue")).toBe(
			"Enregistrer et continuer",
		);
		expect(
			createGuiTranslator("fr")("scenarioEditor.continueWithoutSaving"),
		).toBe("Continuer sans enregistrer");
	});

	it("verwendet zunächst den vollständigen Tag und dann die Basissprache", () => {
		expect(normalizeGuiLanguage("en-GB")).toBe("en-GB");
		expect(normalizeGuiLanguage("es-419")).toBe("es-419");
		expect(normalizeGuiLanguage("pt-BR")).toBe("pt-BR");
		expect(normalizeGuiLanguage("fr-FR")).toBe("fr");
		expect(createGuiTranslator("fr-FR")("settings.title")).toBe("Paramètres");
		expect(createGuiTranslator("en-GB")("scenarioEditor.useColor")).toBe(
			"Use colour",
		);
		expect(createGuiTranslator("pt")("common.share")).toBe("Partilhar");
		expect(createGuiTranslator("pt-BR")("common.share")).toBe("Compartilhar");
		expect(createGuiTranslator("es")("settings.title")).toBe("Ajustes");
		expect(createGuiTranslator("es-419")("settings.title")).toBe(
			"Configuración",
		);
	});

	it("verwendet kanonische und explizite ISO-Sprachaliase", () => {
		expect(resolveGuiLocale("tl-PH")).toEqual({
			languageCode: "fil",
			languageTag: "fil-PH",
			translationTag: "fil",
		});
		expect(resolveGuiLocale("no-NO")).toEqual({
			languageCode: "no",
			languageTag: "no-NO",
			translationTag: "no",
		});
		expect(createGuiTranslator("no")("home.newGame")).toBe("Nytt spill");
	});

	it("fällt über Schriftvarianten und schließlich auf Englisch zurück", () => {
		expect(resolveGuiLocale("iu-Cans-CA")).toEqual({
			languageCode: "iu",
			languageTag: "iu-Cans-CA",
			translationTag: "iu-Cans",
		});
		expect(resolveGuiLocale("zz-ZZ")).toEqual({
			languageCode: "zz",
			languageTag: "zz-ZZ",
			translationTag: "en",
		});
		expect(createGuiTranslator("zz-ZZ")("settings.title")).toBe("Settings");
	});

	it("bewahrt angeforderten und verwendeten Sprach-Tag getrennt", () => {
		expect(resolveGuiLocale("de_DE")).toEqual({
			languageCode: "de",
			languageTag: "de-DE",
			translationTag: "de",
		});
		expect(resolveGuiLocale("en-IN")).toEqual({
			languageCode: "en",
			languageTag: "en-IN",
			translationTag: "en-IN",
		});
		expect(resolveGuiLocale("en-AU")).toEqual({
			languageCode: "en",
			languageTag: "en-AU",
			translationTag: "en",
		});
	});

	it("setzt dynamische Parameter ein", () => {
		expect(
			createGuiTranslator("en")("settings.restoreDiscarded", { count: 3 }),
		).toBe("Library restored. 3 invalid rule sets were discarded.");
	});

	it("lokalisiert den Exit-Hinweis samt Pluralform und erzwungenem Beenden", () => {
		const de = createGuiTranslator("de");
		const en = createGuiTranslator("en");
		expect(de("home.activeWrites", { count: 1 })).toBe(
			"Noch 1 Speichervorgang aktiv.",
		);
		expect(de("home.activeWrites", { count: 2 })).toBe(
			"Noch 2 Speichervorgänge aktiv.",
		);
		expect(de("home.exitAnyway")).toBe("Trotzdem beenden");
		expect(en("home.activeWrites", { count: 2 })).toBe(
			"2 save operations are still active.",
		);
		expect(en("home.exitAnyway")).toBe("Exit anyway");
	});

	it.each([
		["ar", "0 لاعبين"],
		["ar-EG", "٠ لاعبين"],
		["ar-MA", "0 لاعبين"],
		["lv", "0 spēlētāju"],
	])("verwendet für %s die Pluralform zero", (language, expected) => {
		expect(
			createGuiTranslator(language)("loadGame.players", { count: 0 }),
		).toBe(expected);
	});
});
