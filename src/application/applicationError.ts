export type ApplicationErrorSource =
	| "domain"
	| "persistence"
	| "serialization"
	| "storage"
	| "application"
	| "platform"
	| "unknown";
export type ApplicationErrorExpectation = "expected" | "unexpected";
export type ApplicationErrorOperation =
	| "initialize"
	| "list"
	| "load"
	| "save"
	| "delete"
	| "rename"
	| "import"
	| "export"
	| "validate"
	| "repair"
	| "recover"
	| "resolve"
	| "unknown";
export type ApplicationErrorSubject =
	| "game"
	| "template"
	| "ruleSet"
	| "library"
	| "settings"
	| "image"
	| "unknown";
export type ApplicationErrorReason =
	| "notFound"
	| "permissionDenied"
	| "unreadable"
	| "storageUnavailable"
	| "diskFull"
	| "writeFailure"
	| "unsupported"
	| "targetExists"
	| "invalidFileName"
	| "interruptedWrite"
	| "orphanedRecovery"
	| "missingLibrary"
	| "storageFailure"
	| "decodeFailed"
	| "invalidJson"
	| "invalidDocument"
	| "unsupportedVersion"
	| "encodingFailure"
	| "serializationFailure"
	| "invalidObject"
	| "repairFailed"
	| "decisionExpired"
	| "decisionRequired"
	| "invalidDecision"
	| "wrongObjectKind"
	| "invalidValue"
	| "preconditionNotMet"
	| "protectedObject"
	| "entityNotFound"
	| "unsupportedMediaType"
	| "invalidResourceSource"
	| "unsafeResourceSource"
	| "roleDistributionTeamHasNoRoles"
	| "roleDistributionInsufficientDistinctRoles"
	| "invariantViolation"
	| "unexpectedFailure";
export type ApplicationErrorCode =
	| "APPLICATION_EXPECTED_ERROR"
	| "APPLICATION_UNEXPECTED_ERROR";

export type ApplicationStorageFileCategory = "library" | "template" | "game";
export type ApplicationStorageFileReference = {
	category: ApplicationStorageFileCategory;
	fileName: string;
};
export type ApplicationStorageErrorContext = {
	category?: ApplicationStorageFileCategory;
	file?: ApplicationStorageFileReference;
	targetFile?: ApplicationStorageFileReference;
	commandId?: string;
};
export type ApplicationErrorParameters = Readonly<
	Record<string, string | number>
>;

export type ApplicationProblemCapabilities = {
	retryable?: boolean;
	repairable?: boolean;
};

export type NormalizedApplicationProblemCapabilities = {
	retryable: boolean;
	repairable: boolean;
};

export function normalizeApplicationProblemCapabilities(
	source: ApplicationErrorSource,
	capabilities: ApplicationProblemCapabilities,
): NormalizedApplicationProblemCapabilities {
	return {
		retryable: capabilities.retryable ?? source === "storage",
		repairable: capabilities.repairable ?? false,
	};
}

export class ApplicationInvariantError extends Error {
	readonly source = "application";

	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "ApplicationInvariantError";
	}
}

export class ApplicationOperationError extends Error {
	readonly code: ApplicationErrorCode;
	readonly severity: "error" | "critical";

	constructor(
		readonly source: ApplicationErrorSource,
		readonly expectation: ApplicationErrorExpectation,
		readonly operation: ApplicationErrorOperation,
		readonly subject: ApplicationErrorSubject,
		readonly reason: ApplicationErrorReason,
		readonly diagnostic: string | undefined,
		cause: unknown,
		storageContext: ApplicationStorageErrorContext = {},
		retryable?: boolean,
		repairable?: boolean,
		readonly parameters: ApplicationErrorParameters = {},
	) {
		super(reason, { cause });
		this.name = "ApplicationOperationError";
		this.code =
			expectation === "expected"
				? "APPLICATION_EXPECTED_ERROR"
				: "APPLICATION_UNEXPECTED_ERROR";
		this.severity = expectation === "expected" ? "error" : "critical";
		this.category = storageContext.category;
		this.file = storageContext.file;
		this.targetFile = storageContext.targetFile;
		this.commandId = storageContext.commandId;
		const capabilities = normalizeApplicationProblemCapabilities(source, {
			retryable,
			repairable,
		});
		this.retryable = capabilities.retryable;
		this.repairable = capabilities.repairable;
	}

	readonly category?: ApplicationStorageFileCategory;
	readonly file?: ApplicationStorageFileReference;
	readonly targetFile?: ApplicationStorageFileReference;
	readonly commandId?: string;
	readonly retryable: boolean;
	readonly repairable: boolean;
}

export function expectedApplicationError(
	operation: ApplicationErrorOperation,
	subject: ApplicationErrorSubject,
	reason: ApplicationErrorReason,
	diagnostic?: string,
): ApplicationOperationError {
	return new ApplicationOperationError(
		"application",
		"expected",
		operation,
		subject,
		reason,
		diagnostic,
		undefined,
	);
}
