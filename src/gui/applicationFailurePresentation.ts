import {
	ApplicationInvariantError,
	ApplicationOperationError,
} from "../application/applicationError";
import type { LibraryLoadProblem } from "../application/libraryUseCaseContracts";
import type {
	ApplicationObjectReadProblem,
	ApplicationStoreReadProblem,
} from "../application/objectList";
import { ApplicationObjectListError } from "../application/objectList";
import type {
	ObjectContentProblem,
	StorageRecoverySummary,
} from "../application/storageRecovery";
import type { GuiTranslationKey } from "./i18n/de";
import type { GuiTranslator } from "./i18n/translate";

/** Kennzeichnet ausschließlich Texte, die bereits innerhalb der GUI erzeugt wurden. */
export class GuiDisplayError extends Error {}

export type GuiErrorPresentation = {
	message: string;
	technicalDetails?: string;
};

export function createGuiErrorPresentation(
	error: unknown,
	t: GuiTranslator,
	unknownText = t("error.unknown"),
): GuiErrorPresentation {
	const message = primaryErrorText(error, t, unknownText);
	const technicalDetails = technicalErrorDetails(error, t);
	return technicalDetails ? { message, technicalDetails } : { message };
}

export function applicationOperationErrorText(
	error: ApplicationOperationError,
	t: GuiTranslator,
): string {
	if (error.reason === "roleDistributionTeamHasNoRoles") {
		return t("roleDistribution.error.teamHasNoRoles", {
			teamName: readErrorString(error, "teamName", t("common.unknown")),
			count: readErrorNumber(error, "requestedCount"),
		});
	}
	if (error.reason === "roleDistributionInsufficientDistinctRoles") {
		return t("roleDistribution.error.insufficientDistinctRoles", {
			teamName: readErrorString(error, "teamName", t("common.unknown")),
			requestedCount: readErrorNumber(error, "requestedCount"),
			count: readErrorNumber(error, "availableRoleCount"),
		});
	}
	return applicationFailureReasonText(error.reason, t);
}

function readErrorString(
	error: ApplicationOperationError,
	key: string,
	fallback: string,
): string {
	const value = error.parameters[key];
	return typeof value === "string" ? value : fallback;
}

