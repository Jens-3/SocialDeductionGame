import { expect, it } from "vitest";
import { repairRecoveredLibrary } from "../src/domain/libraryContainerRepair";
import {
	createEmptyLibraryDocument,
	recoverLibraryStructure,
} from "../src/serialization/libraryRepair";

const repairLibraryDocument = (value: unknown) =>
	repairRecoveredLibrary(recoverLibraryStructure(value));

it("repariert Pflichtwerte und unbekannte Felder innerhalb des aktuellen Schemas", () => {
	const result = repairLibraryDocument({
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		unexpectedTopLevel: true,
		ruleSetsById: {
			current: {
				version: "falsch",
				teams: [
					{
						name: "Dorf",
						teamOrder: "falsch",
						unexpectedTeamField: true,
					},
				],
				roles: [{ name: "Seher", teamId: "Dorf" }],
				statuses: [{ name: "Vergiftet" }],
				unexpectedRuleSetField: true,
			},
			unrepairable: "kein Objekt",
		},
	});

	expect(result.report.repairedRuleSetCount).toBe(1);
	expect(result.report.removedRuleSets).toEqual([
		{
			storedId: "unrepairable",
			reason: "notAnObject",
		},
	]);
	expect(result.report.changes).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ kind: "unknownFieldsRemoved" }),
		]),
	);
	const serialized = JSON.parse(JSON.stringify(result.document)) as Record<
		string,
		unknown
	>;
	expect(serialized).toMatchObject({
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		ruleSetsById: {
			ruleset_current: {
				id: "ruleset_current",
				name: "Unbenanntes Regelwerk",
				version: 1,
				roles: [{ id: "r_seher", name: "Seher", teamId: "t_dorf" }],
				statuses: [{ id: "d_vergiftet", name: "Vergiftet" }],
			},
		},
	});
	expect(JSON.stringify(serialized)).not.toContain("unexpected");
});

it("trennt in Serialization lesbare und unlesbare RuleSet-Kandidaten", () => {
	const rawRuleSet = "noch kein strukturell gültiges RuleSet";
	const recovered = recoverLibraryStructure({
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		unknownEnvelopeField: true,
		ruleSetsById: { candidate: rawRuleSet },
	});

	expect(recovered.ruleSetCandidates).toEqual([]);
	expect(recovered.rejectedRuleSetCandidates).toEqual([
		{
			storedId: "candidate",
			value: rawRuleSet,
			reason: "notAnObject",
		},
	]);
	expect(recovered.diagnostics).toEqual({
		replacedRuleSetsById: false,
		removedFields: ["unknownEnvelopeField"],
	});
});

it("behandelt das entfernte updatedAt bei einer Reparatur als unbekanntes Feld", () => {
	const recovered = recoverLibraryStructure({
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		updatedAt: "2026-07-13T11:00:00.000Z",
		ruleSetsById: {},
	});
	const repaired = repairRecoveredLibrary(recovered);

	expect(recovered.diagnostics.removedFields).toContain("updatedAt");
	expect(repaired.document).not.toHaveProperty("updatedAt");
	expect(repaired.report.changes).toContainEqual({
		kind: "libraryUnknownFieldsRemoved",
		fields: ["updatedAt"],
	});
});

it("löst RuleSet-ID-Kollisionen erst in Application", () => {
	const result = repairLibraryDocument({
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		ruleSetsById: {
			first: {
				id: "ruleset_same",
				name: "First",
				teams: [],
				roles: [],
			},
			second: {
				id: "ruleset_same",
				name: "Second",
				teams: [],
				roles: [],
			},
		},
	});

	expect(Object.keys(result.document.ruleSetsById as object)).toEqual([
		"ruleset_same",
		"ruleset_same_1",
	]);
	expect(result.report.changes).toEqual(
		expect.arrayContaining([
			{
				kind: "ruleSetIdCollisionResolved",
				storedId: "second",
				newId: "ruleset_same_1",
			},
		]),
	);
});

it("erzeugt eine vollständige leere Library", () => {
	expect(createEmptyLibraryDocument()).toEqual({
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		ruleSetsById: {},
	});
});

it("entfernt unbekannte Singularfelder statt sie zu migrieren", () => {
	const result = repairLibraryDocument({
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		ruleSetsById: {
			conflict: {
				name: "Konflikttest",
				teams: [{ name: "Plural-Team" }],
				team: [{ name: "Singular-Team" }],
				roles: [],
				role: [{ name: "Ignorierte Rolle" }],
				statuses: [],
				status: [{ name: "Ignorierter Zustand" }],
			},
		},
	});
	const ruleSet = Object.values(
		result.document.ruleSetsById as Record<string, Record<string, unknown>>,
	)[0];

	expect(ruleSet?.teams).toEqual(
		expect.arrayContaining([expect.objectContaining({ name: "Plural-Team" })]),
	);
	expect(ruleSet?.roles).toEqual([]);
	expect(ruleSet?.statuses).toEqual([]);
	expect(JSON.stringify(ruleSet)).not.toContain("Singular-Team");
	expect(JSON.stringify(ruleSet)).not.toContain("Ignorierte Rolle");
	expect(JSON.stringify(ruleSet)).not.toContain("Ignorierter Zustand");
	expect(result.report.changes).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ kind: "unknownFieldsRemoved" }),
		]),
	);
});

it("entfernt keine Kandidaten wegen unerwarteter Programmfehler", () => {
	const unexpected = new Error("Programmierfehler in der Library-Reparatur");
	const candidate: Record<string, unknown> = {};
	Object.defineProperty(candidate, "name", {
		enumerable: true,
		get: () => {
			throw unexpected;
		},
	});

	try {
		repairRecoveredLibrary({
			storageType: "social-deduction-app-library",
			storageVersion: 1,
			ruleSetCandidates: [{ storedId: "candidate", value: candidate }],
			rejectedRuleSetCandidates: [],
			diagnostics: {
				replacedRuleSetsById: false,
				removedFields: [],
			},
		});
		throw new Error("Der unerwartete Fehler wurde nicht ausgelöst.");
	} catch (error) {
		expect(error).toBe(unexpected);
	}
});
