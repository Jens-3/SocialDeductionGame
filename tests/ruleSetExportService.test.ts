import { describe, expect, it } from "vitest";
import { RuleSetExportService } from "../src/application/ruleSetExportService";
import { Role, Team } from "../src/domain/models";
import type { RuleSet } from "../src/domain/ruleSet";
import type { DataFileStorage } from "../src/persistence/ports/dataFileStorage";
import { createTestObjectPersistence } from "./createTestObjectPersistence";
import { fixedDomainServices } from "./fixedClock";
import { missingRead } from "./storageReadResult";

describe("RuleSetExportService", () => {
	it("schreibt das flache RuleSet-Format als UTF-8 über den Application-Port", async () => {
		let exported:
			| {
					bytes: Uint8Array;
					options: { suggestedFileName: string; description?: string };
			  }
			| undefined;
		const storage: DataFileStorage = {
			readInternal: (file) => Promise.resolve(missingRead(file)),
			writeExternal: (bytes, options) => {
				exported = { bytes, options };
				return Promise.resolve();
			},
		};

		await new RuleSetExportService(
			createTestObjectPersistence(storage, fixedDomainServices).transfer,
		).exportRuleSet(createRuleSet());

		expect(exported?.options).toEqual({
			suggestedFileName: "ruleset_test_rules.json",
			description: "Regelwerk",
			conflictPolicy: "reject",
			targetPolicy: "suggested",
		});
		expect(JSON.parse(new TextDecoder().decode(exported?.bytes))).toMatchObject(
			{
				fileType: "social-deduction-ruleset",
				schemaVersion: 1,
				id: "ruleset_test_rules",
			},
		);
	});

	it("verweigert den Export, wenn der Port keine externe Ausgabe unterstützt", async () => {
		const storage: DataFileStorage = {
			readInternal: (file) => Promise.resolve(missingRead(file)),
		};

		const error = await new RuleSetExportService(
			createTestObjectPersistence(storage, fixedDomainServices).transfer,
		)
			.exportRuleSet(createRuleSet())
			.catch((caught: unknown) => caught);
		expect(error).toMatchObject({
			name: "ApplicationOperationError",
			code: "APPLICATION_UNEXPECTED_ERROR",
			source: "persistence",
			expectation: "unexpected",
			severity: "critical",
			reason: "unexpectedFailure",
			diagnostic:
				'Der konfigurierte Storage-Adapter unterstützt "writeExternal" nicht.',
		});
	});

	it("validiert fachlich vor Serialisierung und Schreiben", async () => {
		let writeCount = 0;
		const storage: DataFileStorage = {
			readInternal: (file) => Promise.resolve(missingRead(file)),
			writeExternal: () => {
				writeCount++;
				return Promise.resolve();
			},
		};
		const invalidRuleSet = { ...createRuleSet(), id: "invalid id" };

		const error = await new RuleSetExportService(
			createTestObjectPersistence(storage, fixedDomainServices).transfer,
		)
			.exportRuleSet(invalidRuleSet)
			.catch((caught: unknown) => caught);
		expect(error).toMatchObject({
			name: "ApplicationOperationError",
			code: "APPLICATION_EXPECTED_ERROR",
			source: "domain",
			expectation: "expected",
			severity: "error",
			reason: "invalidObject",
		});
		expect(error).toHaveProperty(
			"diagnostic",
			expect.stringContaining("ruleSet.id"),
		);
		expect(writeCount).toBe(0);
	});

	it("liefert Exportkonflikte ohne Command-ID als neu zu startende Entscheidung", async () => {
		const attempts: unknown[] = [];
		const storage: DataFileStorage = {
			readInternal: (file) => Promise.resolve(missingRead(file)),
			writeExternal: (_bytes, options) => {
				attempts.push(options);
				return Promise.resolve(
					options.conflictPolicy === "overwrite"
						? undefined
						: {
								status: "conflict" as const,
								reason: "targetExists" as const,
							},
				);
			},
		};
		const service = new RuleSetExportService(
			createTestObjectPersistence(storage, fixedDomainServices).transfer,
		);

		const decision = await service.exportRuleSet(createRuleSet());

		expect(decision).toEqual({
			status: "expectedFailure",
			continuation: "restart",
			problem: {
				problemId: "export:ruleSet:targetExists",
				source: "storage",
				operation: "export",
				subject: "ruleSet",
				reason: "targetExists",
				availableActions: ["overwrite", "chooseAnotherTarget", "cancel"],
			},
		});
		expect(decision).not.toHaveProperty("commandId");
		await expect(
			service.exportRuleSet(createRuleSet(), "overwrite"),
		).resolves.toEqual({ status: "exported" });
		expect(attempts).toHaveLength(2);
	});
});

function createRuleSet(): RuleSet {
	return {
		id: "ruleset_test_rules",
		name: "Test Rules",
		version: 1,
		teams: [
			new Team({ id: "t_good", name: "Good", teamOrder: 1 }),
			new Team({
				id: "t_unknown",
				name: "Unknown",
				teamOrder: 99,
				isSystem: true,
			}),
		],
		roles: [new Role({ id: "r_villager", name: "Villager", teamId: "t_good" })],
	};
}
