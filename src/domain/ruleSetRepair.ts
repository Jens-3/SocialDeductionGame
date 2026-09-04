import { repairHexColor } from "./color";
import { domainFailure, isDomainOperationError } from "./domainFailure";
import { normalizeLocalizedNameLanguageTag } from "./localizedNames";
import type { RuleSet } from "./ruleSet";
import { createRuleSetFromDraft } from "./ruleSetValidation";
import {
	createUniqueId as createAvailableId,
	createIdFromText,
	type IdArea,
} from "./stringSanitizer";

export type RuleSetRepairMappings = {
	teams: ReadonlyMap<string, string>;
	roles: ReadonlyMap<string, string>;
	statuses: ReadonlyMap<string, string>;
};

export type RuleSetRepairResult = {
	ruleSet: RuleSet;
	changes: RuleSetRepairChange[];
	mappings: RuleSetRepairMappings;
	changeCount: number;
};

export type RuleSetRepairChange =
	| {
			kind: "missingStatusDefinitionAdded";
			ruleSetLabel: string;
			status: string;
	  }
	| {
			kind: "unknownFieldsRemoved";
			subject: "ruleSet" | "team" | "role" | "status";
			ruleSetLabel: string;
			index?: number;
			fields: string[];
	  };

const RULE_SET_KEYS = new Set([
	"id",
	"name",
	"names",
	"version",
	"teams",
	"roles",
	"statuses",
]);
const TEAM_KEYS = new Set([
	"id",
	"name",
	"names",
	"color",
	"teamOrder",
	"isSystem",
]);
const ROLE_KEYS = new Set([
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
]);
const STATUS_KEYS = new Set([
	"id",
	"name",
	"names",
	"unicodeEscaped",
	"unicodeSymbol",
	"defaultDuration",
]);

/** Repariert ein vollständiges RuleSet unabhängig von seinem Container. */
export function repairRuleSet(value: object): RuleSetRepairResult {
	try {
		return repairRuleSetUnchecked(value);
	} catch (error) {
		if (!isDomainOperationError(error)) throw error;
		const details = error.failure.diagnostic ?? error.failure.details;
		throw domainFailure("repair", "repairFailed", false, details);
	}
}

function repairRuleSetUnchecked(value: object): RuleSetRepairResult {
	const source = record(value);
	if (!source)
		throw domainFailure(
			"repair",
			"repairFailed",
			false,
			"Der gespeicherte RuleSet-Eintrag ist kein Objekt.",
		);
	const originalJson = JSON.stringify(value);
	const label = text(source.id) ?? text(source.name) ?? "unknown";
	const changes: RuleSetRepairChange[] = [];
	const fallbackName = "Unbenanntes Regelwerk";
	const name = requiredText(source.name, fallbackName);
	const id = createIdFromText(text(source.id) ?? name, "ruleSet");
	const usedEntityIds = new Set<string>();
	const teamReferenceMap = new Map<string, string>();
	const mappings = createMutableMappings();
	const teams = orderUnknownTeamKeeperFirst(normalizeArray(source.teams)).map(
		(team, index) =>
			repairTeam(
				team,
				index,
				usedEntityIds,
				teamReferenceMap,
				mappings,
				label,
				changes,
			),
	);
	const roles = normalizeArray(source.roles).map((role, index) =>
		repairRole(
			role,
			index,
			usedEntityIds,
			teamReferenceMap,
			mappings,
			label,
			changes,
		),
	);
	const hadStatusesField = source.statuses !== undefined;
	const statuses = normalizeArray(source.statuses).map((status, index) =>
		repairStatus(status, index, usedEntityIds, mappings, label, changes),
	);
	repairRoleStatusReferences(
		roles,
		statuses,
		usedEntityIds,
		mappings,
		label,
		changes,
	);
	countRemovedFields(source, RULE_SET_KEYS, "ruleSet", label, changes);

	const ruleSet = createRuleSetFromDraft({
		id,
		name,
		names: localizedNames(source.names),
		version:
			Number.isInteger(source.version) && Number(source.version) > 0
				? Number(source.version)
				: 1,
		teams,
		roles,
		statuses: hadStatusesField || statuses.length > 0 ? statuses : undefined,
	}).ruleSet;
	const idChangeCount =
		mappings.changedIdCount + (text(source.id) !== ruleSet.id ? 1 : 0);
	const contentChanged = originalJson !== JSON.stringify(ruleSet);
	return {
		ruleSet,
		changes: [...new Set(changes)],
		changeCount: idChangeCount > 0 ? idChangeCount : contentChanged ? 1 : 0,
		mappings: {
			teams: mappings.teams.values,
			roles: mappings.roles.values,
			statuses: mappings.statuses.values,
		},
	};
}

