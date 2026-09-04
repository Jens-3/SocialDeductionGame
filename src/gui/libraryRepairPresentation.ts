import type { LibraryRepairChange } from "../application/libraryUseCases";
import type { GuiTranslator } from "./i18n/translate";

export function libraryRepairChangeText(
	change: LibraryRepairChange,
	t: GuiTranslator,
): string {
	switch (change.kind) {
		case "missingStatusDefinitionAdded":
			return t("repairReport.change.missingStatusDefinitionAdded", change);
		case "unknownFieldsRemoved":
			return unknownFieldsRemovedText(change, t);
		case "ruleSetIdCollisionResolved":
			return t("repairReport.change.ruleSetIdCollisionResolved", change);
		case "ruleSetsContainerReplaced":
			return t("repairReport.change.ruleSetsContainerReplaced");
		case "libraryUnknownFieldsRemoved":
			return t("repairReport.change.libraryUnknownFieldsRemoved", {
				fields: change.fields.join(", "),
			});
		case "insertedMissingQuote":
			return t("repairReport.change.insertedMissingQuote", change);
		case "addedClosingBraces":
			return t("repairReport.change.addedClosingBraces", change);
		case "addedOpeningBraces":
			return t("repairReport.change.addedOpeningBraces", change);
	}
}

function unknownFieldsRemovedText(
	change: Extract<LibraryRepairChange, { kind: "unknownFieldsRemoved" }>,
	t: GuiTranslator,
): string {
	const parameters = {
		ruleSetLabel: change.ruleSetLabel,
		index: change.index ?? 0,
		fields: change.fields.join(", "),
	};
	switch (change.subject) {
		case "ruleSet":
			return t("repairReport.change.ruleSetUnknownFieldsRemoved", parameters);
		case "team":
			return t("repairReport.change.teamUnknownFieldsRemoved", parameters);
		case "role":
			return t("repairReport.change.roleUnknownFieldsRemoved", parameters);
		case "status":
			return t("repairReport.change.statusUnknownFieldsRemoved", parameters);
	}
}
