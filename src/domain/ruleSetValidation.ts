import { type HexColor, isHexColor } from "./color";
import {
	DomainOperationError,
	domainFailure,
	isDomainOperationError,
} from "./domainFailure";
import { type LocalizedNames, Role, type RoleNightInfo, Team } from "./models";
import type {
	ImportRuleSetResult,
	ImportWarning,
	RuleSet,
	RuleSetDraft,
	RuleSetNightActionDraft,
	RuleSetNightDraft,
	RuleSetRoleDraft,
	RuleSetStatusDraft,
	RuleSetTeamDraft,
} from "./ruleSet";
import type { StatusDefinition } from "./statusDefinition";
import { createIdFromText, type IdArea, isIdForArea } from "./stringSanitizer";
import { normalizeUnicodeRepresentation } from "./unicodeSymbol";

export function createRuleSetFromDraft(
	draft: RuleSetDraft,
	options: { mode?: "import" | "stored" } = {},
): ImportRuleSetResult {
	return createRuleSetFromDraftUnchecked(draft, options);
}

function createRuleSetFromDraftUnchecked(
	draft: RuleSetDraft,
	options: { mode?: "import" | "stored" },
): ImportRuleSetResult {
	if (options.mode === "stored")
		return { ruleSet: createStoredRuleSetFromDraft(draft), warnings: [] };
	const warnings: ImportWarning[] = [];
	const name = normalizeRequiredText(draft.name, "name");
	const id =
		draft.id && isIdForArea(draft.id, "ruleSet")
			? draft.id
			: createIdFromText(name, "ruleSet");
	const version = draft.version ?? 1;
	if (!Number.isInteger(version) || version < 1)
		throw invalidRuleSet(
			"Import fehlgeschlagen: version muss eine positive ganze Zahl sein.",
		);

	const teams = draft.teams.map(importTeam);
	ensureUnknownTeam(teams);
	assertNoDuplicateIds(
		teams.map((team) => team.id),
		"Team-ID",
	);
	const teamIds = new Set(teams.map((team) => team.id));
	const roles = draft.roles.map((role, index) =>
		importRole(role, index, teamIds, warnings),
	);
	const statuses = draft.statuses?.map(importStatusDefinition);

	assertNoDuplicateIds(
		roles.map((role) => role.id),
		"Rollen-ID",
	);
	if (statuses)
		assertNoDuplicateIds(
			statuses.map((status) => status.id),
			"Status-ID",
		);
	assertValidRoleStatusReferences(roles, statuses ?? []);
	assertNoDuplicateIds(
		[
			...teams.map((team) => team.id),
			...roles.map((role) => role.id),
			...(statuses?.map((status) => status.id) ?? []),
		],
		"Entitäts-ID",
	);

	const ruleSet: RuleSet = {
		id,
		name,
		names: normalizeLocalizedNames(draft.names, "names"),
		version,
		teams: sortTeams(teams),
		roles: sortRoles(roles, teams),
		statuses,
	};
	return { ruleSet, warnings };
}

