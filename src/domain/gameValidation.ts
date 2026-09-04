import { type HexColor, isHexColor } from "./color";
import {
	DomainOperationError,
	domainFailure,
	isDomainOperationError,
} from "./domainFailure";
import type {
	GameDraft,
	GameLogEntryDraft,
	GamePlayerDraft,
	GamePlayerStatusDraft,
} from "./gameDraft";
import type {
	GameLogEntry,
	GamePhase,
	GameState,
	StatusDefinition,
} from "./gameFactory";
import { repairIds } from "./gameIdRepair";
import {
	type LifeState,
	type LocalizedNames,
	Player,
	type PlayerStatus,
	type PlayerStatusSource,
	type RoleSourceType,
} from "./models";
import { EMPTY_PLAYER_ID } from "./reservedIds";
import type { RuleSet, RuleSetDraft } from "./ruleSet";
import { createRuleSetFromDraft } from "./ruleSetValidation";
import { createIdFromText, type IdArea, isIdForArea } from "./stringSanitizer";

export class GameRuleSetValidationError extends DomainOperationError {
	constructor(cause: DomainOperationError) {
		super({ ...cause.failure, componentKind: "ruleSet" });
		this.name = "GameRuleSetValidationError";
	}
}

/** Prüft einen Game-Draft fachlich und erzeugt einen vollständig hydrierten GameState. */
export function hydrateGameState(source: GameDraft | GameState): GameState {
	return hydrateGameStateUnchecked(source);
}

function hydrateGameStateUnchecked(source: GameDraft | GameState): GameState {
	const draft = toGameDraft(source);
	const gameArea: IdArea = draft.isTemplate ? "template" : "game";
	assertId(draft.id, "game.id", gameArea);
	assertText(draft.name, "game.name");
	assertLocalizedNames(draft.names, "game.names");

	let ruleSetSnapshot: RuleSet;
	try {
		ruleSetSnapshot = createRuleSetFromDraft(draft.ruleSetSnapshot, {
			mode: "stored",
		}).ruleSet;
	} catch (error) {
		if (!isDomainOperationError(error)) throw error;
		throw new GameRuleSetValidationError(error);
	}
	const statusDefinitionsById = createStatusDefinitionRecord(ruleSetSnapshot);
	const playersById = hydratePlayers(draft.players);
	validateGamePlayers(playersById, ruleSetSnapshot, statusDefinitionsById);
	validateGameSeatOrder(draft.seatOrder, playersById);
	validateRolesForShowing(draft.rolesForShowing?.roles, ruleSetSnapshot);

	return {
		id: draft.id,
		name: draft.name,
		names: cloneLocalizedNames(draft.names),
		isTemplate: draft.isTemplate,
		createdAt: draft.createdAt,
		ruleSetSnapshot,
		statusDefinitionsById,
		playersById,
		seatOrder: [...draft.seatOrder],
		time: normalizeGameTime(draft.time.currentNight, draft.time.phase),
		log: hydrateLog(draft.log),
		rolesForShowing: draft.rolesForShowing
			? {
					roles: [...draft.rolesForShowing.roles],
					notice: draft.rolesForShowing.notice,
					showRoleSymbols: draft.rolesForShowing.showRoleSymbols ?? false,
				}
			: undefined,
	};
}

function toGameDraft(source: GameDraft | GameState): GameDraft {
	if ("players" in source) return source;
	const {
		playersById,
		statusDefinitionsById: _derivedStatuses,
		...draft
	} = source;
	void _derivedStatuses;
	return {
		...draft,
		players: Object.values(playersById),
	};
}

/** Erzeugt ausschließlich im RAM eine unabhängige Game-Kopie einer Vorlage. */
export function convertTemplateToGame(template: GameState): GameState {
	const validatedTemplate = hydrateGameState(structuredClone(template));
	if (!validatedTemplate.isTemplate)
		throw invalidGame("Das Dokument ist keine Vorlage.", false);
	return hydrateGameState({
		...validatedTemplate,
		isTemplate: false,
		id: createIdFromText(validatedTemplate.name, "game"),
	});
}

/**
 * Repariert die IDs einer unabhängigen Draft-Kopie vor ihrer fachlichen
 * Validierung. Ein String bezeichnet einen nicht reparierbaren Fehler.
 */
