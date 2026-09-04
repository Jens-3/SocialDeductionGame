import { sanitizeText } from "../shared/textSanitizer";
import type { DomainServices } from "./domainServices";
import type { GamePlayerDraft, GamePlayerStatusDraft } from "./gameDraft";
import { createUniqueGameEntityIdFromName } from "./gameEntityIds";
import type { GameState } from "./gameFactory";
import {
	createPlayerFromDraft,
	validateGamePlayers,
	validateGameSeatOrder,
} from "./gameValidation";
import { normalizeLocalizedNameLanguageTag } from "./localizedNames";
import { changePlayerRoleState, Player } from "./models";
import { EMPTY_PLAYER_ID } from "./reservedIds";
import { replaceSeatOrder } from "./seatOrder";
import { createUniqueId } from "./stringSanitizer";

export type PlayerDraft = GamePlayerDraft;

export type MoveSeatCommand = {
	fromSeatNumber: number;
	toSeatNumber: number;
};

export type MoveShownRoleCommand = {
	playerId: string;
	fromIndex: number;
	toInsertionIndex: number;
};

export type ChangeShownRoleCommand = {
	playerId: string;
	index: number;
	roleId: string;
};

export type SavePlayerCommand = {
	originalPlayerId: string | null;
	player: PlayerDraft;
	seatNumber: number | null;
};

/** Verschiebt einen Sitzeintrag exakt von der alten auf die neue Position. */
export function moveSeat(
	game: GameState,
	command: MoveSeatCommand,
	services: DomainServices,
): GameState {
	validateSeatNumber(game, command.fromSeatNumber);
	validateSeatNumber(game, command.toSeatNumber);
	if (command.fromSeatNumber === command.toSeatNumber) return game;

	const nextSeatOrder = [...game.seatOrder];
	const movedIndex = command.fromSeatNumber - 1;
	const targetIndex = command.toSeatNumber - 1;
	const movedEntry = nextSeatOrder[movedIndex];
	if (
		movedEntry !== EMPTY_PLAYER_ID &&
		nextSeatOrder[targetIndex] === EMPTY_PLAYER_ID
	) {
		nextSeatOrder[movedIndex] = EMPTY_PLAYER_ID;
		nextSeatOrder[targetIndex] = movedEntry;
	} else {
		nextSeatOrder.splice(movedIndex, 1);
		nextSeatOrder.splice(targetIndex, 0, movedEntry);
	}

	return replaceSeatOrder(game, nextSeatOrder, services, {
		addLogEntry: false,
	});
}

/** Verschiebt eine gezeigte Rolle innerhalb der geordneten Rollenliste. */
export function moveShownRole(
	game: GameState,
	command: MoveShownRoleCommand,
): GameState {
	const player = requirePlayer(game, command.playerId);
	validateShownRoleIndex(player.roles.shownRoleIds, command.fromIndex);
	validateShownRoleInsertionIndex(
		player.roles.shownRoleIds,
		command.toInsertionIndex,
	);
	const shownRoleIds = [...player.roles.shownRoleIds];
	const oldPrimaryShownRoleId = shownRoleIds[0] ?? null;
	const [movedRoleId] = shownRoleIds.splice(command.fromIndex, 1);
	if (!movedRoleId) throw new Error("Die gezeigte Rolle existiert nicht.");
	const adjustedInsertionIndex =
		command.toInsertionIndex > command.fromIndex
			? command.toInsertionIndex - 1
			: command.toInsertionIndex;
	shownRoleIds.splice(adjustedInsertionIndex, 0, movedRoleId);
	if (
		shownRoleIds.every(
			(roleId, index) => roleId === player.roles.shownRoleIds[index],
		)
	)
		return game;
	return replacePlayerRoles(game, player, {
		...player.roles,
		shownRoleIds,
		nightRoleId:
			player.roles.nightRoleId === oldPrimaryShownRoleId ||
			player.roles.nightRoleId === null
				? (shownRoleIds[0] ?? null)
				: player.roles.nightRoleId,
	});
}

/** Ersetzt genau eine gezeigte Rolle und bewahrt die übrige Reihenfolge. */
export function changeShownRole(
	game: GameState,
	command: ChangeShownRoleCommand,
): GameState {
	const player = requirePlayer(game, command.playerId);
	validateShownRoleIndex(player.roles.shownRoleIds, command.index);
	if (!game.ruleSetSnapshot.roles.some((role) => role.id === command.roleId))
		throw new Error(`Rolle "${command.roleId}" existiert nicht.`);
	if (
		player.roles.shownRoleIds.some(
			(roleId, index) => roleId === command.roleId && index !== command.index,
		)
	)
		throw new Error(`Rolle "${command.roleId}" ist bereits ausgewählt.`);
	if (player.roles.shownRoleIds[command.index] === command.roleId) return game;
	if (command.index === 0)
		return replacePlayerRoles(
			game,
			player,
			changePlayerRoleState(player.roles, "shownRoleId", command.roleId),
		);
	const shownRoleIds = [...player.roles.shownRoleIds];
	shownRoleIds[command.index] = command.roleId;
	return replacePlayerRoles(game, player, { ...player.roles, shownRoleIds });
}

