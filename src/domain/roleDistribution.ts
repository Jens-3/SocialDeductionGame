// src/domain/roleDistribution.ts

import { DomainOperationError } from "./domainFailure";
import type { DomainServices } from "./domainServices";
import type { GameLogEntry, GameState } from "./gameFactory";
import type { Instant } from "./instant";
import { getDisplayName } from "./localizedNames";
import { Player, type Role } from "./models";

export type TeamRoleCounts = Record<string, number>;
export type SelectedRoleCounts = Record<string, number>;

export type RoleDistributionOptions = {
	language?: string;
	/**
	 * Optional für Tests.
	 * Standard: Math.random
	 */
	rng?: () => number;

	/**
	 * Standard: true.
	 * Wenn true, wird ein zusammenfassender Logeintrag erzeugt.
	 */
	addLogEntry?: boolean;
};

export type SeatRoleAssignment = {
	seatNumber: number;
	playerId: string;
	roleId: string;
};

export type RoleDistributionResult = {
	game: GameState;
	assignments: SeatRoleAssignment[];
	drawnRoleIdsByTeamId: Record<string, string[]>;
	message: string;
};

export type SelectedRoleDistributionResult = {
	game: GameState;
	assignments: SeatRoleAssignment[];
	selectedRoleCounts: Record<string, number>;
	message: string;
};

/**
 * Verteilt eine explizit gewählte Rollenmenge zufällig auf die Sitzplätze.
 * `isUnique` ist hier bewusst keine Einschränkung: Eine mehrfach ausgewählte
 * einzigartige Rolle wird ohne Domain-Warnung mehrfach vergeben.
 */
export function assignRandomRolesByRoleCounts(
	game: GameState,
	requestedRoleCounts: SelectedRoleCounts,
	services: DomainServices,
	options: RoleDistributionOptions = {},
): SelectedRoleDistributionResult {
	const assignableSeats = validateGameForDistribution(game);
	const normalizedRoleCounts = normalizeRoleCounts(game, requestedRoleCounts);
	const selectedRoleIds = Object.entries(normalizedRoleCounts).flatMap(
		([roleId, count]) => Array.from({ length: count }, () => roleId),
	);
	if (selectedRoleIds.length !== assignableSeats.length) {
		throw new Error(
			`Rollenverteilung fehlgeschlagen: Es wurden ${selectedRoleIds.length} Rollen ausgewählt, aber es gibt ${assignableSeats.length} sitzende Spieler.`,
		);
	}

	const rng = options.rng ?? Math.random;
	const now = services.clock.now();
	const randomizedRoleIds = shuffleArray(selectedRoleIds, rng);
	const nextPlayersById = clonePlayersById(game.playersById);
	const assignments = assignableSeats.map(({ playerId, seatNumber }, index) => {
		const player = nextPlayersById[playerId];
		const roleId = randomizedRoleIds[index];
		if (!player || !roleId) {
			throw new Error(
				`Rollenverteilung fehlgeschlagen: Sitz ${index + 1} konnte nicht zugewiesen werden.`,
			);
		}
		player.assignActualRole(roleId);
		return { seatNumber, playerId, roleId };
	});
	const shouldLog = options.addLogEntry !== false && !game.isTemplate;
	const nextGame: GameState = {
		...game,
		playersById: nextPlayersById,
		log: shouldLog
			? [
					...game.log,
					createSelectedRoleDistributionLogEntry({
						game,
						assignments,
						selectedRoleCounts: normalizedRoleCounts,
						now,
						id: services.idGenerator.createId("log"),
					}),
				]
			: game.log,
	};
	return {
		game: nextGame,
		assignments,
		selectedRoleCounts: normalizedRoleCounts,
		message: `${assignments.length} ausgewählte Rollen zufällig verteilt.`,
	};
}

