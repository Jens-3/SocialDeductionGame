import type { RuleSet, RuleSetDraft } from "../domain/ruleSet";
import { encodeUtf8 } from "./jsonEncoding";
import type {
	LibraryDocument,
	LibraryDocumentMetadata,
} from "./libraryDocument";
import {
	createRuleSetEmbeddedJsonText,
	type EmbeddedRuleSetJson,
} from "./ruleSetExport";

export type LibraryRuleSetJson = EmbeddedRuleSetJson;
export type LibraryRuleSetFragment =
	| { status: "encoded"; json: EmbeddedRuleSetJson }
	| { status: "raw"; value: unknown };

export function createLibraryRuleSetJson(
	ruleSet: RuleSet | RuleSetDraft,
): LibraryRuleSetJson {
	return createRuleSetEmbeddedJsonText(ruleSet);
}

/** Serialisiert ein bereits dekodiertes Library-Dokument kanonisch. */
export function createLibraryJsonText(document: LibraryDocument): string {
	return createLibraryJsonTextFromFragments(
		document,
		new Map(
			Object.entries(document.ruleSetsById).map(([id, ruleSet]) => [
				id,
				createLibraryRuleSetJson(ruleSet),
			]),
		),
	);
}

/** Fügt ausschließlich von Serialization erzeugte RuleSet-Fragmente zusammen. */
export function createLibraryJsonTextFromFragments(
	metadata: LibraryDocumentMetadata,
	ruleSetsById: ReadonlyMap<string, EmbeddedRuleSetJson>,
): string {
	const metadataLines = [
		`  "storageType": ${JSON.stringify(metadata.storageType)},`,
		`  "storageVersion": ${JSON.stringify(metadata.storageVersion)},`,
	];
	const entries = [...ruleSetsById.entries()].map(([id, json]) => {
		const lines = json.split("\n");
		return lines
			.map((line, index) =>
				index === 0 ? `    ${JSON.stringify(id)}: ${line}` : `    ${line}`,
			)
			.join("\n");
	});
	const ruleSetLines = entries.map((entry, index) =>
		index < entries.length - 1 ? `${entry},` : entry,
	);
	return [
		"{",
		...metadataLines,
		'  "ruleSetsById": {',
		...ruleSetLines,
		"  }",
		"}",
	].join("\n");
}

/** Erzeugt kanonische UTF-8-Bytes ohne BOM und abschließenden Umbruch. */
export function encodeLibraryDocument(document: LibraryDocument): Uint8Array {
	return encodeUtf8(createLibraryJsonText(document));
}

export function encodeLibraryFragments(
	metadata: LibraryDocumentMetadata,
	ruleSetsById: ReadonlyMap<string, EmbeddedRuleSetJson>,
): Uint8Array {
	return encodeUtf8(createLibraryJsonTextFromFragments(metadata, ruleSetsById));
}

/**
 * Fügt kanonisch kodierte RuleSets und verlustarm erhaltene ungültige
 * JSON-Werte zu einer Library zusammen.
 */
export function encodeLibraryCandidateFragments(
	metadata: LibraryDocumentMetadata,
	ruleSetsById: ReadonlyMap<string, LibraryRuleSetFragment>,
): Uint8Array {
	const fragments = new Map(
		[...ruleSetsById.entries()].map(([id, fragment]) => [
			id,
			(fragment.status === "encoded"
				? fragment.json
				: JSON.stringify(fragment.value, null, 2)) as EmbeddedRuleSetJson,
		]),
	);
	return encodeLibraryFragments(metadata, fragments);
}
