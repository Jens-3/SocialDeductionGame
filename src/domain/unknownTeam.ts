import { createUniqueGameEntityIdFromName } from "./gameEntityIds";
import type { GameState } from "./gameState";
import {
	Player,
	type PlayerRoleState,
	type PlayerStatus,
	Role,
	Team,
} from "./models";

export type EnsureUnknownTeamResult = boolean | string;

/**
 * Stellt sicher, dass die reservierte ID "t_unknown" ausschließlich einem Team
 * gehört. Fehlt dieses Team, wird der übergebene Spielstand gezielt mutiert.
 *
 * Rückgabe:
 * - true: Das System-Team wurde angelegt.
 * - false: Ein Team mit ID "t_unknown" war bereits vorhanden.
 * - string: Eine Rolle oder ein Spieler belegt die reservierte ID; keine Änderung.
 */
export function ensureUnknownTeam(game: GameState): EnsureUnknownTeamResult {
	const conflictingRole = game.ruleSetSnapshot.roles.find(
		(role) => role.id === "t_unknown",
	);
	if (conflictingRole) {
		return `Die reservierte ID "t_unknown" wird bereits von der Rolle "${conflictingRole.name}" verwendet.`;
	}

	const conflictingPlayer = game.playersById.t_unknown;
	if (conflictingPlayer) {
		return `Die reservierte ID "t_unknown" wird bereits vom Spieler "${conflictingPlayer.name}" verwendet.`;
	}

	if (game.ruleSetSnapshot.teams.some((team) => team.id === "t_unknown")) {
		return false;
	}

	game.ruleSetSnapshot.teams.push(Team.createUnknown());
	return true;
}

/**
 * Repariert Rollen und Spieler, die unzulässig die reservierte ID "t_unknown"
 * verwenden. Der übergebene Spielstand und betroffene Referenzen werden mutiert.
 *
 * @returns Anzahl der reparierten Rollen und Spieler.
 */
export function repairUnknownRoleAndPlayerIds(game: GameState): number {
	let changedCount = 0;

	for (let index = 0; index < game.ruleSetSnapshot.roles.length; index++) {
		const role = game.ruleSetSnapshot.roles[index];
		if (role?.id !== "t_unknown") {
			continue;
		}

		const newId = createUniqueGameEntityIdFromName("unknown", game, "role");
		game.ruleSetSnapshot.roles[index] = new Role({
			id: newId,
			name: role.name,
			names: role.names,
			color: role.color,
			teamId: role.teamId,
			night: role.night,
			expectsVisual: role.expectsVisual,
			isUnique: role.isUnique,
			unicodeEscaped: role.unicodeEscaped,
			unicodeSymbol: role.unicodeSymbol,
			kills_someone: role.kills_someone,
			resurrect_someone: role.resurrect_someone,
			apply_status_effect: role.apply_status_effect,
		});
		game.playersById = replaceRoleReferences(
			game.playersById,
			"t_unknown",
			newId,
		);
		changedCount++;
	}

	const conflictingPlayers = Object.entries(game.playersById).filter(
		([playerId, player]) =>
			playerId === "t_unknown" || player.id === "t_unknown",
	);

	for (const [oldPlayerId] of conflictingPlayers) {
		const player = game.playersById[oldPlayerId];
		if (!player) {
			continue;
		}

		const oldEntityId = player.id;
		const newId = createUniqueGameEntityIdFromName("unknown", game, "player");
		delete game.playersById[oldPlayerId];
		game.playersById[newId] = clonePlayerWithId(player, newId);
		game.seatOrder = game.seatOrder.map((playerId) =>
			playerId === oldPlayerId || playerId === oldEntityId ? newId : playerId,
		);
		game.playersById = replacePlayerReferences(
			game.playersById,
			new Set([oldPlayerId, oldEntityId]),
			newId,
		);
		changedCount++;
	}

	return changedCount;
}

/**
 * Repariert doppelte oder falsch markierte Teams mit der reservierten ID
 * "t_unknown". Der übergebene Spielstand wird gezielt mutiert.
 *
 * @returns Anzahl geänderter Teams oder eine Fehlermeldung von
 * ensureUnknownTeam(), falls "t_unknown" durch eine Rolle oder einen Spieler
 * blockiert wird und noch kein entsprechendes Team existiert.
 */
