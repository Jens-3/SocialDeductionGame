import type { GameState } from "../domain/gameFactory";
import { repairGameState } from "../domain/gameRepair";
import { hydrateRuleSet } from "../domain/gameValidation";
import { getDisplayName } from "../domain/localizedNames";
import type { LocalizedNames } from "../domain/models";
import type { RuleSet } from "../domain/ruleSet";
import {
	createPlayer,
	createRole,
	createTeam,
	deletePlayer,
	deleteRole,
	deleteTeam,
	editPlayer,
	editRole,
	editTeam,
} from "../domain/sessionEditing";
import {
	createStatusDefinition,
	deleteStatusDefinition,
	editStatusDefinition,
} from "../domain/statusDefinitions";
import {
	createIdFromText,
	createUniqueIdFromName,
	createUniqueNameAndId,
} from "../domain/stringSanitizer";
import { sanitizeText } from "../shared/textSanitizer";
import {
	type ApplicationErrorReason,
	ApplicationOperationError,
	expectedApplicationError,
} from "./applicationError";
import { executeApplicationOperationSync } from "./internal/applicationErrorMapping";

export type ScenarioEditorType = "ruleSet" | "template" | "game";
export type StoredScenarioEditorType = Exclude<ScenarioEditorType, "game">;
export type ScenarioEditorSection = "teams" | "roles" | "players" | "statuses";

export type RoleEditorValues = {
	name: string;
	displayName: string | null;
	color?: string | null;
	teamId: string;
	firstNightOrder: number | null;
	otherNightOrder: number | null;
	isUnique: boolean;
	unicodeEscaped: string | null;
	killsSomeone: boolean;
	resurrectSomeone: boolean;
	applyStatusEffect: string[];
};

type GeneralEditorValues = {
	name: string;
	displayName?: string | null;
	color?: string | null;
	teamOrder?: number;
	defaultDuration?: number;
};

type ScenarioEditorUpdateValues<Section extends ScenarioEditorSection> =
	Section extends "roles" ? RoleEditorValues : GeneralEditorValues;

export type ScenarioEditorItem = {
	id: string;
	name: string;
	displayName: string;
	localizedName: string;
	color?: string;
	secondary?: string;
	teamId?: string;
	teamOrder?: number;
	firstNightOrder?: number;
	otherNightOrder?: number;
	isUnique?: boolean;
	unicodeEscaped?: string;
	unicodeSymbol?: string;
	killsSomeone?: boolean;
	resurrectSomeone?: boolean;
	applyStatusEffect?: string[];
	defaultDuration?: number;
};

export class ScenarioEditorSession {
	readonly type: ScenarioEditorType;
	readonly originalId: string;
	#game: GameState;
	readonly #language: string;
	#dirty = false;

	private constructor(
		type: ScenarioEditorType,
		game: GameState,
		language: string,
	) {
		this.type = type;
		this.originalId = type === "ruleSet" ? game.ruleSetSnapshot.id : game.id;
		this.#game = game;
		this.#language = language;
	}

	static fromRuleSet(ruleSet: RuleSet, language = "de"): ScenarioEditorSession {
		const hydratedRuleSet = hydrateRuleSet(ruleSet);
		const statuses = hydratedRuleSet.statuses ?? [];
		return new ScenarioEditorSession(
			"ruleSet",
			{
				id: "game_scenario_editor",
				name: ruleSet.name,
				isTemplate: false,
				createdAt: "1970-01-01T00:00:00.000Z",
				ruleSetSnapshot: hydratedRuleSet,
				statusDefinitionsById: Object.fromEntries(
					statuses.map((status) => [status.id, status]),
				),
				playersById: {},
				seatOrder: [],
				time: { currentNight: 0, phase: "setup" },
				log: [],
			},
			language,
		);
	}

	static fromTemplate(
		document: GameState,
		language = "de",
	): ScenarioEditorSession {
		const game = repairGameState(document, "template").document;
		return new ScenarioEditorSession("template", game, language);
	}

