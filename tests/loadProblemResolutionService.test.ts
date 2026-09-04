import { describe, expect, it, vi } from "vitest";
import type { GamePersistenceService } from "../src/application/gameUseCases";
import type { RuleSetReadProblem } from "../src/application/libraryUseCases";
import { LoadProblemDecisionService } from "../src/application/loadProblemQueue";
import {
	LoadProblemResolutionService,
	type QueuedLoadProblem,
} from "../src/application/loadProblemResolutionService";
import type { ObjectReadProblemService } from "../src/application/objectReadProblemService";

describe("LoadProblemResolutionService", () => {
	it("wendet eine gemerkte Objektentscheidung an", async () => {
		const deleteObjectReadProblem = vi.fn(() => Promise.resolve());
		const gameReadService = {} as GamePersistenceService;
		const objectProblems = {
			delete: deleteObjectReadProblem,
		} as unknown as ObjectReadProblemService;
		const decisions = new LoadProblemDecisionService();
		const service = new LoadProblemResolutionService(
			decisions,
			gameReadService,
			undefined,
			objectProblems,
		);
		const problem: QueuedLoadProblem = {
			queueType: "object" as const,
			value: {
				problemId: "object:game:game_broken:serialization:invalidJson",
				source: "serialization",
				operation: "load",
				subject: "game",
				reference: {
					kind: "game",
					storageKey: "game_broken",
					id: "game_broken",
				},
				scope: "object" as const,
				category: "serialization" as const,
				kind: "game" as const,
				storageKey: "game_broken",
				id: "game_broken",
				reason: "invalidJson" as const,
				retryable: false,
				repairable: false,
				canExport: true,
				availableActions: ["delete", "export", "later"],
			},
			reason: "invalidJson" as const,
			availableActions: ["later", "export", "delete"],
		};
		const similar = structuredClone(problem);
		if (similar.queueType !== "object")
			throw new Error("Objektproblem erwartet");
		similar.value.problemId =
			"object:game:game_broken_2:serialization:invalidJson";
		if (similar.value.kind === "ruleSet")
			throw new Error("Spielproblem erwartet");
		similar.value.id = "game_broken_2";
		similar.value.storageKey = "game_broken_2";
		similar.value.reference = {
			kind: "game",
			storageKey: "game_broken_2",
			id: "game_broken_2",
		};

		await expect(service.resolve(problem, "delete", true)).resolves.toEqual({
			applied: true,
		});
		expect(service.problemsForDisplay([similar])).toEqual([]);

		const applied: QueuedLoadProblem[] = [];
		await expect(
			service.applyRemembered([similar], ({ problem: resolved }) => {
				applied.push(resolved);
			}),
		).resolves.toBeUndefined();
		expect(applied).toEqual([similar]);
		expect(deleteObjectReadProblem).toHaveBeenNthCalledWith(1, problem.value);
		expect(deleteObjectReadProblem).toHaveBeenNthCalledWith(2, similar.value);
	});

	it("wendet eine gemerkte Löschentscheidung auf ein einzelnes Regelwerk an", async () => {
		const deleteScenario = vi.fn((_kind: "ruleSet", _id: string) => {
			void _kind;
			void _id;
			return Promise.resolve();
		});
		const objectProblems = {
			delete: (problem: RuleSetReadProblem) =>
				deleteScenario(problem.kind, problem.id),
		} as unknown as ObjectReadProblemService;
		const decisions = new LoadProblemDecisionService();
		const service = new LoadProblemResolutionService(
			decisions,
			undefined,
			undefined,
			objectProblems,
		);
		const value: RuleSetReadProblem = {
			problemId: "object:ruleSet:ruleset_broken:serialization:invalidDocument",
			source: "serialization",
			operation: "load",
			subject: "ruleSet",
			reference: { kind: "ruleSet", id: "ruleset_broken" },
			scope: "object",
			category: "serialization",
			kind: "ruleSet",
			id: "ruleset_broken",
			reason: "invalidDocument",
			retryable: false,
			repairable: true,
			availableActions: ["repair", "delete", "later"],
		};
		const problem: QueuedLoadProblem = {
			...value,
			queueType: "object",
			value,
		};
		decisions.remember(problem, "delete");

		const applied: QueuedLoadProblem[] = [];
		await expect(
			service.applyRemembered([problem], ({ problem: resolved }) => {
				applied.push(resolved);
			}),
		).resolves.toBeUndefined();
		expect(applied).toEqual([problem]);
		expect(deleteScenario).toHaveBeenCalledWith("ruleSet", "ruleset_broken");
	});
});