export type GameDraftRepairResult = {
	draft: GameDraft;
	changeCount: number;
};

/** Repariert einen einzelnen Game-/Template-Draft samt Änderungszahl. */
export function repairGameDraft(
	draft: GameDraft,
): GameDraftRepairResult | string {
	const cloned = structuredClone(draft);
	const repairable = {
		...cloned,
		statusDefinitionsById: createStatusDefinitionRecord(cloned.ruleSetSnapshot),
		playersById: createRepairablePlayerRecord(cloned.players),
	} as unknown as GameState;
	const result = repairIds(repairable);
	if (typeof result === "string") return result;
	const {
		playersById,
		statusDefinitionsById: _derivedStatuses,
		...repairedDraft
	} = repairable;
	void _derivedStatuses;
	return {
		draft: {
			...repairedDraft,
			players: Object.values(playersById),
		},
		changeCount: result,
	};
}

function createRepairablePlayerRecord(
	players: GamePlayerDraft[],
): Record<string, GamePlayerDraft> {
	const result: Record<string, GamePlayerDraft> = {};
	for (const [index, player] of players.entries()) {
		let recordId = player.id;
		while (result[recordId]) recordId = `${player.id}_duplicate_${index + 1}`;
		result[recordId] = player;
	}
	return result;
}

/** Hydriert und prüft jedes RuleSet über dieselbe fachliche Domain-Grenze. */
export function hydrateRuleSet(draft: RuleSetDraft): RuleSet {
	return createRuleSetFromDraft(draft).ruleSet;
}

function createStatusDefinitionRecord(
	ruleSet: RuleSetDraft | RuleSet,
): Record<string, StatusDefinition> {
	return Object.fromEntries(
		(ruleSet.statuses ?? []).map((definition) => [
			definition.id,
			{
				...definition,
				names: cloneLocalizedNames(definition.names),
			},
		]),
	);
}

function hydratePlayers(drafts: GamePlayerDraft[]): Record<string, Player> {
	const playerIds = new Set<string>();
	return Object.fromEntries(
		drafts.map((draft, playerIndex) => {
			const label = `players[${playerIndex}]`;
			assertId(draft.id, `${label}.id`, "player");
			if (playerIds.has(draft.id))
				throw invalidGame(
					`Spielstand ungültig: Doppelte Spieler-ID "${draft.id}".`,
					true,
				);
			playerIds.add(draft.id);
			return [draft.id, createPlayerFromDraft(draft, label)];
		}),
	);
}

/** Prüft einen einzelnen PlayerDraft und erzeugt daraus ein Domain-Objekt. */
export function createPlayerFromDraft(
	draft: GamePlayerDraft,
	label = "player",
): Player {
	assertId(draft.id, `${label}.id`, "player");
	assertText(draft.name, `${label}.name`);
	assertLocalizedNames(draft.names, `${label}.names`);
	return new Player({
		id: draft.id,
		name: draft.name,
		names: draft.names,
		color: validatedColor(draft.color, `${label}.color`),
		lifeState: validatedLifeState(draft.lifeState, `${label}.lifeState`),
		roles: { ...draft.roles },
		statuses: draft.statuses.map((status, index) =>
			hydratePlayerStatus(status, `${label}.statuses[${index}]`),
		),
		note: draft.note,
		removed: draft.removed
			? {
					night: validatedWholeNumber(
						draft.removed.night,
						`${label}.removed.night`,
						0,
					),
					phase: validatedPhase(draft.removed.phase, `${label}.removed.phase`),
				}
			: undefined,
	});
}

function hydratePlayerStatus(
	draft: GamePlayerStatusDraft,
	label: string,
): PlayerStatus {
	assertId(draft.id, `${label}.id`, "statusInstance");
	assertId(draft.statusId, `${label}.statusId`, "statusDefinition");
	assertWholeNumber(draft.fromNight, `${label}.fromNight`, 0);
	if (draft.untilNight !== null) {
		assertWholeNumber(draft.untilNight, `${label}.untilNight`, draft.fromNight);
	}
	return {
		id: draft.id,
		statusId: draft.statusId,
		fromNight: draft.fromNight,
		untilNight: draft.untilNight,
		source: draft.source
			? hydratePlayerStatusSource(draft.source, `${label}.source`)
			: undefined,
		note: draft.note,
	};
}

