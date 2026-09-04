// src/domain/sessionEditing.ts

import { replaceGameEntityIdReferences } from "./gameEntityIdReferences";
import {
	createUniqueGameEntityIdFromId,
	createUniqueGameEntityIdFromName,
} from "./gameEntityIds";
import type { GameState } from "./gameFactory";
import { getDisplayName } from "./localizedNames";
import {
	type LifeState,
	type LocalizedNames,
	Player,
	type PlayerRoleState,
	Role,
	type RoleNightInfo,
	Team,
} from "./models";
import { createIdFromText, type IdArea } from "./stringSanitizer";

export type SessionEditWarning = {
	code: string;
	message: string;
};

export type SessionEditResult = {
	game: GameState;
	warnings: SessionEditWarning[];
	message: string;
};

export type CreateTeamParams = {
	id?: string;
	name: string;
	names?: LocalizedNames;
	color?: string;
	teamOrder?: number;
};

export type EditTeamParams = {
	teamId: string;
	name?: string;
	names?: LocalizedNames | null;
	color?: string | null;
	teamOrder?: number;
};

export type CreateRoleParams = {
	id?: string;
	name: string;
	names?: LocalizedNames;
	color?: string;
	teamId?: string;
	night?: RoleNightInfo;
	expectsVisual?: boolean;
	isUnique?: boolean;
	unicodeEscaped?: string;
	kills_someone?: boolean;
	resurrect_someone?: boolean;
	apply_status_effect?: string[];
};

export type EditRoleParams = {
	roleId: string;
	name?: string;
	names?: LocalizedNames | null;
	color?: string | null;
	teamId?: string;
	night?: RoleNightInfo | null;
	expectsVisual?: boolean;
	isUnique?: boolean;
	unicodeEscaped?: string | null;
	kills_someone?: boolean | null;
	resurrect_someone?: boolean | null;
	apply_status_effect?: string[] | null;
};

export type CreatePlayerParams = {
	id?: string;
	name: string;
	names?: LocalizedNames;
	color?: string;
	seatNumber?: number;
};

export type EditPlayerParams = {
	playerId: string;
	name?: string;
	names?: LocalizedNames | null;
	color?: string | null;
	lifeState?: LifeState;
	roles?: PlayerRoleState;
	note?: string | null;
};

function updatedNames(
	names: LocalizedNames | null | undefined,
	existingNames: LocalizedNames | undefined,
): LocalizedNames | undefined {
	if (names === null) return undefined;
	return names ?? existingNames;
}

function updatedOptionalValue<T>(
	value: T | null | undefined,
	existing: T | undefined,
): T | undefined {
	if (value === null) return undefined;
	return value ?? existing;
}

// Team erstellen
export function createTeam(
	game: GameState,
	params: CreateTeamParams,
	language = "de",
): SessionEditResult {
	const warnings: SessionEditWarning[] = [];
	validateGameForEditing(game);

	const name = makeUniqueName({
		desiredName: params.name,
		existingNames: game.ruleSetSnapshot.teams.map((team) => team.name),
		warnings,
		label: "Teamname",
	});

	const desiredId = params.id ?? createIdFromText(name, "team");

	const id = createUniqueIdWithWarning({
		game,
		desiredId,
		warnings,
		label: "Team-ID",
		area: "team",
	});

	if (desiredId.toLocaleLowerCase() === "t_unknown") {
		warnings.push({
			code: "UNKNOWN_ID_RESERVED",
			message:
				'Die Team-ID "t_unknown" ist reserviert und wurde automatisch geändert.',
		});
	}

	const team = new Team({
		id,
		name,
		names: params.names,
		color: params.color,
		teamOrder: params.teamOrder ?? 0,
		isSystem: false,
	});

	const nextGame: GameState = {
		...game,
		ruleSetSnapshot: {
			...game.ruleSetSnapshot,
			teams: [...game.ruleSetSnapshot.teams, team],
		},
	};

	return {
		game: nextGame,
		warnings,
		message: `Team ${getDisplayName(team, language)} erstellt.`,
	};
}

