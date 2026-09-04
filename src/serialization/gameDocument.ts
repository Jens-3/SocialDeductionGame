import type {
	GameDraft,
	GameLogEntryDraft,
	GamePlayerDraft,
	GamePlayerStatusDraft,
	GamePlayerStatusSourceDraft,
	GameRemovedInfoDraft,
	GameRolesForShowingDraft,
	GameTimeDraft,
} from "../domain/gameDraft";
import type { LocalizedNames } from "../domain/models";
import {
	assertSupportedRuleSetDocument,
	decodeRuleSetDocument,
	type RuleSetDocument,
} from "./ruleSetDocument";
import {
	isSerializationOperationError,
	SerializationOperationError,
	serializationFailure,
} from "./serializationFailure";

/**
 * Strukturell typisiertes JSON-Dokument vor der fachlichen Game-Validierung.
 * Die konkreten Metadatenwerte werden getrennt vom Feldtyp geprüft.
 */
export type GameDocument = Omit<GameDraft, "ruleSetSnapshot"> & {
	fileType?: string;
	schemaVersion?: number;
	ruleSetSnapshot: RuleSetDocument;
};

export class GameRuleSetDocumentError extends SerializationOperationError {
	constructor(cause: unknown) {
		const failure = isSerializationOperationError(cause)
			? cause.failure
			: {
					source: "serialization" as const,
					operation: "decode" as const,
					reason: "invalidDocument" as const,
					repairable: false,
					...(cause instanceof Error && cause.message
						? { diagnostic: cause.message }
						: {}),
				};
		super({ ...failure, componentKind: "ruleSet" });
		this.name = "GameRuleSetDocumentError";
	}
}

const DOCUMENT_FIELDS = [
	"fileType",
	"schemaVersion",
	"id",
	"name",
	"names",
	"isTemplate",
	"createdAt",
	"ruleSetSnapshot",
	"players",
	"seatOrder",
	"time",
	"log",
	"rolesForShowing",
] as const;

/** Dekodiert sämtliche Game-JSON-Felder rekursiv zu einem klassenfreien Draft. */
export function decodeGameDocument(value: unknown): GameDocument {
	const document = requiredRecord(
		value,
		"Die JSON-Wurzel des Spielstands muss ein Objekt sein.",
	);
	assertKnownFields(document, DOCUMENT_FIELDS, "Dokument");
	return {
		fileType: optionalString(document.fileType, "fileType"),
		schemaVersion: optionalNumber(document.schemaVersion, "schemaVersion"),
		id: requiredString(document.id, "id"),
		name: requiredString(document.name, "name"),
		names: optionalLocalizedNames(document.names, "names"),
		isTemplate: optionalBoolean(document.isTemplate, "isTemplate") ?? false,
		createdAt: optionalString(document.createdAt, "createdAt"),
		ruleSetSnapshot: decodeRuleSetSnapshot(document.ruleSetSnapshot),
		players: decodePlayers(document.players),
		seatOrder: requiredStringArray(document.seatOrder, "seatOrder"),
		time: decodeTime(document.time),
		log: requiredArray(document.log, "log").map(decodeLogEntry),
		rolesForShowing: decodeRolesForShowing(document.rolesForShowing),
	};
}

function decodeRuleSetSnapshot(value: unknown): RuleSetDocument {
	try {
		const decoded = decodeRuleSetDocument(value);
		assertSupportedRuleSetDocument(decoded);
		return decoded;
	} catch (error) {
		throw new GameRuleSetDocumentError(error);
	}
}

function decodePlayers(value: unknown): GamePlayerDraft[] {
	return requiredArray(value, "players").map((entry, index) =>
		decodePlayer(entry, `players[${index}]`),
	);
}

function decodePlayer(value: unknown, label: string): GamePlayerDraft {
	const player = requiredRecord(value, `${label} muss ein Objekt sein.`);
	assertKnownFields(
		player,
		[
			"id",
			"name",
			"names",
			"color",
			"lifeState",
			"roles",
			"statuses",
			"note",
			"removed",
		],
		label,
	);
	const roles = requiredRecord(
		player.roles,
		`${label}.roles muss ein Objekt sein.`,
	);
	assertKnownFields(
		roles,
		[
			"actualRoleId",
			"shownRoleId",
			"shownRoleIds",
			"nightRoleId",
			"claimedRoleId",
		],
		`${label}.roles`,
	);
	return {
		id: requiredString(player.id, `${label}.id`),
		name: requiredString(player.name, `${label}.name`),
		names: optionalLocalizedNames(player.names, `${label}.names`),
		color: optionalString(player.color, `${label}.color`),
		lifeState: requiredString(player.lifeState, `${label}.lifeState`),
		roles: {
			actualRoleId: requiredNullableString(
				roles.actualRoleId,
				`${label}.roles.actualRoleId`,
			),
			shownRoleIds: decodeShownRoleIds(roles, `${label}.roles`),
			nightRoleId: requiredNullableString(
				roles.nightRoleId,
				`${label}.roles.nightRoleId`,
			),
			claimedRoleId: optionalString(
				roles.claimedRoleId,
				`${label}.roles.claimedRoleId`,
			),
		},
		statuses: requiredArray(player.statuses, `${label}.statuses`).map(
			(status, index) =>
				decodePlayerStatus(status, `${label}.statuses[${index}]`),
		),
		note: optionalString(player.note, `${label}.note`),
		removed: decodeRemovedInfo(player.removed, `${label}.removed`),
	};
}

