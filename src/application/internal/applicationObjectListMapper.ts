import { getDisplayName } from "../../domain/localizedNames";
import type {
	GameObjectMetadata,
	ObjectListResult,
	ObjectReadProblem,
	PersistedObjectKind,
	RuleSetObjectMetadata,
} from "../../persistence/objectPersistenceTypes";
import { normalizeApplicationProblemCapabilities } from "../applicationError";
import { normalizeLoadProblemActions } from "../loadProblemQueue";
import type {
	ApplicationGameObjectMetadata,
	ApplicationObjectListResult,
	ApplicationObjectMetadataByKind,
	ApplicationObjectReadProblem,
	ApplicationRuleSetObjectMetadata,
} from "../objectList";

export function createApplicationObjectListResult<
	K extends PersistedObjectKind,
>(
	snapshot: ObjectListResult<K>,
	language: string,
): ApplicationObjectListResult<K> {
	if (snapshot.status === "failed") {
		const problem = snapshot.problem;
		const capabilities = normalizeApplicationProblemCapabilities(
			problem.category,
			problem,
		);
		return {
			status: "expectedFailure",
			problem: {
				...problem,
				source: problem.category,
				operation: "list",
				subject: problem.kind === "ruleSet" ? "library" : problem.kind,
				problemId: `store:${problem.kind}:${problem.category}:${problem.reason}`,
				reference:
					problem.kind === "ruleSet"
						? ({ kind: "library" } as const)
						: ({ kind: problem.kind, storageKey: "library" } as const),
				...capabilities,
				availableActions: normalizeLoadProblemActions([
					...(capabilities.retryable ? (["retry"] as const) : []),
					...(capabilities.repairable ? (["repair"] as const) : []),
					"cancel",
				]),
			},
		};
	}
	const metadata = snapshot.metadata.map((item) =>
		localizeObjectMetadata(item, language),
	) as ApplicationObjectMetadataByKind[K][];
	if (metadata[0] && "version" in metadata[0])
		metadata.sort((left, right) =>
			left.name.localeCompare(right.name, language),
		);
	return {
		status: "loaded",
		metadata,
		problems: snapshot.problems.map((problem) =>
			createApplicationObjectReadProblem(problem),
		) as unknown as ApplicationObjectReadProblem<K>[],
		ids: snapshot.ids,
	};
}

function localizeObjectMetadata(
	metadata: GameObjectMetadata | RuleSetObjectMetadata,
	language: string,
): ApplicationGameObjectMetadata | ApplicationRuleSetObjectMetadata {
	if ("playerCount" in metadata) {
		const { names, ruleSetNames, ...summary } = metadata;
		return {
			...summary,
			name: getDisplayName({ name: metadata.name, names }, language),
			ruleSetName: getDisplayName(
				{ name: metadata.ruleSetName, names: ruleSetNames },
				language,
			),
		};
	}
	const { names, ...summary } = metadata;
	return {
		...summary,
		name: getDisplayName({ name: metadata.name, names }, language),
	};
}

function createApplicationObjectReadProblem(
	problem: ObjectReadProblem,
): ApplicationObjectReadProblem {
	const objectKey = "storageKey" in problem ? problem.storageKey : problem.id;
	const identity = {
		problemId: `object:${problem.kind}:${objectKey}:${problem.category}:${problem.reason}`,
		source: problem.category,
		operation: "load" as const,
		subject: problem.kind,
		reference:
			problem.kind === "ruleSet"
				? ({ kind: "ruleSet", id: problem.id } as const)
				: ({
						kind: problem.kind,
						storageKey: objectKey,
						id: problem.id,
					} as const),
	};
	const capabilities = normalizeApplicationProblemCapabilities(
		problem.category,
		{
			retryable:
				"retryable" in problem && typeof problem.retryable === "boolean"
					? problem.retryable
					: undefined,
			repairable: "repairable" in problem ? problem.repairable : undefined,
		},
	);
	if (problem.kind === "ruleSet")
		return {
			...problem,
			...identity,
			...capabilities,
			availableActions: normalizeLoadProblemActions([
				...(capabilities.retryable ? (["retry"] as const) : []),
				...(capabilities.repairable ? (["repair"] as const) : []),
				"delete",
				"later",
			]),
		};
	return {
		...problem,
		...identity,
		...capabilities,
		canExport: true,
		availableActions: normalizeLoadProblemActions([
			...(problem.category === "storage" && problem.canRepairFileName
				? (["repairFileName"] as const)
				: []),
			...(problem.category === "storage" && problem.canKeepBoth
				? (["keepBoth"] as const)
				: []),
			...(capabilities.retryable ? (["retry"] as const) : []),
			...(capabilities.repairable ? (["repair"] as const) : []),
			"delete",
			"export",
			"later",
		]),
	};
}