// Team bearbeiten
export function editTeam(
	game: GameState,
	params: EditTeamParams,
	language = "de",
): SessionEditResult {
	const warnings: SessionEditWarning[] = [];
	validateGameForEditing(game);

	const existingTeam = findTeamOrThrow(game, params.teamId);

	const teamOrder =
		params.teamOrder !== undefined
			? assertInteger(params.teamOrder, "teamOrder")
			: existingTeam.teamOrder;

	if (existingTeam.isSystem) {
		const name =
			params.name === undefined
				? existingTeam.name
				: makeUniqueName({
						desiredName: params.name,
						existingNames: game.ruleSetSnapshot.teams
							.filter((team) => team.id !== existingTeam.id)
							.map((team) => team.name),
						warnings,
						label: "Teamname",
					});

		const updatedTeam = new Team({
			id: existingTeam.id,
			name,
			names: updatedNames(params.names, existingTeam.names),
			color: updatedOptionalValue(params.color, existingTeam.color),
			teamOrder,
			isSystem: true,
		});

		const nextTeams = game.ruleSetSnapshot.teams.map((team) =>
			team.id === existingTeam.id ? updatedTeam : team,
		);

		return {
			game: {
				...game,
				ruleSetSnapshot: {
					...game.ruleSetSnapshot,
					teams: nextTeams,
				},
			},
			warnings,
			message: `System-Team ${getDisplayName(updatedTeam, language)} aktualisiert.`,
		};
	}

	const existingOtherTeamNames = game.ruleSetSnapshot.teams
		.filter((team) => team.id !== existingTeam.id)
		.map((team) => team.name);

	const desiredName = params.name ?? existingTeam.name;

	const name = makeUniqueName({
		desiredName,
		existingNames: existingOtherTeamNames,
		warnings,
		label: "Teamname",
	});

	const id = createUniqueIdFromNameWithWarning({
		game,
		name,
		oldId: existingTeam.id,
		warnings,
		label: "Team-ID",
		area: "team",
	});

	const updatedTeam = new Team({
		id,
		name,
		names: updatedNames(params.names, existingTeam.names),
		color: updatedOptionalValue(params.color, existingTeam.color),
		teamOrder,
		isSystem: false,
	});

	const nextTeams = game.ruleSetSnapshot.teams.map((team) =>
		team.id === existingTeam.id ? updatedTeam : team,
	);

	const nextGame = replaceGameEntityIdReferences(
		{
			...game,
			ruleSetSnapshot: {
				...game.ruleSetSnapshot,
				teams: nextTeams,
			},
		},
		"team",
		existingTeam.id,
		id,
	);

	return {
		game: nextGame,
		warnings,
		message: `Team ${getDisplayName(updatedTeam, language)} bearbeitet.`,
	};
}

// Team löschen
export function deleteTeam(
	game: GameState,
	teamId: string,
	language = "de",
): SessionEditResult {
	const warnings: SessionEditWarning[] = [];
	validateGameForEditing(game);

	const team = findTeamOrThrow(game, teamId);

	if (team.isSystem) {
		throw new Error(
			`Team "${team.name}" ist ein System-Team und darf nicht gelöscht werden.`,
		);
	}

	const rolesInTeam = game.ruleSetSnapshot.roles.filter(
		(role) => role.teamId === teamId,
	);

	if (rolesInTeam.length > 0) {
		throw new Error(
			`Team "${team.name}" kann nicht gelöscht werden, weil es noch ${rolesInTeam.length} Rolle(n) enthält.`,
		);
	}

	const nextGame: GameState = {
		...game,
		ruleSetSnapshot: {
			...game.ruleSetSnapshot,
			teams: game.ruleSetSnapshot.teams.filter(
				(currentTeam) => currentTeam.id !== teamId,
			),
		},
	};

	return {
		game: nextGame,
		warnings,
		message: `Team ${getDisplayName(team, language)} gelöscht.`,
	};
}

