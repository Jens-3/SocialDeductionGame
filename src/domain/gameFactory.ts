// src/domain/gameFactory.ts

import { sanitizeText } from "../shared/textSanitizer";
import type { DomainServices } from "./domainServices";
import { repairIds } from "./gameIdRepair";
import type { GameState } from "./gameState";
import type { Instant } from "./instant";
import { Player, Role, Team } from "./models";
import type { RuleSet } from "./ruleSet";
import type { StatusDefinition } from "./statusDefinition";
import { type IdArea, isIdForArea } from "./stringSanitizer";

export type {
	GameLogEntry,
	GamePhase,
	GameState,
	GameTime,
	RolesForShowing,
} from "./gameState";
export type { StatusDefinition } from "./statusDefinition";

export type CreateGameFromRuleSetParams = {
	services: DomainServices;
	ruleSet: RuleSet;
	playerCount: number;

	/**
	 * Optional.
	 * Wenn kein Name übergeben wird, wird automatisch erzeugt:
	 * "<RuleSet-Name> — YYYY-MM-DD — <N> Spieler"
	 */
	name?: string;

	/**
	 * Optional.
	 * Falls nicht gesetzt, wird ein neues Spiel erzeugt.
	 * Kann für Tests nützlich sein.
	 */
	gameId?: string;
};

export function createGameFromRuleSet(
	params: CreateGameFromRuleSetParams,
): GameState {
	validateCreateGameParams(params);

	const now = params.services.clock.now();

	const gameId = params.gameId ?? params.services.idGenerator.createId("game");
	const gameName =
		normalizeOptionalText(params.name) ??
		createDefaultGameName(params.ruleSet, params.playerCount, now);

	const playersById: Record<string, Player> = {};
	const seatOrder: string[] = [];

	for (let index = 1; index <= params.playerCount; index++) {
		const playerId = `p_player${index}`;

		const player = Player.create({
			id: playerId,
			name: `Player ${index}`,
		});

		playersById[playerId] = player;
		seatOrder.push(playerId);
	}
	const ruleSetSnapshot = cloneRuleSet(params.ruleSet);
	const statusDefinitionsById = Object.fromEntries(
		(ruleSetSnapshot.statuses ?? []).map((definition) => [
			definition.id,
			cloneStatusDefinition(definition),
		]),
	);

	const game: GameState = {
		id: gameId,
		name: gameName,
		isTemplate: false,

		createdAt: now,

		ruleSetSnapshot,
		statusDefinitionsById,

		playersById,
		seatOrder,

		time: {
			currentNight: 0,
			phase: "setup",
		},

		log: [],
	};

	const repairResult = repairIds(game);
	if (typeof repairResult === "string") {
		throw new Error(`Spiel konnte nicht erzeugt werden: ${repairResult}`);
	}

	validateRuleSet(game.ruleSetSnapshot);
	return game;
}

export function createDefaultGameName(
	ruleSet: RuleSet,
	playerCount: number,
	instant: Instant,
): string {
	return `${ruleSet.name} — ${formatDateForName(instant)} — ${playerCount} Spieler`;
}

function validateCreateGameParams(params: CreateGameFromRuleSetParams): void {
	validateRuleSetStructure(params.ruleSet);

	if (!Number.isInteger(params.playerCount) || params.playerCount < 1) {
		throw new Error("playerCount muss eine positive ganze Zahl sein.");
	}

	if (params.playerCount > 50) {
		throw new Error(
			"playerCount ist ungewöhnlich hoch. Maximum für Version 1: 50.",
		);
	}

	if (params.name !== undefined && !params.name.trim()) {
		throw new Error(
			"name darf nicht leer sein, wenn er explizit gesetzt wird.",
		);
	}

	if (params.gameId !== undefined && !isValidGameId(params.gameId)) {
		throw new Error(
			'gameId muss mit "game_" beginnen und darf danach nur Kleinbuchstaben, Zahlen und "_" enthalten.',
		);
	}
}

function validateRuleSetStructure(ruleSet: RuleSet): void {
	if (!isRecord(ruleSet)) {
		throw new Error("ruleSet muss ein Objekt sein.");
	}
	if (!Array.isArray(ruleSet.teams)) {
		throw new Error("ruleSet.teams muss ein Array sein.");
	}
	if (!Array.isArray(ruleSet.roles)) {
		throw new Error("ruleSet.roles muss ein Array sein.");
	}
	if (ruleSet.statuses !== undefined && !Array.isArray(ruleSet.statuses)) {
		throw new Error("ruleSet.statuses muss ein Array sein.");
	}
}

