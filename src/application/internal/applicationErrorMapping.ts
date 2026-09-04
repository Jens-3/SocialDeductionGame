import { isDomainOperationError } from "../../domain/domainFailure";
import {
	isObjectSerializationError,
	isObjectStorageError,
} from "../../persistence/objectPersistenceError";
import { isObjectSaveInterruptedError } from "../../persistence/objectSaveInterruptedError";
import { isStorageOperationError } from "../../persistence/ports/storageFailure";
import {
	type ApplicationErrorExpectation,
	type ApplicationErrorOperation,
	type ApplicationErrorParameters,
	type ApplicationErrorReason,
	type ApplicationErrorSource,
	type ApplicationErrorSubject,
	ApplicationInvariantError,
	ApplicationOperationError,
	type ApplicationStorageErrorContext,
} from "../applicationError";

export function createApplicationOperationError(
	error: unknown,
	operationHint: ApplicationErrorOperation = "unknown",
): Error {
	if (isAbortError(error) || error instanceof ApplicationOperationError)
		return error;
	return new ApplicationOperationError(
		applicationErrorSource(error),
		applicationErrorExpectation(error),
		applicationErrorOperation(error, operationHint),
		applicationErrorSubject(error),
		applicationErrorReason(error),
		applicationDiagnostic(error),
		error,
		applicationStorageContext(error),
		applicationRetryable(error),
		applicationRepairable(error),
		applicationErrorParameters(error),
	);
}

export function createDefaultApplicationOperationError(error: unknown): Error {
	return createApplicationOperationError(error);
}

export function createContextualApplicationOperationError(
	error: unknown,
	operationHint: ApplicationErrorOperation,
): Error {
	return createApplicationOperationError(error, operationHint);
}

export async function executeApplicationOperation<T>(
	operation: () => Promise<T>,
	operationHint: ApplicationErrorOperation,
): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		throw createContextualApplicationOperationError(error, operationHint);
	}
}

export function executeApplicationOperationSync<T>(
	operation: () => T,
	operationHint: ApplicationErrorOperation,
): T {
	try {
		return operation();
	} catch (error) {
		throw createContextualApplicationOperationError(error, operationHint);
	}
}

function applicationErrorReason(error: unknown): ApplicationErrorReason {
	if (isDomainOperationError(error)) return error.failure.reason;
	if (isObjectStorageError(error) || isObjectSerializationError(error))
		return error.reason;
	if (isStorageOperationError(error)) return error.failure.reason;
	if (error instanceof ApplicationInvariantError) return "invariantViolation";
	return "unexpectedFailure";
}

function applicationErrorOperation(
	error: unknown,
	operationHint: ApplicationErrorOperation,
): ApplicationErrorOperation {
	if (isDomainOperationError(error)) return error.failure.operation;
	if (isObjectStorageError(error)) return error.operation;
	if (isObjectSerializationError(error)) {
		switch (error.operation) {
			case "decode":
				return "load";
			case "encode":
				return "save";
			case "repair":
				return "repair";
		}
	}
	if (isStorageOperationError(error)) {
		switch (error.failure.operation) {
			case "read":
				return "load";
			case "write":
				return "save";
			default:
				return error.failure.operation;
		}
	}
	return operationHint;
}

function applicationErrorSubject(error: unknown): ApplicationErrorSubject {
	if (isObjectStorageError(error) || isObjectSerializationError(error))
		return error.context?.kind ?? "unknown";
	return "unknown";
}

function applicationErrorSource(error: unknown): ApplicationErrorSource {
	if (isDomainOperationError(error)) return "domain";
	if (isObjectStorageError(error))
		return error.reason === "storageFailure" && !error.storageFailure
			? "persistence"
			: "storage";
	if (isObjectSerializationError(error)) return "serialization";
	if (isStorageOperationError(error)) return "storage";
	const declaredSource = declaredApplicationErrorSource(error);
	if (declaredSource) return declaredSource;
	if (typeof DOMException !== "undefined" && error instanceof DOMException)
		return "platform";
	return "unknown";
}

function applicationErrorExpectation(
	error: unknown,
): ApplicationErrorExpectation {
	if (isDomainOperationError(error)) return "expected";
	if (isObjectStorageError(error))
		return error.reason === "storageFailure" ? "unexpected" : "expected";
	if (isObjectSerializationError(error))
		return error.reason === "serializationFailure" ? "unexpected" : "expected";
	if (isStorageOperationError(error)) return "expected";
	return "unexpected";
}

function declaredApplicationErrorSource(
	error: unknown,
): ApplicationErrorSource | undefined {
	if (typeof error !== "object" || error === null || !("source" in error))
		return undefined;
	switch (error.source) {
		case "domain":
		case "persistence":
		case "serialization":
		case "storage":
		case "application":
		case "platform":
		case "unknown":
			return error.source;
		default:
			return undefined;
	}
}

function applicationDiagnostic(error: unknown): string | undefined {
	if (isDomainOperationError(error))
		return error.failure.diagnostic ?? error.failure.details;
	if (
		(isObjectStorageError(error) || isObjectSerializationError(error)) &&
		typeof error.diagnostic === "string"
	)
		return error.diagnostic;
	return error instanceof Error && error.message.trim()
		? error.message.trim()
		: undefined;
}

function applicationErrorParameters(
	error: unknown,
): ApplicationErrorParameters {
	if (isDomainOperationError(error)) return error.failure.parameters ?? {};
	return {};
}

function applicationStorageContext(
	error: unknown,
): ApplicationStorageErrorContext {
	if (isObjectStorageError(error)) {
		const failure = error.storageFailure;
		const file =
			failure?.file ??
			(isObjectSaveInterruptedError(error) ? error.file : undefined);
		const commandId = isObjectSaveInterruptedError(error)
			? error.commandId
			: failure?.commandId;
		return {
			...(failure?.category || file
				? { category: failure?.category ?? file?.category }
				: {}),
			...(file ? { file } : {}),
			...(failure?.targetFile ? { targetFile: failure.targetFile } : {}),
			...(commandId ? { commandId } : {}),
		};
	}
	if (isStorageOperationError(error)) {
		const { category, file, targetFile, commandId } = error.failure;
		return {
			...(category || file ? { category: category ?? file?.category } : {}),
			...(file ? { file } : {}),
			...(targetFile ? { targetFile } : {}),
			...(commandId ? { commandId } : {}),
		};
	}
	return {};
}

function applicationRetryable(error: unknown): boolean | undefined {
	if (isObjectStorageError(error)) return error.retryable;
	if (isStorageOperationError(error)) return error.failure.retryable;
	return undefined;
}

function applicationRepairable(error: unknown): boolean | undefined {
	if (isDomainOperationError(error)) return error.failure.repairable;
	if (isObjectStorageError(error) || isObjectSerializationError(error))
		return error.repairable;
	if (isStorageOperationError(error)) return error.failure.repairable;
	return undefined;
}

function isAbortError(error: unknown): error is Error {
	return error instanceof Error && error.name === "AbortError";
}
