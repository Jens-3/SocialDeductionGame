import type { GuiPluralCategory } from "./messages";

export type ExplicitGuiPluralRule =
	| "onlyOther"
	| "oneOtherZeroOther"
	| "oneOtherZeroOne"
	| "oneTwoOtherZeroOther"
	| "oneTwoOtherZeroOne"
	| "oneTwoFewOther"
	| "oneTwoFewManyOther"
	| "standardMoroccanTamazight";

export type ExplicitGuiPluralLanguageTag =
	| "ay"
	| "cop"
	| "crs"
	| "fj"
	| "gn"
	| "ht"
	| "jbn"
	| "kg"
	| "ktu"
	| "la"
	| "lua"
	| "mh"
	| "mi"
	| "nds"
	| "qu"
	| "rmo"
	| "rn"
	| "rw"
	| "sm"
	| "tet"
	| "tg"
	| "thv"
	| "tw"
	| "zgh";

export const explicitGuiPluralRuleByLanguageTag = {
	ay: "onlyOther",
	cop: "oneOtherZeroOther",
	crs: "oneOtherZeroOther",
	fj: "oneTwoFewOther",
	gn: "onlyOther",
	ht: "oneOtherZeroOther",
	jbn: "oneOtherZeroOther",
	kg: "oneOtherZeroOther",
	ktu: "oneOtherZeroOther",
	la: "oneOtherZeroOther",
	lua: "oneOtherZeroOther",
	mh: "oneTwoFewManyOther",
	mi: "oneTwoOtherZeroOne",
	nds: "oneOtherZeroOther",
	qu: "onlyOther",
	rmo: "oneOtherZeroOther",
	rn: "oneOtherZeroOther",
	rw: "oneOtherZeroOther",
	sm: "oneTwoOtherZeroOther",
	tet: "oneOtherZeroOther",
	tg: "oneOtherZeroOne",
	thv: "oneOtherZeroOther",
	tw: "oneOtherZeroOne",
	zgh: "standardMoroccanTamazight",
} as const satisfies Record<
	ExplicitGuiPluralLanguageTag,
	ExplicitGuiPluralRule
>;

export const guiPluralCategoriesByExplicitRule = {
	onlyOther: ["other"],
	oneOtherZeroOther: ["one", "other"],
	oneOtherZeroOne: ["one", "other"],
	oneTwoOtherZeroOther: ["one", "two", "other"],
	oneTwoOtherZeroOne: ["one", "two", "other"],
	oneTwoFewOther: ["one", "two", "few", "other"],
	oneTwoFewManyOther: ["one", "two", "few", "many", "other"],
	standardMoroccanTamazight: ["one", "other"],
} as const satisfies Record<
	ExplicitGuiPluralRule,
	readonly GuiPluralCategory[]
>;

export function selectGuiPluralCategory(
	language: string,
	count: number,
): GuiPluralCategory {
	const explicitRule = explicitGuiPluralRuleByLanguageTag[
		language as ExplicitGuiPluralLanguageTag
	] as ExplicitGuiPluralRule | undefined;
	if (!explicitRule) return new Intl.PluralRules(language).select(count);
	if (!Number.isInteger(count)) return "other";

	switch (explicitRule) {
		case "onlyOther":
			return "other";
		case "oneOtherZeroOther":
			return count === 1 ? "one" : "other";
		case "oneOtherZeroOne":
			return count === 0 || count === 1 ? "one" : "other";
		case "oneTwoOtherZeroOther":
			if (count === 1) return "one";
			return count === 2 ? "two" : "other";
		case "oneTwoOtherZeroOne":
			if (count === 0 || count === 1) return "one";
			return count === 2 ? "two" : "other";
		case "oneTwoFewOther":
			if (count === 1) return "one";
			if (count === 2) return "two";
			return count === 3 ? "few" : "other";
		case "oneTwoFewManyOther":
			if (count === 1) return "one";
			if (count === 2) return "two";
			if (count === 3) return "few";
			return count === 4 ? "many" : "other";
		case "standardMoroccanTamazight":
			return count === 0 || count === 1 || (count >= 11 && count <= 99)
				? "one"
				: "other";
	}
}