export function assignRandomRolesByTeamCounts(
	game: GameState,
	requestedTeamCounts: TeamRoleCounts,
	services: DomainServices,
	options: RoleDistributionOptions = {},
): RoleDistributionResult {
	const assignableSeats = validateGameForDistribution(game);

	const rng = options.rng ?? Math.random;
	const now = services.clock.now();

	const normalizedTeamCounts = normalizeTeamCounts(game, requestedTeamCounts);

	const totalRequestedRoles = sumTeamCounts(normalizedTeamCounts);

	if (totalRequestedRoles !== assignableSeats.length) {
		throw new Error(
			`Rollenverteilung fehlgeschlagen: Es wurden ${totalRequestedRoles} Rollen angefordert, aber es gibt ${assignableSeats.length} sitzende Spieler.`,
		);
	}

	const drawnRoleIdsByTeamId: Record<string, string[]> = {};
	const allDrawnRoleIds: string[] = [];

	for (const team of game.ruleSetSnapshot.teams) {
		const countForTeam = normalizedTeamCounts[team.id] ?? 0;

		if (countForTeam === 0) {
			drawnRoleIdsByTeamId[team.id] = [];
			continue;
		}

		const teamRoles = game.ruleSetSnapshot.roles.filter(
			(role) => role.teamId === team.id,
		);

		const drawnRoleIds = drawRolesForTeam({
			teamName: getDisplayName(team, options.language ?? "de"),
			roles: teamRoles,
			count: countForTeam,
			rng,
		});

		drawnRoleIdsByTeamId[team.id] = drawnRoleIds;
		allDrawnRoleIds.push(...drawnRoleIds);
	}

	const randomizedRoleIds = shuffleArray(allDrawnRoleIds, rng);

	const nextPlayersById = clonePlayersById(game.playersById);
	const assignments: SeatRoleAssignment[] = [];

	for (let index = 0; index < assignableSeats.length; index++) {
		const seat = assignableSeats[index];
		if (!seat) continue;
		const { playerId, seatNumber } = seat;
		const roleId = randomizedRoleIds[index];

		const player = nextPlayersById[playerId];

		if (!player) {
			throw new Error(
				`Rollenverteilung fehlgeschlagen: Sitz ${index + 1} verweist auf unbekannten Spieler "${playerId}".`,
			);
		}

		player.assignActualRole(roleId);

		assignments.push({
			seatNumber,
			playerId,
			roleId,
		});
	}

	const nextGame: GameState = {
		...game,
		playersById: nextPlayersById,
		log:
			options.addLogEntry === false || game.isTemplate
				? game.log
				: [
						...game.log,
						createRoleDistributionLogEntry({
							game,
							assignments,
							normalizedTeamCounts,
							drawnRoleIdsByTeamId,
							now,
							id: services.idGenerator.createId("log"),
						}),
					],
	};

	return {
		game: nextGame,
		assignments,
		drawnRoleIdsByTeamId,
		message: `${assignments.length} Rollen zufällig verteilt.`,
	};
}

// Hilfsfunktionen
function drawRolesForTeam(params: {
	teamName: string;
	roles: Role[];
	count: number;
	rng: () => number;
}): string[] {
	const { teamName, roles, count, rng } = params;

	if (count === 0) {
		return [];
	}

	if (roles.length === 0) {
		throw new DomainOperationError({
			source: "domain",
			operation: "resolve",
			reason: "roleDistributionTeamHasNoRoles",
			repairable: false,
			diagnostic:
				"Role distribution failed: players were requested for a team without roles.",
			parameters: { teamName, requestedCount: count },
		});
	}

	const shuffledUniquePass = shuffleArray(roles, rng);
	const drawnRoles: Role[] = [];

	// Erste Phase: ohne Zurücklegen ziehen.
	while (drawnRoles.length < count && shuffledUniquePass.length > 0) {
		const nextRole = shuffledUniquePass.shift();

		if (!nextRole) {
			break;
		}

		drawnRoles.push(nextRole);
	}

	if (drawnRoles.length >= count) {
		return drawnRoles.map((role) => role.id);
	}

	// Zweite Phase: nur nicht-einzigartige Rollen dürfen wieder in den Pool.
	const repeatableRoles = roles.filter((role) => isRepeatableRole(role));

	if (repeatableRoles.length === 0) {
		throw new DomainOperationError({
			source: "domain",
			operation: "resolve",
			reason: "roleDistributionInsufficientDistinctRoles",
			repairable: false,
			diagnostic:
				"Role distribution failed: the team has too few distinct roles and no repeatable role.",
			parameters: {
				teamName,
				requestedCount: count,
				availableRoleCount: roles.length,
			},
		});
	}

	// Mit Zurücklegen ziehen, bis genug Rollen vorhanden sind.
	while (drawnRoles.length < count) {
		const randomRole = chooseRandomItem(repeatableRoles, rng);
		drawnRoles.push(randomRole);
	}

	return drawnRoles.map((role) => role.id);
}

function isRepeatableRole(role: Role): boolean {
	// Deine Regel:
	// isUnique === false oder isUnique fehlt => mehrfach möglich.
	return (role as { isUnique?: boolean }).isUnique !== true;
}

