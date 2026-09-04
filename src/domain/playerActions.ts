import type { DomainServices } from "./domainServices";
import { createUniquePlayerStatusId } from "./gameEntityIds";
import type { GameLogEntry, GameState, StatusDefinition } from "./gameFactory";
import { getDisplayName } from "./localizedNames";
import type { LifeState, PlayerStatus, Role } from "./models";

export type LifeStateAction = "kill" | "resurrect" | "spend_vote" | "gain_vote";
export type PlayerAbilityAction = "kill" | "resurrect" | "apply_status";

export type PlayerActionWarning = {
	code: string;
	parameters?: Record<string, string>;
};

export type PlayerActionResult = {
	changed: boolean;
	warning?: PlayerActionWarning;
	logEntry: GameLogEntry | null;
};

export type EditPlayerStatusParams = {
	statusId?: string;
	fromNight?: number;
	untilNight?: number | null;
	note?: string | null;
};

/** Bearbeitet eine konkrete Statusinstanz eines Spielers direkt. */
export function editPlayerStatus(
	game: GameState,
	playerId: string,
	statusInstanceId: string,
	params: EditPlayerStatusParams,
): PlayerStatus {
	const player = game.playersById[playerId];
	if (!player) throw new Error(`Spieler "${playerId}" existiert nicht.`);
	const status = player.statuses.find((entry) => entry.id === statusInstanceId);
	if (!status) {
		throw new Error(`Statusinstanz "${statusInstanceId}" existiert nicht.`);
	}
	if (
		params.statusId !== undefined &&
		!game.statusDefinitionsById[params.statusId]
	) {
		throw new Error(`Zustand "${params.statusId}" existiert nicht.`);
	}
	const fromNight =
		params.fromNight === undefined ? status.fromNight : params.fromNight;
	const untilNight =
		params.untilNight === undefined ? status.untilNight : params.untilNight;
	validatePlayerStatusInterval(fromNight, untilNight);

	if (params.statusId !== undefined) status.statusId = params.statusId;
	status.fromNight = fromNight;
	status.untilNight = untilNight;
	if (params.note !== undefined) status.note = params.note?.trim() || undefined;
	return status;
}

function validatePlayerStatusInterval(
	fromNight: number,
	untilNight: number | null,
): void {
	if (!Number.isInteger(fromNight)) {
		throw new Error("fromNight muss eine ganze Zahl sein.");
	}
	if (fromNight < 0) {
		throw new Error("fromNight darf nicht negativ sein.");
	}
	if (untilNight !== null && !Number.isInteger(untilNight)) {
		throw new Error("untilNight muss null oder eine ganze Zahl sein.");
	}
	if (untilNight !== null && untilNight < fromNight) {
		throw new Error("untilNight darf nicht vor fromNight liegen.");
	}
}

export function changePlayerLifeState(
	game: GameState,
	services: DomainServices,
	playerId: string,
	action: LifeStateAction,
	language = "de",
): PlayerActionResult {
	const player = game.playersById[playerId];
	if (!player) {
		return warningResult("PLAYER_NOT_FOUND", { playerId });
	}

	const oldStatus = player.lifeState;
	const transition = getLifeStateTransition(oldStatus, action);
	if (transition.warning) {
		return warningResult(
			transition.warning.code,
			transition.warning.parameters,
		);
	}
	if (transition.newStatus === oldStatus) {
		return unchangedResult();
	}

	player.setLifeState(transition.newStatus);
	const time = { ...game.time };
	const logEntry = createLogEntry({
		services,
		game,
		type: "player_life_state_changed",
		text: `Lebensstatus von ${getDisplayName(player, language)}: ${oldStatus} -> ${transition.newStatus}.`,
		payload: {
			playerId,
			playerName: getDisplayName(player, language),
			oldStatus,
			newStatus: transition.newStatus,
			time,
			action,
		},
	});
	appendLogEntry(game, logEntry);

	return { changed: true, logEntry };
}

