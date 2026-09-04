import type { StorageFailureReason } from "../persistence/ports/storageFailure";
import { sanitizeText } from "../shared/textSanitizer";

const MAX_CAUSE_DEPTH = 6;

/** Interne Adaptermeldung, die nicht als externe Diagnostic weitergereicht wird. */
export class InternalStorageError extends Error {
	readonly externalDiagnostic = false;
}

/** Liefert ausschließlich einen an der technischen Grenze empfangenen Fehlertext. */
export function externalErrorDiagnostic(error: unknown): string | undefined {
	const message = externalErrorMessage(error);
	if (message === undefined) return undefined;
	const sanitized = sanitizeText(message);
	return sanitized.length > 0 ? sanitized : undefined;
}

/** Bereinigt einen extern empfangenen Text genau einmal an der Storage-Grenze. */
export function sanitizeExternalDiagnostic(
	message: unknown,
): string | undefined {
	if (typeof message !== "string") return undefined;
	const sanitized = sanitizeText(message);
	return sanitized.length > 0 ? sanitized : undefined;
}

/**
 * Klassifiziert zuerst stabile technische Marker und verwendet Meldungstext
 * ausschließlich als plattformübergreifenden Fallback.
 */
export function classifyStorageFailureReason(
	error: unknown,
	fallback: StorageFailureReason,
): StorageFailureReason {
	for (const current of errorChain(error)) {
		const code = stringProperty(current, "code");
		const name = stringProperty(current, "name");
		if (code === "ENOENT" || code === "ENOTDIR") return "notFound";
		if (code === "EACCES" || code === "EPERM") return "permissionDenied";
		if (code === "ENOSPC" || code === "EDQUOT") return "diskFull";
		if (name === "NotAllowedError" || name === "SecurityError")
			return "permissionDenied";
		if (name === "QuotaExceededError") return "diskFull";
		if (name === "NotSupportedError") return "unsupported";
	}

	const message = externalErrorMessage(error);
	if (!message) return fallback;
	if (/not found|does not exist|nicht gefunden|ENOENT/i.test(message))
		return "notFound";
	if (
		/permission denied|access denied|keine berechtigung|EACCES|EPERM/i.test(
			message,
		)
	)
		return "permissionDenied";
	if (
		/no space left|disk full|datenträger voll|speicherplatz.*voll|quota exceeded/i.test(
			message,
		)
	)
		return "diskFull";
	if (/not supported|nicht unterstützt/i.test(message)) return "unsupported";
	return fallback;
}

function externalErrorMessage(error: unknown): string | undefined {
	let fallback: string | undefined;
	for (const current of errorChain(error)) {
		const message =
			typeof current === "string"
				? current
				: current instanceof InternalStorageError
					? undefined
					: stringProperty(current, "message");
		if (message) fallback = message;
	}
	return fallback;
}

function errorChain(error: unknown): unknown[] {
	const chain: unknown[] = [];
	const visited = new Set<unknown>();
	let current: unknown = error;
	for (
		let depth = 0;
		depth < MAX_CAUSE_DEPTH && current !== undefined;
		depth += 1
	) {
		if (visited.has(current)) break;
		visited.add(current);
		chain.push(current);
		current =
			typeof current === "object" && current !== null && "cause" in current
				? current.cause
				: undefined;
	}
	return chain;
}

function stringProperty(value: unknown, property: string): string | undefined {
	return typeof value === "object" &&
		value !== null &&
		property in value &&
		typeof value[property as keyof typeof value] === "string"
		? value[property as keyof typeof value]
		: undefined;
}
