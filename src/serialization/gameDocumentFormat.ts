import { decodeGameDocument, type GameDocument } from "./gameDocument";
import { serializationFailure } from "./serializationFailure";

export const GAME_FILE_TYPE = "social-deduction-game" as const;
export const TEMPLATE_FILE_TYPE = "social-deduction-template" as const;
export const GAME_DOCUMENT_SCHEMA_VERSION = 1 as const;

export type GameDocumentVersion = {
	fileType?: typeof GAME_FILE_TYPE | typeof TEMPLATE_FILE_TYPE;
	schemaVersion: typeof GAME_DOCUMENT_SCHEMA_VERSION;
};

/** Prüft vorhandene Formatmetadaten ohne Game und Template zu unterscheiden. */
export function inspectGameDocumentVersion(
	value: unknown,
): GameDocumentVersion {
	const document = asRecord(value);
	if (!document)
		throw serializationFailure(
			"decode",
			"invalidDocument",
			false,
			undefined,
			"Das Dokument ist kein JSON-Objekt.",
		);
	if (
		document.isTemplate !== undefined &&
		typeof document.isTemplate !== "boolean"
	)
		throw serializationFailure(
			"decode",
			"invalidDocument",
			false,
			undefined,
			"isTemplate muss boolean sein.",
		);
	if (
		document.fileType !== undefined &&
		document.fileType !== GAME_FILE_TYPE &&
		document.fileType !== TEMPLATE_FILE_TYPE
	) {
		throw serializationFailure(
			"decode",
			"invalidDocument",
			false,
			undefined,
			"Falscher Dateityp für ein Game-Dokument.",
		);
	}
	if (
		document.schemaVersion !== undefined &&
		document.schemaVersion !== GAME_DOCUMENT_SCHEMA_VERSION
	) {
		throw serializationFailure(
			"decode",
			"unsupportedVersion",
			false,
			undefined,
			"Nicht unterstützte schemaVersion.",
		);
	}
	return {
		...(document.fileType === GAME_FILE_TYPE ||
		document.fileType === TEMPLATE_FILE_TYPE
			? { fileType: document.fileType }
			: {}),
		schemaVersion: GAME_DOCUMENT_SCHEMA_VERSION,
	};
}

/** Dekodiert ein Game oder Template; allein isTemplate bestimmt die Art. */
export function decodeCurrentGameDocument(value: unknown): GameDocument {
	inspectGameDocumentVersion(value);
	return decodeGameDocument(value);
}

/** Ergänzt die aktuellen Metadaten, ohne das übrige Dokument zu verändern. */
export function withCurrentGameDocumentVersion<
	T extends Record<string, unknown> & { isTemplate?: boolean },
>(document: T): T & GameDocumentVersion {
	return {
		...document,
		fileType:
			document.isTemplate === true ? TEMPLATE_FILE_TYPE : GAME_FILE_TYPE,
		schemaVersion: GAME_DOCUMENT_SCHEMA_VERSION,
	};
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}