export function applyStatusToPlayer(
	game: GameState,
	services: DomainServices,
	playerId: string,
	statusId: string,
	sourcePlayerId?: string,
	language = "de",
): PlayerActionResult {
	const player = game.playersById[playerId];
	if (!player) {
		return warningResult("PLAYER_NOT_FOUND", { playerId });
	}

	const definition = game.statusDefinitionsById[statusId];
	if (!definition) {
		return warningResult("STATUS_DEFINITION_NOT_FOUND", { statusId });
	}

	const duration = readDefaultDuration(definition);
	const sourcePlayer = sourcePlayerId
		? game.playersById[sourcePlayerId]
		: undefined;
	const sourceRole = sourcePlayer?.roles.actualRoleId
		? findRole(game, sourcePlayer.roles.actualRoleId)
		: undefined;
	const playerStatus: PlayerStatus = {
		id: createUniquePlayerStatusId(statusId, game),
		statusId,
		fromNight: game.time.currentNight,
		untilNight: duration === 0 ? null : game.time.currentNight + duration - 1,
		source: sourcePlayer
			? {
					playerId: sourcePlayer.id,
					roleSourceType: "actual",
					roleIdAtTime: sourceRole?.id,
					roleNameAtTime: sourceRole
						? getDisplayName(sourceRole, language)
						: undefined,
				}
			: undefined,
	};

	player.addStatus(playerStatus);
	const logEntry = createLogEntry({
		services,
		game,
		type: "player_status_applied",
		text: `Zustand ${getDisplayName(definition, language)} auf ${getDisplayName(player, language)} angewendet.`,
		payload: {
			playerId,
			playerName: getDisplayName(player, language),
			statusName: getDisplayName(definition, language),
			status: structuredClone(playerStatus),
			sourcePlayerId,
		},
	});
	appendLogEntry(game, logEntry);

	return { changed: true, logEntry };
}

export function usePlayerAbility(
	game: GameState,
	services: DomainServices,
	actorPlayerId: string,
	targetPlayerId: string,
	action?: PlayerAbilityAction,
	status?: string,
	validateAbility = true,
	language = "de",
): PlayerActionResult {
	const actor = game.playersById[actorPlayerId];
	if (!actor) {
		return warningResult("ACTOR_NOT_FOUND", { playerId: actorPlayerId });
	}
	if (!game.playersById[targetPlayerId]) {
		return warningResult("TARGET_NOT_FOUND", { playerId: targetPlayerId });
	}

	const role = actor.roles.actualRoleId
		? findRole(game, actor.roles.actualRoleId)
		: undefined;
	let selectedAction = action;

	if (!selectedAction) {
		if (!role) {
			return warningResult("ACTUAL_ROLE_NOT_FOUND", {
				playerId: actorPlayerId,
			});
		}
		const availableActions = getAvailableActions(role);
		if (availableActions.length !== 1) {
			return warningResult("ABILITY_NOT_UNAMBIGUOUS", {
				roleName: getDisplayName(role, language),
			});
		}
		selectedAction = availableActions[0];
	}

	if (validateAbility) {
		if (!role) {
			return warningResult("ACTUAL_ROLE_NOT_FOUND", {
				playerId: actorPlayerId,
			});
		}
		const permissionWarning = validateRolePermission(
			role,
			selectedAction,
			status,
			language,
		);
		if (permissionWarning) {
			return warningResult(
				permissionWarning.code,
				permissionWarning.parameters,
			);
		}
	}

	if (selectedAction === "apply_status") {
		let selectedStatus = status;
		if (!selectedStatus) {
			if (role?.apply_status_effect?.length !== 1) {
				return warningResult("STATUS_NOT_UNAMBIGUOUS");
			}
			selectedStatus = role.apply_status_effect[0];
		}
		return applyStatusToPlayer(
			game,
			services,
			targetPlayerId,
			selectedStatus,
			actorPlayerId,
			language,
		);
	}

	return changePlayerLifeState(
		game,
		services,
		targetPlayerId,
		selectedAction,
		language,
	);
}

