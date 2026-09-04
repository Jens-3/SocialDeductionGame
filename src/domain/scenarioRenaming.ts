import { sanitizeText } from "../shared/textSanitizer";
import type { GameState } from "./gameFactory";
import type { LocalizedNames } from "./models";
import type { RuleSet } from "./ruleSet";
import { createRuleSetFromDraft } from "./ruleSetValidation";
import { createIdFromText } from "./stringSanitizer";

export type RenameScenarioOptions = {
	language?: string;
};

/** Benennt ein Spiel um und erzeugt dessen deterministische Game-ID neu. */
export function renameGame(
	game: GameState,
	name: string,
	options: RenameScenarioOptions = {},
): GameState {
	if (game.isTemplate)
		throw new Error("Eine Vorlage kann nicht als Spiel umbenannt werden.");
	const normalizedName = normalizeName(
		name,
		"Der Spielstand benötigt einen Namen.",
	);
	return {
		...game,
		id: createIdFromText(normalizedName, "game"),
		name: normalizedName,
		names: renameLocalizedName(game.names, normalizedName, options.language),
	};
}

/** Benennt eine Vorlage um und erzeugt deren deterministische Template-ID neu. */
export function renameTemplate(
	template: GameState,
	name: string,
	options: RenameScenarioOptions = {},
): GameState {
	if (!template.isTemplate)
		throw new Error("Ein Spiel kann nicht als Vorlage umbenannt werden.");
	const normalizedName = normalizeName(
		name,
		"Die Vorlage benötigt einen Namen.",
	);
	return {
		...template,
		id: createIdFromText(normalizedName, "template"),
		name: normalizedName,
		names: renameLocalizedName(
			template.names,
			normalizedName,
			options.language,
		),
	};
}

/** Benennt ein Regelwerk um und validiert das vollständige Domain-Ergebnis. */
export function renameRuleSet(
	ruleSet: RuleSet,
	name: string,
	options: RenameScenarioOptions = {},
): RuleSet {
	const normalizedName = normalizeName(
		name,
		"Das Regelwerk benötigt einen Namen.",
	);
	return createRuleSetFromDraft(
		{
			...ruleSet,
			id: createIdFromText(normalizedName, "ruleSet"),
			name: normalizedName,
			names: renameLocalizedName(
				ruleSet.names,
				normalizedName,
				options.language,
			),
		},
		{ mode: "stored" },
	).ruleSet;
}

function normalizeName(value: string, emptyMessage: string): string {
	const name = sanitizeText(value).trim();
	if (!name) throw new Error(emptyMessage);
	return name;
}

function renameLocalizedName(
	names: LocalizedNames | undefined,
	name: string,
	language: string | undefined,
): LocalizedNames | undefined {
	if (!language) return names ? { ...names } : undefined;
	return { ...names, [language]: name };
}
