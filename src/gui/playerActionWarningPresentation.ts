import type {
	PlayerAbilityAction,
	PlayerActionResult,
} from "../application/gameUseCases";
import type { GuiTranslationKey } from "./i18n/de";
import type { GuiTranslator } from "./i18n/translate";

const playerAbilityActionKeys = {
	kill: "game.action.kill",
	resurrect: "game.action.resurrect",
	apply_status: "game.action.applyStatus",
} as const satisfies Record<PlayerAbilityAction, GuiTranslationKey>;

export function playerActionWarningText(
	warning: NonNullable<PlayerActionResult["warning"]>,
	t: GuiTranslator,
): string {
	const parameters = warning.parameters ?? {};
	switch (warning.code) {
		case "PLAYER_NOT_FOUND":
			return t("game.warning.playerNotFound", parameters);
		case "STATUS_DEFINITION_NOT_FOUND":
			return t("game.warning.statusNotFound", parameters);
		case "ACTOR_NOT_FOUND":
			return t("game.warning.actorNotFound", parameters);
		case "TARGET_NOT_FOUND":
			return t("game.warning.targetNotFound", parameters);
		case "ACTUAL_ROLE_NOT_FOUND":
			return t("game.warning.actualRoleNotFound", parameters);
		case "ABILITY_NOT_UNAMBIGUOUS":
			return t("game.warning.abilityAmbiguous", parameters);
		case "STATUS_NOT_UNAMBIGUOUS":
			return t("game.warning.statusAmbiguous");
		case "VOTE_ALREADY_SPENT":
			return t("game.warning.voteAlreadySpent");
		case "ABILITY_NOT_ALLOWED":
			return t("game.warning.abilityNotAllowed", {
				...parameters,
				action: playerAbilityActionText(parameters.action, t),
			});
		case "STATUS_NOT_ALLOWED":
			return t("game.warning.statusNotAllowed", parameters);
		default:
			return (
				(warning as typeof warning & { message?: string }).message ??
				t("game.night.noEffect")
			);
	}
}

function playerAbilityActionText(
	action: string | undefined,
	t: GuiTranslator,
): string {
	if (action && Object.hasOwn(playerAbilityActionKeys, action)) {
		return t(playerAbilityActionKeys[action as PlayerAbilityAction]);
	}
	return t("game.action.unknown", {
		action: action ?? t("common.unknown"),
	});
}
