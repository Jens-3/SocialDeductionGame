import { describe, expect, it } from "vitest";
import {
	LoadProblemDecisionService,
	loadProblemGroupKey,
	normalizeLoadProblemActions,
	sortLoadProblems,
} from "../src/application/loadProblemQueue";

describe("Load-Problem-Queue", () => {
	it("behandelt availableActions unabhängig von Reihenfolge und Duplikaten", () => {
		const first = {
			reason: "invalidJson" as const,
			recoverySource: "temporary" as const,
			availableActions: ["later", "delete", "later"] as const,
			message: "Defekte Datei",
		};
		const second = {
			...first,
			availableActions: ["delete", "later"] as const,
		};

		expect(normalizeLoadProblemActions(first.availableActions)).toEqual([
			"delete",
			"later",
		]);
		expect(loadProblemGroupKey(first)).toBe(loadProblemGroupKey(second));
	});

	it("sortiert nach reason, recoverySource, availableActions und message", () => {
		const problems = sortLoadProblems([
			{
				reason: "invalidJson" as const,
				availableActions: ["later"] as const,
				message: "B",
			},
			{
				reason: "decodeFailed" as const,
				availableActions: ["delete", "later"] as const,
				message: "Z",
			},
			{
				reason: "invalidJson" as const,
				availableActions: ["delete", "later"] as const,
				message: "A",
			},
		]);

		expect(problems.map(({ reason, message }) => [reason, message])).toEqual([
			["decodeFailed", "Z"],
			["invalidJson", "A"],
			["invalidJson", "B"],
		]);
	});

	it("speichert Entscheidungen anhand des kanonischen Gruppenschlüssels", () => {
		const decisions = new LoadProblemDecisionService();
		const first = {
			reason: "invalidJson" as const,
			availableActions: ["later", "delete"] as const,
			message: "Defekte Datei",
		};
		const sameGroup = {
			...first,
			availableActions: ["delete", "later"] as const,
		};

		decisions.remember(first, "delete");

		expect(decisions.getRememberedAction(sameGroup)).toBe("delete");
	});
});
