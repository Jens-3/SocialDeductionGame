import type { LocalizedNames, Role, Team } from "./models";
import type { StatusDefinition } from "./statusDefinition";

export type RuleSet = {
	id: string;
	name: string;
	names?: LocalizedNames;
	version: number;
	teams: Team[];
	roles: Role[];
	statuses?: StatusDefinition[];
};

export type ImportWarning = {
	code: string;
	message: string;
};

export type ImportRuleSetResult = {
	ruleSet: RuleSet;
	warnings: ImportWarning[];
};

export type RuleSetDraft = {
	id?: string;
	name: string;
	names?: LocalizedNames;
	version?: number;
	teams: RuleSetTeamDraft[];
	roles: RuleSetRoleDraft[];
	statuses?: RuleSetStatusDraft[];
};

export type RuleSetTeamDraft = {
	id: string;
	name: string;
	names?: LocalizedNames;
	color?: string;
	teamOrder: number;
	isSystem?: boolean;
};

export type RuleSetNightActionDraft = {
	order: number;
	note?: string;
};

export type RuleSetNightDraft = {
	first?: RuleSetNightActionDraft;
	other?: RuleSetNightActionDraft;
};

export type RuleSetRoleDraft = {
	id: string;
	name: string;
	names?: LocalizedNames;
	color?: string;
	teamId?: string;
	night?: RuleSetNightDraft;
	expectsVisual?: boolean;
	isUnique?: boolean;
	unicodeEscaped?: string;
	unicodeSymbol?: string;
	kills_someone?: boolean;
	resurrect_someone?: boolean;
	apply_status_effect?: string[];
};

export type RuleSetStatusDraft = {
	id: string;
	name: string;
	names?: LocalizedNames;
	unicodeEscaped?: string;
	unicodeSymbol?: string;
	defaultDuration?: number;
};
