import { describe, expect, it } from "vitest";

import {
	assertSupportedRuleSetDocument,
	decodeRuleSetDocument,
} from "../src/serialization/ruleSetDocument";

const minimalDocument = {
	fileType: "social-deduction-ruleset",
	schemaVersion: 1,
	name: "Testregeln",
	teams: [{ id: "t_good", name: "Gut", teamOrder: 1 }],
	roles: [{ id: "r_seer", name: "Seher", teamId: "t_good" }],
};

describe("RuleSet-Dokumentstruktur", () => {
	it("akzeptiert fehlende Formatmetadaten", () => {
		const embedded: Record<string, unknown> = { ...minimalDocument };
		Reflect.deleteProperty(embedded, "fileType");
		Reflect.deleteProperty(embedded, "schemaVersion");
		const decoded = decodeRuleSetDocument(embedded);

		expect(decoded.fileType).toBeUndefined();
		expect(decoded.schemaVersion).toBeUndefined();
		expect(() => assertSupportedRuleSetDocument(decoded)).not.toThrow();
	});

	it("dekodiert ein strukturell korrektes Dokument zu einem typisierten Entwurf", () => {
		expect(decodeRuleSetDocument(minimalDocument)).toEqual(minimalDocument);
	});

	it("lehnt falsche Feld- und Elementtypen in der Strukturprüfung ab", () => {
		expect(() =>
			decodeRuleSetDocument({ ...minimalDocument, version: "1" }),
		).toThrow("version muss eine Zahl sein");
		expect(() =>
			decodeRuleSetDocument({
				...minimalDocument,
				roles: [42],
			}),
		).toThrow("Rolle an Position 0 ist kein Objekt");
		expect(() =>
			decodeRuleSetDocument({
				...minimalDocument,
				roles: [
					{
						...minimalDocument.roles[0],
						apply_status_effect: ["d_poisoned", 42],
					},
				],
			}),
		).toThrow("roles[0].apply_status_effect[1] muss ein String sein");
	});

	it.each([
		["id", { id: null }, "id muss ein String sein"],
		["names", { names: null }, "names muss ein Objekt sein"],
		["version", { version: null }, "version muss eine Zahl sein"],
		["statuses", { statuses: null }, "statuses muss ein Array sein"],
		[
			"role.night",
			{ roles: [{ ...minimalDocument.roles[0], night: null }] },
			"roles[0].night muss ein Objekt sein",
		],
		[
			"role.isUnique",
			{ roles: [{ ...minimalDocument.roles[0], isUnique: null }] },
			"roles[0].isUnique muss boolean sein",
		],
	] as const)(
		"lehnt null für das optionale Feld %s ab",
		(_field, changes, message) => {
			expect(() =>
				decodeRuleSetDocument({ ...minimalDocument, ...changes }),
			).toThrow(message);
		},
	);

	it("lässt typkorrekte Werte für die anschließende Werteprüfung unverändert", () => {
		const document = decodeRuleSetDocument({
			...minimalDocument,
			schemaVersion: 2,
			version: 1.5,
			statuses: [{ id: "d_poisoned", name: "Vergiftet", defaultDuration: -1 }],
		});

		expect(document).toMatchObject({
			schemaVersion: 2,
			version: 1.5,
			statuses: [{ defaultDuration: -1 }],
		});
		expect(() => assertSupportedRuleSetDocument(document)).toThrow(
			"schemaVersion muss 1 sein",
		);
	});

	it("dekodiert beide Unicode-Darstellungen bei Rollen und Statusdefinitionen", () => {
		const decoded = decodeRuleSetDocument({
			...minimalDocument,
			roles: [
				{
					...minimalDocument.roles[0],
					unicodeSymbol: "👁",
					unicodeEscaped: "\\u{1F441}",
				},
			],
			statuses: [
				{
					id: "d_poisoned",
					name: "Vergiftet",
					unicodeSymbol: "🤢",
					unicodeEscaped: "\\u{1F922}",
				},
			],
		});

		expect(decoded.roles[0]).toMatchObject({
			unicodeSymbol: "👁",
			unicodeEscaped: "\\u{1F441}",
		});
		expect(decoded.statuses?.[0]).toMatchObject({
			unicodeSymbol: "🤢",
			unicodeEscaped: "\\u{1F922}",
		});
	});
});
