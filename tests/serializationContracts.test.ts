import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hydrateGameState } from "../src/domain/gameValidation";
import { repairRecoveredLibrary } from "../src/domain/libraryContainerRepair";
import { Player, Role, Team } from "../src/domain/models";
import {
	decodeCurrentGameDocument,
	GAME_DOCUMENT_SCHEMA_VERSION,
	GAME_FILE_TYPE,
} from "../src/serialization/gameDocumentFormat";
import {
	createGameExportDocument,
	createGameExportJsonText,
	encodeGameExportDocument,
} from "../src/serialization/gameExport";
import { decodeJsonBytes, encodeUtf8 } from "../src/serialization/jsonEncoding";
import {
	createJsonSyntaxDetails,
	JsonSyntaxError,
	parseJsonWithDetails,
} from "../src/serialization/jsonSyntaxError";
import { recoverLibraryStructure } from "../src/serialization/libraryRepair";
import {
	createRuleSetExportJsonText,
	encodeRuleSetExportDocument,
} from "../src/serialization/ruleSetExport";
import { createTestGame } from "./fixtures";
import { importRuleSetFromJsonText } from "./ruleSetImportTestHelper";

const repairLibraryDocument = (value: unknown) =>
	repairRecoveredLibrary(recoverLibraryStructure(value));

describe("Serialization-Verträge", () => {
	it("verwendet eine gemeinsame UTF-8-Kodierung ohne BOM", () => {
		const text = "Grün 🐺";
		const bytes = encodeUtf8(text);

		expect(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).toBe(text);
		expect([...bytes.slice(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
	});

	it("serialisiert Game-Drafts kanonisch als aktuelle UTF-8-Datei", () => {
		const game = createTestGame(1);
		const text = createGameExportJsonText(game);
		const parsed = JSON.parse(text) as Record<string, unknown>;

		expect(parsed.fileType).toBe(GAME_FILE_TYPE);
		expect(parsed.schemaVersion).toBe(GAME_DOCUMENT_SCHEMA_VERSION);
		expect(new TextDecoder().decode(encodeGameExportDocument(game))).toBe(text);
		expect(text.endsWith("\n")).toBe(false);
	});

	it("hält RuleSet-Import, Hydrierung und Export bytegenau zusammen", () => {
		const golden = readFileSync(
			path.resolve("tests", "golden", "ruleset-export-v1.json"),
			"utf8",
		).trimEnd();
		const imported = importRuleSetFromJsonText(golden).ruleSet;

		expect(imported.teams.every((team) => team instanceof Team)).toBe(true);
		expect(imported.roles.every((role) => role instanceof Role)).toBe(true);
		expect(createRuleSetExportJsonText(imported)).toBe(golden);
		expect(
			new TextDecoder().decode(encodeRuleSetExportDocument(imported)),
		).toBe(golden);
	});

	it("bewahrt beim JSON-Rundlauf das aktuelle Spielformat und die Modellklassen", () => {
		const original = createTestGame(2);
		const versioned = createGameExportDocument(original);
		const parsed = JSON.parse(JSON.stringify(versioned)) as unknown;

		const decoded = decodeCurrentGameDocument(parsed);
		const hydrated = hydrateGameState(decoded);

		expect(versioned.fileType).toBe(GAME_FILE_TYPE);
		expect(versioned.schemaVersion).toBe(GAME_DOCUMENT_SCHEMA_VERSION);
		expect(hydrated).not.toHaveProperty("fileType");
		expect(hydrated).not.toHaveProperty("schemaVersion");
		expect(hydrated.ruleSetSnapshot.teams[0]).toBeInstanceOf(Team);
		expect(hydrated.ruleSetSnapshot.roles[0]).toBeInstanceOf(Role);
		expect(hydrated.playersById[hydrated.seatOrder[0] ?? ""]).toBeInstanceOf(
			Player,
		);
		expect(JSON.parse(JSON.stringify(hydrated))).toEqual(
			JSON.parse(JSON.stringify(original)),
		);
	});

	it("repariert ausschließlich eine aktuelle Library deterministisch", () => {
		const first = repairLibraryDocument({
			storageType: "social-deduction-app-library",
			storageVersion: 1,
			ruleSetsById: {
				ruleset_contract: {
					id: "ruleset_contract",
					name: "Contract",
					version: 1,
					teams: [],
					roles: [],
				},
			},
		});
		const serialized = JSON.parse(JSON.stringify(first.document)) as unknown;
		const second = repairLibraryDocument(serialized);

		expect(first.document).toMatchObject({
			storageType: "social-deduction-app-library",
			storageVersion: 1,
		});
		expect(second.document).toEqual(serialized);
		expect(second.report.changes).toEqual([]);
		expect(() => repairLibraryDocument({ storageVersion: 0 })).toThrow(
			"aktuelle Dateiformat",
		);
	});

	it("behält UTF-8-Vorrang und den sprachabhängigen ANSI-Fallback", () => {
		const utf8 = decodeJsonBytes(new TextEncoder().encode('{"text":"Grün"}'));
		const ansi = decodeJsonBytes(
			Uint8Array.from([
				0x7b, 0x22, 0x74, 0x65, 0x78, 0x74, 0x22, 0x3a, 0x22, 0x47, 0x72, 0xfc,
				0x6e, 0x22, 0x7d,
			]),
			"de-DE",
		);

		expect(utf8).toMatchObject({ encoding: "utf-8", hadBom: false });
		expect(ansi).toEqual({
			text: '{"text":"Grün"}',
			encoding: "windows-1252",
			hadBom: false,
		});
	});

	it("bewahrt die strukturierten Details von JSON-Syntaxfehlern", () => {
		try {
			parseJsonWithDetails('{\n  "name": }');
			expect.unreachable("Ein Syntaxfehler wurde erwartet.");
		} catch (error) {
			expect(error).toBeInstanceOf(JsonSyntaxError);
			if (!(error instanceof JsonSyntaxError)) return;
			expect(error.failure.diagnostic).toContain("Unexpected");
			expect(error.failure.repairable).toBe(true);
			expect(error.details).toContain("Ungültiges JSON");
		}
	});

	it("behauptet ohne Parserposition keine Zeile oder Spalte", () => {
		const details = createJsonSyntaxDetails(
			'{"first":"}","second":}',
			"Unexpected token '}' while parsing JSON",
		);

		expect(details).toBe(
			"Ungültiges JSON:\nUnexpected token '}' while parsing JSON",
		);
		expect(details).not.toContain("Zeile");
		expect(details).not.toContain("Spalte");
	});

	it("übernimmt weiterhin verlässliche Parserpositionen", () => {
		expect(
			createJsonSyntaxDetails("{\n  bad", "Unexpected token at position 4"),
		).toContain("Zeile 2, Spalte 3");
		expect(
			createJsonSyntaxDetails("irrelevant", "error at line 7 column 9"),
		).toContain("Zeile 7, Spalte 9");
	});
});
