import { describe, expect, expectTypeOf, it } from "vitest";
import type { GameDocument } from "../src/serialization/gameDocument";
import { createGameExportDocument } from "../src/serialization/gameExport";
import type { LibraryDocument } from "../src/serialization/libraryDocument";
import { createLibraryJsonText } from "../src/serialization/librarySerializer";
import type { RuleSetDocument } from "../src/serialization/ruleSetDocument";
import {
	createRuleSetDocumentEmbedded,
	createRuleSetDocumentStandalone,
} from "../src/serialization/ruleSetExport";
import { createTestGame, createTestRuleSet } from "./fixtures";

describe("gemeinsames RuleSet-Schema", () => {
	it("verwendet RuleSetDocument als einzigen strukturellen Lesetyp", () => {
		expectTypeOf<
			GameDocument["ruleSetSnapshot"]
		>().toEqualTypeOf<RuleSetDocument>();
		expectTypeOf<
			LibraryDocument["ruleSetsById"][string]
		>().toEqualTypeOf<RuleSetDocument>();
	});

	it("verwendet in Einzeldatei, Library und Game denselben RuleSet-Inhalt", () => {
		const ruleSet = createTestRuleSet();
		const standalone = createRuleSetDocumentStandalone(ruleSet);
		const { fileType, schemaVersion, ...standaloneContent } = standalone;
		const embedded = createRuleSetDocumentEmbedded(ruleSet);
		expectTypeOf(standalone).toEqualTypeOf<RuleSetDocument>();
		expectTypeOf(embedded).toEqualTypeOf<RuleSetDocument>();

		const library = JSON.parse(
			createLibraryJsonText({
				storageType: "social-deduction-app-library",
				storageVersion: 1,
				ruleSetsById: { [ruleSet.id]: ruleSet },
			}),
		) as { ruleSetsById: Record<string, unknown> };
		const game = createTestGame();
		game.ruleSetSnapshot = ruleSet;
		const gameDocument = createGameExportDocument(game);

		expect(Object.keys(standalone).slice(0, 2)).toEqual([
			"fileType",
			"schemaVersion",
		]);
		expect(fileType).toBe("social-deduction-ruleset");
		expect(schemaVersion).toBe(1);
		expect(embedded).toEqual(standaloneContent);
		expect(library.ruleSetsById[ruleSet.id]).toEqual(standaloneContent);
		expect(gameDocument.ruleSetSnapshot).toEqual(standaloneContent);
		expect(embedded).not.toHaveProperty("fileType");
		expect(embedded).not.toHaveProperty("schemaVersion");
	});
});