// Rolle erstellen
export function createRole(
	game: GameState,
	params: CreateRoleParams,
	language = "de",
): SessionEditResult {
	const warnings: SessionEditWarning[] = [];
	validateGameForEditing(game);

	const teamId = params.teamId ?? "t_unknown";

	if (!game.ruleSetSnapshot.teams.some((team) => team.id === teamId)) {
		throw new Error(
			`Rolle kann nicht erstellt werden: Team "${teamId}" existiert nicht.`,
		);
	}

	const name = makeUniqueName({
		desiredName: params.name,
		existingNames: game.ruleSetSnapshot.roles.map((role) => role.name),
		warnings,
		label: "Rollenname",
	});

	const desiredId = params.id ?? createIdFromText(name, "role");

	const id = createUniqueIdWithWarning({
		game,
		desiredId,
		warnings,
		label: "Rollen-ID",
		area: "role",
	});

	const role = new Role({
		id,
		name,
		names: params.names,
		color: params.color,
		teamId,
		night: params.night,
		expectsVisual: params.expectsVisual ?? false,
		isUnique: params.isUnique ?? false,
		unicodeEscaped: params.unicodeEscaped,
		kills_someone: params.kills_someone,
		resurrect_someone: params.resurrect_someone,
		apply_status_effect: params.apply_status_effect,
	});

	const nextGame: GameState = {
		...game,
		ruleSetSnapshot: {
			...game.ruleSetSnapshot,
			roles: [...game.ruleSetSnapshot.roles, role],
		},
	};

	return {
		game: nextGame,
		warnings,
		message: `Rolle ${getDisplayName(role, language)} erstellt.`,
	};
}

// Rolle bearbeiten
export function editRole(
	game: GameState,
	params: EditRoleParams,
	language = "de",
): SessionEditResult {
	const warnings: SessionEditWarning[] = [];
	validateGameForEditing(game);

	const existingRole = findRoleOrThrow(game, params.roleId);

	const existingOtherRoleNames = game.ruleSetSnapshot.roles
		.filter((role) => role.id !== existingRole.id)
		.map((role) => role.name);

	const name = makeUniqueName({
		desiredName: params.name ?? existingRole.name,
		existingNames: existingOtherRoleNames,
		warnings,
		label: "Rollenname",
	});

	const id = createUniqueIdFromNameWithWarning({
		game,
		name,
		oldId: existingRole.id,
		warnings,
		label: "Rollen-ID",
		area: "role",
	});

	const teamId = params.teamId ?? existingRole.teamId;

	if (!game.ruleSetSnapshot.teams.some((team) => team.id === teamId)) {
		throw new Error(
			`Rolle kann nicht bearbeitet werden: Team "${teamId}" existiert nicht.`,
		);
	}

	const updatedRole = new Role({
		id,
		name,
		names: updatedNames(params.names, existingRole.names),
		color: updatedOptionalValue(params.color, existingRole.color),
		teamId,
		night:
			params.night === null
				? undefined
				: params.night !== undefined
					? params.night
					: existingRole.night,
		expectsVisual: params.expectsVisual ?? existingRole.expectsVisual,
		isUnique: params.isUnique ?? existingRole.isUnique ?? false,
		unicodeEscaped:
			params.unicodeEscaped === null
				? undefined
				: params.unicodeEscaped !== undefined
					? params.unicodeEscaped
					: existingRole.unicodeEscaped,
		kills_someone:
			params.kills_someone === null
				? undefined
				: (params.kills_someone ?? existingRole.kills_someone),
		resurrect_someone:
			params.resurrect_someone === null
				? undefined
				: (params.resurrect_someone ?? existingRole.resurrect_someone),
		apply_status_effect:
			params.apply_status_effect === null
				? undefined
				: (params.apply_status_effect ?? existingRole.apply_status_effect),
	});
	const nextRoles = game.ruleSetSnapshot.roles.map((role) =>
		role.id === existingRole.id ? updatedRole : role,
	);

	const nextGame = replaceGameEntityIdReferences(
		{
			...game,
			ruleSetSnapshot: {
				...game.ruleSetSnapshot,
				roles: nextRoles,
			},
		},
		"role",
		existingRole.id,
		id,
	);

	if (id !== existingRole.id) {
		warnings.push({
			code: "ROLE_ID_REFERENCES_UPDATED",
			message: `Rollen-ID "${existingRole.id}" wurde zu "${id}" geändert. Spielerreferenzen im aktuellen Spiel wurden aktualisiert.`,
		});
	}

	return {
		game: nextGame,
		warnings,
		message: `Rolle ${getDisplayName(updatedRole, language)} bearbeitet.`,
	};
}

