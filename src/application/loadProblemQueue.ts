import type { DomainFailureReason } from "../domain/domainFailure";
import type {
	ObjectSerializationErrorReason,
	ObjectStorageProblemReason,
} from "../persistence/objectPersistenceError";
import type { ObjectRecoverySource } from "../persistence/objectPersistenceTypes";

export type LoadProblemAction =
	| "retry"
	| "cancel"
	| "keepOld"
	| "keepNew"
	| "keepBoth"
	| "restoreBackup"
	| "repair"
	| "createEmpty"
	| "delete"
	| "repairFileName"
	| "export"
	| "later";

export type LoadProblemDescriptor = {
	reason:
		| ObjectStorageProblemReason
		| ObjectSerializationErrorReason
		| DomainFailureReason;
	recoverySource?: ObjectRecoverySource;
	retryable?: boolean;
	repairable?: boolean;
	availableActions: readonly LoadProblemAction[];
};

const REASON_ORDER: LoadProblemDescriptor["reason"][] = [
	"orphanedRecovery",
	"interruptedWrite",
	"decodeFailed",
	"invalidJson",
	"invalidDocument",
	"invalidObject",
	"repairFailed",
	"unsupportedVersion",
	"encodingFailure",
	"serializationFailure",
	"invalidFileName",
	"missingLibrary",
];

const ACTION_ORDER: LoadProblemAction[] = [
	"retry",
	"keepOld",
	"keepNew",
	"keepBoth",
	"restoreBackup",
	"repair",
	"createEmpty",
	"delete",
	"repairFileName",
	"export",
	"later",
	"cancel",
];

export function normalizeLoadProblemActions(
	actions: Iterable<LoadProblemAction>,
): LoadProblemAction[] {
	const unique = new Set(actions);
	return ACTION_ORDER.filter((action) => unique.has(action));
}

export function loadProblemGroupKey(problem: LoadProblemDescriptor): string {
	const retryable = problem.retryable ?? problemCategory(problem) === "storage";
	const repairable = problem.repairable ?? false;
	return JSON.stringify([
		problem.reason,
		problem.recoverySource ?? "",
		retryable,
		repairable,
		normalizeLoadProblemActions(problem.availableActions),
		loadProblemSubject(problem),
	]);
}

function problemCategory(problem: LoadProblemDescriptor): string | undefined {
	return "category" in problem && typeof problem.category === "string"
		? problem.category
		: undefined;
}

function loadProblemSubject(problem: LoadProblemDescriptor): string {
	const classified = problem as LoadProblemDescriptor & {
		kind?: unknown;
		componentKind?: unknown;
		invalidDocumentKind?: unknown;
	};
	if (typeof classified.invalidDocumentKind === "string")
		return classified.invalidDocumentKind;
	if (typeof classified.componentKind === "string")
		return classified.componentKind;
	return typeof classified.kind === "string" ? classified.kind : "";
}

export class LoadProblemDecisionService {
	readonly #decisions = new Map<string, LoadProblemAction>();

	remember(problem: LoadProblemDescriptor, action: LoadProblemAction): void {
		if (action === "export") return;
		this.#decisions.set(loadProblemGroupKey(problem), action);
	}

	getRememberedAction(
		problem: LoadProblemDescriptor,
	): LoadProblemAction | undefined {
		return this.#decisions.get(loadProblemGroupKey(problem));
	}

	forget(problem: LoadProblemDescriptor): void {
		this.#decisions.delete(loadProblemGroupKey(problem));
	}

	clear(): void {
		this.#decisions.clear();
	}
}

export function sortLoadProblems<Problem extends LoadProblemDescriptor>(
	problems: Iterable<Problem>,
	stableKey: (problem: Problem) => string = () => "",
): Problem[] {
	return [...problems].sort((left, right) => {
		const reasonDifference =
			REASON_ORDER.indexOf(left.reason) - REASON_ORDER.indexOf(right.reason);
		if (reasonDifference !== 0) return reasonDifference;
		const sourceDifference = (left.recoverySource ?? "").localeCompare(
			right.recoverySource ?? "",
		);
		if (sourceDifference !== 0) return sourceDifference;
		const actionsDifference = JSON.stringify(
			normalizeLoadProblemActions(left.availableActions),
		).localeCompare(
			JSON.stringify(normalizeLoadProblemActions(right.availableActions)),
		);
		if (actionsDifference !== 0) return actionsDifference;
		const subjectDifference = loadProblemSubject(left).localeCompare(
			loadProblemSubject(right),
		);
		return subjectDifference !== 0
			? subjectDifference
			: stableKey(left).localeCompare(stableKey(right));
	});
}