function requirePlayer(game: GameState, playerId: string): Player {
	const player = game.playersById[playerId];
	if (!player) throw new Error(`Spieler "${playerId}" existiert nicht.`);
	return player;
}

function validateShownRoleIndex(roleIds: string[], index: number): void {
	if (!Number.isInteger(index) || index < 0 || index >= roleIds.length)
		throw new Error(`Ungültige Position der gezeigten Rolle: ${index}.`);
}

function validateShownRoleInsertionIndex(
	roleIds: string[],
	index: number,
): void {
	if (!Number.isInteger(index) || index < 0 || index > roleIds.length)
		throw new Error(`Ungültige Einfügeposition der gezeigten Rolle: ${index}.`);
}

function replacePlayerRoles(
	game: GameState,
	player: Player,
	roles: Player["roles"],
): GameState {
	return {
		...game,
		playersById: {
			...game.playersById,
			[player.id]: new Player({
				id: player.id,
				name: player.name,
				names: player.names,
				color: player.color,
				lifeState: player.lifeState,
				roles,
				statuses: player.statuses.map((status) => ({ ...status })),
				note: player.note,
				removed: player.removed ? { ...player.removed } : undefined,
			}),
		},
	};
}

/**
 * Erzeugt oder aktualisiert einen Spieler und weist ihm optional einen Sitz zu.
 * player.id wird absichtlich nie ausgewertet; die ID entsteht immer aus name.
 */
export function savePlayer(
	game: GameState,
	command: SavePlayerCommand,
): GameState {
	const originalPlayer =
		command.originalPlayerId === null
			? undefined
			: game.playersById[command.originalPlayerId];
	if (command.originalPlayerId !== null && !originalPlayer)
		throw new Error(`Spieler "${command.originalPlayerId}" existiert nicht.`);

	const name = sanitizeText(command.player.name).trim();
	if (!name) throw new Error("Der Spielername darf nicht leer sein.");
	const playerId = createUniqueGameEntityIdFromName(
		name,
		game,
		"player",
		command.originalPlayerId ?? undefined,
	);
	const statuses = normalizePlayerStatuses(
		game,
		command.player.statuses,
		command.originalPlayerId,
		playerId,
	);
	const player = createPlayerFromDraft({
		id: playerId,
		name,
		names: sanitizeNames(command.player.names),
		lifeState: command.player.lifeState,
		roles: cloneRoles(command.player.roles),
		statuses,
		note: sanitizeOptionalText(command.player.note),
		removed: command.player.removed
			? {
					night: command.player.removed.night,
					phase: command.player.removed.phase,
				}
			: undefined,
	});
	const playersById = replacePlayerAndReferences(
		game,
		command.originalPlayerId,
		playerId,
		player,
	);
	const seatOrder = applyPlayerSeat(
		game.seatOrder,
		command.originalPlayerId,
		playerId,
		command.seatNumber,
	);

	validateGamePlayers(
		playersById,
		game.ruleSetSnapshot,
		game.statusDefinitionsById,
	);
	validateGameSeatOrder(seatOrder, playersById);
	return {
		...game,
		playersById,
		seatOrder,
	};
}

/** Entfernt genau einen freien Sitz, ohne Spieler zu verändern. */
export function deleteEmptySeat(
	game: GameState,
	seatNumber: number,
	services: DomainServices,
): GameState {
	const seatIndex = seatNumber - 1;
	if (
		!Number.isInteger(seatNumber) ||
		seatNumber < 1 ||
		game.seatOrder[seatIndex] !== EMPTY_PLAYER_ID
	)
		throw new Error(`Sitzplatz ${seatNumber} ist kein leerer Sitzplatz.`);
	const seatOrder = [...game.seatOrder];
	seatOrder.splice(seatIndex, 1);
	return replaceSeatOrder(game, seatOrder, services, { addLogEntry: false });
}

function normalizePlayerStatuses(
	game: GameState,
	drafts: GamePlayerStatusDraft[],
	originalPlayerId: string | null,
	newPlayerId: string,
): GamePlayerStatusDraft[] {
	const usedIds = new Set(
		Object.entries(game.playersById).flatMap(([playerId, player]) =>
			playerId === originalPlayerId
				? []
				: player.statuses.map((status) => status.id),
		),
	);
	return drafts.map((draft) => {
		const isNew = draft.id === "";
		const definition = game.statusDefinitionsById[draft.statusId];
		if (!definition)
			throw new Error(`Zustand "${draft.statusId}" existiert nicht.`);
		const id = isNew ? createUniqueStatusId(draft.statusId, usedIds) : draft.id;
		usedIds.add(id);
		const duration = readStatusDefaultDuration(definition.defaultDuration);
		const fromNight = isNew ? game.time.currentNight : draft.fromNight;
		return {
			id,
			statusId: draft.statusId,
			fromNight,
			untilNight: isNew
				? duration === 0
					? null
					: fromNight + duration - 1
				: draft.untilNight,
			source: sanitizeStatusSource(draft.source, originalPlayerId, newPlayerId),
			note: sanitizeOptionalText(draft.note),
		};
	});
}

