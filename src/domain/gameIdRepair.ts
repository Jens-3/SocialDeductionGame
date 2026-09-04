import { repairHexColor } from "./color";
import { isDomainOperationError } from "./domainFailure";
import { repairDuplicateGameEntityIds } from "./gameEntityIdRepair";
import {
	createUniqueGameEntityIdFromId,
	createUniqueGameEntityIdFromName,
} from "./gameEntityIds";
import {
	repairDuplicatePlayerIdsInSeatOrder,
	repairOrphanedPlayerIdsInSeatOrder,
	repairOrphanedPlayerRoleIds,
	repairOrphanedRolesForShowingRoleIds,
	repairOrphanedRoleTeamIds,
	repairResolvableGameEntityReferenceIds,
} from "./gameReferenceRepair";
import type { GameState } from "./gameState";
import { normalizeLocalizedNameLanguageTag } from "./localizedNames";
import type { PlayerRoleState } from "./models";
import { EMPTY_PLAYER_ID } from "./reservedIds";
import { type RuleSetRepairMappings, repairRuleSet } from "./ruleSetRepair";
import { repairStatusDefinitionsAndReferences } from "./statusDefinitionRepair";
import {
	createIdFromText,
	createUniqueId,
	type IdArea,
	isIdForArea,
} from "./stringSanitizer";
import {
	repairInconsistentUnknownTeams,
	repairUnknownRoleAndPlayerIds,
} from "./unknownTeam";

export type RepairIdsResult = number | string;

/**
 * Führt alle ID- und ID-Referenzreparaturen in ihrer notwendigen Reihenfolge
 * am übergebenen Spielstand aus.
 *
 * @returns Gesamtzahl der Änderungen oder eine Fehlermeldung, falls die
 * Reparatur des System-Teams "t_unknown" nicht möglich ist.
 */
export function repairIds(game: GameState): RepairIdsResult {
	let changedCount = 0;
	try {
		const repairedRuleSet = repairRuleSet(game.ruleSetSnapshot);
		game.ruleSetSnapshot = repairedRuleSet.ruleSet;
		applyRuleSetRepairMappings(game, repairedRuleSet.mappings);
		game.statusDefinitionsById = Object.fromEntries(
			(repairedRuleSet.ruleSet.statuses ?? []).map((definition) => [
				definition.id,
				{
					...definition,
					names: definition.names ? { ...definition.names } : undefined,
				},
			]),
		);
		changedCount += repairedRuleSet.changeCount;
	} catch (error) {
		if (!isDomainOperationError(error)) throw error;
		return error.failure.diagnostic ?? error.failure.details ?? error.message;
	}
	changedCount += repairPlayerColors(game);
	changedCount += repairPlayerLocalizedNames(game);

	changedCount += repairInvalidGameEntityIds(game);
	changedCount += repairInvalidGameEntityIdPrefixes(game);
	changedCount += repairMismatchedGameEntityRecordIds(game);
	changedCount += repairReservedEmptyPlayerId(game);
	changedCount += repairResolvableGameEntityReferenceIds(game);
	changedCount += repairUnknownRoleAndPlayerIds(game);

	const unknownTeamResult = repairInconsistentUnknownTeams(game);
	if (typeof unknownTeamResult === "string") {
		return unknownTeamResult;
	}
	changedCount += unknownTeamResult;

	changedCount += repairDuplicateGameEntityIds(game);
	changedCount += repairStatusDefinitionsAndReferences(game);
	changedCount += repairOrphanedRoleTeamIds(game);
	changedCount += repairOrphanedPlayerIdsInSeatOrder(game);
	changedCount += repairDuplicatePlayerIdsInSeatOrder(game);
	changedCount += repairOrphanedPlayerRoleIds(game);
	changedCount += repairOrphanedRolesForShowingRoleIds(game);

	return changedCount;
}

function repairPlayerLocalizedNames(game: GameState): number {
	let changedCount = 0;
	for (const player of Object.values(game.playersById)) {
		if (!player.names) continue;
		const repairedNames = Object.fromEntries(
			Object.entries(player.names).map(([language, name]) => [
				normalizeLocalizedNameLanguageTag(language),
				name,
			]),
		);
		if (JSON.stringify(player.names) === JSON.stringify(repairedNames))
			continue;
		player.names = repairedNames;
		changedCount++;
	}
	return changedCount;
}

