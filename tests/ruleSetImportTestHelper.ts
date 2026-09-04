import type { ImportRuleSetResult } from "../src/domain/ruleSet";
import { createRuleSetFromDraft } from "../src/domain/ruleSetValidation";
import { parseJsonWithDetails } from "../src/serialization/jsonSyntaxError";
import {
	assertSupportedRuleSetDocument,
	decodeRuleSetDocument,
} from "../src/serialization/ruleSetDocument";

/** Testhilfe für den Serialization-/Domain-Vertrag ohne Datei-Persistence. */
export function importRuleSetFromJsonText(
	jsonText: string,
): ImportRuleSetResult {
	const document = decodeRuleSetDocument(parseJsonWithDetails(jsonText));
	assertSupportedRuleSetDocument(document);
	return createRuleSetFromDraft(document);
}
