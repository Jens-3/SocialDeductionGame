import { isDomainOperationError } from "./domainFailure";
import type { RuleSet } from "./ruleSet";
import type { RuleSetRepairChange } from "./ruleSetRepair";
import { repairRuleSet } from "./ruleSetRepair";
import { createUniqueId } from "./stringSanitizer";

export type RecoverableLibraryStructure = {
	storageType: "social-deduction-app-library";
	storageVersion: 1;
	ruleSetCandidates: Array<{
		storedId: string;
		value: Record<string, unknown>;
	}>;
	rejectedRuleSetCandidates: Array<{
		storedId: string;
		value: unknown;
		reason: "notAnObject";
	}>;
	diagnostics: {
		replacedRuleSetsById: boolean;
		removedFields: string[];
	};
};

export type RemovedRuleSetReport = {
	storedId: string;
	name?: string;
	reason: "notAnObject" | "repairFailed";
};

export type LibraryRepairChange =
	| RuleSetRepairChange
	| { kind: "ruleSetIdCollisionResolved"; storedId: string; newId: string }
	| { kind: "ruleSetsContainerReplaced" }
	| { kind: "libraryUnknownFieldsRemoved"; fields: string[] }
	| { kind: "insertedMissingQuote"; position: number }
	| { kind: "addedClosingBraces"; count: number }
	| { kind: "addedOpeningBraces"; count: number };

export type LibraryRepairReport = {
	repairedRuleSetCount: number;
	removedRuleSets: RemovedRuleSetReport[];
	changes: LibraryRepairChange[];
};

export type RepairLibraryResult = {
	document: Record<string, unknown>;
	report: LibraryRepairReport;
};

export function repairRecoveredLibrary(
	recovered: RecoverableLibraryStructure,
): RepairLibraryResult {
	const changes = createEnvelopeChanges(recovered.diagnostics);
	const removedRuleSets: RemovedRuleSetReport[] =
		recovered.rejectedRuleSetCandidates.map(({ storedId, value, reason }) => ({
			storedId,
			...(readName(value) ? { name: readName(value) } : {}),
			reason,
		}));
	const repairedRuleSets = new Map<string, RuleSet>();
	const usedRuleSetIds = new Set<string>();

	for (const { storedId, value: rawRuleSet } of recovered.ruleSetCandidates) {
		try {
			const candidate = withStoredIdFallback(rawRuleSet, storedId);
			const repaired = repairRuleSet(candidate);
			const ruleSet = resolveRuleSetIdCollision(
				repaired.ruleSet,
				usedRuleSetIds,
			);
			repairedRuleSets.set(ruleSet.id, ruleSet);
			changes.push(...repaired.changes);
			if (ruleSet.id !== repaired.ruleSet.id)
				changes.push({
					kind: "ruleSetIdCollisionResolved",
					storedId,
					newId: ruleSet.id,
				});
		} catch (error) {
			if (!isDomainOperationError(error)) throw error;
			removedRuleSets.push({
				storedId,
				...(readName(rawRuleSet) ? { name: readName(rawRuleSet) } : {}),
				reason: "repairFailed",
			});
		}
	}

	return {
		document: {
			storageType: recovered.storageType,
			storageVersion: recovered.storageVersion,
			ruleSetsById: Object.fromEntries(repairedRuleSets),
		},
		report: {
			repairedRuleSetCount: repairedRuleSets.size,
			removedRuleSets,
			changes: [...new Set(changes)],
		},
	};
}

function withStoredIdFallback(
	value: Record<string, unknown>,
	storedId: string,
): Record<string, unknown> {
	return typeof value.id !== "string" ? { ...value, id: storedId } : value;
}

function resolveRuleSetIdCollision(
	ruleSet: RuleSet,
	usedIds: Set<string>,
): RuleSet {
	if (!usedIds.has(ruleSet.id)) {
		usedIds.add(ruleSet.id);
		return ruleSet;
	}
	const id = createUniqueId(ruleSet.id, "ruleSet", usedIds).id;
	usedIds.add(id);
	return { ...ruleSet, id };
}

function createEnvelopeChanges(diagnostics: {
	replacedRuleSetsById: boolean;
	removedFields: string[];
}): LibraryRepairChange[] {
	return [
		...(diagnostics.replacedRuleSetsById
			? ([{ kind: "ruleSetsContainerReplaced" }] as const)
			: []),
		...(diagnostics.removedFields.length > 0
			? [
					{
						kind: "libraryUnknownFieldsRemoved" as const,
						fields: diagnostics.removedFields,
					},
				]
			: []),
	];
}

function readName(value: unknown): string | undefined {
	const name = record(value)?.name;
	return typeof name === "string" ? name.trim() || undefined : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}
