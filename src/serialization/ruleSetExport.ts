import type { RuleSet, RuleSetDraft } from "../domain/ruleSet";
import { encodeUtf8 } from "./jsonEncoding";
import type { RuleSetDocument } from "./ruleSetDocument";

export const RULE_SET_FILE_TYPE = "social-deduction-ruleset" as const;
export const RULE_SET_SCHEMA_VERSION = 1 as const;

declare const embeddedRuleSetJsonBrand: unique symbol;
export type EmbeddedRuleSetJson = string & {
	readonly [embeddedRuleSetJsonBrand]: true;
};

/** Erzeugt die gemeinsame metadatenfreie RuleSet-Struktur für Library und Game. */
export function createRuleSetDocumentEmbedded(
	ruleSet: RuleSet | RuleSetDraft,
): RuleSetDocument {
	return createRuleSetDocumentContent(ruleSet);
}

function createRuleSetDocumentContent(
	ruleSet: RuleSet | RuleSetDraft,
): RuleSetDocument {
	return {
		id: ruleSet.id,
		name: ruleSet.name,
		names: ruleSet.names ? { ...ruleSet.names } : undefined,
		version: ruleSet.version,
		teams: ruleSet.teams.map((team) => ({
			id: team.id,
			name: team.name,
			names: team.names ? { ...team.names } : undefined,
			color: team.color,
			teamOrder: team.teamOrder,
			isSystem: team.isSystem ? true : undefined,
		})),
		roles: ruleSet.roles.map((role) => {
			return {
				id: role.id,
				name: role.name,
				names: role.names ? { ...role.names } : undefined,
				color: role.color,
				teamId: role.teamId,
				night: role.night
					? {
							first: role.night.first ? { ...role.night.first } : undefined,
							other: role.night.other ? { ...role.night.other } : undefined,
						}
					: undefined,
				expectsVisual: role.expectsVisual,
				isUnique: role.isUnique,
				unicodeSymbol: role.unicodeSymbol,
				unicodeEscaped: role.unicodeEscaped,
				kills_someone: role.kills_someone,
				resurrect_someone: role.resurrect_someone,
				apply_status_effect: role.apply_status_effect
					? [...role.apply_status_effect]
					: undefined,
			};
		}),
		statuses: ruleSet.statuses?.map((status) => {
			return {
				id: status.id,
				name: status.name,
				names: status.names ? { ...status.names } : undefined,
				unicodeSymbol: status.unicodeSymbol,
				unicodeEscaped: status.unicodeEscaped,
				defaultDuration: status.defaultDuration,
			};
		}),
	};
}

/** Erzeugt eine eigenständige RuleSet-Datei mit Metadaten an erster Stelle. */
export function createRuleSetDocumentStandalone(
	ruleSet: RuleSet,
): RuleSetDocument {
	return {
		fileType: RULE_SET_FILE_TYPE,
		schemaVersion: RULE_SET_SCHEMA_VERSION,
		...createRuleSetDocumentContent(ruleSet),
	};
}

/** Erzeugt ein kanonisches JSON-Fragment für die Einbettung in eine Library. */
export function createRuleSetEmbeddedJsonText(
	ruleSet: RuleSet | RuleSetDraft,
): EmbeddedRuleSetJson {
	return JSON.stringify(
		createRuleSetDocumentEmbedded(ruleSet),
		null,
		2,
	) as EmbeddedRuleSetJson;
}

export function createRuleSetExportJsonText(ruleSet: RuleSet): string {
	return JSON.stringify(createRuleSetDocumentStandalone(ruleSet), null, 2);
}

/** Erzeugt die kanonischen UTF-8-Bytes ohne BOM und abschließenden Umbruch. */
export function encodeRuleSetExportDocument(ruleSet: RuleSet): Uint8Array {
	return encodeUtf8(createRuleSetExportJsonText(ruleSet));
}
