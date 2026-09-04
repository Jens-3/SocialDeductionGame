import { serializationFailure } from "./serializationFailure";

export type LibraryRuleSetRepairCandidate = {
	storedId: string;
	value: Record<string, unknown>;
};

export type RejectedLibraryRuleSetCandidate = {
	storedId: string;
	value: unknown;
	reason: "notAnObject";
};

export type LibraryStructureRepairDiagnostics = {
	replacedRuleSetsById: boolean;
	removedFields: string[];
};

export type RecoveredLibraryStructure = {
	storageType: "social-deduction-app-library";
	storageVersion: 1;
	ruleSetCandidates: LibraryRuleSetRepairCandidate[];
	rejectedRuleSetCandidates: RejectedLibraryRuleSetCandidate[];
	diagnostics: LibraryStructureRepairDiagnostics;
};

export function createEmptyLibraryDocument(): Record<string, unknown> {
	return {
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		ruleSetsById: {},
	};
}

/** Gewinnt ausschließlich die aktuelle Library-Hülle und ihre Rohkandidaten. */
export function recoverLibraryStructure(
	value: unknown,
): RecoveredLibraryStructure {
	const source = record(value);
	if (
		source?.storageType !== "social-deduction-app-library" ||
		source.storageVersion !== 1
	)
		throw serializationFailure(
			"repair",
			"unsupportedVersion",
			false,
			undefined,
			"Die Library verwendet nicht das aktuelle Dateiformat.",
		);

	const storedRuleSets = record(source.ruleSetsById);
	const allowedFields = new Set([
		"storageType",
		"storageVersion",
		"ruleSetsById",
	]);
	const ruleSetCandidates: LibraryRuleSetRepairCandidate[] = [];
	const rejectedRuleSetCandidates: RejectedLibraryRuleSetCandidate[] = [];
	for (const [storedId, candidate] of Object.entries(storedRuleSets ?? {})) {
		const candidateRecord = record(candidate);
		if (candidateRecord) {
			ruleSetCandidates.push({ storedId, value: candidateRecord });
		} else {
			rejectedRuleSetCandidates.push({
				storedId,
				value: candidate,
				reason: "notAnObject",
			});
		}
	}

	return {
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		ruleSetCandidates,
		rejectedRuleSetCandidates,
		diagnostics: {
			replacedRuleSetsById: storedRuleSets === undefined,
			removedFields: Object.keys(source).filter(
				(field) => !allowedFields.has(field),
			),
		},
	};
}

function record(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}
