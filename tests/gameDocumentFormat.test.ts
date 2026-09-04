import { describe, expect, it } from "vitest";
import { Player } from "../src/domain/models";
import {
	decodeCurrentGameDocument,
	GAME_DOCUMENT_SCHEMA_VERSION,
	GAME_FILE_TYPE,
	inspectGameDocumentVersion,
	TEMPLATE_FILE_TYPE,
	withCurrentGameDocumentVersion,
} from "../src/serialization/gameDocumentFormat";
import { createGameExportDocument } from "../src/serialization/gameExport";
import { createTestGame } from "./fixtures";

describe("gemeinsames Spielstand- und Vorlagenformat", () => {
	it("behandelt fehlendes isTemplate und fehlende Formatmetadaten als Game", () => {
		const game = createGameExportDocument(createTestGame());
		const withoutDiscriminator: Partial<typeof game> = { ...game };
		delete withoutDiscriminator.isTemplate;
		delete withoutDiscriminator.fileType;
		delete withoutDiscriminator.schemaVersion;

		const decoded = decodeCurrentGameDocument(withoutDiscriminator);

		expect(decoded.isTemplate).toBe(false);
		expect(decoded.fileType).toBeUndefined();
		expect(decoded.schemaVersion).toBeUndefined();
	});

	it("gibt ausschließlich das rekursiv dekodierte klassenfreie Dokument zurück", () => {
		const source = createGameExportDocument(createTestGame());
		expect(source.players[0]).toBeInstanceOf(Player);

		const decoded = decodeCurrentGameDocument(source);

		expect(decoded).not.toBe(source);
		expect(decoded.players).not.toBe(source.players);
		expect(decoded.players[0]).not.toBeInstanceOf(Player);
	});

	it("akzeptiert optionale, zum Dokument passende Formatmetadaten", () => {
		const game = createGameExportDocument(createTestGame());
		const template = {
			...game,
			id: "template_demo",
			isTemplate: true,
			fileType: TEMPLATE_FILE_TYPE,
			schemaVersion: GAME_DOCUMENT_SCHEMA_VERSION,
		};

		expect(inspectGameDocumentVersion(template)).toEqual({
			fileType: TEMPLATE_FILE_TYPE,
			schemaVersion: GAME_DOCUMENT_SCHEMA_VERSION,
		});
		expect(decodeCurrentGameDocument(template).isTemplate).toBe(true);
	});

	it("leitet in Serialization keine Dokumentart aus isTemplate ab", () => {
		expect(
			inspectGameDocumentVersion({
				isTemplate: true,
				fileType: GAME_FILE_TYPE,
			}),
		).toEqual({
			fileType: GAME_FILE_TYPE,
			schemaVersion: GAME_DOCUMENT_SCHEMA_VERSION,
		});
		expect(
			inspectGameDocumentVersion({
				fileType: TEMPLATE_FILE_TYPE,
			}),
		).toEqual({
			fileType: TEMPLATE_FILE_TYPE,
			schemaVersion: GAME_DOCUMENT_SCHEMA_VERSION,
		});
	});

	it("lehnt eine vorhandene fremde schemaVersion ab", () => {
		expect(() => inspectGameDocumentVersion({ schemaVersion: 2 })).toThrow(
			"schemaVersion",
		);
	});

	it.each([
		["isTemplate", { isTemplate: null }, "isTemplate muss boolean sein"],
		["fileType", { fileType: null }, "Falscher Dateityp"],
		["schemaVersion", { schemaVersion: null }, "schemaVersion"],
	])(
		"lehnt null für das vorhandene Metadatenfeld %s ab",
		(_field, value, message) => {
			expect(() => inspectGameDocumentVersion(value)).toThrow(message);
		},
	);

	it("leitet die Schreibmetadaten ausschließlich aus isTemplate ab", () => {
		const game = createGameExportDocument(createTestGame());
		expect(withCurrentGameDocumentVersion(game).fileType).toBe(GAME_FILE_TYPE);
		expect(
			withCurrentGameDocumentVersion({
				...game,
				id: "template_demo",
				isTemplate: true,
			}).fileType,
		).toBe(TEMPLATE_FILE_TYPE);
	});

	it("akzeptiert Dokumente ohne createdAt", () => {
		const game = createGameExportDocument(createTestGame());
		delete game.createdAt;

		expect(() => decodeCurrentGameDocument(game)).not.toThrow();
	});

	it("lehnt das entfernte Feld updatedAt ab", () => {
		const game = {
			...createGameExportDocument(createTestGame()),
			updatedAt: "2026-01-02T04:05:06.000Z",
		};

		expect(() => decodeCurrentGameDocument(game)).toThrow("updatedAt");
	});

	it("überlässt fachliche Nachtwerte der Domain-Prüfung", () => {
		const game = createGameExportDocument(createTestGame());
		game.time = { currentNight: -1, phase: "night" };

		expect(() => decodeCurrentGameDocument(game)).not.toThrow();
	});
});
