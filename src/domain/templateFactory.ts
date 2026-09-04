// src/domain/templateFactory.ts

import type { DomainServices } from "./domainServices";
import type { GameLogEntry, GameState } from "./gameFactory";
import { repairGameState } from "./gameRepair";
import { getDisplayName } from "./localizedNames";
import {
	Player,
	type PlayerRoleState,
	type PlayerStatus,
	type PlayerStatusSource,
} from "./models";
import { EMPTY_PLAYER_ID } from "./reservedIds";
import { renameTemplate } from "./scenarioRenaming";

export type CreateTemplateFromGameParams = {
	services: DomainServices;
	game: GameState;
	language?: string;

	/**
	 * Optionaler neuer Vorlagenname.
	 * Wenn nicht gesetzt: "<alter Name> Vorlage"
	 */
	name?: string;
};

export type TemplateFactoryWarning = {
	code: string;
	message: string;
};

export type CreateTemplateFromGameResult = {
	template: GameState;
	warnings: TemplateFactoryWarning[];
	message: string;
};

export function createTemplateFromGame(
	params: CreateTemplateFromGameParams,
): CreateTemplateFromGameResult {
	const repairedGame = repairGameState(params.game, "game");
	const game = repairedGame.document;
	const warnings: TemplateFactoryWarning[] = [];

	if (repairedGame.report.changeCount > 0) {
		const problemLabel =
			repairedGame.report.changeCount === 1 ? "ID-Problem" : "ID-Probleme";
		warnings.push({
			code: "IDS_REPAIRED",
			message: `Vor der Template-Erstellung wurden ${repairedGame.report.changeCount} ${problemLabel} im Spiel repariert.`,
		});
	}

	validateGameForTemplateCreation(game);

	const now = params.services.clock.now();

	const language = params.language ?? "de";
	const finalOldPlayerIds = createFinalPlayerOrder(game, warnings, language);
	const playerIdMap = createAnonymizedPlayerIdMap(finalOldPlayerIds);

	const setupStatusesByOldPlayerId = collectSetupStatusesByOldPlayerId(
		game,
		warnings,
	);

	const nextPlayersById: Record<string, Player> = {};
	const nextSeatOrder: string[] = [];

	for (let index = 0; index < finalOldPlayerIds.length; index++) {
		const oldPlayerId = finalOldPlayerIds[index];
		if (oldPlayerId === EMPTY_PLAYER_ID) {
			nextSeatOrder.push(EMPTY_PLAYER_ID);
			continue;
		}
		const oldPlayer = game.playersById[oldPlayerId];

		if (!oldPlayer) {
			warnings.push({
				code: "MISSING_PLAYER_SKIPPED",
				message: `Spieler "${oldPlayerId}" wurde in der Reihenfolge gefunden, existiert aber nicht in playersById und wurde übersprungen.`,
			});
			continue;
		}

		const newPlayerId = playerIdMap[oldPlayerId];

		const setupStatuses = setupStatusesByOldPlayerId[oldPlayerId] ?? [];

		const anonymizedStatuses = setupStatuses.map((status) =>
			remapPlayerStatus(status, playerIdMap),
		);

		const newPlayer = new Player({
			id: newPlayerId,
			name: `Player ${index + 1}`,
			color: oldPlayer.color,
			lifeState: "alive",
			roles: clonePlayerRoleState(oldPlayer.roles),
			statuses: anonymizedStatuses,
			note: oldPlayer.note,
			removed: undefined,
		});

		nextPlayersById[newPlayerId] = newPlayer;
		nextSeatOrder.push(newPlayerId);
	}

	const template = renameTemplate(
		{
			...game,
			id: "template_pending",
			name: `${game.name} Vorlage`,
			isTemplate: true,

			createdAt: now,

			playersById: nextPlayersById,
			seatOrder: nextSeatOrder,

			time: {
				currentNight: 0,
				phase: "setup",
			},

			log: [],
		},
		params.name ?? `${game.name} Vorlage`,
	);

	return {
		template,
		warnings,
		message: `Vorlage ${getDisplayName(template, language)} aus Spielstand ${getDisplayName(game, language)} erstellt.`,
	};
}

// Spielerreihenfolge herstellen
// Archivierte Spieler werden ans Ende der Sitz-/Zugreihenfolge gesetzt.
function createFinalPlayerOrder(
	game: GameState,
	warnings: TemplateFactoryWarning[],
	language: string,
): string[] {
	const seatedPlayerIds = [...game.seatOrder];

	const seatedSet = new Set(seatedPlayerIds);

	const archivedOrUnseatedPlayerIds = Object.values(game.playersById)
		.filter((player) => !seatedSet.has(player.id))
		.sort(comparePlayersForTemplateReinsertion)
		.map((player) => player.id);

	for (const playerId of archivedOrUnseatedPlayerIds) {
		const player = game.playersById[playerId];

		if (player?.removed) {
			warnings.push({
				code: "ARCHIVED_PLAYER_REINSERTED",
				message: `Archivierter Spieler "${getDisplayName(player, language)}" wurde am Ende der Reihenfolge wieder eingesetzt.`,
			});
		} else {
			warnings.push({
				code: "UNSEATED_PLAYER_REINSERTED",
				message: `Nicht sitzender Spieler "${player ? getDisplayName(player, language) : playerId}" wurde am Ende der Reihenfolge eingesetzt.`,
			});
		}
	}

	return [...seatedPlayerIds, ...archivedOrUnseatedPlayerIds];
}

