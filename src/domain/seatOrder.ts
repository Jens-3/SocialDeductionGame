// src/domain/seatOrder.ts

import type { DomainServices } from "./domainServices";
import type { GameLogEntry, GameState } from "./gameFactory";
import type { Instant } from "./instant";
import { getDisplayName } from "./localizedNames";
import { EMPTY_PLAYER_ID } from "./reservedIds";

export type SeatOrderOptions = {
	language?: string;

	/**
	 * Standard: true.
	 * In Vorlagen wird trotzdem nicht geloggt.
	 */
	addLogEntry?: boolean;
};

export type ShufflePlayersOptions = SeatOrderOptions & {
	/** Optional für deterministische Tests. Standard: Math.random. */
	rng?: () => number;
};

export type SeatEntry = {
	seatNumber: number;
	playerId: string;
	playerName: string;
};

export function getSeatNumber(
	game: GameState,
	playerId: string,
): number | null {
	validateSeatOrderIntegrity(game);

	const index = game.seatOrder.indexOf(playerId);

	if (index === -1) {
		return null;
	}

	return index + 1;
}

export function getPlayerIdAtSeat(
	game: GameState,
	seatNumber: number,
): string | null {
	validateSeatOrderIntegrity(game);
	validateSeatNumberForRead(game, seatNumber);

	return game.seatOrder[seatNumber - 1] ?? null;
}

export function getSeatEntries(game: GameState, language = "de"): SeatEntry[] {
	validateSeatOrderIntegrity(game);

	return game.seatOrder.map((playerId, index) => {
		if (playerId === EMPTY_PLAYER_ID) {
			return {
				seatNumber: index + 1,
				playerId,
				playerName: "",
			};
		}
		const player = game.playersById[playerId];

		if (!player) {
			throw new Error(
				`Sitzordnung ungültig: Sitz ${index + 1} verweist auf unbekannten Spieler "${playerId}".`,
			);
		}

		return {
			seatNumber: index + 1,
			playerId,
			playerName: getDisplayName(player, language),
		};
	});
}

// Spieler an bestimmten Sitz verschieben
// Diese Funktion verschiebt einen bereits sitzenden Spieler auf einen neuen Sitz. Andere Spieler rücken entsprechend nach.
export function movePlayerToSeat(
	game: GameState,
	playerId: string,
	targetSeatNumber: number,
	services: DomainServices,
	options: SeatOrderOptions = {},
): GameState {
	validateSeatOrderIntegrity(game);
	validateExistingSeatedPlayer(game, playerId);
	validateSeatNumberForMove(game, targetSeatNumber);

	const oldSeatOrder = [...game.seatOrder];
	const oldIndex = oldSeatOrder.indexOf(playerId);
	const targetIndex = targetSeatNumber - 1;

	if (oldIndex === targetIndex) {
		return game;
	}

	const nextSeatOrder = [...oldSeatOrder];
	if (oldSeatOrder[targetIndex] === EMPTY_PLAYER_ID) {
		nextSeatOrder[oldIndex] = EMPTY_PLAYER_ID;
		nextSeatOrder[targetIndex] = playerId;
	} else {
		nextSeatOrder.splice(oldIndex, 1);
		nextSeatOrder.splice(targetIndex, 0, playerId);
	}

	return createGameWithUpdatedSeatOrder({
		game,
		oldSeatOrder,
		nextSeatOrder,
		services,
		options,
		logText: `Spieler ${getPlayerLabel(game, playerId, options.language ?? "de")} von Sitz ${oldIndex + 1} auf Sitz ${targetSeatNumber} verschoben.`,
		logType: "seat_order_changed",
		payload: {
			action: "move",
			playerId,
			playerName: getPlayerDisplayName(
				game,
				playerId,
				options.language ?? "de",
			),
			fromSeat: oldIndex + 1,
			toSeat: targetSeatNumber,
		},
	});
}

// Zwei Sitze tauschen
export function swapSeats(
	game: GameState,
	seatNumberA: number,
	seatNumberB: number,
	services: DomainServices,
	options: SeatOrderOptions = {},
): GameState {
	validateSeatOrderIntegrity(game);
	validateSeatNumberForRead(game, seatNumberA);
	validateSeatNumberForRead(game, seatNumberB);

	if (seatNumberA === seatNumberB) {
		return game;
	}

	const oldSeatOrder = [...game.seatOrder];
	const nextSeatOrder = [...oldSeatOrder];

	const indexA = seatNumberA - 1;
	const indexB = seatNumberB - 1;

	const playerA = nextSeatOrder[indexA];
	const playerB = nextSeatOrder[indexB];

	nextSeatOrder[indexA] = playerB;
	nextSeatOrder[indexB] = playerA;

	return createGameWithUpdatedSeatOrder({
		game,
		oldSeatOrder,
		nextSeatOrder,
		services,
		options,
		logText: `Sitz ${seatNumberA} und Sitz ${seatNumberB} getauscht.`,
		logType: "seat_order_changed",
		payload: {
			action: "swap",
			seatA: seatNumberA,
			seatB: seatNumberB,
			playerAId: playerA,
			playerAName: getPlayerDisplayName(
				game,
				playerA,
				options.language ?? "de",
			),
			playerBId: playerB,
			playerBName: getPlayerDisplayName(
				game,
				playerB,
				options.language ?? "de",
			),
		},
	});
}