function decodeShownRoleIds(
	roles: Record<string, unknown>,
	label: string,
): string[] {
	if (roles.shownRoleIds !== undefined) {
		return requiredArray(roles.shownRoleIds, `${label}.shownRoleIds`).map(
			(value, index) =>
				requiredString(value, `${label}.shownRoleIds[${index}]`),
		);
	}
	const legacyRoleId = requiredNullableString(
		roles.shownRoleId,
		`${label}.shownRoleId`,
	);
	return legacyRoleId === null ? [] : [legacyRoleId];
}

function decodePlayerStatus(
	value: unknown,
	label: string,
): GamePlayerStatusDraft {
	const status = requiredRecord(value, `${label} muss ein Objekt sein.`);
	assertKnownFields(
		status,
		["id", "statusId", "fromNight", "untilNight", "source", "note"],
		label,
	);
	return {
		id: requiredString(status.id, `${label}.id`),
		statusId: requiredString(status.statusId, `${label}.statusId`),
		fromNight: requiredNumber(status.fromNight, `${label}.fromNight`),
		untilNight: requiredNullableNumber(
			status.untilNight,
			`${label}.untilNight`,
		),
		source: decodePlayerStatusSource(status.source, `${label}.source`),
		note: optionalString(status.note, `${label}.note`),
	};
}

function decodePlayerStatusSource(
	value: unknown,
	label: string,
): GamePlayerStatusSourceDraft | undefined {
	const source = optionalRecord(value, label);
	if (!source) return undefined;
	assertKnownFields(
		source,
		["playerId", "roleSourceType", "roleIdAtTime", "roleNameAtTime"],
		label,
	);
	return {
		playerId: requiredString(source.playerId, `${label}.playerId`),
		roleSourceType: optionalString(
			source.roleSourceType,
			`${label}.roleSourceType`,
		),
		roleIdAtTime: optionalString(source.roleIdAtTime, `${label}.roleIdAtTime`),
		roleNameAtTime: optionalString(
			source.roleNameAtTime,
			`${label}.roleNameAtTime`,
		),
	};
}

function decodeRemovedInfo(
	value: unknown,
	label: string,
): GameRemovedInfoDraft | undefined {
	const removed = optionalRecord(value, label);
	if (!removed) return undefined;
	assertKnownFields(removed, ["night", "phase"], label);
	return {
		night: requiredNumber(removed.night, `${label}.night`),
		phase: requiredString(removed.phase, `${label}.phase`),
	};
}

function decodeTime(value: unknown): GameTimeDraft {
	const time = requiredRecord(value, "time muss ein Objekt sein.");
	assertKnownFields(time, ["currentNight", "phase"], "time");
	return {
		currentNight: requiredNumber(time.currentNight, "time.currentNight"),
		phase: requiredString(time.phase, "time.phase"),
	};
}

function decodeLogEntry(value: unknown, index: number): GameLogEntryDraft {
	const label = `log[${index}]`;
	const entry = requiredRecord(value, `${label} muss ein Objekt sein.`);
	assertKnownFields(
		entry,
		["id", "night", "phase", "createdAt", "type", "actor", "text", "payload"],
		label,
	);
	return {
		id: requiredString(entry.id, `${label}.id`),
		night: requiredNumber(entry.night, `${label}.night`),
		phase: requiredString(entry.phase, `${label}.phase`),
		createdAt: requiredString(entry.createdAt, `${label}.createdAt`),
		type: requiredString(entry.type, `${label}.type`),
		actor: optionalString(entry.actor, `${label}.actor`),
		text: requiredString(entry.text, `${label}.text`),
		payload: optionalRecord(entry.payload, `${label}.payload`),
	};
}

function decodeRolesForShowing(
	value: unknown,
): GameRolesForShowingDraft | undefined {
	const draft = optionalRecord(value, "rolesForShowing");
	if (!draft) return undefined;
	assertKnownFields(
		draft,
		["roles", "notice", "showRoleSymbols"],
		"rolesForShowing",
	);
	return {
		roles: requiredStringArray(draft.roles, "rolesForShowing.roles"),
		notice: optionalString(draft.notice, "rolesForShowing.notice"),
		showRoleSymbols: optionalBoolean(
			draft.showRoleSymbols,
			"rolesForShowing.showRoleSymbols",
		),
	};
}

function optionalLocalizedNames(
	value: unknown,
	label: string,
): LocalizedNames | undefined {
	const names = optionalRecord(value, label);
	if (!names) return undefined;
	return Object.fromEntries(
		Object.entries(names).map(([languageCode, name]) => [
			languageCode,
			requiredString(name, `${label}.${languageCode}`),
		]),
	);
}

function requiredStringArray(value: unknown, label: string): string[] {
	return requiredArray(value, label).map((entry, index) =>
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

function requiredNullableString(value: unknown, label: string): string | null {
	if (value === null) return null;
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

function requiredNullableNumber(value: unknown, label: string): number | null {
	if (value === null) return null;
	return requiredNumber(value, label);
}

function requiredBoolean(value: unknown, label: string): boolean {
	if (typeof value !== "boolean")
		throw invalidDocument(`Import fehlgeschlagen: ${label} muss boolean sein.`);
	return value;
}

function optionalBoolean(value: unknown, label: string): boolean | undefined {
	if (value === undefined) return undefined;
	return requiredBoolean(value, label);
}

function optionalRecord(
	value: unknown,
	label: string,
): Record<string, unknown> | undefined {
	if (value === undefined) return undefined;
	return requiredRecord(value, `${label} muss ein Objekt sein.`);
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
	const unknownFields = Object.keys(value).filter(
		(field) => !allowed.has(field),
	);
	if (unknownFields.length === 0) return;
	const fields = unknownFields.map((field) => `"${field}"`).join(", ");
	throw invalidDocument(
		`Import fehlgeschlagen: ${label} enthält ${unknownFields.length === 1 ? "ein unbekanntes Feld" : "unbekannte Felder"}: ${fields}.`,
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
