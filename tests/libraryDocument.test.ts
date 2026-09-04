import { describe, expect, it } from "vitest";
import {
	decodeCurrentLibraryCandidates,
	decodeCurrentLibraryDocument,
	InvalidLibraryRuleSetDocumentError,
} from "../src/serialization/libraryDocument";
import {
	createLibraryJsonText,
	createLibraryJsonTextFromFragments,
	createLibraryRuleSetJson,
	encodeLibraryDocument,
} from "../src/serialization/librarySerializer";
import { createRuleSetEmbeddedJsonText } from "../src/serialization/ruleSetExport";
import { createTestRuleSet } from "./fixtures";

function libraryDocument(): Record<string, unknown> {
	return {
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		ruleSetsById: {
			ruleset_test: {
				id: "ruleset_test",
				name: "Test",
				version: 1,
				teams: [],
				roles: [],
			},
		},
	};
}

describe("Library-Dokumentformat", () => {
	it("dekodiert die vollständige aktuelle Library rekursiv", () => {
		const document = decodeCurrentLibraryDocument(libraryDocument());

		expect(document.ruleSetsById.ruleset_test).toMatchObject({
			id: "ruleset_test",
			name: "Test",
		});
	});

	it("lehnt falsche Feldtypen und unbekannte Felder ab", () => {
		expect(() =>
			decodeCurrentLibraryDocument({
				...libraryDocument(),
				storageVersion: "1",
			}),
		).toThrow("keine unterstützte Struktur");
		expect(() =>
			decodeCurrentLibraryDocument({
				...libraryDocument(),
				unexpected: true,
			}),
		).toThrow('unbekanntes Feld: "unexpected"');
		expect(() =>
			decodeCurrentLibraryDocument({
				...libraryDocument(),
				globalStatusDefinitionsById: {},
			}),
		).toThrow('unbekanntes Feld: "globalStatusDefinitionsById"');
		expect(() =>
			decodeCurrentLibraryDocument({
				...libraryDocument(),
				updatedAt: "2026-07-19T12:00:00.000Z",
			}),
		).toThrow('unbekanntes Feld: "updatedAt"');
	});

	it("ordnet einen ungültigen Eintrag der gespeicherten RuleSet-ID zu", () => {
		const source = libraryDocument();
		source.ruleSetsById = { broken: { id: "broken" } };

		expect(() => decodeCurrentLibraryDocument(source)).toThrow(
			InvalidLibraryRuleSetDocumentError,
		);
		expect(() => decodeCurrentLibraryDocument(source)).toThrow(
			'Regelwerk "broken" ist ungültig',
		);
	});

	it("klassifiziert RuleSet-Kandidaten ohne Restore-Entscheidung", () => {
		const source = libraryDocument();
		source.ruleSetsById = {
			...(source.ruleSetsById as Record<string, unknown>),
			broken: { id: "broken" },
		};

		const decoded = decodeCurrentLibraryCandidates(source);

		expect(decoded.ruleSetCandidates).toEqual([
			expect.objectContaining({
				recordId: "ruleset_test",
				status: "decoded",
			}),
			expect.objectContaining({
				recordId: "broken",
				status: "invalid",
			}),
		]);
		expect(decoded).not.toHaveProperty("discardedRuleSetIds");
	});

	it("serialisiert kanonisch als UTF-8 ohne abschließenden Umbruch", () => {
		const document = decodeCurrentLibraryDocument(libraryDocument());
		const text = createLibraryJsonText(document);

		expect(text.endsWith("\n")).toBe(false);
		expect(new TextDecoder().decode(encodeLibraryDocument(document))).toBe(
			text,
		);
		expect(JSON.parse(text)).toEqual(document);
	});

	it("setzt validierte RuleSet-Fragmente ohne JSON-Strings zusammen", () => {
		const document = decodeCurrentLibraryDocument(libraryDocument());
		const ruleSet = document.ruleSetsById.ruleset_test;
		expect(ruleSet).toBeDefined();
		if (!ruleSet) return;

		const text = createLibraryJsonTextFromFragments(
			{
				storageType: document.storageType,
				storageVersion: document.storageVersion,
			},
			new Map([["ruleset_test", createRuleSetEmbeddedJsonText(ruleSet)]]),
		);
		const parsed = JSON.parse(text) as {
			ruleSetsById: Record<string, unknown>;
		};

		expect(parsed.ruleSetsById.ruleset_test).toEqual(ruleSet);
		expect(typeof parsed.ruleSetsById.ruleset_test).toBe("object");
	});

	it("erhält Sonderzeichen in name, names und unicodeSymbol", () => {
		const source = createTestRuleSet();
		const role = source.roles[0];
		expect(role).toBeDefined();
		if (!role) return;
		const ruleSet = {
			...source,
			name: 'Nacht "&" Tag \\ Ω',
			names: {
				de: "Wölfe „Überall“ \\ & mehr",
				ja: "夜と昼 🐺",
			},
			roles: [
				{
					...role,
					unicodeSymbol: "🧙‍♀️",
					unicodeEscaped: undefined,
				},
				...source.roles.slice(1),
			],
		};

		const text = createLibraryJsonTextFromFragments(
			{
				storageType: "social-deduction-app-library",
				storageVersion: 1,
			},
			new Map([[ruleSet.id, createLibraryRuleSetJson(ruleSet)]]),
		);
		const parsed = JSON.parse(text) as {
			ruleSetsById: Record<
				string,
				{
					name: string;
					names: Record<string, string>;
					roles: Array<{ unicodeSymbol?: string }>;
				}
			>;
		};
		const stored = parsed.ruleSetsById[ruleSet.id];

		expect(stored?.name).toBe(ruleSet.name);
		expect(stored?.names).toEqual(ruleSet.names);
		expect(stored?.roles[0]?.unicodeSymbol).toBe("🧙‍♀️");
	});
});
