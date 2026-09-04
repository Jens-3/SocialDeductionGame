import type { GuiTranslationKey } from "../src/gui/i18n/de";
import type { GuiPluralCategory } from "../src/gui/i18n/messages";

export type GuiPlaceholderCounts = Readonly<Record<string, number>>;

type GuiPlaceholderExpectation = Readonly<{
	plain?: GuiPlaceholderCounts;
	plural?: Readonly<Partial<Record<GuiPluralCategory, GuiPlaceholderCounts>>>;
}>;

// Entries not listed here intentionally expect no placeholders. Plural categories
// without their own entry inherit the expectation for `other`.
export const expectedGuiPlaceholders: Partial<
	Record<GuiTranslationKey, GuiPlaceholderExpectation>
> = {
	"common.moreActionsFor": { plain: { name: 1 } },
	"common.restored": { plain: { index: 1 } },
	"home.activeWrites": {
		plural: { one: { count: 1 }, other: { count: 1 } },
	},
	"newGame.useRuleSet": { plain: { count: 1 } },
	"newGame.useTemplate": { plain: { count: 1 } },
	"loadGame.players": {
		plural: { one: { count: 1 }, other: { count: 1 } },
	},
	"loadGame.deleteQuestion": { plain: { name: 1 } },
	"loadGame.night": { plain: { number: 1 } },
	"loadGame.day": { plain: { number: 1 } },
	"scenarios.ruleSetMetadata": {
		plain: { version: 1, teams: 1, roles: 1 },
	},
	"scenarios.templateMetadata": {
		plural: {
			one: { count: 1, ruleSet: 1 },
			other: { count: 1, ruleSet: 1 },
		},
	},
	"scenarios.savedAt": { plain: { date: 1 } },
	"scenarios.exported": { plain: { name: 1 } },
	"scenarios.shared": { plain: { name: 1 } },
	"scenarios.deleted": { plain: { name: 1 } },
	"scenarios.renamed": { plain: { name: 1 } },
	"scenarios.duplicatedMessage": { plain: { name: 1 } },
	"scenarios.deleteQuestion": { plain: { name: 1 } },
	"settings.restoreDiscarded": {
		plural: { one: { count: 1 }, other: { count: 1 } },
	},
	"settings.replaceDescription": { plain: { fileName: 1 } },
	"settings.invalidRuleSetsDiscarded": { plain: { ids: 1 } },
	"error.technicalInline": { plain: { details: 1 } },
	"success.imported.game": { plain: { name: 1 } },
	"success.imported.template": { plain: { name: 1 } },
	"success.imported.ruleSet": { plain: { name: 1 } },
	"success.recovered.game": { plain: { name: 1 } },
	"success.recovered.template": { plain: { name: 1 } },
	"success.recovered.ruleSet": { plain: { name: 1 } },
	"success.repaired.game": { plain: { name: 1 } },
	"success.repaired.template": { plain: { name: 1 } },
	"success.repaired.ruleSet": { plain: { name: 1 } },
	"repairReport.acceptedRuleSets": {
		plural: { one: { count: 1 }, other: { count: 1 } },
	},
	"repairReport.change.missingStatusDefinitionAdded": {
		plain: { ruleSetLabel: 1, status: 1 },
	},
	"repairReport.change.ruleSetUnknownFieldsRemoved": {
		plain: { ruleSetLabel: 1, fields: 1 },
	},
	"repairReport.change.teamUnknownFieldsRemoved": {
		plain: { index: 1, ruleSetLabel: 1, fields: 1 },
	},
	"repairReport.change.roleUnknownFieldsRemoved": {
		plain: { index: 1, ruleSetLabel: 1, fields: 1 },
	},
	"repairReport.change.statusUnknownFieldsRemoved": {
		plain: { index: 1, ruleSetLabel: 1, fields: 1 },
	},
	"repairReport.change.ruleSetIdCollisionResolved": {
		plain: { storedId: 1, newId: 1 },
	},
	"repairReport.change.libraryUnknownFieldsRemoved": {
		plain: { fields: 1 },
	},
	"repairReport.change.insertedMissingQuote": { plain: { position: 1 } },
	"repairReport.change.addedClosingBraces": {
		plural: { one: {}, other: { count: 1 } },
	},
	"repairReport.change.addedOpeningBraces": {
		plural: { one: {}, other: { count: 1 } },
	},
	"game.zoomLevel": { plain: { percent: 1 } },
	"game.seatAccessible": { plain: { seat: 1, marker: 1 } },
	"game.deleteSeat": { plain: { seat: 1 } },
	"game.addPlayerAfterSeat": { plain: { seat: 1 } },
	"game.seat": { plain: { seat: 1 } },
	"game.actionsForSeat": { plain: { seat: 1 } },
	"game.deleteSelectedSeat": { plain: { seat: 1 } },
	"game.addPlayerAfterSelectedSeat": { plain: { seat: 1 } },
	"game.statusDuration": { plain: { from: 1, until: 1 } },
	"game.playerWithName": { plain: { name: 1 } },
	"game.nightNumber": { plain: { number: 1 } },
	"game.dayNumber": { plain: { number: 1 } },
	"game.log.timeAdvanced": { plain: { oldTime: 1, newTime: 1 } },
	"game.log.timeRewound": { plain: { oldTime: 1, newTime: 1 } },
	"game.log.lifeStateChanged": {
		plain: { player: 1, oldState: 1, newState: 1 },
	},
	"game.log.statusApplied": { plain: { status: 1, player: 1 } },
	"game.log.rolesDistributed": {
		plural: { one: { count: 1 }, other: { count: 1 } },
	},
	"game.log.selectedRolesDistributed": {
		plural: { one: { count: 1 }, other: { count: 1 } },
	},
	"game.log.seatMoved": {
		plain: { playerName: 1, fromSeat: 1, toSeat: 1 },
	},
	"game.log.seatsSwapped": { plain: { seatA: 1, seatB: 1 } },
	"game.log.playerAppended": { plain: { playerName: 1, toSeat: 1 } },
	"game.log.playerInserted": { plain: { playerName: 1, toSeat: 1 } },
	"game.log.playerRemoved": { plain: { playerName: 1, fromSeat: 1 } },
	"game.roleReveal.prompt": { plain: { player: 1, seat: 1 } },
	"game.overview.playerAccessible": {
		plain: { name: 1, seat: 1, marker: 1 },
	},
	"game.overview.shownRole": { plain: { role: 1 } },
	"game.overview.nightRole": { plain: { role: 1 } },
	"game.night.actionFor": { plain: { player: 1 } },
	"game.action.unknown": { plain: { action: 1 } },
	"game.warning.playerNotFound": { plain: { playerId: 1 } },
	"game.warning.statusNotFound": { plain: { statusId: 1 } },
	"game.warning.actorNotFound": { plain: { playerId: 1 } },
	"game.warning.targetNotFound": { plain: { playerId: 1 } },
	"game.warning.actualRoleNotFound": { plain: { playerId: 1 } },
	"game.warning.abilityAmbiguous": { plain: { roleName: 1 } },
	"game.warning.abilityNotAllowed": {
		plain: { roleName: 1, action: 1 },
	},
	"game.warning.statusNotAllowed": {
		plain: { roleName: 1, statusId: 1 },
	},
	"recovery.openCount": { plain: { count: 1 } },
	"recovery.orphanedFile": { plain: { recoveryFile: 1, kind: 1 } },
	"recovery.twoFiles": { plain: { kind: 1, id: 1 } },
	"recovery.affectedObject": { plain: { kind: 1, reference: 1 } },
	"rolesForShowing.removeRole": { plain: { name: 1 } },
	"roleDistribution.decrease": { plain: { name: 1 } },
	"roleDistribution.count": { plain: { name: 1 } },
	"roleDistribution.increase": { plain: { name: 1 } },
	"roleDistribution.error.teamHasNoRoles": {
		plural: { other: { teamName: 1, count: 1 } },
	},
	"roleDistribution.error.insufficientDistinctRoles": {
		plural: {
			other: { teamName: 1, requestedCount: 1, count: 1 },
		},
	},
	"scenarioEditor.displayName": { plain: { language: 1 } },
	"scenarioEditor.deleteQuestion": { plain: { name: 1 } },
};
