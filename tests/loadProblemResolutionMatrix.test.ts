/* eslint-disable @typescript-eslint/unbound-method -- Die geprüften Servicemethoden sind Vitest-Mocks. */
import { describe, expect, it, vi } from "vitest";
import type { GamePersistenceService } from "../src/application/gameUseCases";
import type {
	LibraryBrowseService,
	LibraryRecoveryService,
} from "../src/application/libraryUseCases";
import { LoadProblemDecisionService } from "../src/application/loadProblemQueue";
import {
	LoadProblemResolutionService,
	type QueuedLoadProblem,
} from "../src/application/loadProblemResolutionService";
import type { ObjectReadProblemService } from "../src/application/objectReadProblemService";

function writeProblem(kind: "game" | "ruleSet" = "game"): QueuedLoadProblem {
	return {
		queueType: "write",
		value: {
			status: "decisionRequired",
			decisionKind: "writeRecovery",
			commandId: `command_${kind}`,
			recoveryKey: `recovery_${kind}`,
			id: `${kind}_broken`,
			kind,
			hasNew: true,
			canKeepNew: true,
			reason: "interruptedWrite",
			availableActions: ["keepOld", "keepNew", "keepBoth", "export", "later"],
		},
		reason: "interruptedWrite",
		availableActions: ["keepOld", "keepNew", "keepBoth", "export", "later"],
	};
}

function objectProblem(kind: "game" | "ruleSet" = "game"): QueuedLoadProblem {
	const value = {
		problemId: `object:${kind}:broken:serialization:invalidJson`,
		source: "serialization",
		operation: "load",
		subject: kind,
		reference:
			kind === "game"
				? { kind, storageKey: "game_broken", id: "game_broken" }
				: { kind, id: "ruleset_broken" },
		scope: "object",
		category: "serialization",
		kind,
		...(kind === "game" ? { storageKey: "game_broken" } : {}),
		id: kind === "game" ? "game_broken" : "ruleset_broken",
		reason: "invalidJson",
		retryable: true,
		repairable: true,
		...(kind === "game" ? { canExport: true } : {}),
		availableActions: [
			"retry",
			"repair",
			"repairFileName",
			"keepBoth",
			"delete",
			"export",
			"later",
		],
	};
	return {
		queueType: "object",
		value,
		reason: "invalidJson",
		retryable: true,
		repairable: true,
		availableActions: value.availableActions,
	} as QueuedLoadProblem;
}

function libraryProblem(): QueuedLoadProblem {
	const value = {
		problemId: "library:serialization:invalidJson",
		source: "serialization",
		operation: "load",
		subject: "library",
		reference: { kind: "library" },
		reason: "invalidJson",
		invalidDocumentKind: "library",
		hasReadableOriginal: true,
		hasReadableBackup: true,
		canRestoreBackup: true,
		canRepair: true,
		canExport: true,
		availableActions: [
			"restoreBackup",
			"repair",
			"createEmpty",
			"export",
			"later",
		],
	};
	return {
		queueType: "library",
		value,
		reason: "invalidJson",
		availableActions: value.availableActions,
	} as QueuedLoadProblem;
}

function gamePersistence() {
	return {
		resolveWriteRecovery: vi.fn(() => Promise.resolve(undefined)),
		finishInternalStorageCommand: vi.fn(() => Promise.resolve()),
		exportFailedWrite: vi.fn(() => Promise.resolve()),
		listObjects: vi.fn(() =>
			Promise.resolve({
				status: "loaded",
				metadata: [],
				problems: [],
				ids: [],
			}),
		),
		clearBrowseCache: vi.fn(),
	} as unknown as GamePersistenceService;
}

function libraryRecovery() {
	return {
		resolveWriteRecovery: vi.fn(() =>
			Promise.resolve({ status: "recovered", kind: "ruleSet", id: "rule" }),
		),
		finishInternalStorageCommand: vi.fn(() => Promise.resolve()),
		exportFailedWrite: vi.fn(() => Promise.resolve()),
		restoreInternalBackup: vi.fn(() =>
			Promise.resolve({
				status: "restored",
				kind: "library",
				source: "backup",
			}),
		),
		repairInternalLibrary: vi.fn(() =>
			Promise.resolve({
				status: "repaired",
				kind: "library",
				report: { repairedRuleSetCount: 0, removedRuleSets: [], changes: [] },
			}),
		),
		createAndStoreEmptyLibrary: vi.fn(() => Promise.resolve()),
		exportInternalLibraryRaw: vi.fn(() => Promise.resolve()),
		useEmptyLibraryInMemory: vi.fn(() => Promise.resolve()),
	} as unknown as LibraryRecoveryService;
}

