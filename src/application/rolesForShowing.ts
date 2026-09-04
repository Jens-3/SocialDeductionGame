import type { GameState } from "../domain/gameFactory";
import type { RolesForShowingDraft } from "../domain/gameRolesForShowing";
import { getDisplayName } from "../domain/localizedNames";
import { sanitizeText } from "../shared/textSanitizer";

export type { RolesForShowingDraft } from "../domain/gameRolesForShowing";

export type RolesForShowingRolePresentation = {
	id: string;
	displayName: string;
	unicodeSymbol: string;
	teamName?: string;
};

export type RolesForShowingEditorModel = RolesForShowingDraft & {
	selectedRoles: RolesForShowingRolePresentation[];
	roleOptions: RolesForShowingRolePresentation[];
};

export type RolesForShowingPresentation = {
	notice: string;
	roleNames: string[];
};

export function createRolesForShowingEditorModel(
	game: GameState,
	language = "de",
): RolesForShowingEditorModel {
	const roleOptions = createSortedRoleOptions(game, language);
	const roleById = new Map(roleOptions.map((role) => [role.id, role]));
	const roles = [...(game.rolesForShowing?.roles ?? [])];
	return {
		roles,
		notice: game.rolesForShowing?.notice ?? "",
		showRoleSymbols: game.rolesForShowing?.showRoleSymbols ?? false,
		selectedRoles: roles.map(
			(roleId) =>
				roleById.get(roleId) ?? {
					id: roleId,
					displayName: roleId,
					unicodeSymbol: DEFAULT_ROLE_SYMBOL,
				},
		),
		roleOptions,
	};
}

export function createRolesForShowingPresentation(
	game: GameState,
	draft: RolesForShowingDraft,
	language = "de",
): RolesForShowingPresentation {
	const rolesById = new Map(
		game.ruleSetSnapshot.roles.map((role) => [
			role.id,
			{
				displayName: getDisplayName(role, language),
				unicodeSymbol: role.unicodeSymbol ?? DEFAULT_ROLE_SYMBOL,
			},
		]),
	);
	const notice = sanitizeText(draft.notice).trim();
	const roleNames = draft.roles.map((roleId) => {
		const role = rolesById.get(roleId) ?? {
			displayName: roleId,
			unicodeSymbol: DEFAULT_ROLE_SYMBOL,
		};
		return draft.showRoleSymbols
			? `${role.unicodeSymbol} ${role.displayName}`
			: role.displayName;
	});
	return {
		notice,
		roleNames,
	};
}

function createSortedRoleOptions(
	game: GameState,
	language: string,
): RolesForShowingRolePresentation[] {
	const sortedTeams = [...game.ruleSetSnapshot.teams].sort(
		(left, right) =>
			left.teamOrder - right.teamOrder ||
			getDisplayName(left, language).localeCompare(
				getDisplayName(right, language),
			),
	);
	const teamIndex = new Map(sortedTeams.map((team, index) => [team.id, index]));
	const teamsById = new Map(sortedTeams.map((team) => [team.id, team]));
	return [...game.ruleSetSnapshot.roles]
		.sort(
			(left, right) =>
				(teamIndex.get(left.teamId) ?? Number.MAX_SAFE_INTEGER) -
					(teamIndex.get(right.teamId) ?? Number.MAX_SAFE_INTEGER) ||
				getDisplayName(left, language).localeCompare(
					getDisplayName(right, language),
				) ||
				left.id.localeCompare(right.id),
		)
		.map((role) => {
			const team = teamsById.get(role.teamId);
			return {
				id: role.id,
				displayName: getDisplayName(role, language),
				unicodeSymbol: role.unicodeSymbol ?? DEFAULT_ROLE_SYMBOL,
				teamName: team ? getDisplayName(team, language) : undefined,
			};
		});
}

const DEFAULT_ROLE_SYMBOL = "◆";
