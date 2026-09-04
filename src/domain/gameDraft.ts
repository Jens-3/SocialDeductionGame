import type { LocalizedNames } from "./models";
import type { RuleSetDraft } from "./ruleSet";

/**
 * Klassenfreier, strukturell typisierter Entwurf eines Spielstands.
 *
 * Die Draft-Typen beschreiben ausschließlich JSON-Feldtypen. Fachliche
 * Wertmengen und Zusammenhänge werden erst von der Domain-Validierung geprüft.
 */
export type GameDraft = {
	id: string;
	name: string;
	names?: LocalizedNames;
	isTemplate: boolean;
	createdAt?: string;
	ruleSetSnapshot: RuleSetDraft;
	players: GamePlayerDraft[];
	seatOrder: string[];
	time: GameTimeDraft;
	log: GameLogEntryDraft[];
	rolesForShowing?: GameRolesForShowingDraft;
};

export type GamePlayerDraft = {
	id: string;
	name: string;
	names?: LocalizedNames;
	color?: string;
	lifeState: string;
	roles: GamePlayerRolesDraft;
	statuses: GamePlayerStatusDraft[];
	note?: string;
	removed?: GameRemovedInfoDraft;
};

export type GamePlayerRolesDraft = {
	actualRoleId: string | null;
	shownRoleIds: string[];
	nightRoleId: string | null;
	claimedRoleId?: string;
};

export type GamePlayerStatusDraft = {
	id: string;
	statusId: string;
	fromNight: number;
	untilNight: number | null;
	source?: GamePlayerStatusSourceDraft;
	note?: string;
};

export type GamePlayerStatusSourceDraft = {
	playerId: string;
	roleSourceType?: string;
	roleIdAtTime?: string;
	roleNameAtTime?: string;
};

export type GameRemovedInfoDraft = {
	night: number;
	phase: string;
};

export type GameTimeDraft = {
	currentNight: number;
	phase: string;
};

export type GameLogEntryDraft = {
	id: string;
	night: number;
	phase: string;
	createdAt: string;
	type: string;
	actor?: string;
	text: string;
	payload?: Record<string, unknown>;
};

export type GameRolesForShowingDraft = {
	roles: string[];
	notice?: string;
	showRoleSymbols?: boolean;
};
