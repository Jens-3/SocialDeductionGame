import { describe, expect, it } from "vitest";
import { hydrateGameState } from "../src/domain/gameValidation";
import { createTemplateFromGame } from "../src/domain/templateFactory";
import { createGameExportDocument } from "../src/serialization/gameExport";
import { decodeScenarioDocument } from "../src/serialization/scenarioDocument";
import { fixedDomainServices } from "./fixedClock";
import { createTestGame, createTestRuleSet } from "./fixtures";

describe("ScenarioDocument-Decoder", () => {
	it("erkennt und dekodiert ein Regelwerk", () => {
		const ruleSet = createTestRuleSet();
		const decoded = decodeScenarioDocument(ruleSet);

		expect(decoded.kind).toBe("ruleSet");
		expect(decoded.document.id).toBe(ruleSet.id);
	});

	it("dekodiert Games und Templates als denselben Dokumenttyp", () => {
		const game = createTestGame();
		const template = createTemplateFromGame({
			services: fixedDomainServices,
			game,
		}).template;

		const gameDocument = decodeScenarioDocument(createGameExportDocument(game));
		const templateDocument = decodeScenarioDocument(
			createGameExportDocument(template),
		);
		expect(gameDocument.kind).toBe("gameDocument");
		expect(templateDocument.kind).toBe("gameDocument");
		if (
			gameDocument.kind !== "gameDocument" ||
			templateDocument.kind !== "gameDocument"
		)
			return;
		expect(hydrateGameState(gameDocument.document).isTemplate).toBe(false);
		expect(hydrateGameState(templateDocument.document).isTemplate).toBe(true);
	});

	it("weist unbestimmte Rohstrukturen in Serialization zurück", () => {
		expect(() => decodeScenarioDocument(null)).toThrow("JSON-Objekt");
		expect(() => decodeScenarioDocument({ name: "Unvollständig" })).toThrow();
	});
});
