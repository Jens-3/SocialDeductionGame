import { describe, expect, it } from "vitest";
import { clearGameLog, deleteGameLogEntry } from "../src/domain/gameLog";
import { createTestGame } from "./fixtures";

describe("Game-Log bearbeiten", () => {
	it("löscht genau den ausgewählten Eintrag", () => {
		const game = createTestGame();
		game.log = [logEntry("log_1"), logEntry("log_2")];

		const updated = deleteGameLogEntry(game, "log_1");

		expect(updated.log.map(({ id }) => id)).toEqual(["log_2"]);
		expect(game.log.map(({ id }) => id)).toEqual(["log_1", "log_2"]);
	});

	it("löscht das gesamte Log", () => {
		const game = createTestGame();
		game.log = [logEntry("log_1"), logEntry("log_2")];

		const updated = clearGameLog(game);

		expect(updated.log).toEqual([]);
		expect(game.log).toHaveLength(2);
	});

	it("behält bei wirkungslosen Löschungen die Spielreferenz bei", () => {
		const game = createTestGame();

		expect(deleteGameLogEntry(game, "missing")).toBe(game);
		expect(clearGameLog(game)).toBe(game);
	});
});

function logEntry(id: string) {
	return {
		id,
		night: 0,
		phase: "setup" as const,
		createdAt: "2026-08-15T00:00:00.000Z",
		type: "test",
		actor: "storyteller" as const,
		text: id,
	};
}
