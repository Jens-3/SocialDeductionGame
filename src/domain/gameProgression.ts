// src/domain/gameProgression.ts

import type { DomainServices } from "./domainServices";
import type {
	GameLogEntry,
	GamePhase,
	GameState,
	GameTime,
} from "./gameFactory";
import type { Instant } from "./instant";

export type AdvanceTimeOptions = {
	/**
	 * Standard: true.
	 * Bei Vorlagen wird trotzdem nicht geloggt.
	 */
	addLogEntry?: boolean;
};

export function advanceGameTime(
	game: GameState,
	services: DomainServices,
	options: AdvanceTimeOptions = {},
): GameState {
	validateGameTime(game.time);

	const oldTime = { ...game.time };
	const newTime = getNextGameTime(game.time);

	const now = services.clock.now();
	const shouldAddLog = options.addLogEntry !== false && !game.isTemplate;

	const logEntry: GameLogEntry | null = shouldAddLog
		? createTimeAdvancedLogEntry({
				oldTime,
				newTime,
				now,
				id: services.idGenerator.createId("log"),
			})
		: null;

	return {
		...game,
		time: newTime,
		log: logEntry ? [...game.log, logEntry] : game.log,
	};
}

/** Schaltet die Spielzeit um genau einen regulären Schritt zurück. */
export function rewindGameTime(
	game: GameState,
	services: DomainServices,
	options: AdvanceTimeOptions = {},
): GameState {
	validateGameTime(game.time);

	const oldTime = { ...game.time };
	const newTime = getPreviousGameTime(game.time);
	const now = services.clock.now();
	const shouldAddLog = options.addLogEntry !== false && !game.isTemplate;
	const logEntry: GameLogEntry | null = shouldAddLog
		? createTimeRewoundLogEntry({
				oldTime,
				newTime,
				now,
				id: services.idGenerator.createId("log"),
			})
		: null;

	return {
		...game,
		time: newTime,
		log: logEntry ? [...game.log, logEntry] : game.log,
	};
}

// Zeitlogik
function getNextGameTime(time: GameTime): GameTime {
	if (time.currentNight === 0) {
		return {
			currentNight: 1,
			phase: "night",
		};
	}

	if (time.currentNight > 0 && time.phase === "night") {
		return {
			currentNight: time.currentNight,
			phase: "day",
		};
	}

	if (time.currentNight > 0 && time.phase === "day") {
		return {
			currentNight: time.currentNight + 1,
			phase: "night",
		};
	}

	throw new Error(
		`Ungültiger Spielzeit-Zustand: currentNight=${time.currentNight}, phase=${time.phase}`,
	);
}

function getPreviousGameTime(time: GameTime): GameTime {
	if (time.currentNight === 0) return { ...time };
	if (time.currentNight === 1 && time.phase === "night") {
		return { currentNight: 0, phase: "setup" };
	}
	if (time.phase === "day") {
		return { currentNight: time.currentNight, phase: "night" };
	}
	if (time.phase === "night") {
		return { currentNight: time.currentNight - 1, phase: "day" };
	}
	throw new Error(
		`Ungültiger Spielzeit-Zustand: currentNight=${time.currentNight}, phase=${time.phase}`,
	);
}

function createTimeRewoundLogEntry(params: {
	oldTime: GameTime;
	newTime: GameTime;
	now: Instant;
	id: string;
}): GameLogEntry {
	const { oldTime, newTime, now, id } = params;
	return {
		id,
		night: newTime.currentNight,
		phase: newTime.phase,
		createdAt: now,
		type: "time_rewound",
		actor: "storyteller",
		text: `Zeit zurückgeschaltet: ${formatGameTime(oldTime)} → ${formatGameTime(newTime)}.`,
		payload: { oldTime, newTime },
	};
}

// Logeintrag
function createTimeAdvancedLogEntry(params: {
	oldTime: GameTime;
	newTime: GameTime;
	now: Instant;
	id: string;
}): GameLogEntry {
	const { oldTime, newTime, now, id } = params;

	return {
		id,
		night: newTime.currentNight,
		phase: newTime.phase,
		createdAt: now,
		type: "time_advanced",
		actor: "storyteller",
		text: createTimeAdvancedText(oldTime, newTime),
		payload: {
			oldTime,
			newTime,
		},
	};
}

function createTimeAdvancedText(oldTime: GameTime, newTime: GameTime): string {
	return `Zeit weitergeschaltet: ${formatGameTime(oldTime)} → ${formatGameTime(
		newTime,
	)}.`;
}

function formatGameTime(time: GameTime): string {
	if (time.currentNight === 0) {
		return "Setup";
	}

	if (time.phase === "night") {
		return `Nacht ${time.currentNight}`;
	}

	if (time.phase === "day") {
		return `Tag ${time.currentNight}`;
	}

	return `${time.phase} ${time.currentNight}`;
}

// Validierung und ID
function validateGameTime(time: GameTime): void {
	if (!Number.isInteger(time.currentNight)) {
		throw new Error("currentNight muss eine ganze Zahl sein.");
	}

	if (time.currentNight < 0) {
		throw new Error("currentNight darf nicht negativ sein.");
	}

	if (!isValidGamePhase(time.phase)) {
		throw new Error('phase muss "setup", "night" oder "day" sein.');
	}

	if (time.currentNight === 0 && time.phase !== "setup") {
		throw new Error('Bei currentNight === 0 muss phase "setup" sein.');
	}

	if (time.currentNight > 0 && time.phase === "setup") {
		throw new Error('Bei currentNight > 0 darf phase nicht "setup" sein.');
	}
}

function isValidGamePhase(value: unknown): value is GamePhase {
	return value === "setup" || value === "night" || value === "day";
}
