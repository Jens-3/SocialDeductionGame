import { getDisplayName } from "../domain/localizedNames";
import { decodeUnicodeEscaped } from "../domain/models";
import { isObjectSerializationError } from "../persistence/objectPersistenceError";

export function getScenarioDisplayName(
	value: { name: string; names?: Record<string, string> },
	language: string,
): string {
	return getDisplayName(value, language);
}

export function decodeRoleUnicodeSymbol(value: string): string | undefined {
	return decodeUnicodeEscaped(value);
}

export function getObjectSerializationErrorDetails(
	error: unknown,
): string | undefined {
	return isObjectSerializationError(error) ? error.details : undefined;
}