function hydratePlayerStatusSource(
	draft: NonNullable<GamePlayerStatusDraft["source"]>,
	label: string,
): PlayerStatusSource {
	assertId(draft.playerId, `${label}.playerId`, "player");
	if (draft.roleIdAtTime !== undefined)
		assertId(draft.roleIdAtTime, `${label}.roleIdAtTime`, "role");
	return {
		playerId: draft.playerId,
		roleSourceType:
			draft.roleSourceType === undefined
				? undefined
				: validatedRoleSourceType(
						draft.roleSourceType,
						`${label}.roleSourceType`,
					),
		roleIdAtTime: draft.roleIdAtTime,
		roleNameAtTime: draft.roleNameAtTime,
	};
}

/** Prüft die spielweiten IDs und Referenzen einer Player-Sammlung. */
export function validateGamePlayers(
	players: Record<string, Player>,
	ruleSet: RuleSet,
	statusDefinitions: Record<string, StatusDefinition>,
): void {
	const statusIds = new Set<string>();
	const roleIds = new Set(ruleSet.roles.map((role) => role.id));
	for (const player of Object.values(players)) {
		for (const [field, roleId] of Object.entries(player.roles)) {
			if (field === "shownRoleIds") {
				if (
					new Set(player.roles.shownRoleIds).size !==
					player.roles.shownRoleIds.length
				)
					throw invalidGame(
						`Spielstand ungültig: Spieler "${player.id}" enthält doppelte gezeigte Rollen.`,
						true,
					);
				for (const shownRoleId of player.roles.shownRoleIds)
					if (!roleIds.has(shownRoleId))
						throw invalidGame(
							`Spielstand ungültig: Spieler "${player.id}" verweist in ${field} auf unbekannte Rolle "${shownRoleId}".`,
							true,
						);
				continue;
			}
			if (typeof roleId === "string" && !roleIds.has(roleId))
				throw invalidGame(
					`Spielstand ungültig: Spieler "${player.id}" verweist in ${field} auf unbekannte Rolle "${roleId}".`,
					true,
				);
		}
		for (const status of player.statuses) {
			if (statusIds.has(status.id))
				throw invalidGame(
					`Spielstand ungültig: Doppelte Statusinstanz-ID "${status.id}".`,
					true,
				);
			statusIds.add(status.id);
			if (!statusDefinitions[status.statusId])
				throw invalidGame(
					`Spielstand ungültig: Statusinstanz "${status.id}" verweist auf unbekannte Statusdefinition "${status.statusId}".`,
					true,
				);
		}
	}
}

/** Prüft eine Sitzordnung gegen die vorhandenen Domain-Spieler. */
export function validateGameSeatOrder(
	seatOrder: string[],
	players: Record<string, Player>,
): void {
	const seen = new Set<string>();
	for (const playerId of seatOrder) {
		if (playerId === EMPTY_PLAYER_ID) continue;
		assertId(playerId, "seatOrder", "player");
		if (!players[playerId])
			throw invalidGame(
				`Spielstand ungültig: seatOrder verweist auf unbekannten Spieler "${playerId}".`,
				true,
			);
		if (seen.has(playerId))
			throw invalidGame(
				`Spielstand ungültig: Spieler "${playerId}" steht mehrfach in seatOrder.`,
				true,
			);
		seen.add(playerId);
	}
}

function validateRolesForShowing(
	roleIds: string[] | undefined,
	ruleSet: RuleSet,
): void {
	if (!roleIds) return;
	const available = new Set(ruleSet.roles.map((role) => role.id));
	for (const roleId of roleIds) {
		assertId(roleId, "rolesForShowing.roles", "role");
		if (!available.has(roleId))
			throw invalidGame(
				`Spielstand ungültig: rolesForShowing verweist auf unbekannte Rolle "${roleId}".`,
				false,
			);
	}
}

