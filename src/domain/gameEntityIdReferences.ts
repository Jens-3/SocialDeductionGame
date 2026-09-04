import type { GameLogEntry, GameState } from "./gameState";
import { Player, type PlayerRoleState, Role } from "./models";

export type GameEntityReferenceType =
	| "team"
	| "role"
	| "player"
	| "statusDefinition";

/**
 * Ersetzt alle fachlichen Referenzen auf eine geänderte Entitäts-ID.
 * Die ID der Entität selbst und gegebenenfalls ihr Record-Key werden vom
 * aufrufenden Bearbeitungsvorgang geändert.
 */
export function replaceGameEntityIdReferences(
	game: GameState,
	type: GameEntityReferenceType,
	oldId: string,
	newId: string,
): GameState {
	if (oldId === newId) return game;

	const withReferences =
		type === "team"
			? replaceTeamIdReferences(game, oldId, newId)
			: type === "role"
				? replaceRoleIdReferences(game, oldId, newId)
				: type === "player"
					? replacePlayerIdReferences(game, oldId, newId)
					: replaceStatusDefinitionIdReferences(game, oldId, newId);

	return replaceLogPayloadIdReferences(withReferences, oldId, newId);
}

function replaceTeamIdReferences(
	game: GameState,
	oldId: string,
	newId: string,
): GameState {
	return {
		...game,
		ruleSetSnapshot: {
			...game.ruleSetSnapshot,
			roles: game.ruleSetSnapshot.roles.map((role) =>
				role.teamId === oldId ? cloneRole(role, { teamId: newId }) : role,
			),
		},
	};
}

function replaceRoleIdReferences(
	game: GameState,
	oldId: string,
	newId: string,
): GameState {
	return {
		...game,
		playersById: Object.fromEntries(
			Object.entries(game.playersById).map(([playerId, player]) => [
				playerId,
				clonePlayer(player, {
					roles: replaceRoleStateId(player.roles, oldId, newId),
					statuses: player.statuses.map((status) => ({
						...status,
						source:
							status.source?.roleIdAtTime === oldId
								? { ...status.source, roleIdAtTime: newId }
								: status.source,
					})),
				}),
			]),
		),
		rolesForShowing: game.rolesForShowing
			? {
					...game.rolesForShowing,
					roles: game.rolesForShowing.roles.map((roleId) =>
						roleId === oldId ? newId : roleId,
					),
				}
			: undefined,
	};
}

function replacePlayerIdReferences(
	game: GameState,
	oldId: string,
	newId: string,
): GameState {
	return {
		...game,
		seatOrder: game.seatOrder.map((playerId) =>
			playerId === oldId ? newId : playerId,
		),
		playersById: Object.fromEntries(
			Object.entries(game.playersById).map(([playerId, player]) => [
				playerId,
				clonePlayer(player, {
					statuses: player.statuses.map((status) => ({
						...status,
						source:
							status.source?.playerId === oldId
								? { ...status.source, playerId: newId }
								: status.source,
					})),
				}),
			]),
		),
	};
}

/** Aktualisiert alle Verwendungen einer Statusdefinitions-ID. */
export function replaceStatusDefinitionIdReferences(
	game: GameState,
	oldId: string,
	newId: string,
): GameState {
	if (oldId === newId) return game;
	return {
		...game,
		ruleSetSnapshot: {
			...game.ruleSetSnapshot,
			roles: game.ruleSetSnapshot.roles.map((role) =>
				role.apply_status_effect?.includes(oldId)
					? cloneRole(role, {
							apply_status_effect: role.apply_status_effect.map((statusId) =>
								statusId === oldId ? newId : statusId,
							),
						})
					: role,
			),
		},
		playersById: Object.fromEntries(
			Object.entries(game.playersById).map(([playerId, player]) => [
				playerId,
				clonePlayer(player, {
					statuses: player.statuses.map((status) =>
						status.statusId === oldId
							? { ...status, statusId: newId }
							: { ...status },
					),
				}),
			]),
		),
	};
}

function replaceRoleStateId(
	roles: PlayerRoleState,
	oldId: string,
	newId: string,
): PlayerRoleState {
	return {
		actualRoleId: roles.actualRoleId === oldId ? newId : roles.actualRoleId,
		shownRoleIds: roles.shownRoleIds.map((roleId) =>
			roleId === oldId ? newId : roleId,
		),
		nightRoleId: roles.nightRoleId === oldId ? newId : roles.nightRoleId,
		claimedRoleId: roles.claimedRoleId === oldId ? newId : roles.claimedRoleId,
	};
}

function cloneRole(
	role: Role,
	changes: Partial<Pick<Role, "teamId" | "apply_status_effect">>,
): Role {
	return new Role({
		id: role.id,
		name: role.name,
		names: role.names,
		color: role.color,
		teamId: changes.teamId ?? role.teamId,
		night: role.night,
		expectsVisual: role.expectsVisual,
		isUnique: role.isUnique,
		unicodeEscaped: role.unicodeEscaped,
		unicodeSymbol: role.unicodeSymbol,
		kills_someone: role.kills_someone,
		resurrect_someone: role.resurrect_someone,
		apply_status_effect:
			changes.apply_status_effect ?? role.apply_status_effect,
	});
}

function clonePlayer(
	player: Player,
	changes: Partial<Pick<Player, "roles" | "statuses">>,
): Player {
	return new Player({
		id: player.id,
		name: player.name,
		names: player.names,
		color: player.color,
		lifeState: player.lifeState,
		roles: changes.roles ?? player.roles,
		statuses: changes.statuses ?? player.statuses,
		note: player.note,
		removed: player.removed,
	});
}

function replaceLogPayloadIdReferences(
	game: GameState,
	oldId: string,
	newId: string,
): GameState {
	let changed = false;
	const log = game.log.map((entry): GameLogEntry => {
		if (!entry.payload) return entry;
		const payload = replaceIdInStructuredValue(entry.payload, oldId, newId);
		if (payload === entry.payload) return entry;
		changed = true;
		return { ...entry, payload: payload as Record<string, unknown> };
	});
	return changed ? { ...game, log } : game;
}

function replaceIdInStructuredValue(
	value: unknown,
	oldId: string,
	newId: string,
): unknown {
	if (value === oldId) return newId;
	if (Array.isArray(value)) {
		const next = value.map((entry) =>
			replaceIdInStructuredValue(entry, oldId, newId),
		);
		return next.some((entry, index) => entry !== value[index]) ? next : value;
	}
	if (typeof value !== "object" || value === null) return value;

	let changed = false;
	const next: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value)) {
		const nextKey = key === oldId ? newId : key;
		const nextEntry = replaceIdInStructuredValue(entry, oldId, newId);
		if (nextKey !== key || nextEntry !== entry) changed = true;
		next[nextKey] = nextEntry;
	}
	return changed ? next : value;
}