function repairPlayerColors(game: GameState): number {
	let changedCount = 0;
	for (const player of Object.values(game.playersById)) {
		const original: unknown = player.color;
		const repaired = repairHexColor(original);
		if (original === repaired) continue;
		player.color = repaired;
		changedCount++;
	}
	return changedCount;
}

function applyRuleSetRepairMappings(
	game: GameState,
	mappings: RuleSetRepairMappings,
): void {
	for (const player of Object.values(game.playersById)) {
		player.roles = {
			actualRoleId: mappedNullableId(player.roles.actualRoleId, mappings.roles),
			shownRoleIds: player.roles.shownRoleIds.map(
				(roleId) => mappings.roles.get(roleId) ?? roleId,
			),
			nightRoleId: mappedNullableId(player.roles.nightRoleId, mappings.roles),
			claimedRoleId:
				player.roles.claimedRoleId === undefined
					? undefined
					: (mappings.roles.get(player.roles.claimedRoleId) ??
						player.roles.claimedRoleId),
		};
		for (const status of player.statuses)
			status.statusId =
				mappings.statuses.get(status.statusId) ?? status.statusId;
	}
	if (game.rolesForShowing)
		game.rolesForShowing.roles = game.rolesForShowing.roles.map(
			(roleId) => mappings.roles.get(roleId) ?? roleId,
		);
}

function mappedNullableId(
	id: string | null,
	mappings: ReadonlyMap<string, string>,
): string | null {
	return id === null ? null : (mappings.get(id) ?? id);
}

/**
 * Repariert ein tatsächliches Player-Objekt, das unzulässig die ausschließlich
 * für freie Sitze reservierte ID "p_empty" verwendet. Vorhandene p_empty-Werte
 * in seatOrder bleiben als Platzhalter unverändert.
 */
export function repairReservedEmptyPlayerId(game: GameState): number {
	let changedCount = 0;

	for (const [recordId, player] of Object.entries(game.playersById)) {
		if (recordId !== EMPTY_PLAYER_ID && player.id !== EMPTY_PLAYER_ID) continue;

		const newId = createUniqueGameEntityIdFromName(player.name, game, "player");
		delete game.playersById[recordId];
		(player as unknown as { id: string }).id = newId;
		game.playersById[newId] = player;
		replaceStatusSourcePlayerIds(game, new Set([recordId]), newId);
		changedCount++;
	}

	return changedCount;
}

/**
 * Repariert syntaktisch ungültige IDs und führt eindeutig zuordenbare
 * Referenzen mit. Der übergebene Spielstand wird mutiert.
 *
 * @returns Anzahl geänderter Entitäten und Sitzordnungseinträge.
 */
export function repairInvalidGameEntityIds(game: GameState): number {
	return repairGameEntityIds(game, "syntax");
}

/**
 * Ersetzt bei syntaktisch gültigen IDs ausschließlich ein falsches
 * Bereichspräfix und führt unmittelbar betroffene Referenzen mit.
 * Kollisions- und Fachprüfungen erfolgen in späteren Reparaturschritten.
 */
export function repairInvalidGameEntityIdPrefixes(game: GameState): number {
	return repairGameEntityIds(game, "prefix");
}

/**
 * Gleicht bei Spielern den Record-Schlüssel an die Objekt-ID an. Die Objekt-ID
 * ist dabei maßgeblich. Ist ihr Schlüssel bereits
 * anderweitig belegt, wird für das inkonsistente Objekt eine eindeutige ID
 * erzeugt, damit kein Record überschrieben wird.
 */
export function repairMismatchedGameEntityRecordIds(game: GameState): number {
	let changedCount = 0;

	for (const [recordId, player] of Object.entries(game.playersById)) {
		if (recordId === player.id) continue;

		const desiredId = player.id;
		const occupyingPlayer = game.playersById[desiredId];
		const newId =
			occupyingPlayer === undefined || occupyingPlayer === player
				? desiredId
				: createUniqueGameEntityIdFromId(desiredId, game, "player");

		delete game.playersById[recordId];
		(player as unknown as { id: string }).id = newId;
		game.playersById[newId] = player;
		game.seatOrder = game.seatOrder.map((playerId) =>
			playerId === recordId ? newId : playerId,
		);
		replaceStatusSourcePlayerIds(game, new Set([recordId]), newId);
		changedCount++;
	}

	return changedCount;
}

