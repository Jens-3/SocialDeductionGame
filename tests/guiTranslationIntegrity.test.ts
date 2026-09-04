import { describe, expect, it } from "vitest";
import { type GuiTranslationKey, germanGuiMessages } from "../src/gui/i18n/de";
import type {
	GuiPluralCategory,
	GuiTranslationMessage,
} from "../src/gui/i18n/messages";
import { selectGuiPluralCategory } from "../src/gui/i18n/pluralRules";
import {
	guiMessagesByLanguageTag,
	type SupportedGuiLanguageTag,
} from "../src/gui/i18n/registry";
import {
	expectedGuiPlaceholders,
	type GuiPlaceholderCounts,
} from "./guiPlaceholderManifest";

const emptyPlaceholderCounts: GuiPlaceholderCounts = {};
const pluralWitnessCandidates = [
	...Array.from({ length: 201 }, (_, value) => value),
	1_000,
	1_000_000,
	...Array.from({ length: 21 }, (_, integer) =>
		Array.from({ length: 9 }, (_, fraction) => integer + (fraction + 1) / 10),
	).flat(),
	0.01,
	0.001,
	1.01,
	1.001,
] as const;

function countPlaceholders(message: string): GuiPlaceholderCounts {
	const counts: Record<string, number> = {};
	for (const match of message.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/gu)) {
		const placeholder = match[1];
		counts[placeholder] = (counts[placeholder] ?? 0) + 1;
	}
	return counts;
}

function expectOnlyValidPlaceholders(message: string, context: string): void {
	const withoutPlaceholders = message.replace(/\{[A-Za-z][A-Za-z0-9]*\}/gu, "");
	expect(withoutPlaceholders, context).not.toMatch(/[{}]/u);
	expect(message, context).not.toMatch(/ZXQ(?:PH|HTML|COUNT|SEG)|[⟦⟧]/u);
}

function expectedPlainPlaceholders(
	key: GuiTranslationKey,
): GuiPlaceholderCounts {
	return expectedGuiPlaceholders[key]?.plain ?? emptyPlaceholderCounts;
}

function expectedPluralPlaceholders(
	key: GuiTranslationKey,
	category: GuiPluralCategory,
): GuiPlaceholderCounts {
	const plural = expectedGuiPlaceholders[key]?.plural;
	return plural?.[category] ?? plural?.other ?? emptyPlaceholderCounts;
}

function usedPluralCategories(
	messages: Readonly<Record<GuiTranslationKey, GuiTranslationMessage>>,
): Set<GuiPluralCategory> {
	const categories = new Set<GuiPluralCategory>();
	for (const message of Object.values(messages)) {
		if (typeof message === "string") continue;
		for (const category of Object.keys(message.plural)) {
			categories.add(category as GuiPluralCategory);
		}
	}
	return categories;
}

describe("Integrität der GUI-Lokalisierungen", () => {
	it("beschreibt die Platzhalter der deutschen Referenz explizit", () => {
		for (const [key, message] of Object.entries(germanGuiMessages) as [
			GuiTranslationKey,
			GuiTranslationMessage,
		][]) {
			if (typeof message === "string") {
				expect(countPlaceholders(message), key).toEqual(
					expectedPlainPlaceholders(key),
				);
				continue;
			}

			for (const [category, variant] of Object.entries(message.plural) as [
				GuiPluralCategory,
				string,
			][]) {
				expect(countPlaceholders(variant), `${key}.${category}`).toEqual(
					expectedPluralPlaceholders(key, category),
				);
			}
		}
	});

	it("bewahrt in jeder Sprache Typ, Namen und Anzahl aller Platzhalter", () => {
		for (const [language, messages] of Object.entries(
			guiMessagesByLanguageTag,
		) as [
			SupportedGuiLanguageTag,
			Record<GuiTranslationKey, GuiTranslationMessage>,
		][]) {
			for (const [key, referenceMessage] of Object.entries(
				germanGuiMessages,
			) as [GuiTranslationKey, GuiTranslationMessage][]) {
				const message = messages[key];
				expect(typeof message, `${language}.${key}`).toBe(
					typeof referenceMessage,
				);

				if (typeof message === "string") {
					expectOnlyValidPlaceholders(message, `${language}.${key}`);
					expect(countPlaceholders(message), `${language}.${key}`).toEqual(
						expectedPlainPlaceholders(key),
					);
					continue;
				}

				for (const [category, variant] of Object.entries(message.plural) as [
					GuiPluralCategory,
					string,
				][]) {
					const context = `${language}.${key}.${category}`;
					expectOnlyValidPlaceholders(variant, context);
					expect(countPlaceholders(variant), context).toEqual(
						expectedPluralPlaceholders(key, category),
					);
				}
			}
		}
	}, 15_000);

	it.each([
		["zero", 0],
		["one", 1],
		["two", 2],
	] as const)(
		"wählt für vorhandenes %s immer den kanonischen Wert %s",
		(category, count) => {
			for (const [language, messages] of Object.entries(
				guiMessagesByLanguageTag,
			) as [
				SupportedGuiLanguageTag,
				Record<GuiTranslationKey, GuiTranslationMessage>,
			][]) {
				if (!usedPluralCategories(messages).has(category)) continue;
				expect(selectGuiPluralCategory(language, count), language).toBe(
					category,
				);
			}
		},
	);

	it("speichert pro Feld genau die erreichbaren Pluralformen", () => {
		for (const [language, messages] of Object.entries(
			guiMessagesByLanguageTag,
		) as [
			SupportedGuiLanguageTag,
			Record<GuiTranslationKey, GuiTranslationMessage>,
		][]) {
			const reachableCategories = [
				...new Set(
					pluralWitnessCandidates.map((count) =>
						selectGuiPluralCategory(language, count),
					),
				),
			].sort();
			for (const [key, message] of Object.entries(messages) as [
				GuiTranslationKey,
				GuiTranslationMessage,
			][]) {
				if (typeof message === "string") continue;
				expect(
					Object.keys(message.plural).sort(),
					`${language}.${key}`,
				).toEqual(reachableCategories);
			}
		}
	});

	it("verwechselt die gegensätzlichen Sitzkreis-Optionen nicht", () => {
		for (const [language, messages] of Object.entries(
			guiMessagesByLanguageTag,
		) as [
			SupportedGuiLanguageTag,
			Record<GuiTranslationKey, GuiTranslationMessage>,
		][]) {
			expect(
				messages["settings.seatCircleNorthFirst"],
				`${language}: erster und letzter Sitzplatz`,
			).not.toBe(messages["settings.seatCircleNorthLast"]);
			expect(
				messages["settings.seatCircleClockwise"],
				`${language}: Drehrichtung`,
			).not.toBe(messages["settings.seatCircleCounterClockwise"]);
		}
	});
});
