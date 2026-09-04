import { sanitizeText } from "../shared/textSanitizer";
import type { GameState, RolesForShowing } from "./gameFactory";

export type RolesForShowingDraft = {
	roles: string[];
	notice: string;
	showRoleSymbols: boolean;
};

export function saveRolesForShowing(
	game: GameState,
	draft: RolesForShowingDraft,
): GameState {
	const notice = sanitizeText(draft.notice).trim();
	const availableRoleIds = new Set(
		game.ruleSetSnapshot.roles.map((role) => role.id),
	);
	const rolesForShowing: RolesForShowing = {
		roles: draft.roles
			.map((roleId) => sanitizeText(roleId).trim())
			.filter((roleId) => roleId !== "" && availableRoleIds.has(roleId)),
		...(notice ? { notice } : {}),
		showRoleSymbols: draft.showRoleSymbols,
	};
	return {
		...game,
		rolesForShowing,
	};
}
