export type DomainOperation = "validate" | "repair" | "resolve";

export type DomainFailureReason =
	| "invalidObject"
	| "repairFailed"
	| "roleDistributionTeamHasNoRoles"
	| "roleDistributionInsufficientDistinctRoles";

export type DomainFailureParameters = Readonly<Record<string, string | number>>;

export type DomainFailure = {
	source: "domain";
	operation: DomainOperation;
	reason: DomainFailureReason;
	repairable: boolean;
	componentKind?: "ruleSet";
	diagnostic?: string;
	details?: string;
	parameters?: DomainFailureParameters;
};

export class DomainOperationError extends Error {
	readonly source = "domain";

	constructor(readonly failure: DomainFailure) {
		super(failure.diagnostic ?? failure.details);
		this.name = "DomainOperationError";
	}
}

export function isDomainOperationError(
	error: unknown,
): error is DomainOperationError {
	return (
		error instanceof DomainOperationError ||
		(typeof error === "object" &&
			error !== null &&
			"source" in error &&
			error.source === "domain" &&
			"failure" in error)
	);
}

export function domainFailure(
	operation: DomainOperation,
	reason: DomainFailureReason,
	repairable: boolean,
	details?: string,
): DomainOperationError {
	return new DomainOperationError({
		source: "domain",
		operation,
		reason,
		repairable,
		...(details ? { details } : {}),
	});
}
