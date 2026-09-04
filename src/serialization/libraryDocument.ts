import {
	assertSupportedRuleSetDocument,
	decodeRuleSetDocument,
	type RuleSetDocument,
} from "./ruleSetDocument";
import {
	isSerializationOperationError,
	SerializationOperationError,
	serializationFailure,
} from "./serializationFailure";

export const LIBRARY_STORAGE_TYPE = "social-deduction-app-library" as const;
export const LIBRARY_STORAGE_VERSION = 1 as const;

export type LibraryDocument = {
	storageType: string;
	storageVersion: number;
	ruleSetsById: Record<string, RuleSetDocument>;
};

export type LibraryDocumentMetadata = Omit<LibraryDocument, "ruleSetsById">;

export type LibraryRuleSetDocumentCandidate =
	| {
			recordId: string;
			status: "decoded";
			raw: unknown;
			document: RuleSetDocument;
	  }
	| {
			recordId: string;
			status: "invalid";
			raw: unknown;
			error: SerializationOperationError;
	  };

export type DecodedLibraryCandidates = {
	metadata: LibraryDocumentMetadata;
	ruleSetCandidates: LibraryRuleSetDocumentCandidate[];
};

const DOCUMENT_FIELDS = [
	"storageType",
	"storageVersion",
	"ruleSetsById",
] as const;

export class InvalidLibraryRuleSetDocumentError extends SerializationOperationError {
	readonly ruleSetId: string;

	constructor(ruleSetId: string, cause: unknown) {
		const failure = isSerializationOperationError(cause)
			? cause.failure
			: {
					source: "serialization" as const,
					operation: "decode" as const,
					reason: "invalidDocument" as const,
					repairable: false,
					...(cause instanceof Error && cause.message
						? { diagnostic: cause.message }
						: {}),
				};
		const failureMessage = failure.diagnostic ?? failure.details;
		super({ ...failure, documentId: ruleSetId });
		this.name = "InvalidLibraryRuleSetDocumentError";
		this.message = `Regelwerk "${ruleSetId}" ist ungültig.${failureMessage ? ` ${failureMessage}` : ""}`;
		this.ruleSetId = ruleSetId;
	}
}

/** Dekodiert die vollständige aktuelle Library einschließlich aller RuleSets. */
export function decodeCurrentLibraryDocument(value: unknown): LibraryDocument {
	const decoded = decodeCurrentLibraryCandidates(value);
	const invalid = decoded.ruleSetCandidates.find(
		(candidate) => candidate.status === "invalid",
	);
	if (invalid?.status === "invalid") throw invalid.error;
	return {
		...decoded.metadata,
		ruleSetsById: Object.fromEntries(
			decoded.ruleSetCandidates.flatMap((candidate) =>
				candidate.status === "decoded"
					? [[candidate.recordId, candidate.document]]
					: [],
			),
		),
	};
}

/**
 * Dekodiert die aktuelle Library-Hülle und klassifiziert jeden RuleSet-Eintrag
 * ohne eine Entscheidung über Abbruch oder Verwerfen zu treffen.
 */
export function decodeCurrentLibraryCandidates(
	value: unknown,
): DecodedLibraryCandidates {
	const decoded = decodeLibraryCandidates(value);
	assertSupportedLibraryMetadata(decoded.metadata);
	return decoded;
}

export function assertSupportedLibraryDocument(
	document: LibraryDocument,
): void {
	if (document.storageType !== LIBRARY_STORAGE_TYPE)
		throw invalidLibrary("Die Library hat keine unterstützte Struktur.");
	if (document.storageVersion !== LIBRARY_STORAGE_VERSION)
		throw invalidLibrary("Die Library hat keine unterstützte Struktur.");
}

function decodeLibraryCandidates(value: unknown): DecodedLibraryCandidates {
	const source = requiredRecord(
		value,
		"Die JSON-Wurzel der Library muss ein Objekt sein.",
	);
	if (
		source.storageType !== LIBRARY_STORAGE_TYPE ||
		source.storageVersion !== LIBRARY_STORAGE_VERSION
	)
		throw invalidLibrary("Die Library hat keine unterstützte Struktur.");
	assertKnownFields(source, DOCUMENT_FIELDS, "Library");
	const storedRuleSets = requiredRecord(
		source.ruleSetsById,
		"ruleSetsById muss ein Objekt sein.",
	);
	const ruleSetCandidates: LibraryRuleSetDocumentCandidate[] = [];
	for (const [recordId, ruleSetValue] of Object.entries(storedRuleSets)) {
		try {
			const decoded = decodeRuleSetDocument(
				requiredRecord(
					ruleSetValue,
					`ruleSetsById.${recordId} muss ein Objekt sein.`,
				),
			);
			assertSupportedRuleSetDocument(decoded);
			ruleSetCandidates.push({
				recordId,
				status: "decoded",
				raw: ruleSetValue,
				document: decoded,
			});
		} catch (error) {
			ruleSetCandidates.push({
				recordId,
				status: "invalid",
				raw: ruleSetValue,
				error: new InvalidLibraryRuleSetDocumentError(recordId, error),
			});
		}
	}

	return {
		metadata: {
			storageType: requiredString(source.storageType, "storageType"),
			storageVersion: requiredNumber(source.storageVersion, "storageVersion"),
		},
		ruleSetCandidates,
	};
}

function assertSupportedLibraryMetadata(
	metadata: LibraryDocumentMetadata,
): void {
	assertSupportedLibraryDocument({ ...metadata, ruleSetsById: {} });
}

function requiredString(value: unknown, label: string): string {
	if (typeof value !== "string")
		throw invalidLibrary(`Die Library enthält für ${label} keinen String.`);
	return value;
}

function requiredNumber(value: unknown, label: string): number {
	if (typeof value !== "number")
		throw invalidLibrary(`Die Library enthält für ${label} keine Zahl.`);
	return value;
}

function requiredRecord(
	value: unknown,
	message: string,
): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw invalidLibrary(message);
	return value as Record<string, unknown>;
}

function assertKnownFields(
	value: Record<string, unknown>,
	allowedFields: readonly string[],
	label: string,
): void {
	const allowed = new Set(allowedFields);
	const unknownFields = Object.keys(value).filter(
		(field) => !allowed.has(field),
	);
	if (unknownFields.length === 0) return;
	throw invalidLibrary(
		`${label} enthält ${unknownFields.length === 1 ? "ein unbekanntes Feld" : "unbekannte Felder"}: ${unknownFields.map((field) => `"${field}"`).join(", ")}.`,
	);
}

function invalidLibrary(diagnostic: string): Error {
	return serializationFailure(
		"decode",
		"invalidDocument",
		false,
		undefined,
		diagnostic,
	);
}