function orderUnknownTeamKeeperFirst(teams: unknown[]): unknown[] {
	const candidates = teams
		.map((team, index) => ({ source: record(team), team, index }))
		.filter(
			(entry) =>
				entry.source &&
				text(entry.source.id) !== undefined &&
				createIdFromText(text(entry.source.id) ?? "", "team") === "t_unknown",
		);
	if (candidates.length < 2) return teams;

	const systemCandidates = candidates.filter(
		(entry) => entry.source?.isSystem === true,
	);
	const selectable =
		systemCandidates.length === 1 ? systemCandidates : candidates;
	const keeper = selectable.reduce((selected, candidate) => {
		const selectedOrder = Number(selected.source?.teamOrder);
		const candidateOrder = Number(candidate.source?.teamOrder);
		return Number.isFinite(candidateOrder) &&
			(!Number.isFinite(selectedOrder) || candidateOrder > selectedOrder)
			? candidate
			: selected;
	});
	return [keeper.team, ...teams.filter((_, index) => index !== keeper.index)];
}

type RepairedRole = ReturnType<typeof repairRole>;
type RepairedStatus = ReturnType<typeof repairStatus>;

function repairRoleStatusReferences(
	roles: RepairedRole[],
	statuses: RepairedStatus[],
	usedIds: Set<string>,
	mappings: MutableMappings,
	ruleSetLabel: string,
	changes: RuleSetRepairChange[],
): void {
	for (const role of roles) {
		const repairedIds: string[] = [];
		for (const statusText of role.apply_status_effect ?? []) {
			const mappedId = mappings.statuses.values.get(statusText);
			const candidateId = createIdFromText(statusText, "statusDefinition");
			let definition = statuses.find(
				(status) =>
					status.id === mappedId ||
					status.id === statusText ||
					status.id === candidateId ||
					status.name.trim().toLocaleLowerCase() ===
						statusText.trim().toLocaleLowerCase(),
			);

			if (!definition) {
				const id = createUniqueId(statusText, "statusDefinition", usedIds);
				definition = {
					id,
					name: statusText,
					names: undefined,
					unicodeEscaped: undefined,
					unicodeSymbol: undefined,
					defaultDuration: 1,
				};
				statuses.push(definition);
				registerMapping(mappings.statuses, statusText, id);
				mappings.changedIdCount++;
				changes.push({
					kind: "missingStatusDefinitionAdded",
					ruleSetLabel,
					status: statusText,
				});
			}

			if (!repairedIds.includes(definition.id)) repairedIds.push(definition.id);
		}
		role.apply_status_effect =
			role.apply_status_effect === undefined ? undefined : repairedIds;
	}
}

type MutableMapping = {
	values: Map<string, string>;
	ambiguous: Set<string>;
};

type MutableMappings = {
	teams: MutableMapping;
	roles: MutableMapping;
	statuses: MutableMapping;
	changedIdCount: number;
};

function createMutableMappings(): MutableMappings {
	const mapping = (): MutableMapping => ({
		values: new Map<string, string>(),
		ambiguous: new Set<string>(),
	});
	return {
		teams: mapping(),
		roles: mapping(),
		statuses: mapping(),
		changedIdCount: 0,
	};
}

function registerMapping(
	mapping: MutableMapping,
	oldId: string | undefined,
	newId: string,
): void {
	if (!oldId || mapping.ambiguous.has(oldId)) return;
	const previous = mapping.values.get(oldId);
	if (previous === undefined || previous === newId) {
		mapping.values.set(oldId, newId);
		return;
	}
	mapping.values.delete(oldId);
	mapping.ambiguous.add(oldId);
}

function repairTeam(
	value: unknown,
	index: number,
	usedIds: Set<string>,
	teamReferenceMap: Map<string, string>,
	mappings: MutableMappings,
	ruleSetLabel: string,
	changes: RuleSetRepairChange[],
) {
	const source = record(value) ?? {};
	const name = requiredText(source.name, `Unbenanntes Team ${index + 1}`);
	const oldId = text(source.id);
	const rawId = oldId ?? name;
	const normalizedRawId = createIdFromText(rawId, "team");
	const id = createUniqueId(rawId, "team", usedIds);
	if (oldId !== id) mappings.changedIdCount++;
	if (!teamReferenceMap.has(normalizedRawId))
		teamReferenceMap.set(normalizedRawId, id);
	registerMapping(mappings.teams, oldId, id);
	countRemovedFields(
		source,
		TEAM_KEYS,
		"team",
		ruleSetLabel,
		changes,
		index + 1,
	);
	return {
		id,
		name,
		names: localizedNames(source.names),
		color: repairHexColor(source.color),
		teamOrder:
			id === "t_unknown"
				? Number.isInteger(source.teamOrder)
					? Number(source.teamOrder)
					: 99
				: Number.isInteger(source.teamOrder)
					? Number(source.teamOrder)
					: 0,
		isSystem:
			id === "t_unknown" ||
			(normalizedRawId !== "t_unknown" && source.isSystem === true),
	};
}

