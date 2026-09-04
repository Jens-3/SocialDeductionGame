/* eslint-disable @typescript-eslint/unbound-method -- Die geprüften Portmethoden sind Vitest-Mocks. */
import { describe, expect, it, vi } from "vitest";
import { DefaultObjectReadProblemService } from "../src/application/internal/defaultObjectReadProblemService";
import type { ApplicationObjectReadProblem } from "../src/application/objectList";
import type { DocumentSyntaxRepair } from "../src/persistence/objectPersistenceTypes";
import type { ObjectRecoveryPort } from "../src/persistence/ports/objectRecoveryPort";

const problem = {
	problemId: "object:game:game_broken:serialization:invalidJson",
	source: "serialization",
	operation: "load",
	subject: "game",
	reference: {
		kind: "game",
		storageKey: "game_broken",
		id: "game_broken",
	},
	scope: "object",
	category: "serialization",
	kind: "game",
	storageKey: "game_broken",
	id: "game_broken",
	reason: "invalidJson",
	retryable: false,
	repairable: true,
	canExport: true,
	availableActions: [
		"repair",
		"repairFileName",
		"keepBoth",
		"delete",
		"export",
	],
} as ApplicationObjectReadProblem;

function createPersistence(overrides: Partial<ObjectRecoveryPort> = {}) {
	return {
		deleteObjectReadProblem: vi.fn(() => Promise.resolve()),
		exportObjectReadProblem: vi.fn(() => Promise.resolve()),
		repairObjectReadProblem: vi.fn(() => Promise.resolve(undefined)),
		...overrides,
	} as unknown as ObjectRecoveryPort;
}

describe("DefaultObjectReadProblemService", () => {
	it("übergibt Löschen und Exportieren an den Recovery-Port", async () => {
		const persistence = createPersistence();
		const service = new DefaultObjectReadProblemService(persistence);

		await service.delete(problem);
		await service.export(problem);

		expect(persistence.deleteObjectReadProblem).toHaveBeenCalledWith(problem, {
			ansiFallbackLocale: "de",
		});
		expect(persistence.exportObjectReadProblem).toHaveBeenCalledWith(problem);
	});

	it.each([
		["repair", false],
		["repairFileName", false],
		["keepBoth", true],
	] as const)(
		"reicht die Reparaturaktion %s korrekt weiter",
		async (action, keepBoth) => {
			const persistence = createPersistence();
			const service = new DefaultObjectReadProblemService(persistence);

			await expect(service.repair(problem, action)).resolves.toEqual({
				status: "repaired",
				kind: "game",
				id: "game_broken",
			});
			expect(persistence.repairObjectReadProblem).toHaveBeenCalledWith(
				problem,
				{ ansiFallbackLocale: "de" },
				keepBoth,
			);
		},
	);

	it("stellt Syntaxreparaturen vor die fachlichen Änderungen", async () => {
		const report = {
			repairedRuleSetCount: 1,
			removedRuleSets: [],
			changes: [{ kind: "ruleSetsContainerReplaced" as const }],
		};
		const persistence = createPersistence({
			repairObjectReadProblem: vi.fn(() =>
				Promise.resolve({
					report,
					syntaxRepairs: [
						{ kind: "insertedMissingQuote", position: 12 },
						{ kind: "addedClosingBraces", count: 2 },
					] satisfies DocumentSyntaxRepair[],
				}),
			),
		});
		const service = new DefaultObjectReadProblemService(persistence);

		const result = await service.repair(problem, "repair");

		expect(result.report?.changes).toEqual([
			{ kind: "insertedMissingQuote", position: 12 },
			{ kind: "addedClosingBraces", count: 2 },
			{ kind: "ruleSetsContainerReplaced" },
		]);
	});

	it("übersetzt unerwartete Portfehler mit dem passenden Operationskontext", async () => {
		const persistence = createPersistence({
			exportObjectReadProblem: vi.fn(() =>
				Promise.reject(new Error("kaputter Export")),
			),
		});
		const service = new DefaultObjectReadProblemService(persistence);

		await expect(service.export(problem)).rejects.toMatchObject({
			name: "ApplicationOperationError",
			operation: "export",
			reason: "unexpectedFailure",
		});
	});
});