// Rolle löschen
export function deleteRole(
	game: GameState,
	roleId: string,
	language = "de",
): SessionEditResult {
	const warnings: SessionEditWarning[] = [];
	validateGameForEditing(game);

	const role = findRoleOrThrow(game, roleId);

	const usageCount = countRoleReferencesInPlayers(game, roleId);

	if (usageCount > 0) {
		warnings.push({
			code: "ROLE_DELETED_BUT_REFERENCED",
			message: `Rolle "${getDisplayName(role, language)}" wurde gelöscht, wird aber im aktuellen Spiel noch ${usageCount}x referenziert. Diese Referenzen bleiben als fehlende Rollendefinition sichtbar.`,
		});
	}

	const nextGame: GameState = {
		...game,
		rolesForShowing: game.rolesForShowing
			? {
					...game.rolesForShowing,
					roles: game.rolesForShowing.roles.filter(
						(shownRoleId) => shownRoleId !== roleId,
					),
				}
			: undefined,
		ruleSetSnapshot: {
			...game.ruleSetSnapshot,
			roles: game.ruleSetSnapshot.roles.filter(
				(currentRole) => currentRole.id !== roleId,
			),
		},
	};

	return {
		game: nextGame,
		warnings,
		message: `Rolle ${getDisplayName(role, language)} gelöscht.`,
	};
}

// Player erstellen
export function createPlayer(
	game: GameState,
	params: CreatePlayerParams,
	language = "de",
): SessionEditResult {
	const warnings: SessionEditWarning[] = [];
	validateGameForEditing(game);

	const name = makeUniqueName({
		desiredName: params.name,
		existingNames: Object.values(game.playersById).map((player) => player.name),
		warnings,
		label: "Spielername",
	});

	const desiredId = params.id ?? createIdFromText(name, "player");

	const id = createUniqueIdWithWarning({
		game,
		desiredId,
		warnings,
		label: "Spieler-ID",
		area: "player",
	});

	const player = Player.create({
		id,
		name,
		names: params.names,
		color: params.color,
	});

	const nextPlayersById = {
		...game.playersById,
		[id]: player,
	};

	const nextSeatOrder = [...game.seatOrder];

	if (
		params.seatNumber !== undefined &&
		Number.isInteger(params.seatNumber) &&
		params.seatNumber > 0 &&
		params.seatNumber <= game.seatOrder.length
	) {
		nextSeatOrder.splice(params.seatNumber - 1, 0, id);
	} else {
		nextSeatOrder.push(id);
	}

	const nextGame: GameState = {
		...game,
		playersById: nextPlayersById,
		seatOrder: nextSeatOrder,
	};

	return {
		game: nextGame,
		warnings,
		message: `Spieler ${getDisplayName(player, language)} erstellt.`,
	};
}