function validateRuleSet(ruleSet: RuleSet): void {
	if (!isRecord(ruleSet)) {
		throw new Error("ruleSet muss ein Objekt sein.");
	}

	assertValidId(ruleSet.id, "ruleSet.id", "ruleSet");
	assertNonEmptyString(ruleSet.name, "ruleSet.name");

	if (!Number.isInteger(ruleSet.version) || ruleSet.version < 1) {
		throw new Error("ruleSet.version muss eine positive ganze Zahl sein.");
	}

	if (!Array.isArray(ruleSet.teams)) {
		throw new Error("ruleSet.teams muss ein Array sein.");
	}

	if (!Array.isArray(ruleSet.roles)) {
		throw new Error("ruleSet.roles muss ein Array sein.");
	}
	if (ruleSet.statuses !== undefined && !Array.isArray(ruleSet.statuses)) {
		throw new Error("ruleSet.statuses muss ein Array sein.");
	}

	const teamIds = new Set<string>();

	for (const team of ruleSet.teams) {
		assertValidId(team.id, "team.id", "team");
		assertNonEmptyString(team.name, "team.name");

		if (!Number.isInteger(team.teamOrder)) {
			throw new Error(`Team "${team.id}" hat keine gültige teamOrder.`);
		}

		if (teamIds.has(team.id)) {
			throw new Error(`Doppelte Team-ID "${team.id}".`);
		}

		teamIds.add(team.id);
	}

	if (!teamIds.has("t_unknown")) {
		throw new Error(
			'RuleSet muss ein System-Team mit id "t_unknown" enthalten.',
		);
	}

	const roleIds = new Set<string>();

	for (const role of ruleSet.roles) {
		assertValidId(role.id, "role.id", "role");
		assertNonEmptyString(role.name, "role.name");
		assertValidId(role.teamId, "role.teamId", "team");

		if (roleIds.has(role.id)) {
			throw new Error(`Doppelte Rollen-ID "${role.id}".`);
		}

		roleIds.add(role.id);

		if (!teamIds.has(role.teamId)) {
			throw new Error(
				`Rolle "${role.id}" verweist auf unbekanntes Team "${role.teamId}".`,
			);
		}

		if (typeof role.expectsVisual !== "boolean") {
			throw new Error(`Rolle "${role.id}" hat kein gültiges expectsVisual.`);
		}

		if (typeof role.isUnique !== "boolean") {
			throw new Error(`Rolle "${role.id}" hat kein gültiges isUnique.`);
		}

		if (role.unicodeEscaped !== undefined) {
			assertAsciiOnly(role.unicodeEscaped, `role "${role.id}".unicodeEscaped`);
		}
	}

	const entityIds = new Set([...teamIds, ...roleIds]);
	for (const status of ruleSet.statuses ?? []) {
		assertValidId(status.id, "status.id", "statusDefinition");
		assertNonEmptyString(status.name, "status.name");
		if (entityIds.has(status.id)) {
			throw new Error(`Doppelte Entitäts-ID "${status.id}".`);
		}
		entityIds.add(status.id);
	}
}

function cloneRuleSet(ruleSet: RuleSet): RuleSet {
	return {
		id: ruleSet.id,
		name: ruleSet.name,
		names: ruleSet.names ? { ...ruleSet.names } : undefined,
		version: ruleSet.version,
		teams: ruleSet.teams.map(
			(team) =>
				new Team({
					id: team.id,
					name: team.name,
					names: team.names,
					color: team.color,
					teamOrder: team.teamOrder,
					isSystem: team.isSystem,
				}),
		),
		roles: ruleSet.roles.map(
			(role) =>
				new Role({
					id: role.id,
					name: role.name,
					names: role.names,
					color: role.color,
					teamId: role.teamId,
					night: cloneNightInfo(role.night),
					expectsVisual: role.expectsVisual,
					isUnique: role.isUnique,
					unicodeEscaped: role.unicodeEscaped,
					unicodeSymbol: role.unicodeSymbol,
					kills_someone: role.kills_someone,
					resurrect_someone: role.resurrect_someone,
					apply_status_effect: role.apply_status_effect,
				}),
		),
		statuses: ruleSet.statuses?.map((status) => cloneStatusDefinition(status)),
	};
}

function cloneNightInfo(night: Role["night"]): Role["night"] {
	if (!night) {
		return undefined;
	}

	return {
		first: night.first
			? {
					order: night.first.order,
					note: night.first.note,
				}
			: undefined,
		other: night.other
			? {
					order: night.other.order,
					note: night.other.note,
				}
			: undefined,
	};
}

function cloneStatusDefinition(definition: StatusDefinition): StatusDefinition {
	return {
		id: definition.id,
		name: definition.name,
		names: definition.names ? { ...definition.names } : undefined,
		unicodeEscaped: definition.unicodeEscaped,
		unicodeSymbol: definition.unicodeSymbol,
		defaultDuration: definition.defaultDuration,
	};
}

function formatDateForName(instant: Instant): string {
	return instant.slice(0, 10);
}

function normalizeOptionalText(value: string | undefined): string | undefined {
	const trimmed = value === undefined ? undefined : sanitizeText(value).trim();
	return trimmed ? trimmed : undefined;
}

function assertValidId(value: unknown, label: string, area: IdArea): void {
	if (typeof value !== "string") {
		throw new Error(`${label} muss ein String sein.`);
	}

	if (!isIdForArea(value, area)) {
		throw new Error(
			`${label} hat nicht das erwartete Präfix für den Bereich ${area}.`,
		);
	}
}

function isValidGameId(value: string): boolean {
	return /^game_[a-z0-9_]+$/.test(value);
}

function assertNonEmptyString(value: unknown, label: string): void {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(`${label} muss ein nicht-leerer String sein.`);
	}
}

function assertAsciiOnly(value: string, label: string): void {
	for (const char of value) {
		if (char.charCodeAt(0) > 127) {
			throw new Error(`${label} darf nur ASCII-Zeichen enthalten.`);
		}
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