function comparePlayersForTemplateReinsertion(a: Player, b: Player): number {
	const removedA = a.removed;
	const removedB = b.removed;

	if (removedA && removedB) {
		if (removedA.night !== removedB.night) {
			return removedA.night - removedB.night;
		}

		return phaseOrder(removedA.phase) - phaseOrder(removedB.phase);
	}

	if (removedA && !removedB) return -1;
	if (!removedA && removedB) return 1;

	return naturalCompare(a.id, b.id);
}

function phaseOrder(phase: "setup" | "night" | "day"): number {
	switch (phase) {
		case "setup":
			return 0;
		case "night":
			return 1;
		case "day":
			return 2;
	}
}

// Spieler-IDs anonymisieren
function createAnonymizedPlayerIdMap(
	oldPlayerIds: string[],
): Record<string, string> {
	const result: Record<string, string> = {};

	for (let index = 0; index < oldPlayerIds.length; index++) {
		if (oldPlayerIds[index] === EMPTY_PLAYER_ID) continue;
		result[oldPlayerIds[index]] = `p_player${index + 1}`;
	}

	return result;
}

// Setup-Zustände sammeln
// Regel:
// 1. Aktuelle Spielerzustände mit fromNight === 0 bleiben erhalten.
// 2. Zusätzlich werden Setup-Zustände aus dem Log wiederhergestellt.
// 3. Doppelte Statusinstanzen werden über status.id vermieden.
// 4. Statusquellen werden auf die neuen anonymisierten Spieler-IDs umgebogen.

function collectSetupStatusesByOldPlayerId(
	game: GameState,
	warnings: TemplateFactoryWarning[],
): Record<string, PlayerStatus[]> {
	const result: Record<string, PlayerStatus[]> = {};

	for (const player of Object.values(game.playersById)) {
		const setupStatuses = player.statuses.filter(
			(status) => status.fromNight === 0,
		);

		for (const status of setupStatuses) {
			addStatusIfMissing(result, player.id, clonePlayerStatus(status));
		}
	}

	for (const logEntry of game.log) {
		if (!isSetupLogEntry(logEntry)) {
			continue;
		}

		const extracted = extractSetupStatusFromLogEntry(logEntry);

		if (!extracted) {
			continue;
		}

		if (!game.playersById[extracted.playerId]) {
			warnings.push({
				code: "SETUP_STATUS_LOG_PLAYER_MISSING",
				message: `Setup-Zustand aus Logeintrag "${logEntry.id}" verweist auf unbekannten Spieler "${extracted.playerId}" und wurde ignoriert.`,
			});
			continue;
		}

		addStatusIfMissing(
			result,
			extracted.playerId,
			normalizeStatusAsSetup(clonePlayerStatus(extracted.status)),
		);
	}

	return result;
}

function isSetupLogEntry(logEntry: GameLogEntry): boolean {
	return logEntry.night === 0 && logEntry.phase === "setup";
}

// Status aus Logeintrag extrahieren
function extractSetupStatusFromLogEntry(
	logEntry: GameLogEntry,
): { playerId: string; status: PlayerStatus } | null {
	if (!isRecord(logEntry.payload)) {
		return null;
	}

	const payload = logEntry.payload;

	const playerId =
		typeof payload.playerId === "string" ? payload.playerId : undefined;

	if (!playerId) {
		return null;
	}

	if (isPlayerStatus(payload.status)) {
		return {
			playerId,
			status: payload.status,
		};
	}

	if (isPlayerStatus(payload.playerStatus)) {
		return {
			playerId,
			status: payload.playerStatus,
		};
	}

	const flatStatus = tryExtractFlatPlayerStatus(payload);

	if (flatStatus) {
		return {
			playerId,
			status: flatStatus,
		};
	}

	return null;
}

function tryExtractFlatPlayerStatus(
	payload: Record<string, unknown>,
): PlayerStatus | null {
	const id =
		typeof payload.statusInstanceId === "string"
			? payload.statusInstanceId
			: typeof payload.id === "string"
				? payload.id
				: undefined;

	const statusId =
		typeof payload.statusId === "string" ? payload.statusId : undefined;

	if (!id || !statusId) {
		return null;
	}

	const fromNight =
		typeof payload.fromNight === "number" && Number.isInteger(payload.fromNight)
			? payload.fromNight
			: 0;

	const untilNight =
		payload.untilNight === null
			? null
			: typeof payload.untilNight === "number" &&
					Number.isInteger(payload.untilNight)
				? payload.untilNight
				: 0;

	return {
		id,
		statusId,
		fromNight,
		untilNight,
		source: isPlayerStatusSource(payload.source) ? payload.source : undefined,
		note: typeof payload.note === "string" ? payload.note : undefined,
	};
}