function repairRole(
	value: unknown,
	index: number,
	usedIds: Set<string>,
	teamReferenceMap: Map<string, string>,
	mappings: MutableMappings,
	ruleSetLabel: string,
	changes: RuleSetRepairChange[],
) {
	const source = record(value) ?? {};
	const name = requiredText(source.name, `Unbenannte Rolle ${index + 1}`);
	const oldId = text(source.id);
	const id = createUniqueId(oldId ?? name, "role", usedIds);
	if (oldId !== id) mappings.changedIdCount++;
	registerMapping(mappings.roles, oldId, id);
	const rawTeamId = text(source.teamId);
	const normalizedTeamId = rawTeamId
		? createIdFromText(rawTeamId, "team")
		: "t_unknown";
	countRemovedFields(
		source,
		ROLE_KEYS,
		"role",
		ruleSetLabel,
		changes,
		index + 1,
	);
	return {
		id,
		name,
		names: localizedNames(source.names),
		color: repairHexColor(source.color),
		teamId: teamReferenceMap.get(normalizedTeamId) ?? normalizedTeamId,
		night: repairNight(source.night),
		expectsVisual: source.expectsVisual === true,
		isUnique: typeof source.isUnique === "boolean" ? source.isUnique : true,
		unicodeEscaped: asciiText(source.unicodeEscaped),
		unicodeSymbol: text(source.unicodeSymbol),
		kills_someone:
			typeof source.kills_someone === "boolean"
				? source.kills_someone
				: undefined,
		resurrect_someone:
			typeof source.resurrect_someone === "boolean"
				? source.resurrect_someone
				: undefined,
		apply_status_effect: stringArray(source.apply_status_effect),
	};
}

function repairStatus(
	value: unknown,
	index: number,
	usedIds: Set<string>,
	mappings: MutableMappings,
	ruleSetLabel: string,
	changes: RuleSetRepairChange[],
) {
	const source = record(value) ?? {};
	const name = requiredText(source.name, `Unbenannter Zustand ${index + 1}`);
	const oldId = text(source.id);
	const id = createUniqueId(oldId ?? name, "statusDefinition", usedIds);
	if (oldId !== id) mappings.changedIdCount++;
	registerMapping(mappings.statuses, oldId, id);
	countRemovedFields(
		source,
		STATUS_KEYS,
		"status",
		ruleSetLabel,
		changes,
		index + 1,
	);
	return {
		id,
		name,
		names: localizedNames(source.names),
		unicodeEscaped: asciiText(source.unicodeEscaped),
		unicodeSymbol: text(source.unicodeSymbol),
		defaultDuration: repairedDefaultDuration(source),
	};
}

function repairedDefaultDuration(source: Record<string, unknown>): number {
	return typeof source.defaultDuration === "number" &&
		Number.isInteger(source.defaultDuration) &&
		source.defaultDuration >= 0
		? source.defaultDuration
		: 1;
}

function normalizeArray(value: unknown): unknown[] {
	if (Array.isArray(value)) return value;
	if (record(value)) return [value];
	return [];
}

function repairNight(value: unknown) {
	const source = record(value);
	if (!source) return undefined;
	const first = repairNightAction(source.first);
	const other = repairNightAction(source.other);
	return first || other ? { first, other } : undefined;
}

function repairNightAction(value: unknown) {
	const source = record(value);
	if (!source) return undefined;
	return {
		order: Number.isInteger(source.order) ? Number(source.order) : 0,
		note: text(source.note),
	};
}

function createUniqueId(
	value: string,
	area: IdArea,
	usedIds: Set<string>,
): string {
	const id = createAvailableId(value, area, usedIds).id;
	usedIds.add(id);
	return id;
}

function requiredText(value: unknown, fallback: string): string {
	return text(value)?.trim() || fallback;
}

function text(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function asciiText(value: unknown): string | undefined {
	const valueText = text(value)?.trim();
	return valueText &&
		[...valueText].every((character) => character.charCodeAt(0) <= 0x7f)
		? valueText
		: undefined;
}

function stringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	return value.filter(
		(entry): entry is string =>
			typeof entry === "string" && Boolean(entry.trim()),
	);
}

function localizedNames(value: unknown): Record<string, string> | undefined {
	const source = record(value);
	if (!source) return undefined;
	const names = Object.fromEntries(
		Object.entries(source)
			.filter(
				(entry): entry is [string, string] =>
					Boolean(entry[0].trim()) && typeof entry[1] === "string",
			)
			.map(([language, name]) => [
				normalizeLocalizedNameLanguageTag(language),
				name,
			]),
	);
	return Object.keys(names).length > 0 ? names : undefined;
}

function countRemovedFields(
	source: Record<string, unknown>,
	allowed: Set<string>,
	subject: "ruleSet" | "team" | "role" | "status",
	ruleSetLabel: string,
	changes: RuleSetRepairChange[],
	index?: number,
): void {
	const removed = Object.keys(source).filter((key) => !allowed.has(key));
	if (removed.length > 0)
		changes.push({
			kind: "unknownFieldsRemoved",
			subject,
			ruleSetLabel,
			...(index === undefined ? {} : { index }),
			fields: removed,
		});
}

function record(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}