function createStoredRuleSetFromDraft(draft: RuleSetDraft): RuleSet {
	const name = normalizeRequiredText(draft.name, "name");
	const id = draft.id ?? createIdFromText(name, "ruleSet");
	if (!isIdForArea(id, "ruleSet"))
		throw invalidRuleSet("RuleSet id has an invalid prefix or format.");
	const version = draft.version ?? 1;
	if (!Number.isInteger(version) || version < 1)
		throw invalidRuleSet(
			"Import fehlgeschlagen: version muss eine positive ganze Zahl sein.",
		);

	const teams = draft.teams.map((team, index) => {
		const label = `teams[${index}]`;
		if (!isIdForArea(team.id, "team"))
			throw invalidRuleSet(
				`Team id "${team.id}" hat kein gültiges Team-Präfix oder Format.`,
			);
		if (!Number.isInteger(team.teamOrder))
			throw invalidRuleSet(`${label}.teamOrder muss eine ganze Zahl sein.`);
		return new Team({
			id: team.id,
			name: normalizeRequiredText(team.name, `${label}.name`),
			names: normalizeLocalizedNames(team.names, `${label}.names`),
			color: validatedColor(team.color, `${label}.color`),
			teamOrder: team.teamOrder,
			isSystem: team.isSystem,
		});
	});
	assertNoDuplicateIds(
		teams.map((team) => team.id),
		"Team-ID",
	);
	const teamIds = new Set(teams.map((team) => team.id));
	if (!teamIds.has("t_unknown"))
		throw invalidRuleSet('Spielstand ungültig: System-Team "t_unknown" fehlt.');

	const roles = draft.roles.map((role, index) => {
		const label = `roles[${index}]`;
		if (!isIdForArea(role.id, "role"))
			throw invalidRuleSet(
				`Role id "${role.id}" hat kein gültiges Rollen-Präfix oder Format.`,
			);
		const unicode = normalizeUnicodeRepresentation(role, label);
		const hydrated = new Role({
			id: role.id,
			name: normalizeRequiredText(role.name, `${label}.name`),
			names: normalizeLocalizedNames(role.names, `${label}.names`),
			color: validatedColor(role.color, `${label}.color`),
			teamId: role.teamId,
			night: importNightInfo(role.night, `${label}.night`),
			expectsVisual: role.expectsVisual ?? false,
			isUnique: role.isUnique ?? true,
			unicodeEscaped: unicode.unicodeEscaped,
			unicodeSymbol: unicode.unicodeSymbol,
			kills_someone: role.kills_someone,
			resurrect_someone: role.resurrect_someone,
			apply_status_effect: role.apply_status_effect,
		});
		if (!teamIds.has(hydrated.teamId))
			throw invalidRuleSet(
				`Spielstand ungültig: ${label}.teamId verweist auf unbekanntes Team "${hydrated.teamId}".`,
			);
		return hydrated;
	});
	assertNoDuplicateIds(
		roles.map((role) => role.id),
		"Rollen-ID",
	);

	const statuses = draft.statuses?.map((status, index) => {
		const label = `statuses[${index}]`;
		if (!isIdForArea(status.id, "statusDefinition"))
			throw invalidRuleSet(`${label}.id hat keine gültige Status-ID.`);
		const duration = status.defaultDuration ?? 1;
		if (!Number.isInteger(duration) || duration < 0)
			throw invalidRuleSet(
				`Import fehlgeschlagen: ${label}.defaultDuration muss eine ganze Zahl >= 0 sein.`,
			);
		const unicode = normalizeUnicodeRepresentation(status, label);
		return {
			id: status.id,
			name: normalizeRequiredText(status.name, `${label}.name`),
			names: normalizeLocalizedNames(status.names, `${label}.names`),
			unicodeEscaped: unicode.unicodeEscaped,
			unicodeSymbol: unicode.unicodeSymbol,
			defaultDuration: duration,
		};
	});
	assertNoDuplicateIds(statuses?.map((status) => status.id) ?? [], "Status-ID");
	assertNoDuplicateIds(
		[
			...teams.map((team) => team.id),
			...roles.map((role) => role.id),
			...(statuses?.map((status) => status.id) ?? []),
		],
		"Entitäts-ID",
	);
	assertValidRoleStatusReferences(roles, statuses ?? []);

	return {
		id,
		name,
		names: normalizeLocalizedNames(draft.names, "names"),
		version,
		teams,
		roles,
		statuses,
	};
}

export function assertRuleSetExportable(ruleSet: RuleSet): void {
	try {
		assertRuleSetExportableUnchecked(ruleSet);
	} catch (error) {
		if (!isDomainOperationError(error)) throw error;
		throw new DomainOperationError({
			...error.failure,
			repairable: false,
		});
	}
}

