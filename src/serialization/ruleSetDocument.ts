import type { LocalizedNames } from "../domain/models";
import type {
	RuleSetDraft,
	RuleSetNightActionDraft,
	RuleSetNightDraft,
	RuleSetRoleDraft,
	RuleSetStatusDraft,
	RuleSetTeamDraft,
} from "../domain/ruleSet";
import { serializationFailure } from "./serializationFailure";

export type RuleSetDocument = RuleSetDraft & {
	fileType?: string;
	schemaVersion?: number;
};

const FILE_FIELDS = [
	"fileType",
	"schemaVersion",
	"id",
	"name",
	"names",
	"version",
	"teams",
	"roles",
	"statuses",
] as const;

export function decodeRuleSetDocument(value: unknown): RuleSetDocument {
	const document = requiredRecord(
		value,
		"Die JSON-Wurzel muss ein Objekt sein.",
	);
	assertKnownFields(document, FILE_FIELDS, "Datei");
	return {
		fileType: optionalString(document.fileType, "fileType"),
		schemaVersion: optionalNumber(document.schemaVersion, "schemaVersion"),
		id: optionalString(document.id, "id"),
		name: requiredString(document.name, "name"),
		names: optionalLocalizedNames(document.names, "names"),
		version: optionalNumber(document.version, "version"),
		teams: requiredArray(document.teams, "teams").map(decodeTeam),
		roles: requiredArray(document.roles, "roles").map(decodeRole),
		statuses: optionalArray(document.statuses, "statuses")?.map(decodeStatus),
	};
}

export function assertSupportedRuleSetDocument(
	document: RuleSetDocument,
): void {
	if (
		document.fileType !== undefined &&
		document.fileType !== "social-deduction-ruleset"
	)
		throw unsupportedVersion(
			'Import fehlgeschlagen: fileType muss "social-deduction-ruleset" sein.',
		);
	if (document.schemaVersion !== undefined && document.schemaVersion !== 1)
		throw unsupportedVersion(
			"Import fehlgeschlagen: schemaVersion muss 1 sein.",
		);
}

function decodeTeam(value: unknown, index: number): RuleSetTeamDraft {
	const label = `teams[${index}]`;
	const team = requiredRecord(
		value,
		`Team an Position ${index} ist kein Objekt.`,
	);
	assertKnownFields(
		team,
		["id", "name", "names", "color", "teamOrder", "isSystem"],
		label,
	);
	return {
		id: requiredString(team.id, `${label}.id`),
		name: requiredString(team.name, `${label}.name`),
		names: optionalLocalizedNames(team.names, `${label}.names`),
		color: optionalString(team.color, `${label}.color`),
		teamOrder: requiredNumber(team.teamOrder, `${label}.teamOrder`),
		isSystem: optionalBoolean(team.isSystem, `${label}.isSystem`),
	};
}

function decodeRole(value: unknown, index: number): RuleSetRoleDraft {
	const label = `roles[${index}]`;
	const role = requiredRecord(
		value,
		`Rolle an Position ${index} ist kein Objekt.`,
	);
	assertKnownFields(
		role,
		[
			"id",
			"name",
			"names",
			"color",
			"teamId",
			"night",
			"expectsVisual",
			"isUnique",
			"unicodeEscaped",
			"unicodeSymbol",
			"kills_someone",
			"resurrect_someone",
			"apply_status_effect",
		],
		label,
	);
	return {
		id: requiredString(role.id, `${label}.id`),
		name: requiredString(role.name, `${label}.name`),
		names: optionalLocalizedNames(role.names, `${label}.names`),
		color: optionalString(role.color, `${label}.color`),
		teamId: optionalString(role.teamId, `${label}.teamId`),
		night: optionalNight(role.night, `${label}.night`),
		expectsVisual: optionalBoolean(
			role.expectsVisual,
			`${label}.expectsVisual`,
		),
		isUnique: optionalBoolean(role.isUnique, `${label}.isUnique`),
		unicodeEscaped: optionalString(
			role.unicodeEscaped,
			`${label}.unicodeEscaped`,
		),
		unicodeSymbol: optionalString(role.unicodeSymbol, `${label}.unicodeSymbol`),
		kills_someone: optionalBoolean(
			role.kills_someone,
			`${label}.kills_someone`,
		),
		resurrect_someone: optionalBoolean(
			role.resurrect_someone,
			`${label}.resurrect_someone`,
		),
		apply_status_effect: optionalStringArray(
			role.apply_status_effect,
			`${label}.apply_status_effect`,
		),
	};
}

function decodeStatus(value: unknown, index: number): RuleSetStatusDraft {
	const label = `statuses[${index}]`;
	const status = requiredRecord(
		value,
		`Status an Position ${index} ist kein Objekt.`,
	);
	assertKnownFields(
		status,
		[
			"id",
			"name",
			"names",
			"unicodeEscaped",
			"unicodeSymbol",
			"defaultDuration",
		],
		label,
	);
	return {
		id: requiredString(status.id, `${label}.id`),
		name: requiredString(status.name, `${label}.name`),
		names: optionalLocalizedNames(status.names, `${label}.names`),
		unicodeEscaped: optionalString(
			status.unicodeEscaped,
			`${label}.unicodeEscaped`,
		),
		unicodeSymbol: optionalString(
			status.unicodeSymbol,
			`${label}.unicodeSymbol`,
		),
		defaultDuration: optionalNumber(
			status.defaultDuration,
			`${label}.defaultDuration`,
		),
	};
}