// Status normalisieren und deduplizieren
function normalizeStatusAsSetup(status: PlayerStatus): PlayerStatus {
	return {
		...status,
		fromNight: 0,
	};
}

function addStatusIfMissing(
	target: Record<string, PlayerStatus[]>,
	playerId: string,
	status: PlayerStatus,
): void {
	if (!target[playerId]) {
		target[playerId] = [];
	}

	const alreadyExists = target[playerId].some(
		(existingStatus) => existingStatus.id === status.id,
	);

	if (!alreadyExists) {
		target[playerId].push(status);
	}
}

// Status klonen und Spielerreferenzen umbiegen
function clonePlayerStatus(status: PlayerStatus): PlayerStatus {
	return {
		id: status.id,
		statusId: status.statusId,
		fromNight: status.fromNight,
		untilNight: status.untilNight,
		source: status.source
			? {
					playerId: status.source.playerId,
					roleSourceType: status.source.roleSourceType,
					roleIdAtTime: status.source.roleIdAtTime,
					roleNameAtTime: status.source.roleNameAtTime,
				}
			: undefined,
		note: status.note,
	};
}

function remapPlayerStatus(
	status: PlayerStatus,
	playerIdMap: Record<string, string>,
): PlayerStatus {
	return {
		...status,
		source: status.source
			? remapPlayerStatusSource(status.source, playerIdMap)
			: undefined,
	};
}

function remapPlayerStatusSource(
	source: PlayerStatusSource,
	playerIdMap: Record<string, string>,
): PlayerStatusSource {
	return {
		...source,
		playerId: playerIdMap[source.playerId] ?? source.playerId,
	};
}

// Validierung und Type Guards
function validateGameForTemplateCreation(game: GameState): void {
	if (!isRecord(game)) {
		throw new Error("game muss ein Objekt sein.");
	}

	if (!isRecord(game.playersById)) {
		throw new Error("game.playersById muss ein Objekt sein.");
	}

	if (!Array.isArray(game.seatOrder)) {
		throw new Error("game.seatOrder muss ein Array sein.");
	}

	if (!Array.isArray(game.log)) {
		throw new Error("game.log muss ein Array sein.");
	}

	const seenSeatIds = new Set<string>();
	if (game.playersById[EMPTY_PLAYER_ID]) {
		throw new Error(
			`Die reservierte ID "${EMPTY_PLAYER_ID}" darf keinem Player-Objekt gehören.`,
		);
	}

	for (const playerId of game.seatOrder) {
		if (playerId === EMPTY_PLAYER_ID) continue;
		if (seenSeatIds.has(playerId)) {
			throw new Error(`seatOrder enthält Spieler "${playerId}" mehrfach.`);
		}

		if (!game.playersById[playerId]) {
			throw new Error(
				`seatOrder verweist auf unbekannten Spieler "${playerId}".`,
			);
		}

		seenSeatIds.add(playerId);
	}
}

function isPlayerStatus(value: unknown): value is PlayerStatus {
	if (!isRecord(value)) {
		return false;
	}

	if (typeof value.id !== "string") return false;
	if (typeof value.statusId !== "string") return false;
	if (
		typeof value.fromNight !== "number" ||
		!Number.isInteger(value.fromNight)
	) {
		return false;
	}

	if (
		value.untilNight !== null &&
		(typeof value.untilNight !== "number" ||
			!Number.isInteger(value.untilNight))
	) {
		return false;
	}

	if (value.source !== undefined && !isPlayerStatusSource(value.source)) {
		return false;
	}

	if (value.note !== undefined && typeof value.note !== "string") {
		return false;
	}

	return true;
}

function isPlayerStatusSource(value: unknown): value is PlayerStatusSource {
	if (!isRecord(value)) {
		return false;
	}

	if (typeof value.playerId !== "string") {
		return false;
	}

	if (
		value.roleSourceType !== undefined &&
		value.roleSourceType !== "actual" &&
		value.roleSourceType !== "shown" &&
		value.roleSourceType !== "night" &&
		value.roleSourceType !== "none"
	) {
		return false;
	}

	if (
		value.roleIdAtTime !== undefined &&
		typeof value.roleIdAtTime !== "string"
	) {
		return false;
	}

	if (
		value.roleNameAtTime !== undefined &&
		typeof value.roleNameAtTime !== "string"
	) {
		return false;
	}

	return true;
}

function clonePlayerRoleState(roles: PlayerRoleState): PlayerRoleState {
	return {
		actualRoleId: roles.actualRoleId,
		shownRoleIds: [...roles.shownRoleIds],
		nightRoleId: roles.nightRoleId,
		claimedRoleId: roles.claimedRoleId,
	};
}

function naturalCompare(a: string, b: string): number {
	return a.localeCompare(b, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