function assertRuleSetExportableUnchecked(ruleSet: RuleSet): void {
	assertExportId(ruleSet.id, "ruleSet.id", "ruleSet");
	assertExportText(ruleSet.name, "ruleSet.name");
	assertExportLocalizedNames(ruleSet.names, "ruleSet.names");

	if (!Number.isInteger(ruleSet.version) || ruleSet.version < 1)
		throw invalidRuleSetExport(
			"Export fehlgeschlagen: ruleSet.version muss eine positive ganze Zahl sein.",
		);

	const teamIds = new Set<string>();
	for (const team of ruleSet.teams) {
		assertExportId(team.id, "team.id", "team");
		assertExportText(team.name, "team.name");
		assertExportLocalizedNames(team.names, `team "${team.id}".names`);
		assertExportColor(team.color, `team "${team.id}".color`);
		if (!Number.isInteger(team.teamOrder))
			throw invalidRuleSetExport(
				`Export fehlgeschlagen: Team "${team.id}" hat keine gültige teamOrder.`,
			);
		if (teamIds.has(team.id))
			throw invalidRuleSetExport(
				`Export fehlgeschlagen: Doppelte Team-ID "${team.id}".`,
			);
		teamIds.add(team.id);
	}

	const roleIds = new Set<string>();
	for (const role of ruleSet.roles) {
		assertExportId(role.id, "role.id", "role");
		assertExportText(role.name, "role.name");
		assertExportLocalizedNames(role.names, `role "${role.id}".names`);
		assertExportColor(role.color, `role "${role.id}".color`);
		assertExportId(role.teamId, "role.teamId", "team");
		if (roleIds.has(role.id))
			throw invalidRuleSetExport(
				`Export fehlgeschlagen: Doppelte Rollen-ID "${role.id}".`,
			);
		roleIds.add(role.id);
		if (!teamIds.has(role.teamId))
			throw invalidRuleSetExport(
				`Export fehlgeschlagen: Rolle "${role.id}" verweist auf unbekanntes Team "${role.teamId}".`,
			);
		if (role.unicodeEscaped !== undefined)
			assertExportAscii(
				role.unicodeEscaped,
				`role "${role.id}".unicodeEscaped`,
			);
		normalizeUnicodeRepresentation(role, `role "${role.id}"`);
		for (const statusId of role.apply_status_effect ?? []) {
			if (!isIdForArea(statusId, "statusDefinition"))
				throw invalidRuleSetExport(
					`Export fehlgeschlagen: role "${role.id}".apply_status_effect muss ein Array nicht-leerer Strings sein.`,
				);
		}
	}

	const entityIds = new Set([...teamIds, ...roleIds]);
	for (const status of ruleSet.statuses ?? []) {
		assertExportId(status.id, "status.id", "statusDefinition");
		assertExportText(status.name, "status.name");
		assertExportLocalizedNames(status.names, `status "${status.id}".names`);
		if (entityIds.has(status.id))
			throw invalidRuleSetExport(
				`Export fehlgeschlagen: Doppelte Entitäts-ID "${status.id}".`,
			);
		entityIds.add(status.id);
		if (status.unicodeEscaped !== undefined)
			assertExportAscii(
				status.unicodeEscaped,
				`status "${status.id}".unicodeEscaped`,
			);
		normalizeUnicodeRepresentation(status, `status "${status.id}"`);
		if (
			status.defaultDuration !== undefined &&
			(!Number.isInteger(status.defaultDuration) || status.defaultDuration < 0)
		)
			throw invalidRuleSetExport(
				`Export fehlgeschlagen: status "${status.id}".defaultDuration muss zwischen 0 und 100 liegen.`,
			);
	}
}

function assertExportId(value: string, label: string, area: IdArea): void {
	if (!isIdForArea(value, area))
		throw invalidRuleSetExport(
			`Export fehlgeschlagen: ${label} hat nicht das erwartete Präfix für den Bereich ${area}.`,
		);
}

function assertExportText(value: string, label: string): void {
	if (!value.trim())
		throw invalidRuleSetExport(
			`Export fehlgeschlagen: ${label} muss ein nicht-leerer String sein.`,
		);
}

function assertExportLocalizedNames(
	names: LocalizedNames | undefined,
	label: string,
): void {
	for (const languageCode of Object.keys(names ?? {})) {
		if (!languageCode.trim())
			throw invalidRuleSetExport(
				`Export fehlgeschlagen: ${label} muss Sprachcodes auf Strings abbilden.`,
			);
	}
}

function validatedColor(
	value: string | undefined,
	label: string,
): HexColor | undefined {
	if (value === undefined || isHexColor(value)) return value;
	throw invalidRuleSet(
		`Import fehlgeschlagen: ${label} muss aus genau sechs Zeichen von 0-9 oder A-F bestehen.`,
	);
}