function replacePlayerAndReferences(
	game: GameState,
	originalPlayerId: string | null,
	newPlayerId: string,
	player: Player,
): Record<string, Player> {
	const playersById: Record<string, Player> = {};
	for (const [playerId, current] of Object.entries(game.playersById)) {
		if (playerId === originalPlayerId) continue;
		playersById[playerId] = clonePlayerWithUpdatedSource(
			current,
			originalPlayerId,
			newPlayerId,
		);
	}
	playersById[newPlayerId] = player;
	return playersById;
}

function clonePlayerWithUpdatedSource(
	player: Player,
	originalPlayerId: string | null,
	newPlayerId: string,
): Player {
	return new Player({
		id: player.id,
		name: player.name,
		names: player.names,
		color: player.color,
		lifeState: player.lifeState,
		roles: { ...player.roles },
		statuses: player.statuses.map((status) => ({
			...status,
			source:
				status.source?.playerId === originalPlayerId
					? { ...status.source, playerId: newPlayerId }
					: status.source
						? { ...status.source }
						: undefined,
		})),
		note: player.note,
		removed: player.removed ? { ...player.removed } : undefined,
	});
}

function applyPlayerSeat(
	currentSeatOrder: string[],
	originalPlayerId: string | null,
	newPlayerId: string,
	targetSeatNumber: number | null,
): string[] {
	const seatOrder = [...currentSeatOrder];
	const originalIndex =
		originalPlayerId === null ? -1 : seatOrder.indexOf(originalPlayerId);
	if (originalIndex >= 0) seatOrder[originalIndex] = newPlayerId;
	if (targetSeatNumber === null) {
		if (originalIndex >= 0) seatOrder[originalIndex] = EMPTY_PLAYER_ID;
		return seatOrder;
	}
	if (
		!Number.isInteger(targetSeatNumber) ||
		targetSeatNumber < 1 ||
		targetSeatNumber > seatOrder.length + (originalIndex < 0 ? 1 : 0)
	)
		throw new Error("Die Sitzplatznummer liegt außerhalb der Sitzordnung.");

	const targetIndex = targetSeatNumber - 1;
	if (originalIndex >= 0) {
		if (originalIndex === targetIndex) return seatOrder;
		if (seatOrder[targetIndex] === EMPTY_PLAYER_ID) {
			seatOrder[originalIndex] = EMPTY_PLAYER_ID;
			seatOrder[targetIndex] = newPlayerId;
		} else {
			seatOrder.splice(originalIndex, 1);
			seatOrder.splice(targetIndex, 0, newPlayerId);
		}
		return seatOrder;
	}

	if (seatOrder[targetIndex] === EMPTY_PLAYER_ID)
		seatOrder[targetIndex] = newPlayerId;
	else seatOrder.splice(targetIndex, 0, newPlayerId);
	return seatOrder;
}

function createUniqueStatusId(statusId: string, usedIds: Set<string>): string {
	return createUniqueId(
		statusId.replace(/^d_/, ""),
		"statusInstance",
		usedIds,
		{ forceSuffix: true },
	).id;
}

function cloneRoles(roles: GamePlayerDraft["roles"]): GamePlayerDraft["roles"] {
	return {
		actualRoleId: roles.actualRoleId,
		shownRoleIds: [...roles.shownRoleIds],
		nightRoleId: roles.nightRoleId,
		claimedRoleId: roles.claimedRoleId,
	};
}

function sanitizeStatusSource(
	source: GamePlayerStatusDraft["source"],
	originalPlayerId: string | null,
	newPlayerId: string,
): GamePlayerStatusDraft["source"] {
	if (!source) return undefined;
	return {
		playerId:
			source.playerId === originalPlayerId ? newPlayerId : source.playerId,
		roleSourceType: source.roleSourceType,
		roleIdAtTime: sanitizeOptionalText(source.roleIdAtTime),
		roleNameAtTime: sanitizeOptionalText(source.roleNameAtTime),
	};
}

function sanitizeNames(
	names: GamePlayerDraft["names"],
): Record<string, string> | undefined {
	if (!names) return undefined;
	const sanitized = Object.fromEntries(
		Object.entries(names)
			.map(
				([language, name]) =>
					[
						normalizeLocalizedNameLanguageTag(language),
						sanitizeText(name).trim(),
					] as const,
			)
			.filter(([, name]) => name !== ""),
	);
	return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeOptionalText(value: string | undefined): string | undefined {
	return value === undefined
		? undefined
		: sanitizeText(value).trim() || undefined;
}

function validateSeatNumber(game: GameState, seatNumber: number): void {
	if (
		!Number.isInteger(seatNumber) ||
		seatNumber < 1 ||
		seatNumber > game.seatOrder.length
	)
		throw new Error("Die Sitzplatznummer liegt außerhalb der Sitzordnung.");
}

function readStatusDefaultDuration(value: number | undefined): number {
	return value !== undefined && Number.isInteger(value) && value >= 0
		? value
		: 1;
}