// Spieler ans Ende setzen
export function appendPlayerToSeatOrder(
	game: GameState,
	playerId: string,
	services: DomainServices,
	options: SeatOrderOptions = {},
): GameState {
	validateSeatOrderIntegrity(game);
	validateExistingPlayer(game, playerId);

	if (game.seatOrder.includes(playerId)) {
		throw new Error(
			`Sitzordnung ungültig: Spieler "${playerId}" sitzt bereits.`,
		);
	}

	const oldSeatOrder = [...game.seatOrder];
	const nextSeatOrder = [...oldSeatOrder, playerId];

	return createGameWithUpdatedSeatOrder({
		game,
		oldSeatOrder,
		nextSeatOrder,
		services,
		options,
		logText: `Spieler ${getPlayerLabel(game, playerId, options.language ?? "de")} an Sitz ${nextSeatOrder.length} gesetzt.`,
		logType: "seat_order_changed",
		payload: {
			action: "append",
			playerId,
			playerName: getPlayerDisplayName(
				game,
				playerId,
				options.language ?? "de",
			),
			toSeat: nextSeatOrder.length,
		},
	});
}

// Spieler an bestimmtem Sitz einfügen
// Diese Funktion ist für vorhandene Spieler gedacht, die noch nicht in seatOrder sitzen.
export function insertPlayerAtSeat(
	game: GameState,
	playerId: string,
	seatNumber: number,
	services: DomainServices,
	options: SeatOrderOptions = {},
): GameState {
	validateSeatOrderIntegrity(game);
	validateExistingPlayer(game, playerId);

	if (game.seatOrder.includes(playerId)) {
		throw new Error(
			`Sitzordnung ungültig: Spieler "${playerId}" sitzt bereits. Nutze movePlayerToSeat statt insertPlayerAtSeat.`,
		);
	}

	validateSeatNumberForInsert(game, seatNumber);

	const oldSeatOrder = [...game.seatOrder];
	const nextSeatOrder = [...oldSeatOrder];

	nextSeatOrder.splice(seatNumber - 1, 0, playerId);

	return createGameWithUpdatedSeatOrder({
		game,
		oldSeatOrder,
		nextSeatOrder,
		services,
		options,
		logText: `Spieler ${getPlayerLabel(game, playerId, options.language ?? "de")} an Sitz ${seatNumber} eingefügt.`,
		logType: "seat_order_changed",
		payload: {
			action: "insert",
			playerId,
			playerName: getPlayerDisplayName(
				game,
				playerId,
				options.language ?? "de",
			),
			toSeat: seatNumber,
		},
	});
}

// Spieler aus Sitzordnung entfernen
// Diese Funktion entfernt den Spieler nur aus der Sitzordnung. Der Spieler bleibt in playersById erhalten.
export function removePlayerFromSeatOrder(
	game: GameState,
	playerId: string,
	services: DomainServices,
	options: SeatOrderOptions = {},
): GameState {
	validateSeatOrderIntegrity(game);
	validateExistingSeatedPlayer(game, playerId);

	const oldSeatOrder = [...game.seatOrder];
	const oldIndex = oldSeatOrder.indexOf(playerId);

	const nextSeatOrder = oldSeatOrder.filter((id) => id !== playerId);

	return createGameWithUpdatedSeatOrder({
		game,
		oldSeatOrder,
		nextSeatOrder,
		services,
		options,
		logText: `Spieler ${getPlayerLabel(game, playerId, options.language ?? "de")} von Sitz ${oldIndex + 1} entfernt.`,
		logType: "seat_order_changed",
		payload: {
			action: "remove",
			playerId,
			playerName: getPlayerDisplayName(
				game,
				playerId,
				options.language ?? "de",
			),
			fromSeat: oldIndex + 1,
		},
	});
}