function assertExportColor(value: string | undefined, label: string): void {
	if (value === undefined || isHexColor(value)) return;
	throw invalidRuleSetExport(
		`Export fehlgeschlagen: ${label} muss aus genau sechs Zeichen von 0-9 oder A-F bestehen.`,
	);
}

function assertExportAscii(value: string, label: string): void {
	for (const character of value) {
		if (character.charCodeAt(0) > 127)
			throw invalidRuleSetExport(
				`Export fehlgeschlagen: ${label} darf nur ASCII-Zeichen enthalten.`,
			);
	}
}

function importTeam(draft: RuleSetTeamDraft, index: number): Team {
	if (!Number.isInteger(draft.teamOrder))
		throw invalidRuleSet(
			`Import fehlgeschlagen: teams[${index}].teamOrder muss eine ganze Zahl sein.`,
		);
	return new Team({
		id: normalizeRequiredId(draft.id, `teams[${index}].id`, "team"),
		name: normalizeRequiredText(draft.name, `teams[${index}].name`),
		names: normalizeLocalizedNames(draft.names, `teams[${index}].names`),
		color: validatedColor(draft.color, `teams[${index}].color`),
		teamOrder: draft.teamOrder,
		isSystem: draft.isSystem ?? false,
	});
}

function importRole(
	draft: RuleSetRoleDraft,
	index: number,
	teamIds: Set<string>,
	warnings: ImportWarning[],
): Role {
	const label = `roles[${index}]`;
	const id = normalizeRequiredId(draft.id, `${label}.id`, "role");
	let teamId = draft.teamId
		? normalizeRequiredId(draft.teamId, `${label}.teamId`, "team")
		: "t_unknown";
	if (!teamIds.has(teamId)) {
		warnings.push({
			code: "ROLE_TEAM_MISSING",
			message: `Rolle "${id}" verweist auf unbekanntes Team "${teamId}" und wurde nach "t_unknown" verschoben.`,
		});
		teamId = "t_unknown";
	}
	const unicode = normalizeUnicodeRepresentation(draft, label);
	return new Role({
		id,
		name: normalizeRequiredText(draft.name, `${label}.name`),
		names: normalizeLocalizedNames(draft.names, `${label}.names`),
		color: validatedColor(draft.color, `${label}.color`),
		teamId,
		night: importNightInfo(draft.night, `${label}.night`),
		expectsVisual: draft.expectsVisual ?? false,
		isUnique: draft.isUnique ?? true,
		unicodeEscaped: unicode.unicodeEscaped,
		unicodeSymbol: unicode.unicodeSymbol,
		kills_someone: draft.kills_someone,
		resurrect_someone: draft.resurrect_someone,
		apply_status_effect: draft.apply_status_effect?.map(
			(statusId, statusIndex) =>
				createIdFromText(
					normalizeRequiredText(
						statusId,
						`${label}.apply_status_effect[${statusIndex}]`,
					),
					"statusDefinition",
				),
		),
	});
}

function importStatusDefinition(
	draft: RuleSetStatusDraft,
	index: number,
): StatusDefinition {
	const label = `statuses[${index}]`;
	const duration = draft.defaultDuration ?? 1;
	if (!Number.isInteger(duration) || duration < 0)
		throw invalidRuleSet(
			`Import fehlgeschlagen: ${label}.defaultDuration muss eine ganze Zahl >= 0 sein.`,
		);
	const unicode = normalizeUnicodeRepresentation(draft, label);
	return {
		id: normalizeRequiredId(draft.id, `${label}.id`, "statusDefinition"),
		name: normalizeRequiredText(draft.name, `${label}.name`),
		names: normalizeLocalizedNames(draft.names, `${label}.names`),
		unicodeEscaped: unicode.unicodeEscaped,
		unicodeSymbol: unicode.unicodeSymbol,
		defaultDuration: duration,
	};
}

function importNightInfo(
	draft: RuleSetNightDraft | undefined,
	label: string,
): RoleNightInfo | undefined {
	if (!draft) return undefined;
	const first = importNightAction(draft.first, `${label}.first`);
	const other = importNightAction(draft.other, `${label}.other`);
	return first || other ? { first, other } : undefined;
}