export function repairInconsistentUnknownTeams(
	game: GameState,
): number | string {
	const unknownTeams = game.ruleSetSnapshot.teams.filter(
		(team) => team.id === "t_unknown",
	);

	if (unknownTeams.length === 0) {
		const result = ensureUnknownTeam(game);
		return typeof result === "string" ? result : result ? 1 : 0;
	}

	const changedTeams = new Set<Team>();

	if (unknownTeams.length === 1) {
		const onlyTeam = unknownTeams[0];
		if (onlyTeam && onlyTeam.isSystem !== true) {
			setSystemFlag(onlyTeam, true);
			changedTeams.add(onlyTeam);
		}
		return changedTeams.size;
	}

	const systemTeams = unknownTeams.filter((team) => team.isSystem === true);
	const keeper =
		systemTeams.length === 1
			? systemTeams[0]
			: selectHighestOrderedTeam(unknownTeams);

	if (!keeper) {
		return 0;
	}

	if (systemTeams.length !== 1 && keeper.isSystem !== true) {
		setSystemFlag(keeper, true);
		changedTeams.add(keeper);
	}

	if (systemTeams.length > 1) {
		for (const team of unknownTeams) {
			if (team !== keeper && team.isSystem === true) {
				setSystemFlag(team, false);
				changedTeams.add(team);
			}
		}
	}

	for (const team of unknownTeams) {
		if (team === keeper || team.id !== "t_unknown" || team.isSystem === true) {
			continue;
		}

		setTeamId(team, createUniqueGameEntityIdFromName("unknown", game, "team"));
		changedTeams.add(team);
	}

	return changedTeams.size;
}

function selectHighestOrderedTeam(teams: Team[]): Team | undefined {
	let selected = teams[0];
	let selectedOrder = getKnownTeamOrder(selected);

	for (let index = 1; index < teams.length; index++) {
		const candidate = teams[index];
		if (!candidate) {
			continue;
		}

		const candidateOrder = getKnownTeamOrder(candidate);
		if (
			candidateOrder !== undefined &&
			(selectedOrder === undefined || candidateOrder > selectedOrder)
		) {
			selected = candidate;
			selectedOrder = candidateOrder;
		}
	}

	return selected;
}

function getKnownTeamOrder(team: Team | undefined): number | undefined {
	return team && Number.isFinite(team.teamOrder) ? team.teamOrder : undefined;
}

function setSystemFlag(team: Team, isSystem: boolean): void {
	(team as unknown as { isSystem: boolean }).isSystem = isSystem;
}

function setTeamId(team: Team, id: string): void {
	(team as unknown as { id: string }).id = id;
}

function replaceRoleReferences(
	playersById: Record<string, Player>,
	oldRoleId: string,
	newRoleId: string,
): Record<string, Player> {
	return Object.fromEntries(
		Object.entries(playersById).map(([playerId, player]) => [
			playerId,
			new Player({
				id: player.id,
				name: player.name,
				names: player.names,
				color: player.color,
				lifeState: player.lifeState,
				roles: replaceRoleStateReferences(player.roles, oldRoleId, newRoleId),
				statuses: cloneStatuses(player.statuses),
				note: player.note,
				removed: player.removed ? { ...player.removed } : undefined,
			}),
		]),
	);
}

function replaceRoleStateReferences(
	roles: PlayerRoleState,
	oldRoleId: string,
	newRoleId: string,
): PlayerRoleState {
	return {
		actualRoleId:
			roles.actualRoleId === oldRoleId ? newRoleId : roles.actualRoleId,
		shownRoleIds: roles.shownRoleIds.map((roleId) =>
			roleId === oldRoleId ? newRoleId : roleId,
		),
		nightRoleId:
			roles.nightRoleId === oldRoleId ? newRoleId : roles.nightRoleId,
		claimedRoleId:
			roles.claimedRoleId === oldRoleId ? newRoleId : roles.claimedRoleId,
	};
}

function clonePlayerWithId(player: Player, id: string): Player {
	return new Player({
		id,
		name: player.name,
		names: player.names,
		color: player.color,
		lifeState: player.lifeState,
		roles: { ...player.roles },
		statuses: cloneStatuses(player.statuses),
		note: player.note,
		removed: player.removed ? { ...player.removed } : undefined,
	});
}

function replacePlayerReferences(
	playersById: Record<string, Player>,
	oldPlayerIds: Set<string>,
	newPlayerId: string,
): Record<string, Player> {
	return Object.fromEntries(
		Object.entries(playersById).map(([playerId, player]) => [
			playerId,
			new Player({
				id: player.id,
				name: player.name,
				names: player.names,
				color: player.color,
				lifeState: player.lifeState,
				roles: { ...player.roles },
				statuses: player.statuses.map((status) => ({
					...status,
					source:
						status.source && oldPlayerIds.has(status.source.playerId)
							? { ...status.source, playerId: newPlayerId }
							: status.source
								? { ...status.source }
								: undefined,
				})),
				note: player.note,
				removed: player.removed ? { ...player.removed } : undefined,
			}),
		]),
	);
}

function cloneStatuses(statuses: PlayerStatus[]): PlayerStatus[] {
	return statuses.map((status) => ({
		...status,
		source: status.source ? { ...status.source } : undefined,
	}));
}