function optionalNight(
	value: unknown,
	label: string,
): RuleSetNightDraft | undefined {
	if (value === undefined) return undefined;
	const night = requiredRecord(value, `${label} muss ein Objekt sein.`);
	assertKnownFields(night, ["first", "other"], label);
	return {
		first: optionalNightAction(night.first, `${label}.first`),
		other: optionalNightAction(night.other, `${label}.other`),
	};
}

function optionalNightAction(
	value: unknown,
	label: string,
): RuleSetNightActionDraft | undefined {
	if (value === undefined) return undefined;
	const action = requiredRecord(value, `${label} muss ein Objekt sein.`);
	assertKnownFields(action, ["order", "note"], label);
	return {
		order: requiredNumber(action.order, `${label}.order`),
		note: optionalString(action.note, `${label}.note`),
	};
}

function optionalLocalizedNames(
	value: unknown,
	label: string,
): LocalizedNames | undefined {
	if (value === undefined) return undefined;
	const record = requiredRecord(value, `${label} muss ein Objekt sein.`);
	return Object.fromEntries(
		Object.entries(record).map(([languageCode, name]) => [
			languageCode,
			requiredString(name, `${label}.${languageCode}`),
		]),
	);
}

function optionalStringArray(
	value: unknown,
	label: string,
): string[] | undefined {
	return optionalArray(value, label)?.map((entry, index) =>
		requiredString(entry, `${label}[${index}]`),
	);
}

function requiredArray(value: unknown, label: string): unknown[] {
	if (!Array.isArray(value))
		throw invalidDocument(
			`Import fehlgeschlagen: ${label} muss ein Array sein.`,
		);
	return value;
}

function optionalArray(value: unknown, label: string): unknown[] | undefined {
	if (value === undefined) return undefined;
	return requiredArray(value, label);
}

function requiredString(value: unknown, label: string): string {
	if (typeof value !== "string")
		throw invalidDocument(
			`Import fehlgeschlagen: ${label} muss ein String sein.`,
		);
	return value;
}

function optionalString(value: unknown, label: string): string | undefined {
	if (value === undefined) return undefined;
	return requiredString(value, label);
}

function requiredNumber(value: unknown, label: string): number {
	if (typeof value !== "number")
		throw invalidDocument(
			`Import fehlgeschlagen: ${label} muss eine Zahl sein.`,
		);
	return value;
}

function optionalNumber(value: unknown, label: string): number | undefined {
	if (value === undefined) return undefined;
	return requiredNumber(value, label);
}

function optionalBoolean(value: unknown, label: string): boolean | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "boolean")
		throw invalidDocument(`Import fehlgeschlagen: ${label} muss boolean sein.`);
	return value;
}

function requiredRecord(
	value: unknown,
	message: string,
): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw invalidDocument(`Import fehlgeschlagen: ${message}`);
	return value as Record<string, unknown>;
}

function assertKnownFields(
	value: Record<string, unknown>,
	allowedFields: readonly string[],
	label: string,
): void {
	const allowed = new Set(allowedFields);
	const unknown = Object.keys(value).filter((field) => !allowed.has(field));
	if (unknown.length === 0) return;
	const descriptions = unknown.map((field) => {
		const suggestion = findClosestField(field, allowedFields);
		return suggestion
			? `"${field}" (war "${suggestion}" gemeint?)`
			: `"${field}"`;
	});
	throw invalidDocument(
		`Import fehlgeschlagen: ${label} enthält ${unknown.length === 1 ? "ein unbekanntes Feld" : "unbekannte Felder"}: ${descriptions.join(", ")}.`,
	);
}

function invalidDocument(diagnostic: string): Error {
	return serializationFailure(
		"decode",
		"invalidDocument",
		false,
		undefined,
		diagnostic,
	);
}

function unsupportedVersion(diagnostic: string): Error {
	return serializationFailure(
		"decode",
		"unsupportedVersion",
		false,
		undefined,
		diagnostic,
	);
}

function findClosestField(
	field: string,
	allowedFields: readonly string[],
): string | undefined {
	let best: { field: string; distance: number } | undefined;
	for (const candidate of allowedFields) {
		const distance = levenshteinDistance(
			field.toLowerCase(),
			candidate.toLowerCase(),
		);
		if (!best || distance < best.distance)
			best = { field: candidate, distance };
	}
	const limit = Math.max(1, Math.floor(field.length / 3));
	return best && best.distance <= limit ? best.field : undefined;
}

function levenshteinDistance(left: string, right: string): number {
	const previous = Array.from(
		{ length: right.length + 1 },
		(_, index) => index,
	);
	for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
		const current = [leftIndex];
		for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
			current[rightIndex] = Math.min(
				(current[rightIndex - 1] ?? 0) + 1,
				(previous[rightIndex] ?? 0) + 1,
				(previous[rightIndex - 1] ?? 0) +
					(left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
			);
		}
		previous.splice(0, previous.length, ...current);
	}
	return previous[right.length] ?? 0;
}