function importNightAction(
	draft: RuleSetNightActionDraft | undefined,
	label: string,
): { order: number; note?: string } | undefined {
	if (!draft) return undefined;
	if (!Number.isInteger(draft.order))
		throw invalidRuleSet(
			`Import fehlgeschlagen: ${label}.order muss eine ganze Zahl sein.`,
		);
	if (draft.order <= 0) return undefined;
	return { order: draft.order, note: normalizeOptionalText(draft.note) };
}

function normalizeRequiredId(
	value: string,
	label: string,
	area: IdArea,
): string {
	return createIdFromText(normalizeRequiredText(value, label), area);
}

function normalizeRequiredText(value: string, label: string): string {
	const trimmed = value.trim();
	if (!trimmed)
		throw invalidRuleSet(
			`Import fehlgeschlagen: ${label} darf nicht leer sein.`,
		);
	return trimmed;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
	return value?.trim() || undefined;
}

function normalizeLocalizedNames(
	names: LocalizedNames | undefined,
	label: string,
): LocalizedNames | undefined {
	if (!names) return undefined;
	for (const languageCode of Object.keys(names)) {
		if (!languageCode.trim())
			throw invalidRuleSet(
				`Import fehlgeschlagen: ${label} enthält einen leeren Sprachcode.`,
			);
	}
	return { ...names };
}

function ensureUnknownTeam(teams: Team[]): void {
	if (!teams.some((team) => team.id === "t_unknown"))
		teams.push(Team.createUnknown());
}

function sortTeams(teams: Team[]): Team[] {
	return [...teams].sort(
		(left, right) =>
			left.teamOrder - right.teamOrder || left.name.localeCompare(right.name),
	);
}

function sortRoles(roles: Role[], teams: Team[]): Role[] {
	const teamOrder = new Map(teams.map((team) => [team.id, team.teamOrder]));
	return [...roles].sort((left, right) => {
		const orderDifference =
			(teamOrder.get(left.teamId) ?? 999) -
			(teamOrder.get(right.teamId) ?? 999);
		return orderDifference || left.name.localeCompare(right.name);
	});
}

function assertNoDuplicateIds(ids: string[], label: string): void {
	const seen = new Set<string>();
	for (const id of ids) {
		if (seen.has(id))
			throw invalidRuleSet(`Import fehlgeschlagen: Doppelte ${label} "${id}".`);
		seen.add(id);
	}
}

function assertValidRoleStatusReferences(
	roles: Role[],
	statuses: StatusDefinition[],
): void {
	const statusIds = new Set(statuses.map((status) => status.id));
	const missing = new Set<string>();
	const duplicates: Array<{ roleId: string; statusIds: string[] }> = [];
	for (const role of roles) {
		const seen = new Set<string>();
		const duplicateIds = new Set<string>();
		for (const statusId of role.apply_status_effect ?? []) {
			if (!statusIds.has(statusId)) missing.add(statusId);
			if (seen.has(statusId)) duplicateIds.add(statusId);
			seen.add(statusId);
		}
		if (duplicateIds.size > 0)
			duplicates.push({ roleId: role.id, statusIds: [...duplicateIds].sort() });
	}
	if (missing.size === 0 && duplicates.length === 0) return;
	const problems: string[] = [];
	if (missing.size > 0)
		problems.push(
			`Statusdefinitionen fehlen für: ${[...missing]
				.sort()
				.map((id) => `"${id}"`)
				.join(", ")}.`,
		);
	if (duplicates.length > 0)
		problems.push(
			`Doppelte Statuseinträge in Rollen: ${duplicates
				.map(
					({ roleId, statusIds: ids }) =>
						`Rolle "${roleId}": ${ids.map((id) => `"${id}"`).join(", ")}`,
				)
				.join("; ")}.`,
		);
	throw invalidRuleSet(`Import fehlgeschlagen: ${problems.join(" ")}`);
}

function invalidRuleSet(details: string): DomainOperationError {
	return domainFailure("validate", "invalidObject", true, details);
}

function invalidRuleSetExport(details: string): DomainOperationError {
	return domainFailure("validate", "invalidObject", false, details);
}