function getLifeStateTransition(
	status: LifeState,
	action: LifeStateAction,
): { newStatus: LifeState; warning?: PlayerActionWarning } {
	const transitions: Record<
		LifeStateAction,
		Partial<Record<LifeState, LifeState>>
	> = {
		kill: {
			alive: "dead_vote_available",
			dead_vote_available: "doubledead_vote_available",
			dead_vote_spent: "doubledead_vote_spent",
		},
		resurrect: {
			doubledead_vote_available: "dead_vote_available",
			doubledead_vote_spent: "dead_vote_spent",
			dead_vote_available: "alive",
			dead_vote_spent: "alive",
		},
		spend_vote: {
			dead_vote_available: "dead_vote_spent",
			doubledead_vote_available: "doubledead_vote_spent",
		},
		gain_vote: {
			dead_vote_spent: "dead_vote_available",
			doubledead_vote_spent: "doubledead_vote_available",
		},
	};

	if (
		action === "spend_vote" &&
		(status === "dead_vote_spent" || status === "doubledead_vote_spent")
	) {
		return {
			newStatus: status,
			warning: {
				code: "VOTE_ALREADY_SPENT",
			},
		};
	}

	return { newStatus: transitions[action][status] ?? status };
}

function getAvailableActions(role: Role): PlayerAbilityAction[] {
	const actions: PlayerAbilityAction[] = [];
	if (role.kills_someone === true) actions.push("kill");
	if (role.resurrect_someone === true) actions.push("resurrect");
	if ((role.apply_status_effect?.length ?? 0) > 0) actions.push("apply_status");
	return actions;
}

function validateRolePermission(
	role: Role,
	action: PlayerAbilityAction,
	status: string | undefined,
	language: string,
): PlayerActionWarning | undefined {
	const allowed =
		(action === "kill" && role.kills_someone === true) ||
		(action === "resurrect" && role.resurrect_someone === true) ||
		(action === "apply_status" && (role.apply_status_effect?.length ?? 0) > 0);
	if (!allowed) {
		return {
			code: "ABILITY_NOT_ALLOWED",
			parameters: {
				roleName: getDisplayName(role, language),
				action,
			},
		};
	}
	if (
		action === "apply_status" &&
		status !== undefined &&
		!role.apply_status_effect?.includes(status)
	) {
		return {
			code: "STATUS_NOT_ALLOWED",
			parameters: {
				roleName: getDisplayName(role, language),
				statusId: status,
			},
		};
	}
	return undefined;
}

function findRole(game: GameState, roleId: string): Role | undefined {
	return game.ruleSetSnapshot.roles.find((role) => role.id === roleId);
}

function readDefaultDuration(definition: StatusDefinition): number {
	if (
		typeof definition.defaultDuration === "number" &&
		Number.isInteger(definition.defaultDuration) &&
		definition.defaultDuration >= 0
	)
		return definition.defaultDuration;
	return 1;
}

function createLogEntry(params: {
	services: DomainServices;
	game: GameState;
	type: string;
	text: string;
	payload: Record<string, unknown>;
}): GameLogEntry {
	const now = params.services.clock.now();
	return {
		id: params.services.idGenerator.createId("log"),
		night: params.game.time.currentNight,
		phase: params.game.time.phase,
		createdAt: now,
		type: params.type,
		actor: "storyteller",
		text: params.text,
		payload: params.payload,
	};
}

function appendLogEntry(game: GameState, logEntry: GameLogEntry): void {
	game.log.push(logEntry);
}

function unchangedResult(): PlayerActionResult {
	return { changed: false, logEntry: null };
}

function warningResult(
	code: string,
	parameters?: Record<string, string>,
): PlayerActionResult {
	return {
		changed: false,
		warning: { code, ...(parameters ? { parameters } : {}) },
		logEntry: null,
	};
}