describe("LoadProblemResolutionService-Aktionsmatrix", () => {
	it.each(["keepOld", "keepNew", "keepBoth"] as const)(
		"löst eine Game-Schreibwiederherstellung mit %s auf",
		async (action) => {
			const persistence = gamePersistence();
			const service = new LoadProblemResolutionService(
				new LoadProblemDecisionService(),
				persistence,
			);

			await expect(service.resolve(writeProblem(), action)).resolves.toEqual({
				applied: true,
			});
			expect(persistence.resolveWriteRecovery).toHaveBeenCalledWith(
				"command_game",
				action,
			);
		},
	);

	it.each(["later", "export"] as const)(
		"beendet eine Game-Schreibwiederherstellung nach %s",
		async (action) => {
			const persistence = gamePersistence();
			const service = new LoadProblemResolutionService(
				new LoadProblemDecisionService(),
				persistence,
			);

			await expect(service.resolve(writeProblem(), action)).resolves.toEqual({
				applied: true,
			});
			expect(persistence.finishInternalStorageCommand).toHaveBeenCalledWith(
				"command_game",
			);
			expect(persistence.exportFailedWrite).toHaveBeenCalledTimes(
				action === "export" ? 1 : 0,
			);
		},
	);

	it("verwendet für Regelwerk-Schreibprobleme ausschließlich den Library-Service", async () => {
		const games = gamePersistence();
		const library = libraryRecovery();
		const service = new LoadProblemResolutionService(
			new LoadProblemDecisionService(),
			games,
			library,
		);

		await service.resolve(writeProblem("ruleSet"), "keepBoth");

		expect(library.resolveWriteRecovery).toHaveBeenCalledWith(
			"command_ruleSet",
			"keepBoth",
		);
		expect(games.resolveWriteRecovery).not.toHaveBeenCalled();
	});

	it("lehnt nicht verfügbare Aktionen und fehlende Services ab", async () => {
		const service = new LoadProblemResolutionService(
			new LoadProblemDecisionService(),
		);

		await expect(service.resolve(writeProblem(), "retry")).resolves.toEqual({
			applied: false,
		});
		await expect(service.resolve(writeProblem(), "keepOld")).resolves.toEqual({
			applied: false,
		});
		await expect(service.resolve(libraryProblem(), "repair")).resolves.toEqual({
			applied: false,
		});
	});

	it.each([
		["restoreBackup", "restoreInternalBackup"],
		["createEmpty", "createAndStoreEmptyLibrary"],
		["export", "exportInternalLibraryRaw"],
		["later", "useEmptyLibraryInMemory"],
	] as const)("führt die Bibliotheksaktion %s aus", async (action, method) => {
		const recovery = libraryRecovery();
		const service = new LoadProblemResolutionService(
			new LoadProblemDecisionService(),
			undefined,
			recovery,
		);

		await expect(service.resolve(libraryProblem(), action)).resolves.toEqual({
			applied: true,
		});
		expect(recovery[method]).toHaveBeenCalledOnce();
	});

	it("gibt den Reparaturbericht einer Bibliotheksreparatur zurück", async () => {
		const recovery = libraryRecovery();
		const service = new LoadProblemResolutionService(
			new LoadProblemDecisionService(),
			undefined,
			recovery,
		);

		await expect(service.resolve(libraryProblem(), "repair")).resolves.toEqual({
			applied: true,
			libraryRepairReport: {
				repairedRuleSetCount: 0,
				removedRuleSets: [],
				changes: [],
			},
		});
	});

	it.each([
		[[], true],
		[["object:game:broken:serialization:invalidJson"], false],
	] as const)(
		"wertet einen erneuten Objekt-Leseversuch aus",
		async (remainingProblemIds, expectedApplied) => {
			const problem = objectProblem();
			const persistence = gamePersistence();
			vi.mocked(persistence.listObjects).mockResolvedValue({
				status: "loaded",
				metadata: [],
				problems: remainingProblemIds.map(
					(problemId) =>
						({ problemId }) as Extract<
							QueuedLoadProblem,
							{ queueType: "object" }
						>["value"],
				),
				ids: [],
			});
			const service = new LoadProblemResolutionService(
				new LoadProblemDecisionService(),
				persistence,
			);

			await expect(service.resolve(problem, "retry")).resolves.toEqual({
				applied: expectedApplied,
			});
		},
	);

	it("repariert Objektprobleme, leert den Browse-Cache und reicht Berichte weiter", async () => {
		const problem = objectProblem();
		const persistence = gamePersistence();
		const report = {
			repairedRuleSetCount: 0,
			removedRuleSets: [],
			changes: [],
		};
		const objectService = {
			repair: vi.fn(() =>
				Promise.resolve({
					status: "repaired",
					kind: "game",
					id: "game_broken",
					report,
				}),
			),
		} as unknown as ObjectReadProblemService;
		const service = new LoadProblemResolutionService(
			new LoadProblemDecisionService(),
			persistence,
			undefined,
			objectService,
		);

		await expect(service.resolve(problem, "keepBoth")).resolves.toEqual({
			applied: true,
			libraryRepairReport: report,
		});
		expect(objectService.repair).toHaveBeenCalledWith(
			problem.value,
			"keepBoth",
		);
		expect(persistence.clearBrowseCache).toHaveBeenCalledOnce();
	});

	it("verwendet beim Regelwerk-Retry den Library-Browse-Service", async () => {
		const problem = objectProblem("ruleSet");
		const browse = {
			listObjects: vi.fn(() =>
				Promise.resolve({
					status: "loaded",
					metadata: [],
					problems: [],
					ids: [],
				}),
			),
		} as unknown as LibraryBrowseService;
		const service = new LoadProblemResolutionService(
			new LoadProblemDecisionService(),
			undefined,
			undefined,
			undefined,
			browse,
		);

		await expect(service.resolve(problem, "retry")).resolves.toEqual({
			applied: true,
		});
		expect(browse.listObjects).toHaveBeenCalledWith("ruleSet");
	});

	it("löscht gemerkte Entscheidungen, sobald keine Probleme mehr bestehen", async () => {
		const decisions = new LoadProblemDecisionService();
		const problem = objectProblem();
		decisions.remember(problem, "later");
		const service = new LoadProblemResolutionService(decisions);

		await service.applyRemembered([], vi.fn());

		expect(decisions.getRememberedAction(problem)).toBeUndefined();
	});

	it("teilt einen laufenden Apply-Remembered-Vorgang", async () => {
		let releaseDelete: (() => void) | undefined;
		const deleting = new Promise<void>((resolve) => {
			releaseDelete = resolve;
		});
		const problem = objectProblem();
		const decisions = new LoadProblemDecisionService();
		decisions.remember(problem, "delete");
		const objectService = {
			delete: vi.fn(() => deleting),
		} as unknown as ObjectReadProblemService;
		const service = new LoadProblemResolutionService(
			decisions,
			undefined,
			undefined,
			objectService,
		);

		const first = service.applyRemembered([problem], vi.fn());
		const second = service.applyRemembered([problem], vi.fn());

		expect(second).toBe(first);
		expect(objectService.delete).toHaveBeenCalledOnce();
		releaseDelete?.();
		await first;
	});

	it("vergisst eine gemerkte Entscheidung nach einem Ausführungsfehler", async () => {
		const problem = objectProblem();
		const decisions = new LoadProblemDecisionService();
		decisions.remember(problem, "delete");
		const objectService = {
			delete: vi.fn(() => Promise.reject(new Error("delete failed"))),
		} as unknown as ObjectReadProblemService;
		const service = new LoadProblemResolutionService(
			decisions,
			undefined,
			undefined,
			objectService,
		);

		await expect(service.applyRemembered([problem], vi.fn())).rejects.toThrow(
			"delete failed",
		);
		expect(decisions.getRememberedAction(problem)).toBeUndefined();
	});
});