// Sitzordnung direkt ersetzen
// Interner Domain-Baustein für zusammengesetzte Sitzoperationen, Reparaturen
// und Tests. GUI-Vorschau und Animation gehören ausdrücklich nicht hierher.
export function replaceSeatOrder(
	game: GameState,
	nextSeatOrder: string[],
	services: DomainServices,
	options: SeatOrderOptions = {},
): GameState {
	validateSeatOrderIntegrity(game);
	validateProposedSeatOrder(game, nextSeatOrder);

	const oldSeatOrder = [...game.seatOrder];

	if (arraysEqual(oldSeatOrder, nextSeatOrder)) {
		return game;
	}

	return createGameWithUpdatedSeatOrder({
		game,
		oldSeatOrder,
		nextSeatOrder: [...nextSeatOrder],
		services,
		options,
		logText: "Sitzordnung geändert.",
		logType: "seat_order_changed",
		payload: {
			action: "replace",
		},
	});
}

/** Ordnet alle sitzenden Spieler zufällig an; freie Sitzplätze bleiben frei. */
export function shufflePlayers(
	game: GameState,
	services: DomainServices,
	options: ShufflePlayersOptions = {},
): GameState {
	validateSeatOrderIntegrity(game);
	const oldSeatOrder = [...game.seatOrder];
	const shuffledPlayerIds = oldSeatOrder.filter(
		(playerId) => playerId !== EMPTY_PLAYER_ID,
	);
	if (shuffledPlayerIds.length < 2) return game;

	const rng = options.rng ?? Math.random;
	for (let index = shuffledPlayerIds.length - 1; index > 0; index--) {
		const randomValue = rng();
		if (
			typeof randomValue !== "number" ||
			!Number.isFinite(randomValue) ||
			randomValue < 0 ||
			randomValue >= 1
		)
			throw new Error("rng muss eine Zahl x liefern mit 0 <= x < 1.");
		const randomIndex = Math.floor(randomValue * (index + 1));
		const current = shuffledPlayerIds[index];
		shuffledPlayerIds[index] = shuffledPlayerIds[randomIndex];
		shuffledPlayerIds[randomIndex] = current;
	}

	let playerIndex = 0;
	const nextSeatOrder = oldSeatOrder.map((playerId) =>
		playerId === EMPTY_PLAYER_ID
			? EMPTY_PLAYER_ID
			: (shuffledPlayerIds[playerIndex++] ?? playerId),
	);
	if (arraysEqual(oldSeatOrder, nextSeatOrder)) return game;

	return createGameWithUpdatedSeatOrder({
		game,
		oldSeatOrder,
		nextSeatOrder,
		services,
		options,
		logText: "Spieler zufällig angeordnet.",
		logType: "seat_order_changed",
		payload: { action: "shuffle" },
	});
}

// Gemeinsamer Update-Helfer
function createGameWithUpdatedSeatOrder(params: {
	game: GameState;
	oldSeatOrder: string[];
	nextSeatOrder: string[];
	services: DomainServices;
	options: SeatOrderOptions;
	logText: string;
	logType: string;
	payload: Record<string, unknown>;
}): GameState {
	const {
		game,
		oldSeatOrder,
		nextSeatOrder,
		services,
		options,
		logText,
		logType,
		payload,
	} = params;

	validateProposedSeatOrder(game, nextSeatOrder);

	const now = services.clock.now();
	const shouldAddLog = options.addLogEntry !== false && !game.isTemplate;

	const logEntry: GameLogEntry | null = shouldAddLog
		? createSeatOrderLogEntry({
				game,
				now,
				id: services.idGenerator.createId("log"),
				logText,
				logType,
				oldSeatOrder,
				nextSeatOrder,
				payload,
				language: options.language ?? "de",
			})
		: null;

	return {
		...game,
		seatOrder: nextSeatOrder,
		log: logEntry ? [...game.log, logEntry] : game.log,
	};
}

// Logeintrag
function createSeatOrderLogEntry(params: {
	game: GameState;
	now: Instant;
	id: string;
	logText: string;
	logType: string;
	oldSeatOrder: string[];
	nextSeatOrder: string[];
	payload: Record<string, unknown>;
	language: string;
}): GameLogEntry {
	const {
		game,
		now,
		id,
		logText,
		logType,
		oldSeatOrder,
		nextSeatOrder,
		payload,
		language,
	} = params;

	return {
		id,
		night: game.time.currentNight,
		phase: game.time.phase,
		createdAt: now,
		type: logType,
		actor: "storyteller",
		text: logText,
		payload: {
			...payload,
			beforeSeatOrder: createSeatSnapshot(game, oldSeatOrder, language),
			afterSeatOrder: createSeatSnapshot(game, nextSeatOrder, language),
		},
	};
}

function createSeatSnapshot(
	game: GameState,
	seatOrder: string[],
	language: string,
): Array<{
	seatNumber: number;
	playerId: string;
	playerName?: string;
}> {
	return seatOrder.map((playerId, index) => ({
		seatNumber: index + 1,
		playerId,
		playerName: getPlayerDisplayName(game, playerId, language),
	}));
}

