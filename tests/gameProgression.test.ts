import { expect, it } from "vitest";
import type { GameState } from "../src/domain/gameFactory";
import {
	type AdvanceTimeOptions,
	rewindGameTime as rewindTime,
} from "../src/domain/gameProgression";
import { fixedDomainServices } from "./fixedClock";

const rewindGameTime = (game: GameState, options: AdvanceTimeOptions = {}) =>
	rewindTime(game, fixedDomainServices, options);

function gameAt(
	currentNight: number,
	phase: "setup" | "night" | "day",
): GameState {
	return {
		id: "game_test",
		name: "Test",
		isTemplate: false,
		createdAt: "2026-01-01T00:00:00.000Z",
		ruleSetSnapshot: {
			id: "rules_test",
			name: "Test",
			version: 1,
			teams: [],
			roles: [],
		},
		statusDefinitionsById: {},
		playersById: {},
		seatOrder: [],
		time: { currentNight, phase },
		log: [],
	};
}

it("schaltet die Spielzeit über Nacht, Tag und Setup zurück", () => {
	expect(
		rewindGameTime(gameAt(2, "night"), { addLogEntry: false }).time,
	).toEqual({
		currentNight: 1,
		phase: "day",
	});
	expect(rewindGameTime(gameAt(1, "day"), { addLogEntry: false }).time).toEqual(
		{
			currentNight: 1,
			phase: "night",
		},
	);
	expect(
		rewindGameTime(gameAt(1, "night"), { addLogEntry: false }).time,
	).toEqual({
		currentNight: 0,
		phase: "setup",
	});
});
