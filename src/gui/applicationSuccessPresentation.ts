import type { ApplicationObjectSuccess } from "../application/objectSuccess";
import type { GuiTranslator } from "./i18n/translate";

export function applicationObjectSuccessText(
	success: ApplicationObjectSuccess,
	t: GuiTranslator,
): string {
	if (success.kind === "library") return t(`success.${success.status}.library`);
	return t(`success.${success.status}.${success.kind}`, {
		name: success.name ?? success.id,
	});
}