	static fromGame(document: GameState, language = "de"): ScenarioEditorSession {
		const game = repairGameState(document, "game").document;
		return new ScenarioEditorSession("game", game, language);
	}

	get name(): string {
		return this.type === "ruleSet"
			? this.#game.ruleSetSnapshot.name
			: this.#game.name;
	}

	isDirty(): boolean {
		return this.#dirty;
	}

	markSaved(): void {
		this.#dirty = false;
	}

	markChanged(): void {
		this.#dirty = true;
	}

	items(section: ScenarioEditorSection): ScenarioEditorItem[] {
		const teams = [...this.#game.ruleSetSnapshot.teams].sort(
			(a, b) =>
				a.teamOrder - b.teamOrder ||
				getDisplayName(a, this.#language).localeCompare(
					getDisplayName(b, this.#language),
				),
		);
		if (section === "teams")
			return teams.map((team) => ({
				id: team.id,
				name: team.name,
				displayName: getDisplayName(team, this.#language),
				localizedName: team.names?.[this.#language]?.trim() ?? "",
				color: team.color,
				secondary: `Reihenfolge ${team.teamOrder}`,
				teamOrder: team.teamOrder,
			}));
		if (section === "roles") {
			const teamIndex = new Map(teams.map((team, index) => [team.id, index]));
			return [...this.#game.ruleSetSnapshot.roles]
				.sort(
					(a, b) =>
						(teamIndex.get(a.teamId) ?? Number.MAX_SAFE_INTEGER) -
							(teamIndex.get(b.teamId) ?? Number.MAX_SAFE_INTEGER) ||
						getDisplayName(a, this.#language).localeCompare(
							getDisplayName(b, this.#language),
						) ||
						a.id.localeCompare(b.id),
				)
				.map((role) => {
					const team = this.#game.ruleSetSnapshot.teams.find(
						(team) => team.id === role.teamId,
					);
					return {
						id: role.id,
						name: role.name,
						displayName: getDisplayName(role, this.#language),
						localizedName: role.names?.[this.#language]?.trim() ?? "",
						color: role.color,
						teamId: role.teamId,
						firstNightOrder: role.night?.first?.order,
						otherNightOrder: role.night?.other?.order,
						isUnique: role.isUnique,
						unicodeEscaped: role.unicodeEscaped,
						unicodeSymbol: role.unicodeSymbol,
						killsSomeone: role.kills_someone === true,
						resurrectSomeone: role.resurrect_someone === true,
						applyStatusEffect: [...(role.apply_status_effect ?? [])],
						secondary: team
							? getDisplayName(team, this.#language)
							: role.teamId,
					};
				});
		}
		if (section === "players")
			return Object.values(this.#game.playersById)
				.sort(
					(a, b) =>
						getDisplayName(a, this.#language).localeCompare(
							getDisplayName(b, this.#language),
						) || a.id.localeCompare(b.id),
				)
				.map((player) => ({
					id: player.id,
					name: player.name,
					displayName: getDisplayName(player, this.#language),
					localizedName: player.names?.[this.#language]?.trim() ?? "",
					color: player.color,
				}));
		return Object.values(this.#game.statusDefinitionsById)
			.sort(
				(a, b) =>
					getDisplayName(a, this.#language).localeCompare(
						getDisplayName(b, this.#language),
					) || a.id.localeCompare(b.id),
			)
			.map((status) => ({
				id: status.id,
				name: status.name,
				displayName: getDisplayName(status, this.#language),
				localizedName: status.names?.[this.#language]?.trim() ?? "",
				defaultDuration: status.defaultDuration ?? 1,
			}));
	}

	teamOptions(): Array<{ id: string; name: string }> {
		return this.items("teams").map(({ id, displayName }) => ({
			id,
			name: displayName,
		}));
	}

	getItem(
		section: ScenarioEditorSection,
		id: string,
	): ScenarioEditorItem | undefined {
		return this.items(section).find((item) => item.id === id);
	}

	create(section: ScenarioEditorSection, defaultName: string): string {
		try {
			return this.#create(section, defaultName);
		} catch (error) {
			throwScenarioEditorError(error, this.type, "invalidValue");
		}
	}

	#create(section: ScenarioEditorSection, defaultName: string): string {
		if (section === "players" && this.type === "ruleSet")
			throw expectedApplicationError("save", "ruleSet", "preconditionNotMet");
		const name = sanitizeText(defaultName).trim();
		if (!name)
			throw expectedApplicationError("save", this.type, "invalidValue");
		const previousIds = new Set(this.items(section).map(({ id }) => id));
		let result: { game: GameState };
		if (section === "teams")
			result = createTeam(this.#game, { name }, this.#language);
		else if (section === "roles") {
			const teamId = this.teamOptions()[0]?.id;
			if (!teamId)
				throw expectedApplicationError("save", this.type, "preconditionNotMet");
			result = createRole(this.#game, { name, teamId }, this.#language);
		} else if (section === "players")
			result = createPlayer(this.#game, { name }, this.#language);
		else
			result = createStatusDefinition(this.#game, {
				name,
			});
		this.#game = result.game;
		this.#dirty = true;
		return this.items(section).find(({ id }) => !previousIds.has(id))?.id ?? "";
	}

	update<Section extends ScenarioEditorSection>(
		section: Section,
		id: string,
		values: ScenarioEditorUpdateValues<Section>,
	): string {
		try {
			return this.#update(section, id, values);
		} catch (error) {
			throwScenarioEditorError(error, this.type, "invalidValue");
		}
	}

	#update<Section extends ScenarioEditorSection>(
		section: Section,
		id: string,
		values: ScenarioEditorUpdateValues<Section>,
	): string {
		const updateValues = values as GeneralEditorValues &
			Partial<RoleEditorValues>;
		const name = sanitizeText(updateValues.name).trim();
		if (!name)
			throw expectedApplicationError(
				"save",
				this.type,
				"invalidValue",
				"field=name",
			);
		const previousIds = new Set(this.items(section).map((item) => item.id));
		const current =
			section === "teams"
				? this.#game.ruleSetSnapshot.teams.find((entity) => entity.id === id)
				: section === "roles"
					? this.#game.ruleSetSnapshot.roles.find((entity) => entity.id === id)
					: section === "players"
						? this.#game.playersById[id]
						: this.#game.statusDefinitionsById[id];
		const names =
			updateValues.displayName === undefined
				? undefined
				: updateLocalizedName(
						current?.names,
						updateValues.displayName,
						this.#language,
					);
		let result: { game: GameState };
		if (section === "teams")
			result = editTeam(
				this.#game,
				{
					teamId: id,
					name,
					names,
					color: updateValues.color,
					teamOrder: updateValues.teamOrder,
				},
				this.#language,
			);
		else if (section === "roles")
			result = editRole(
				this.#game,
				{
					roleId: id,
					name,
					names,
					color: updateValues.color,
					teamId: updateValues.teamId,
					night: {
						first:
							updateValues.firstNightOrder == null
								? undefined
								: { order: updateValues.firstNightOrder },
						other:
							updateValues.otherNightOrder == null
								? undefined
								: { order: updateValues.otherNightOrder },
					},
					isUnique: updateValues.isUnique,
					unicodeEscaped: updateValues.unicodeEscaped?.trim() || null,
					kills_someone: updateValues.killsSomeone,
					resurrect_someone: updateValues.resurrectSomeone,
					apply_status_effect: updateValues.applyStatusEffect,
				},
				this.#language,
			);
		else if (section === "players")
			result = editPlayer(
				this.#game,
				{ playerId: id, name, names, color: updateValues.color },
				this.#language,
			);
		else
			result = editStatusDefinition(this.#game, {
				statusId: id,
				name,
				names,
				defaultDuration: updateValues.defaultDuration,
			});
		this.#game = result.game;
		this.#dirty = true;
		const updatedItems = this.items(section);
		if (updatedItems.some((item) => item.id === id)) return id;
		return updatedItems.find((item) => !previousIds.has(item.id))?.id ?? id;
	}

	delete(section: ScenarioEditorSection, id: string): void {
		try {
			this.#delete(section, id);
		} catch (error) {
			throwScenarioEditorError(
				error,
				this.type,
				"preconditionNotMet",
				"delete",
			);
		}
	}

	#delete(section: ScenarioEditorSection, id: string): void {
		let result: { game: GameState };
		if (section === "teams")
			result = deleteTeam(this.#game, id, this.#language);
		else if (section === "roles")
			result = deleteRole(this.#game, id, this.#language);
		else if (section === "players")
			result = deletePlayer(this.#game, id, this.#language);
		else result = deleteStatusDefinition(this.#game, id, this.#language);
		this.#game = result.game;
		this.#dirty = true;
	}

	toDocument(name = this.name, id = this.originalId): RuleSet | GameState {
		try {
			return this.#toDocument(name, id);
		} catch (error) {
			throwScenarioEditorError(error, this.type, "invalidDocument");
		}
	}

	#toDocument(name: string, id: string): RuleSet | GameState {
		this.#game = repairGameState(this.#game).document;
		const cleanName = sanitizeText(name).trim();
		if (!cleanName)
			throw expectedApplicationError(
				"save",
				this.type,
				"invalidValue",
				"field=name",
			);
		if (this.type === "ruleSet")
			return structuredClone({
				...this.#game.ruleSetSnapshot,
				id,
				name: cleanName,
			});
		return structuredClone({
			...this.#game,
			id,
			name: cleanName,
			isTemplate: this.type === "template",
		});
	}
}

function throwScenarioEditorError(
	error: unknown,
	subject: ScenarioEditorType,
	reason: ApplicationErrorReason,
	operation: "save" | "delete" = "save",
): never {
	if (error instanceof ApplicationOperationError) throw error;
	throw expectedApplicationError(
		operation,
		subject,
		reason,
		error instanceof Error ? error.message : undefined,
	);
}

export class ScenarioEditorFactory {
	fromRuleSet(ruleSet: RuleSet, language = "de"): ScenarioEditorSession {
		return executeApplicationOperationSync(
			() => ScenarioEditorSession.fromRuleSet(ruleSet, language),
			"load",
		);
	}

	fromTemplate(document: GameState, language = "de"): ScenarioEditorSession {
		return executeApplicationOperationSync(
			() => ScenarioEditorSession.fromTemplate(document, language),
			"load",
		);
	}

	fromGame(document: GameState, language = "de"): ScenarioEditorSession {
		return executeApplicationOperationSync(
			() => ScenarioEditorSession.fromGame(document, language),
			"load",
		);
	}
}

function updateLocalizedName(
	existingNames: LocalizedNames | undefined,
	displayName: string | null,
	language: string,
): LocalizedNames | null {
	const names = { ...existingNames };
	const value = displayName === null ? "" : sanitizeText(displayName).trim();
	if (value) names[language] = value;
	else delete names[language];
	return Object.keys(names).length > 0 ? names : null;
}

export function suggestScenarioCopy(
	name: string,
	type: StoredScenarioEditorType,
	existing: Array<{ id: string; name: string }>,
): { name: string; id: string } {
	return createUniqueScenarioIdentity(name, type, existing, true);
}

export function createUniqueScenarioIdentity(
	name: string,
	type: StoredScenarioEditorType,
	existing: Array<{ id: string; name: string }>,
	forceSuffix = false,
): { name: string; id: string } {
	const unavailableIds = new Set(existing.map(({ id }) => id));
	const area = type === "ruleSet" ? "ruleSet" : "template";
	for (const entry of existing)
		unavailableIds.add(createIdFromText(entry.name, area));
	return createUniqueNameAndId(name, area, unavailableIds, {
		forceSuffix,
	});
}

export function createUniqueScenarioId(
	name: string,
	type: StoredScenarioEditorType,
	existingIds: string[],
): string {
	const area = type === "ruleSet" ? "ruleSet" : "template";
	return createUniqueIdFromName(name, area, new Set(existingIds), {
		firstSuffix: 2,
	}).id;
}