function readErrorNumber(
	error: ApplicationOperationError,
	key: string,
): number {
	const value = error.parameters[key];
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function guiErrorText(
	error: unknown,
	t: GuiTranslator,
	unknownText = t("error.unknown"),
): string {
	const presentation = createGuiErrorPresentation(error, t, unknownText);
	const summary = technicalErrorSummary(error);
	return summary
		? `${presentation.message} ${t("error.technicalInline", { details: summary })}`
		: presentation.message;
}

function primaryErrorText(
	error: unknown,
	t: GuiTranslator,
	unknownText: string,
): string {
	if (error instanceof ApplicationOperationError)
		return applicationOperationErrorText(error, t);
	if (error instanceof ApplicationInvariantError)
		return applicationFailureReasonText("invariantViolation", t);
	if (error instanceof ApplicationObjectListError)
		return objectStoreReadProblemText(error.problem, t);
	if (error instanceof GuiDisplayError) return error.message;
	return unknownText;
}

function technicalErrorDetails(
	error: unknown,
	t: GuiTranslator,
): string | undefined {
	if (error instanceof GuiDisplayError) return undefined;
	if (
		error instanceof ApplicationOperationError &&
		error.expectation === "expected"
	)
		return undefined;
	if (error instanceof ApplicationObjectListError) return undefined;
	if (!(error instanceof Error)) return undefined;

	const lines: string[] = [];
	if (error instanceof ApplicationOperationError) {
		lines.push(`${t("error.details.source")}: ${error.source}`);
		lines.push(`${t("error.details.operation")}: ${error.operation}`);
		lines.push(`${t("error.details.subject")}: ${error.subject}`);
		lines.push(`${t("error.details.reason")}: ${error.reason}`);
		if (error.diagnostic)
			lines.push(`${t("error.details.diagnostic")}: ${error.diagnostic}`);
	} else {
		lines.push(`${t("error.details.type")}: ${error.name || "Error"}`);
		if (error.message)
			lines.push(`${t("error.details.message")}: ${error.message}`);
	}
	const cause = error.cause;
	if (cause instanceof Error && cause !== error) {
		lines.push(`${t("error.details.cause")}: ${cause.name}: ${cause.message}`);
	}
	const stack = cause instanceof Error ? cause.stack : error.stack;
	if (__DEV__ && stack) {
		lines.push("", `${t("error.details.stack")}:`, stack);
	}
	return lines.join("\n") || undefined;
}

function technicalErrorSummary(error: unknown): string | undefined {
	if (error instanceof GuiDisplayError) return undefined;
	if (
		error instanceof ApplicationOperationError &&
		error.expectation === "expected"
	)
		return undefined;
	if (error instanceof ApplicationObjectListError) return undefined;
	if (!(error instanceof Error)) return undefined;
	if (error instanceof ApplicationOperationError)
		return (
			error.diagnostic ??
			(error.cause instanceof Error ? error.cause.message : undefined)
		);
	return error.message || undefined;
}

export function applicationFailureReasonText(
	reason: string,
	t: GuiTranslator,
): string {
	const keys: Record<string, GuiTranslationKey> = {
		notFound: "error.dataNotFound",
		missingLibrary: "error.dataNotFound",
		permissionDenied: "error.dataUnreadable",
		unreadable: "error.dataUnreadable",
		storageUnavailable: "error.storageUnavailable",
		diskFull: "error.diskFull",
		writeFailure: "error.writeFailed",
		unsupported: "error.storageUnavailable",
		interruptedWrite: "error.writeFailed",
		targetExists: "error.targetExists",
		invalidFileName: "error.invalidFileReference",
		orphanedRecovery: "error.incompleteRecovery",
		invalidJson: "error.invalidJson",
		invalidDocument: "error.invalidDocument",
		unsupportedVersion: "error.unsupportedVersion",
		encodingFailure: "error.encodingFailed",
		decodeFailed: "error.encodingFailed",
		invalidObject: "error.invalidObject",
		repairFailed: "error.repairFailed",
		decisionExpired: "error.decisionExpired",
		decisionRequired: "error.decisionRequired",
		invalidDecision: "error.invalidDecision",
		wrongObjectKind: "error.wrongObjectKind",
		invalidValue: "error.invalidValue",
		preconditionNotMet: "error.preconditionNotMet",
		protectedObject: "error.protectedObject",
		entityNotFound: "error.entityNotFound",
		unsupportedMediaType: "error.unsupportedMediaType",
		invalidResourceSource: "error.invalidResourceSource",
		unsafeResourceSource: "error.unsafeResourceSource",
		invariantViolation: "error.unexpected",
	};
	return t(keys[reason] ?? "error.unexpected");
}

export function objectReadProblemText(
	problem: ApplicationObjectReadProblem,
	t: GuiTranslator,
): string {
	if (
		problem.kind === "ruleSet" ||
		("componentKind" in problem && problem.componentKind === "ruleSet")
	)
		return t("error.ruleSetInvalid");
	if (problem.category === "domain")
		return applicationFailureReasonText(problem.reason, t);
	const keys: Partial<Record<string, GuiTranslationKey>> = {
		invalidFileName: "error.fileNameInvalid",
		decodeFailed: "error.savedDataUnreadable",
		invalidJson: "error.savedDataInvalidJson",
		invalidDocument: "error.savedObjectInvalid",
		unsupportedVersion: "error.savedObjectUnsupportedVersion",
		encodingFailure: "error.savedObjectEncodingFailed",
	};
	return t(keys[problem.reason] ?? "error.savedObjectProcessingFailed");
}

export function objectStoreReadProblemText(
	problem: ApplicationStoreReadProblem,
	t: GuiTranslator,
): string {
	if (problem.category === "storage")
		return t(
			problem.reason === "missingLibrary"
				? "error.objectStoreMissing"
				: "error.objectStoreUnreadable",
		);
	const keys: Partial<Record<string, GuiTranslationKey>> = {
		decodeFailed: "error.savedDataUnreadable",
		invalidJson: "error.objectStoreInvalidJson",
		invalidDocument: "error.objectStoreInvalid",
		unsupportedVersion: "error.objectStoreUnsupportedVersion",
		encodingFailure: "error.objectStoreEncodingFailed",
	};
	return t(keys[problem.reason] ?? "error.objectStoreProcessingFailed");
}

export function contentProblemText(
	problem: ObjectContentProblem,
	t: GuiTranslator,
): string {
	return applicationFailureReasonText(problem.reason, t);
}

export function storageRecoveryText(
	recovery: StorageRecoverySummary,
	t: GuiTranslator,
): string {
	if (recovery.validationProblem)
		return contentProblemText(recovery.validationProblem, t);
	return t(
		recovery.reason === "orphanedRecovery"
			? "error.newFileMissing"
			: "error.incompleteWrite",
	);
}

export function libraryLoadProblemText(
	problem: LibraryLoadProblem,
	t: GuiTranslator,
): string {
	if (problem.invalidDocumentKind === "library") {
		const keys: Partial<Record<string, GuiTranslationKey>> = {
			invalidJson: "error.ruleSetStoreInvalidJson",
			decodeFailed: "error.ruleSetsUnreadable",
			invalidDocument: "error.ruleSetStoreInvalid",
		};
		const key = keys[problem.reason];
		if (key) return t(key);
	}
	return applicationFailureReasonText(problem.reason, t);
}
