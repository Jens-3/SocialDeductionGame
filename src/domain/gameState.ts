import type { Player } from "./models";
import type { RuleSet } from "./ruleSet";
import type { StatusDefinition } from "./statusDefinition";

export type GamePhase = "setup" | "night" | "day";

export type GameTime = {
	currentNight: number;
	phase: GamePhase;
};

export type GameLogEntry = {
	id: string;
	night: number;
	phase: GamePhase;
	createdAt: string;
	type: string;
	actor?: "system" | "storyteller";
	text: string;
	payload?: Record<string, unknown>;
};

export type RolesForShowing = {
	roles: string[];
	notice?: string;
	showRoleSymbols: boolean;
};

export type GameState = {
	id: string;
	name: string;
	names?: Record<string, string>;
	isTemplate: boolean;

	createdAt?: string;

	ruleSetSnapshot: RuleSet;
	statusDefinitionsById: Record<string, StatusDefinition>;

	playersById: Record<string, Player>;
	seatOrder: string[];

	time: GameTime;
	log: GameLogEntry[];
	rolesForShowing?: RolesForShowing;
};
