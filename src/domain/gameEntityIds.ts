import type { GameState } from "./gameState";
import { EMPTY_PLAYER_ID, UNKNOWN_TEAM_ID } from "./reservedIds";
import {
	createUniqueId,
	createUniqueIdFromName,
	type IdArea,
	normalizeId,
} from "./stringSanitizer";

/**
 * Erzeugt eine im gemeinsamen Namensraum von Teams, Rollen, Spielern,
 * Statusdefinitionen und Statusinstanzen eindeutige ID. Die reservierte ID
 * "t_unknown" gilt immer als vergeben.
 *
 * Der Spielstand wird nicht verändert.
 */
export function createUniqueGameEntityIdFromName(
	name: string,
	game: GameState,
	area: IdArea = "generic",
	oldId?: string,
	alwaysAppendCounter = false,
): string {
	const sanitizedOldId =
		oldId === undefined ? undefined : normalizeId(oldId, area);

	const usedIds = collectUsedGameEntityIds(game);
	return createUniqueIdFromName(name, area, usedIds, {
		...(sanitizedOldId !== undefined && sanitizedOldId !== EMPTY_PLAYER_ID
			? { ignoredId: sanitizedOldId }
			: {}),
		forceSuffix: alwaysAppendCounter,
	}).id;
}

export function createUniqueGameEntityIdFromId(
	id: string,
	game: GameState,
	area: IdArea = "generic",
	oldId?: string,
	alwaysAppendCounter = false,
): string {
	const sanitizedOldId =
		oldId === undefined ? undefined : normalizeId(oldId, area);

	const usedIds = collectUsedGameEntityIds(game);
	return createUniqueId(id, area, usedIds, {
		...(sanitizedOldId !== undefined && sanitizedOldId !== EMPTY_PLAYER_ID
			? { ignoredId: sanitizedOldId }
			: {}),
		forceSuffix: alwaysAppendCounter,
	}).id;
}

export function collectUsedGameEntityIds(game: GameState): Set<string> {
	return new Set([
		UNKNOWN_TEAM_ID,
		EMPTY_PLAYER_ID,
		...game.ruleSetSnapshot.teams.map((team) => team.id),
		...game.ruleSetSnapshot.roles.map((role) => role.id),
		...Object.keys(game.playersById),
		...Object.values(game.playersById).map((player) => player.id),
		...Object.keys(game.statusDefinitionsById),
		...Object.values(game.statusDefinitionsById).map(
			(definition) => definition.id,
		),
		...(game.ruleSetSnapshot.statuses ?? []).map((definition) => definition.id),
		...Object.values(game.playersById).flatMap((player) =>
			player.statuses.flatMap((status) => [status.id, status.statusId]),
		),
	]);
}

export function createUniquePlayerStatusId(
	statusId: string,
	game: GameState,
): string {
	return createUniqueGameEntityIdFromId(
		statusId.replace(/^d_/, ""),
		game,
		"statusInstance",
		undefined,
		true,
	);
}
