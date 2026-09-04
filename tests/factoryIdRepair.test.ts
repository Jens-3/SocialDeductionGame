import { describe, expect, it } from "vitest";

import { createGameFromRuleSet } from "../src/domain/gameFactory";
import { createTemplateFromGame } from "../src/domain/templateFactory";
import { createFixedDomainServices, fixedDomainServices } from "./fixedClock";
import { createTestGame, createTestRuleSet } from "./fixtures";

describe("ID-Reparatur an Factory-Grenzen", () => {
	it("bereinigt den Spielnamen direkt an der Domain-Factory", () => {
		const game = createGameFromRuleSet({
			services: fixedDomainServices,
			ruleSet: createTestRuleSet(),
			playerCount: 1,
			name: "  Runde\u202E\tA  ",
		});

		expect(game.name).toBe("Runde A");
	});

	it("repariert die kopierten Library-Daten beim Erzeugen eines Spiels", () => {
		const ruleSet = createTestRuleSet();
		(ruleSet.teams[0] as unknown as { id: string }).id = "good";
		ruleSet.roles[0].teamId = "good";

		const game = createGameFromRuleSet({
			services: fixedDomainServices,
			ruleSet,
			playerCount: 1,
			gameId: "game_repair_test",
		});

		expect(game.ruleSetSnapshot.teams[0]?.id).toBe("t_good");
		expect(game.ruleSetSnapshot.roles[0]?.teamId).toBe("t_good");
		expect(ruleSet.teams[0]?.id).toBe("good");
	});

	it("repariert das Spiel vor der Template-Erstellung", () => {
		const game = createTestGame(1);
		(game.ruleSetSnapshot.teams[0] as unknown as { id: string }).id = "good";
		game.ruleSetSnapshot.roles[0].teamId = "good";

		const result = createTemplateFromGame({
			services: createFixedDomainServices("2026-01-02T03:04:05.000Z"),
			game,
		});

		expect(game.ruleSetSnapshot.teams[0]?.id).toBe("good");
		expect(game.ruleSetSnapshot.roles[0]?.teamId).toBe("good");
		expect(result.template.ruleSetSnapshot.teams[0]?.id).toBe("t_good");
		expect(result.warnings).toContainEqual({
			code: "IDS_REPAIRED",
			message:
				"Vor der Template-Erstellung wurden 1 ID-Problem im Spiel repariert.",
		});
	});
});
