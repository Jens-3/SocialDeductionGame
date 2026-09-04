import type { GameState } from "./gameState";

/** Entfernt genau einen Logeintrag. Ist er nicht vorhanden, bleibt das Spiel unverändert. */
export function deleteGameLogEntry(
	game: GameState,
	logEntryId: string,
): GameState {
	if (!game.log.some(({ id }) => id === logEntryId)) return game;
	return {
		...game,
		log: game.log.filter(({ id }) => id !== logEntryId),
	};
}

/** Entfernt sämtliche Logeinträge. Ein bereits leeres Log bleibt unverändert. */
export function clearGameLog(game: GameState): GameState {
	if (game.log.length === 0) return game;
	return { ...game, log: [] };
}
