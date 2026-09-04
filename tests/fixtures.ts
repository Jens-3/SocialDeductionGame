import type { LoadedGameDocument } from "../src/application/gameUseCases";
import {
	createGameFromRuleSet,
	type GameState,
} from "../src/domain/gameFactory";
import { Role, Team } from "../src/domain/models";
import type { RuleSet } from "../src/domain/ruleSet";
import { createFixedDomainServices } from "./fixedClock";

export function createTestRuleSet(): RuleSet {
	return {
		id: "ruleset_test_rules",
		name: "Test Rules",
		version: 1,
		teams: [
			new Team({ id: "t_good", name: "Good", teamOrder: 10 }),
			new Team({ id: "t_evil", name: "Evil", teamOrder: 20 }),
			new Team({
				id: "t_unknown",
				name: "Unknown",
				teamOrder: 999,
				isSystem: true,
			}),
		],
		roles: [
			new Role({
				id: "r_seer",
				name: "Seer",
				teamId: "t_good",
				isUnique: true,
			}),
			new Role({ id: "r_villager", name: "Villager", teamId: "t_good" }),
			new Role({
				id: "r_wolf",
				name: "Wolf",
				teamId: "t_evil",
				isUnique: true,
			}),
		],
	};
}

export function createTestGame(playerCount = 3): GameState {
	return createGameFromRuleSet({
		services: createFixedDomainServices("2026-01-02T03:04:05.000Z"),
		ruleSet: createTestRuleSet(),
		playerCount,
	});
}

export function createTestLoadedGameDocument<TDocument>(
	document: TDocument,
	options: { id: string; name: string; displayName?: string },
): LoadedGameDocument & { document: TDocument } {
	return {
		id: options.id,
		name: options.name,
		displayName: options.displayName ?? options.name,
		document,
	} as unknown as LoadedGameDocument & { document: TDocument };
}
