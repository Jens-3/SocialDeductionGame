import type { GameState } from "../domain/gameFactory";
import { getDisplayName } from "../domain/localizedNames";

export type { GameState };

export type RoleDistributionMode = "teams" | "roles";

export type RoleDistributionItem = {
	id: string;
	name: string;
	unicodeSymbol?: string;
	group?: string;
	isUnique?: boolean;
};

const DEFAULT_ROLE_SYMBOL = "◆";

export type RoleDistributionModel = {
	teams: RoleDistributionItem[];
	roles: RoleDistributionItem[];
	playerCount: number;
	hasAssignedRoles: boolean;
	isRunning: boolean;
	currentTeamCounts: Record<string, number>;
	currentRoleCounts: Record<string, number>;
};

export function createRoleDistributionModel(
	game: GameState,
	language = "de",
): RoleDistributionModel {
	const teams = [...game.ruleSetSnapshot.teams].sort(
		(left, right) =>
			left.teamOrder - right.teamOrder ||
			getDisplayName(left, language).localeCompare(
				getDisplayName(right, language),
			),
	);
	const teamOrder = new Map(teams.map((team) => [team.id, team.teamOrder]));
	const teamsById = new Map(teams.map((team) => [team.id, team]));
	const roles = [...game.ruleSetSnapshot.roles].sort(
		(left, right) =>
			(teamOrder.get(left.teamId) ?? Number.MAX_SAFE_INTEGER) -
				(teamOrder.get(right.teamId) ?? Number.MAX_SAFE_INTEGER) ||
			getDisplayName(left, language).localeCompare(
				getDisplayName(right, language),
			) ||
			left.id.localeCompare(right.id),
	);
	const currentRoleCounts = createCurrentRoleCounts(game);
	return {
		teams: teams.map((team) => ({
			id: team.id,
			name: getDisplayName(team, language),
		})),
		roles: roles.map((role) => {
			const team = teamsById.get(role.teamId);
			return {
				id: role.id,
				name: getDisplayName(role, language),
				unicodeSymbol: role.unicodeSymbol?.trim() || DEFAULT_ROLE_SYMBOL,
				group: team ? getDisplayName(team, language) : undefined,
				isUnique: role.isUnique,
			};
		}),
		playerCount: game.seatOrder.filter(
			(playerId) => playerId !== "p_empty" && game.playersById[playerId],
		).length,
		hasAssignedRoles: Object.values(game.playersById).some(
			(player) =>
				game.seatOrder.includes(player.id) &&
				player.roles.actualRoleId !== null,
		),
		isRunning: game.time.currentNight > 0 || game.time.phase !== "setup",
		currentTeamCounts: createCurrentTeamCounts(game, currentRoleCounts),
		currentRoleCounts,
	};
}

function createCurrentRoleCounts(game: GameState): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const playerId of game.seatOrder) {
		if (playerId === "p_empty") continue;
		const roleId = game.playersById[playerId]?.roles.actualRoleId;
		if (roleId) counts[roleId] = (counts[roleId] ?? 0) + 1;
	}
	return counts;
}

function createCurrentTeamCounts(
	game: GameState,
	roleCounts: Record<string, number>,
): Record<string, number> {
	const roleTeams = new Map(
		game.ruleSetSnapshot.roles.map((role) => [role.id, role.teamId]),
	);
	const counts: Record<string, number> = {};
	for (const [roleId, count] of Object.entries(roleCounts)) {
		const teamId = roleTeams.get(roleId);
		if (teamId) counts[teamId] = (counts[teamId] ?? 0) + count;
	}
	return counts;
}