type IdRepairMode = "syntax" | "prefix";

function repairGameEntityIds(game: GameState, mode: IdRepairMode): number {
	let changedCount = 0;
	const gameArea: IdArea = game.isTemplate ? "template" : "game";
	if (shouldRepairId(game.id, gameArea, mode)) {
		game.id = createIdFromText(game.id, gameArea);
		changedCount++;
	}
	if (shouldRepairId(game.ruleSetSnapshot.id, "ruleSet", mode)) {
		game.ruleSetSnapshot.id = createIdFromText(
			game.ruleSetSnapshot.id,
			"ruleSet",
		);
		changedCount++;
	}

	const logPlan = planLogIdRepairs(game, mode);
	for (const { entry, newId } of logPlan) entry.id = newId;
	changedCount += logPlan.length;

	const entityPlan = planGameEntityIdRepairs(game, mode);
	applyGameEntityIdRepairPlan(game, entityPlan);
	changedCount +=
		entityPlan.teams.length +
		entityPlan.roles.length +
		entityPlan.players.length +
		entityPlan.statuses.length;

	game.seatOrder = game.seatOrder.map((playerId) => {
		if (!shouldRepairId(playerId, "player", mode)) return playerId;
		changedCount++;
		return createIdFromText(playerId, "player");
	});

	return changedCount;
}

type IdRepair<T> = { entity: T; oldId: string; newId: string };

type PlayerIdRepair = IdRepair<GameState["playersById"][string]> & {
	recordId: string;
};

type GameEntityIdRepairPlan = {
	teams: IdRepair<GameState["ruleSetSnapshot"]["teams"][number]>[];
	roles: IdRepair<GameState["ruleSetSnapshot"]["roles"][number]>[];
	players: PlayerIdRepair[];
	statuses: IdRepair<GameState["playersById"][string]["statuses"][number]>[];
};

function planLogIdRepairs(game: GameState, mode: IdRepairMode) {
	const unavailableIds = new Set(
		game.log
			.filter((entry) => !shouldRepairId(entry.id, "log", mode))
			.map((entry) => entry.id),
	);
	return game.log.flatMap((entry) => {
		if (!shouldRepairId(entry.id, "log", mode)) return [];
		const newId = createUniqueId(entry.id, "log", unavailableIds).id;
		unavailableIds.add(newId);
		return [{ entry, newId }];
	});
}

function planGameEntityIdRepairs(
	game: GameState,
	mode: IdRepairMode,
): GameEntityIdRepairPlan {
	const unavailableIds = collectStableGameEntityIds(game, mode);
	const allocate = (id: string, area: IdArea): string => {
		const newId = createUniqueId(id, area, unavailableIds).id;
		unavailableIds.add(newId);
		return newId;
	};

	const teams = game.ruleSetSnapshot.teams.flatMap((team) =>
		shouldRepairId(team.id, "team", mode)
			? [{ entity: team, oldId: team.id, newId: allocate(team.id, "team") }]
			: [],
	);
	const roles = game.ruleSetSnapshot.roles.flatMap((role) =>
		shouldRepairId(role.id, "role", mode)
			? [{ entity: role, oldId: role.id, newId: allocate(role.id, "role") }]
			: [],
	);
	const players = Object.entries(game.playersById).flatMap(
		([recordId, player]) =>
			shouldRepairId(recordId, "player", mode) ||
			shouldRepairId(player.id, "player", mode)
				? [
						{
							entity: player,
							recordId,
							oldId: player.id,
							newId: allocate(player.id, "player"),
						},
					]
				: [],
	);
	const statuses = Object.values(game.playersById).flatMap((player) =>
		player.statuses.flatMap((status) =>
			shouldRepairId(status.id, "statusInstance", mode)
				? [
						{
							entity: status,
							oldId: status.id,
							newId: allocate(status.id, "statusInstance"),
						},
					]
				: [],
		),
	);

	return { teams, roles, players, statuses };
}

