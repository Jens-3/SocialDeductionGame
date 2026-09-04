import type { GameDocument } from "./gameDocument";
import { decodeCurrentGameDocument } from "./gameDocumentFormat";
import {
	assertSupportedRuleSetDocument,
	decodeRuleSetDocument,
	type RuleSetDocument,
} from "./ruleSetDocument";
import { serializationFailure } from "./serializationFailure";

export type ScenarioDocument =
	| { kind: "ruleSet"; document: RuleSetDocument }
	| { kind: "gameDocument"; document: GameDocument };

/** Erkennt und dekodiert ein externes Szenariodokument vollständig. */
export function decodeScenarioDocument(value: unknown): ScenarioDocument {
	const candidate = asRecord(value);
	if (!candidate)
		throw serializationFailure(
			"decode",
			"invalidDocument",
			false,
			undefined,
			"Die ausgewählte Datei enthält kein JSON-Objekt.",
		);

	if (
		candidate.fileType === "social-deduction-ruleset" ||
		(Array.isArray(candidate.teams) && Array.isArray(candidate.roles))
	) {
		const document = decodeRuleSetDocument(candidate);
		assertSupportedRuleSetDocument(document);
		return { kind: "ruleSet", document };
	}

	return {
		kind: "gameDocument",
		document: decodeCurrentGameDocument(candidate),
	};
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}
