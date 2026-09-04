import { describe, expect, it } from "vitest";
import {
	explicitGuiPluralRuleByLanguageTag,
	guiPluralCategoriesByExplicitRule,
	selectGuiPluralCategory,
} from "../src/gui/i18n/pluralRules";
import { guiMessagesByLanguageTag } from "../src/gui/i18n/registry";
import { formatGuiMessage } from "../src/gui/i18n/translate";

const expectedCategoriesByLanguageTag = {
	ay: ["other"],
	cop: ["one", "other"],
	crs: ["one", "other"],
	fj: ["one", "two", "few", "other"],
	gn: ["other"],
	ht: ["one", "other"],
	jbn: ["one", "other"],
	kg: ["one", "other"],
	ktu: ["one", "other"],
	la: ["one", "other"],
	lua: ["one", "other"],
	mh: ["one", "two", "few", "many", "other"],
	mi: ["one", "two", "other"],
	nds: ["one", "other"],
	qu: ["other"],
	rmo: ["one", "other"],
	rn: ["one", "other"],
	rw: ["one", "other"],
	sm: ["one", "two", "other"],
	tet: ["one", "other"],
	tg: ["one", "other"],
	thv: ["one", "other"],
	tw: ["one", "other"],
	zgh: ["one", "other"],
} as const;

describe("explizite GUI-Pluralregeln", () => {
	it("ordnet alle 24 registrierten, nicht von Intl unterstützten Sprachen explizit zu", () => {
		expect(Object.keys(explicitGuiPluralRuleByLanguageTag).sort()).toEqual(
			Object.keys(expectedCategoriesByLanguageTag).sort(),
		);
	});

	it.each([
		["ay", 0, "other"],
		["ay", 1, "other"],
		["cop", 0, "other"],
		["cop", 1, "one"],
		["tg", 0, "one"],
		["tg", 2, "other"],
		["sm", 0, "other"],
		["sm", 1, "one"],
		["sm", 2, "two"],
		["mi", 0, "one"],
		["mi", 2, "two"],
		["fj", 3, "few"],
		["fj", 4, "other"],
		["mh", 3, "few"],
		["mh", 4, "many"],
		["mh", 5, "other"],
	] as const)(
		"wählt für %s bei %s die Kategorie %s",
		(language, count, expected) => {
			expect(selectGuiPluralCategory(language, count)).toBe(expected);
		},
	);

	it.each([
		[0, "one"],
		[1, "one"],
		[2, "other"],
		[10, "other"],
		[11, "one"],
		[20, "one"],
		[99, "one"],
		[100, "other"],
		[111, "other"],
	] as const)(
		"wendet für zgh bei %s die Sonderkategorie %s an",
		(count, expected) => {
			expect(selectGuiPluralCategory("zgh", count)).toBe(expected);
		},
	);

	it("verwendet für Dezimalzahlen die neutrale Form other", () => {
		for (const language of Object.keys(explicitGuiPluralRuleByLanguageTag)) {
			expect(selectGuiPluralCategory(language, 1.5)).toBe("other");
		}
	});

	it("trennt den Übersetzungs-Tag von der regionalen Zahlenformatierung", () => {
		const message = {
			plural: {
				one: "one:{count}",
				other: "other:{count}",
			},
		} as const;

		expect(formatGuiMessage(message, "zgh-MA", { count: 20 }, "zgh")).toBe(
			"one:20",
		);
		expect(formatGuiMessage(message, "zgh-MA", { count: 100 }, "zgh")).toBe(
			"other:100",
		);
	});

	it("enthält in jedem Pluralfeld genau die Kategorien seiner Sprachregel", () => {
		for (const [language, expectedCategories] of Object.entries(
			expectedCategoriesByLanguageTag,
		)) {
			const rule =
				explicitGuiPluralRuleByLanguageTag[
					language as keyof typeof explicitGuiPluralRuleByLanguageTag
				];
			expect(guiPluralCategoriesByExplicitRule[rule]).toEqual(
				expectedCategories,
			);

			const messages =
				guiMessagesByLanguageTag[
					language as keyof typeof guiMessagesByLanguageTag
				];
			if (!messages) continue;
			for (const message of Object.values(messages)) {
				if (typeof message === "string") continue;
				expect(Object.keys(message.plural).sort()).toEqual(
					[...expectedCategories].sort(),
				);
			}
		}
	});
});