function collectStableGameEntityIds(
	game: GameState,
	mode: IdRepairMode,
): Set<string> {
	const ids = new Set<string>(["t_unknown", EMPTY_PLAYER_ID]);
	for (const team of game.ruleSetSnapshot.teams)
		if (!shouldRepairId(team.id, "team", mode)) ids.add(team.id);
	for (const role of game.ruleSetSnapshot.roles)
		if (!shouldRepairId(role.id, "role", mode)) ids.add(role.id);
	for (const [recordId, player] of Object.entries(game.playersById)) {
		const isRepaired =
			shouldRepairId(recordId, "player", mode) ||
			shouldRepairId(player.id, "player", mode);
		if (!isRepaired) {
			ids.add(recordId);
			ids.add(player.id);
		}
	}
	for (const definition of game.ruleSetSnapshot.statuses ?? [])
		ids.add(definition.id);
	for (const definition of Object.values(game.statusDefinitionsById))
		ids.add(definition.id);
	for (const player of Object.values(game.playersById))
		for (const status of player.statuses)
			if (!shouldRepairId(status.id, "statusInstance", mode))
				ids.add(status.id);
	return ids;
}

function applyGameEntityIdRepairPlan(
	game: GameState,
	plan: GameEntityIdRepairPlan,
): void {
	const teamMappings = new Map(
		plan.teams.map(({ oldId, newId }) => [oldId, newId]),
	);
	for (const { entity, newId } of plan.teams)
		(entity as unknown as { id: string }).id = newId;
	for (const role of game.ruleSetSnapshot.roles)
		role.teamId = teamMappings.get(role.teamId) ?? role.teamId;

	const roleMappings = new Map(
		plan.roles.map(({ oldId, newId }) => [oldId, newId]),
	);
	for (const { entity, newId } of plan.roles) entity.id = newId;
	for (const player of Object.values(game.playersById))
		player.roles = replaceMappedRoleIds(player.roles, roleMappings);
	if (game.rolesForShowing)
		game.rolesForShowing.roles = game.rolesForShowing.roles.map(
			(roleId) => roleMappings.get(roleId) ?? roleId,
		);

	const originalPlayerRecordIds = new Set(Object.keys(game.playersById));
	const playerMappings = new Map<string, string>();
	for (const { recordId, oldId, newId } of plan.players) {
		playerMappings.set(recordId, newId);
		if (oldId === recordId || !originalPlayerRecordIds.has(oldId))
			playerMappings.set(oldId, newId);
		delete game.playersById[recordId];
	}
	for (const { entity, newId } of plan.players) {
		(entity as unknown as { id: string }).id = newId;
		game.playersById[newId] = entity;
	}
	game.seatOrder = game.seatOrder.map(
		(playerId) => playerMappings.get(playerId) ?? playerId,
	);
	for (const player of Object.values(game.playersById))
		for (const status of player.statuses)
			if (status.source)
				status.source.playerId =
					playerMappings.get(status.source.playerId) ?? status.source.playerId;

	for (const { entity, newId } of plan.statuses) entity.id = newId;
}

function shouldRepairId(
	value: string,
	area: IdArea,
	mode: IdRepairMode,
): boolean {
	const isSyntacticallyValid = /^[a-z][a-z0-9_]*$/.test(value);
	return mode === "syntax"
		? !isSyntacticallyValid
		: isSyntacticallyValid && !isIdForArea(value, area);
}

function replaceMappedRoleIds(
	roles: PlayerRoleState,
	mappings: ReadonlyMap<string, string>,
): PlayerRoleState {
	return {
		actualRoleId: mappedNullableId(roles.actualRoleId, mappings),
		shownRoleIds: roles.shownRoleIds.map(
			(roleId) => mappings.get(roleId) ?? roleId,
		),
		nightRoleId: mappedNullableId(roles.nightRoleId, mappings),
		claimedRoleId:
			roles.claimedRoleId === undefined
				? undefined
				: (mappings.get(roles.claimedRoleId) ?? roles.claimedRoleId),
	};
}

function replaceStatusSourcePlayerIds(
	game: GameState,
	oldIds: Set<string>,
	newId: string,
): void {
	for (const player of Object.values(game.playersById)) {
		for (const status of player.statuses) {
			if (status.source && oldIds.has(status.source.playerId)) {
				status.source.playerId = newId;
			}
		}
	}
}