// Team-Counts normalisieren und prüfen
function normalizeTeamCounts(
	game: GameState,
	requestedTeamCounts: TeamRoleCounts,
): Record<string, number> {
	if (!isRecord(requestedTeamCounts)) {
		throw new Error("teamCounts muss ein Objekt sein.");
	}

	const knownTeamIds = new Set(
		game.ruleSetSnapshot.teams.map((team) => team.id),
	);
	const normalized: Record<string, number> = {};

	// Nicht genannte Teams werden auf 0 gesetzt.
	for (const team of game.ruleSetSnapshot.teams) {
		normalized[team.id] = 0;
	}

	for (const [teamId, rawCount] of Object.entries(requestedTeamCounts)) {
		if (!knownTeamIds.has(teamId)) {
			throw new Error(
				`Rollenverteilung fehlgeschlagen: Unbekanntes Team "${teamId}".`,
			);
		}

		if (!Number.isInteger(rawCount)) {
			throw new Error(
				`Rollenverteilung fehlgeschlagen: Anzahl für Team "${teamId}" muss eine ganze Zahl sein.`,
			);
		}

		if (rawCount < 0) {
			throw new Error(
				`Rollenverteilung fehlgeschlagen: Anzahl für Team "${teamId}" darf nicht negativ sein.`,
			);
		}

		if (rawCount > 100) {
			throw new Error(
				`Rollenverteilung fehlgeschlagen: Anzahl für Team "${teamId}" darf nicht größer als 100 sein.`,
			);
		}

		normalized[teamId] = rawCount;
	}

	return normalized;
}

function normalizeRoleCounts(
	game: GameState,
	requestedRoleCounts: SelectedRoleCounts,
): Record<string, number> {
	if (!isRecord(requestedRoleCounts)) {
		throw new Error("roleCounts muss ein Objekt sein.");
	}
	const knownRoleIds = new Set(
		game.ruleSetSnapshot.roles.map((role) => role.id),
	);
	const normalized: Record<string, number> = {};
	for (const role of game.ruleSetSnapshot.roles) normalized[role.id] = 0;
	for (const [roleId, count] of Object.entries(requestedRoleCounts)) {
		if (!knownRoleIds.has(roleId)) {
			throw new Error(
				`Rollenverteilung fehlgeschlagen: Unbekannte Rolle "${roleId}".`,
			);
		}
		if (!Number.isInteger(count) || count < 0 || count > 100) {
			throw new Error(
				`Rollenverteilung fehlgeschlagen: Anzahl für Rolle "${roleId}" muss eine ganze Zahl zwischen 0 und 100 sein.`,
			);
		}
		normalized[roleId] = count;
	}
	return normalized;
}

function sumTeamCounts(teamCounts: Record<string, number>): number {
	return Object.values(teamCounts).reduce((sum, count) => sum + count, 0);
}

// Game-Validierung
function validateGameForDistribution(
	game: GameState,
): Array<{ playerId: string; seatNumber: number }> {
	if (!isRecord(game)) {
		throw new Error("game muss ein Objekt sein.");
	}

	if (!isRecord(game.playersById)) {
		throw new Error("game.playersById muss ein Objekt sein.");
	}

	if (!Array.isArray(game.seatOrder)) {
		throw new Error("game.seatOrder muss ein Array sein.");
	}

	if (!isRecord(game.ruleSetSnapshot)) {
		throw new Error("game.ruleSetSnapshot muss ein Objekt sein.");
	}

	if (!Array.isArray(game.ruleSetSnapshot.teams)) {
		throw new Error("game.ruleSetSnapshot.teams muss ein Array sein.");
	}

	if (!Array.isArray(game.ruleSetSnapshot.roles)) {
		throw new Error("game.ruleSetSnapshot.roles muss ein Array sein.");
	}

	if (game.seatOrder.length === 0) {
		throw new Error(
			"Rollenverteilung fehlgeschlagen: Es gibt keine sitzenden Spieler.",
		);
	}
	if (game.playersById.p_empty) {
		throw new Error(
			'Rollenverteilung fehlgeschlagen: "p_empty" darf kein Spielerobjekt sein.',
		);
	}

	const seenPlayerIds = new Set<string>();
	const assignableSeats: Array<{ playerId: string; seatNumber: number }> = [];

	for (let index = 0; index < game.seatOrder.length; index++) {
		const playerId = game.seatOrder[index];
		if (!playerId) continue;
		if (playerId === "p_empty") continue;
		if (seenPlayerIds.has(playerId)) {
			throw new Error(
				`Rollenverteilung fehlgeschlagen: Spieler "${playerId}" kommt mehrfach in seatOrder vor.`,
			);
		}

		seenPlayerIds.add(playerId);

		if (!game.playersById[playerId]) {
			throw new Error(
				`Rollenverteilung fehlgeschlagen: seatOrder verweist auf unbekannten Spieler "${playerId}".`,
			);
		}
		assignableSeats.push({ playerId, seatNumber: index + 1 });
	}
	if (assignableSeats.length === 0) {
		throw new Error(
			"Rollenverteilung fehlgeschlagen: Es gibt keine sitzenden Spieler.",
		);
	}
	return assignableSeats;
}