// Player bearbeiten
export function editPlayer(
	game: GameState,
	params: EditPlayerParams,
	language = "de",
): SessionEditResult {
	const warnings: SessionEditWarning[] = [];
	validateGameForEditing(game);

	const existingPlayer = game.playersById[params.playerId];

	if (!existingPlayer) {
		throw new Error(`Spieler "${params.playerId}" existiert nicht.`);
	}

	const existingOtherPlayerNames = Object.values(game.playersById)
		.filter((player) => player.id !== params.playerId)
		.map((player) => player.name);

	const name = makeUniqueName({
		desiredName: params.name ?? existingPlayer.name,
		existingNames: existingOtherPlayerNames,
		warnings,
		label: "Spielername",
	});

	const id = createUniqueIdFromNameWithWarning({
		game,
		name,
		oldId: existingPlayer.id,
		warnings,
		label: "Spieler-ID",
		area: "player",
	});

	const updatedPlayer = new Player({
		id,
		name,
		names: updatedNames(params.names, existingPlayer.names),
		color: updatedOptionalValue(params.color, existingPlayer.color),
		lifeState: params.lifeState ?? existingPlayer.lifeState,
		roles: params.roles ?? clonePlayerRoleState(existingPlayer.roles),
		statuses: existingPlayer.statuses.map((status) => ({ ...status })),
		note:
			params.note === null
				? undefined
				: params.note !== undefined
					? params.note
					: existingPlayer.note,
		removed: existingPlayer.removed ? { ...existingPlayer.removed } : undefined,
	});

	const nextPlayersById = { ...game.playersById };

	delete nextPlayersById[params.playerId];
	nextPlayersById[id] = updatedPlayer;

	const nextGame = replaceGameEntityIdReferences(
		{ ...game, playersById: nextPlayersById },
		"player",
		params.playerId,
		id,
	);

	if (id !== params.playerId) {
		warnings.push({
			code: "PLAYER_ID_REFERENCES_UPDATED",
			message: `Spieler-ID "${params.playerId}" wurde zu "${id}" geändert. Sitzordnung und Statusquellen wurden aktualisiert.`,
		});
	}

	return {
		game: nextGame,
		warnings,
		message: `Spieler ${getDisplayName(updatedPlayer, language)} bearbeitet.`,
	};
}

// Player löschen
export function deletePlayer(
	game: GameState,
	playerId: string,
	language = "de",
): SessionEditResult {
	const warnings: SessionEditWarning[] = [];
	validateGameForEditing(game);

	const player = game.playersById[playerId];

	if (!player) {
		throw new Error(`Spieler "${playerId}" existiert nicht.`);
	}

	const nextSeatOrder = game.seatOrder.filter((id) => id !== playerId);

	if (game.time.phase === "setup" && game.time.currentNight === 0) {
		const nextPlayersById = { ...game.playersById };
		delete nextPlayersById[playerId];

		return {
			game: {
				...game,
				playersById: nextPlayersById,
				seatOrder: nextSeatOrder,
			},
			warnings,
			message: `Spieler ${getDisplayName(player, language)} gelöscht.`,
		};
	}

	const archivedPlayer = new Player({
		id: player.id,
		name: player.name,
		names: player.names,
		color: player.color,
		lifeState: player.lifeState,
		roles: clonePlayerRoleState(player.roles),
		statuses: player.statuses.map((status) => ({ ...status })),
		note: player.note,
		removed: {
			night: game.time.currentNight,
			phase: game.time.phase,
		},
	});

	return {
		game: {
			...game,
			playersById: {
				...game.playersById,
				[playerId]: archivedPlayer,
			},
			seatOrder: nextSeatOrder,
		},
		warnings,
		message: `Spieler ${getDisplayName(player, language)} aus der Sitzordnung entfernt und archiviert.`,
	};
}

// Hilfsfunktionen
function validateGameForEditing(game: GameState): void {
	if (!game.ruleSetSnapshot) {
		throw new Error("game.ruleSetSnapshot fehlt.");
	}

	if (!Array.isArray(game.ruleSetSnapshot.teams)) {
		throw new Error("game.ruleSetSnapshot.teams muss ein Array sein.");
	}

	if (!Array.isArray(game.ruleSetSnapshot.roles)) {
		throw new Error("game.ruleSetSnapshot.roles muss ein Array sein.");
	}

	if (!game.playersById || typeof game.playersById !== "object") {
		throw new Error("game.playersById muss ein Objekt sein.");
	}

	if (!Array.isArray(game.seatOrder)) {
		throw new Error("game.seatOrder muss ein Array sein.");
	}
}

function findTeamOrThrow(game: GameState, teamId: string): Team {
	const team = game.ruleSetSnapshot.teams.find(
		(currentTeam) => currentTeam.id === teamId,
	);

	if (!team) {
		throw new Error(`Team "${teamId}" existiert nicht.`);
	}

	return team;
}