// Validierung
export function validateSeatOrderIntegrity(game: GameState): void {
	if (!isRecord(game.playersById)) {
		throw new Error("playersById muss ein Objekt sein.");
	}

	if (!Array.isArray(game.seatOrder)) {
		throw new Error("seatOrder muss ein Array sein.");
	}
	if (game.playersById[EMPTY_PLAYER_ID]) {
		throw new Error(
			`Die reservierte ID "${EMPTY_PLAYER_ID}" darf keinem Player-Objekt gehören.`,
		);
	}

	const seen = new Set<string>();

	for (const playerId of game.seatOrder) {
		if (typeof playerId !== "string" || !playerId.trim()) {
			throw new Error("seatOrder darf nur nicht-leere Player-IDs enthalten.");
		}
		if (playerId === EMPTY_PLAYER_ID) continue;

		if (seen.has(playerId)) {
			throw new Error(
				`Sitzordnung ungültig: Spieler "${playerId}" kommt mehrfach vor.`,
			);
		}

		if (!game.playersById[playerId]) {
			throw new Error(
				`Sitzordnung ungültig: Spieler "${playerId}" existiert nicht in playersById.`,
			);
		}

		seen.add(playerId);
	}
}

function validateProposedSeatOrder(
	game: GameState,
	proposedSeatOrder: string[],
): void {
	if (!Array.isArray(proposedSeatOrder)) {
		throw new Error("Neue Sitzordnung muss ein Array sein.");
	}

	const seen = new Set<string>();

	for (const playerId of proposedSeatOrder) {
		if (typeof playerId !== "string" || !playerId.trim()) {
			throw new Error(
				"Neue Sitzordnung darf nur nicht-leere Player-IDs enthalten.",
			);
		}
		if (playerId === EMPTY_PLAYER_ID) continue;

		if (seen.has(playerId)) {
			throw new Error(
				`Neue Sitzordnung ungültig: Spieler "${playerId}" kommt mehrfach vor.`,
			);
		}

		if (!game.playersById[playerId]) {
			throw new Error(
				`Neue Sitzordnung ungültig: Spieler "${playerId}" existiert nicht in playersById.`,
			);
		}

		seen.add(playerId);
	}
}

function validateExistingPlayer(game: GameState, playerId: string): void {
	if (!playerId.trim()) {
		throw new Error("playerId darf nicht leer sein.");
	}

	if (!game.playersById[playerId]) {
		throw new Error(`Spieler "${playerId}" existiert nicht.`);
	}
}

function validateExistingSeatedPlayer(game: GameState, playerId: string): void {
	validateExistingPlayer(game, playerId);

	if (!game.seatOrder.includes(playerId)) {
		throw new Error(
			`Spieler "${playerId}" sitzt aktuell nicht in der Sitzordnung.`,
		);
	}
}

function validateSeatNumberForRead(game: GameState, seatNumber: number): void {
	if (!Number.isInteger(seatNumber)) {
		throw new Error("Sitznummer muss eine ganze Zahl sein.");
	}

	if (seatNumber < 1 || seatNumber > game.seatOrder.length) {
		throw new Error(
			`Sitznummer muss zwischen 1 und ${game.seatOrder.length} liegen.`,
		);
	}
}

function validateSeatNumberForMove(game: GameState, seatNumber: number): void {
	validateSeatNumberForRead(game, seatNumber);
}

function validateSeatNumberForInsert(
	game: GameState,
	seatNumber: number,
): void {
	if (!Number.isInteger(seatNumber)) {
		throw new Error("Sitznummer muss eine ganze Zahl sein.");
	}

	const maxSeatNumber = game.seatOrder.length + 1;

	if (seatNumber < 1 || seatNumber > maxSeatNumber) {
		throw new Error(
			`Sitznummer zum Einfügen muss zwischen 1 und ${maxSeatNumber} liegen.`,
		);
	}
}

// Kleine Hilfsfunktionen
function getPlayerLabel(
	game: GameState,
	playerId: string,
	language: string,
): string {
	const player = game.playersById[playerId];

	if (!player) {
		return `"${playerId}"`;
	}

	return `"${getDisplayName(player, language)}"`;
}

function getPlayerDisplayName(
	game: GameState,
	playerId: string,
	language: string,
): string | undefined {
	const player = game.playersById[playerId];
	return player ? getDisplayName(player, language) : undefined;
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
	if (a.length !== b.length) {
		return false;
	}

	for (let index = 0; index < a.length; index++) {
		if (a[index] !== b[index]) {
			return false;
		}
	}

	return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