// Zufallsfunktionen
function shuffleArray<T>(items: T[], rng: () => number): T[] {
	const result = [...items];

	for (let index = result.length - 1; index > 0; index--) {
		const randomIndex = randomIntegerInclusive(0, index, rng);

		const temp = result[index];
		result[index] = result[randomIndex];
		result[randomIndex] = temp;
	}

	return result;
}

function chooseRandomItem<T>(items: T[], rng: () => number): T {
	if (items.length === 0) {
		throw new Error(
			"chooseRandomItem kann nicht aus einer leeren Liste ziehen.",
		);
	}

	const index = randomIntegerInclusive(0, items.length - 1, rng);
	return items[index];
}

function randomIntegerInclusive(
	min: number,
	max: number,
	rng: () => number,
): number {
	const value = rng();

	if (typeof value !== "number" || value < 0 || value >= 1) {
		throw new Error("rng muss eine Zahl x liefern mit 0 <= x < 1.");
	}

	return Math.floor(value * (max - min + 1)) + min;
}

// Spieler klonen
function clonePlayersById(
	playersById: Record<string, Player>,
): Record<string, Player> {
	const result: Record<string, Player> = {};

	for (const [playerId, player] of Object.entries(playersById)) {
		result[playerId] = new Player({
			id: player.id,
			name: player.name,
			names: player.names,
			color: player.color,
			lifeState: player.lifeState,
			roles: {
				actualRoleId: player.roles.actualRoleId,
				shownRoleIds: [...player.roles.shownRoleIds],
				nightRoleId: player.roles.nightRoleId,
				claimedRoleId: player.roles.claimedRoleId,
			},
			statuses: player.statuses.map((status) => ({
				id: status.id,
				statusId: status.statusId,
				fromNight: status.fromNight,
				untilNight: status.untilNight,
				source: status.source
					? {
							playerId: status.source.playerId,
							roleSourceType: status.source.roleSourceType,
							roleIdAtTime: status.source.roleIdAtTime,
							roleNameAtTime: status.source.roleNameAtTime,
						}
					: undefined,
				note: status.note,
			})),
			note: player.note,
			removed: player.removed
				? {
						night: player.removed.night,
						phase: player.removed.phase,
					}
				: undefined,
		});
	}

	return result;
}

// Logeintrag
function createRoleDistributionLogEntry(params: {
	game: GameState;
	assignments: SeatRoleAssignment[];
	normalizedTeamCounts: Record<string, number>;
	drawnRoleIdsByTeamId: Record<string, string[]>;
	now: Instant;
	id: string;
}): GameLogEntry {
	const {
		game,
		assignments,
		normalizedTeamCounts,
		drawnRoleIdsByTeamId,
		now,
		id,
	} = params;

	return {
		id,
		night: game.time.currentNight,
		phase: game.time.phase,
		createdAt: now,
		type: "roles_randomly_distributed",
		actor: "storyteller",
		text: `${assignments.length} Rollen zufällig verteilt.`,
		payload: {
			teamCounts: normalizedTeamCounts,
			drawnRoleIdsByTeamId,
			assignments,
		},
	};
}

function createSelectedRoleDistributionLogEntry(params: {
	game: GameState;
	assignments: SeatRoleAssignment[];
	selectedRoleCounts: Record<string, number>;
	now: Instant;
	id: string;
}): GameLogEntry {
	const { game, assignments, selectedRoleCounts, now, id } = params;
	return {
		id,
		night: game.time.currentNight,
		phase: game.time.phase,
		createdAt: now,
		type: "selected_roles_randomly_distributed",
		actor: "storyteller",
		text: `${assignments.length} ausgewählte Rollen zufällig verteilt.`,
		payload: { selectedRoleCounts, assignments },
	};
}

// Kleine Hilfsfunktion
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