function findRoleOrThrow(game: GameState, roleId: string): Role {
	const role = game.ruleSetSnapshot.roles.find(
		(currentRole) => currentRole.id === roleId,
	);

	if (!role) {
		throw new Error(`Rolle "${roleId}" existiert nicht.`);
	}

	return role;
}

function createUniqueIdWithWarning(params: {
	game: GameState;
	desiredId: string;
	oldId?: string;
	warnings: SessionEditWarning[];
	label: string;
	area: IdArea;
}): string {
	const baseId = createIdFromText(params.desiredId, params.area);
	const uniqueId = createUniqueGameEntityIdFromId(
		params.desiredId,
		params.game,
		params.area,
		params.oldId,
	);

	if (uniqueId !== baseId) {
		params.warnings.push({
			code: "DUPLICATE_ID_RENUMBERED",
			message: `${params.label} "${baseId}" ist bereits vergeben oder reserviert und wurde zu "${uniqueId}" geändert.`,
		});
	}

	return uniqueId;
}

function createUniqueIdFromNameWithWarning(params: {
	game: GameState;
	name: string;
	oldId: string;
	warnings: SessionEditWarning[];
	label: string;
	area: IdArea;
}): string {
	const baseId = createIdFromText(params.name, params.area);
	const uniqueId = createUniqueGameEntityIdFromName(
		params.name,
		params.game,
		params.area,
		params.oldId,
	);

	if (uniqueId !== baseId) {
		params.warnings.push({
			code: "DUPLICATE_ID_RENUMBERED",
			message: `${params.label} "${baseId}" ist bereits vergeben oder reserviert und wurde zu "${uniqueId}" geändert.`,
		});
	}

	return uniqueId;
}

function makeUniqueName(params: {
	desiredName: string;
	existingNames: string[];
	warnings: SessionEditWarning[];
	label: string;
}): string {
	const baseName = normalizeRequiredDisplayName(
		params.desiredName,
		params.label,
	);

	const existingNameKeys = new Set(
		params.existingNames.map((name) => normalizeNameKey(name)),
	);

	if (!existingNameKeys.has(normalizeNameKey(baseName))) {
		return baseName;
	}

	let counter = 2;
	let candidate = `${baseName} ${counter}`;

	while (existingNameKeys.has(normalizeNameKey(candidate))) {
		counter++;
		candidate = `${baseName} ${counter}`;
	}

	params.warnings.push({
		code: "DUPLICATE_NAME_RENUMBERED",
		message: `${params.label} "${baseName}" existiert bereits und wurde zu "${candidate}" geändert.`,
	});

	return candidate;
}

function normalizeRequiredDisplayName(value: string, label: string): string {
	if (typeof value !== "string") {
		throw new Error(`${label} muss ein String sein.`);
	}

	const trimmed = value.trim();

	if (!trimmed) {
		throw new Error(`${label} darf nicht leer sein.`);
	}

	return trimmed;
}

function normalizeNameKey(value: string): string {
	return value.trim().toLocaleLowerCase();
}

function assertInteger(value: number, label: string): number {
	if (!Number.isInteger(value)) {
		throw new Error(`${label} muss eine ganze Zahl sein.`);
	}

	return value;
}

function clonePlayerRoleState(roles: PlayerRoleState): PlayerRoleState {
	return {
		actualRoleId: roles.actualRoleId,
		shownRoleIds: [...roles.shownRoleIds],
		nightRoleId: roles.nightRoleId,
		claimedRoleId: roles.claimedRoleId,
	};
}

function countRoleReferencesInPlayers(game: GameState, roleId: string): number {
	let count = 0;

	for (const player of Object.values(game.playersById)) {
		if (player.roles.actualRoleId === roleId) count++;
		count += player.roles.shownRoleIds.filter(
			(shownRoleId) => shownRoleId === roleId,
		).length;
		if (player.roles.nightRoleId === roleId) count++;
		if (player.roles.claimedRoleId === roleId) count++;
	}

	return count;
}