function hydrateLog(drafts: GameLogEntryDraft[]): GameLogEntry[] {
	const ids = new Set<string>();
	return drafts.map((draft, index) => {
		const label = `log[${index}]`;
		assertId(draft.id, `${label}.id`, "log");
		if (ids.has(draft.id))
			throw invalidGame(
				`Spielstand ungültig: Doppelte Log-ID "${draft.id}".`,
				true,
			);
		ids.add(draft.id);
		assertWholeNumber(draft.night, `${label}.night`, 0);
		assertText(draft.createdAt, `${label}.createdAt`);
		assertText(draft.type, `${label}.type`);
		return {
			id: draft.id,
			night: draft.night,
			phase: validatedPhase(draft.phase, `${label}.phase`),
			createdAt: draft.createdAt,
			type: draft.type,
			actor: validatedLogActor(draft.actor, `${label}.actor`),
			text: draft.text,
			payload: draft.payload ? structuredClone(draft.payload) : undefined,
		};
	});
}

function normalizeGameTime(
	currentNight: number,
	phase: string,
): GameState["time"] {
	assertWholeNumber(currentNight, "time.currentNight", 0);
	const validPhase = validatedPhase(phase, "time.phase");
	if (currentNight === 0) return { currentNight: 0, phase: "setup" };
	if (validPhase === "setup") return { currentNight, phase: "night" };
	return { currentNight, phase: validPhase };
}

function assertId(value: string, label: string, area: IdArea): void {
	if (!isIdForArea(value, area))
		throw invalidGame(
			`Spielstand ungültig: ${label} hat keine gültige ${area}-ID.`,
			true,
		);
}

function assertText(value: string, label: string): void {
	if (!value.trim())
		throw invalidGame(
			`Spielstand ungültig: ${label} darf nicht leer sein.`,
			false,
		);
}

function validatedWholeNumber(
	value: number,
	label: string,
	minimum?: number,
): number {
	assertWholeNumber(value, label, minimum);
	return value;
}

function assertWholeNumber(
	value: number,
	label: string,
	minimum?: number,
): void {
	if (!Number.isInteger(value) || (minimum !== undefined && value < minimum))
		throw invalidGame(
			`Spielstand ungültig: ${label} muss eine ganze Zahl${minimum === undefined ? "" : ` >= ${minimum}`} sein.`,
			false,
		);
}

function validatedPhase(value: string, label: string): GamePhase {
	if (value === "setup" || value === "night" || value === "day") return value;
	throw invalidGame(
		`Spielstand ungültig: ${label} hat den ungültigen Wert "${value}".`,
		false,
	);
}

function validatedLifeState(value: string, label: string): LifeState {
	if (
		value === "alive" ||
		value === "dead_vote_available" ||
		value === "dead_vote_spent" ||
		value === "doubledead_vote_available" ||
		value === "doubledead_vote_spent"
	)
		return value;
	throw invalidGame(
		`Spielstand ungültig: ${label} hat den ungültigen Wert "${value}".`,
		false,
	);
}

function validatedRoleSourceType(value: string, label: string): RoleSourceType {
	if (
		value === "actual" ||
		value === "shown" ||
		value === "night" ||
		value === "none"
	)
		return value;
	throw invalidGame(
		`Spielstand ungültig: ${label} hat den ungültigen Wert "${value}".`,
		false,
	);
}

function validatedColor(
	value: string | undefined,
	label: string,
): HexColor | undefined {
	if (value === undefined || isHexColor(value)) return value;
	throw invalidGame(
		`Spielstand ungültig: ${label} muss aus genau sechs Zeichen von 0-9 oder A-F bestehen.`,
		true,
	);
}

function validatedLogActor(
	value: string | undefined,
	label: string,
): GameLogEntry["actor"] {
	if (value === undefined || value === "system" || value === "storyteller")
		return value;
	throw invalidGame(
		`Spielstand ungültig: ${label} hat den ungültigen Wert "${value}".`,
		false,
	);
}

function assertLocalizedNames(
	names: LocalizedNames | undefined,
	label: string,
): void {
	for (const languageCode of Object.keys(names ?? {})) {
		if (!languageCode.trim())
			throw invalidGame(
				`Spielstand ungültig: ${label} enthält einen leeren Sprachcode.`,
				false,
			);
	}
}

function invalidGame(
	details: string,
	repairable: boolean,
): DomainOperationError {
	return domainFailure("validate", "invalidObject", repairable, details);
}

function cloneLocalizedNames(
	names: LocalizedNames | undefined,
): LocalizedNames | undefined {
	return names ? { ...names } : undefined;
}
