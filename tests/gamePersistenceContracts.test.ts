import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ApplicationOperationError } from "../src/application/applicationError";
import { createDefaultApplicationOperationError } from "../src/application/internal/applicationErrorMapping";
import { setLanguage } from "../src/config";
import type { GameState } from "../src/domain/gameFactory";
import {
	ObjectSerializationError,
	ObjectStorageError,
} from "../src/persistence/objectPersistenceError";
import { ObjectSaveInterruptedError } from "../src/persistence/objectSaveInterruptedError";
import type {
	DataFileReadResult,
	DataFileReference,
	DataFileStorage,
	DataFileWriteOptions,
	StoredByteDocument,
} from "../src/persistence/ports/dataFileStorage";
import { RecoverableStorageWriteError } from "../src/persistence/ports/dataFileStorage";
import type { StorageOperationResult } from "../src/persistence/ports/storageFailure";
import { storageFailure } from "../src/persistence/ports/storageFailure";
import type { StorageRecoveryCandidate } from "../src/persistence/ports/storageRecovery";
import {
	createGameExportDocument,
	type GameExportDocument,
} from "../src/serialization/gameExport";
import { createTestObjectPersistence } from "./createTestObjectPersistence";
import { fixedDomainServices } from "./fixedClock";
import { createTestGame } from "./fixtures";
import { GameTestFacade } from "./gameTestFacade";
import { failedRead, missingRead } from "./storageReadResult";

class GamePersistenceTestFacade extends GameTestFacade {}

const decoder = new TextDecoder();
const decoding = { ansiFallbackLocale: "de" } as const;

afterEach(() => setLanguage("de"));

describe("Game-Persistenzverträge", () => {
	it("übersetzt behebbare Storage-Fehler an der Persistence-Grenze", async () => {
		const file = {
			category: "game" as const,
			fileName: "game_interrupted.json",
		};
		const storage: DataFileStorage = {
			readInternal: (file) => Promise.resolve(missingRead(file)),
			writeInternal: () =>
				Promise.reject(
					new RecoverableStorageWriteError(
						"Speichern unterbrochen",
						"command-object-save",
						"targetExists",
						file,
						"Speichern unterbrochen",
					),
				),
		};
		const persistence = createTestObjectPersistence(
			storage,
			fixedDomainServices,
		);

		const error = await persistence.write
			.saveObject(createTestGame(), decoding)
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(ObjectSaveInterruptedError);
		expect(error).toMatchObject({
			code: "OBJECT_SAVE_INTERRUPTED",
			kind: "storage",
			operation: "save",
			retryable: true,
			commandId: "command-object-save",
			file,
			reason: "targetExists",
			message: "Speichern unterbrochen",
		});
		const applicationError = createDefaultApplicationOperationError(error);
		expect(applicationError).toBeInstanceOf(ApplicationOperationError);
		expect(applicationError).toMatchObject({
			source: "storage",
			category: "game",
			file,
			commandId: "command-object-save",
		});
		expect(error).not.toBeInstanceOf(RecoverableStorageWriteError);
	});

	it("unterscheidet Import-Storagefehler von reparierbaren JSON-Fehlern", async () => {
		const storageFailurePersistence = createTestObjectPersistence(
			{
				readInternal: (file) => Promise.resolve(missingRead(file)),
				readExternal: () =>
					Promise.reject(
						storageFailure("import", "storageUnavailable", {
							diagnostic: "Dateizugriff fehlgeschlagen",
						}),
					),
			},
			fixedDomainServices,
		);
		const storageError = await storageFailurePersistence.transfer
			.importObject({}, decoding)
			.catch((caught: unknown) => caught);
		expect(storageError).toBeInstanceOf(ObjectStorageError);
		expect(storageError).toMatchObject({
			kind: "storage",
			operation: "import",
			retryable: true,
			reason: "storageUnavailable",
		});

		const invalidJson = createTestObjectPersistence(
			{
				readInternal: (file) => Promise.resolve(missingRead(file)),
				readExternal: () => Promise.resolve(new TextEncoder().encode('{"id":')),
			},
			fixedDomainServices,
		);
		const serializationError = await invalidJson.transfer
			.importObject({}, decoding)
			.catch((caught: unknown) => caught);
		expect(serializationError).toBeInstanceOf(ObjectSerializationError);
		expect(serializationError).toMatchObject({
			kind: "serialization",
			operation: "decode",
			repairable: true,
			reason: "invalidJson",
		});
		expect((serializationError as ObjectSerializationError).details).toContain(
			"Ungültiges JSON",
		);
	});

	it("typisiert Storage- und Serialization-Fehler beim Laden von Spielen", async () => {
		const loadError = async (result: DataFileReadResult | Error) => {
			const persistence = createTestObjectPersistence(
				{
					readInternal: () =>
						result instanceof Error
							? Promise.reject(result)
							: Promise.resolve(result),
				},
				fixedDomainServices,
			);
			return persistence.read
				.loadObject("game", "game_typed_error", decoding)
				.catch((caught: unknown) => caught);
		};

		const typedErrorFile: DataFileReference = {
			category: "game",
			fileName: "game_typed_error.json",
		};
		await expect(loadError(missingRead(typedErrorFile))).resolves.toMatchObject(
			{
				kind: "storage",
				operation: "load",
				retryable: false,
				reason: "notFound",
			},
		);
		await expect(
			loadError(failedRead(typedErrorFile, "storageUnavailable", "Offline")),
		).resolves.toMatchObject({
			kind: "storage",
			operation: "load",
			retryable: true,
			reason: "storageUnavailable",
		});
		const unexpectedAdapterError = new Error("Adapterfehler");
		await expect(loadError(unexpectedAdapterError)).resolves.toBe(
			unexpectedAdapterError,
		);
		await expect(
			loadError({
				status: "error",
				error: {
					source: "storage",
					operation: "read",
					reason: "storageUnavailable",
					retryable: true,
					repairable: false,
					category: "game",
					file: {
						category: "game",
						fileName: "game_typed_error.json",
					},
					diagnostic: "Offline",
				},
			}),
		).resolves.toMatchObject({
			kind: "storage",
			operation: "load",
			retryable: true,
			reason: "storageUnavailable",
			storageFailure: {
				category: "game",
				file: {
					category: "game",
					fileName: "game_typed_error.json",
				},
			},
			context: {
				kind: "game",
				id: "game_typed_error",
				storageKey: "game_typed_error",
			},
		});
		await expect(
			loadError({
				status: "success",
				bytes: Uint8Array.from([0xff, 0xfe, 0x00]),
			}),
		).resolves.toMatchObject({
			kind: "serialization",
			operation: "decode",
			repairable: false,
			reason: "encodingFailure",
		});
		await expect(
			loadError({
				status: "success",
				bytes: new TextEncoder().encode('{"id":'),
			}),
		).resolves.toMatchObject({
			kind: "serialization",
			operation: "decode",
			repairable: true,
			reason: "invalidJson",
		});
		await expect(
			loadError({
				status: "success",
				bytes: new TextEncoder().encode('{"id":"game_typed_error"}'),
			}),
		).resolves.toMatchObject({
			kind: "serialization",
			operation: "decode",
			repairable: false,
			reason: "invalidDocument",
		});
	});

	it("fixiert interne Speicher- und externe Exportbytes getrennt", async () => {
		const storage = new ContractStorage();
		const service = new GamePersistenceTestFacade(storage);
		service.setPreparedGame(createGoldenGame());

		await service.saveLoadedGame();

		const saved = storage.documents.get("game_golden_contract.json");
		expect(saved).toBeDefined();
		expect(saved).toEqual(readGoldenBytes("game-save-v1.json"));
		expect(saved?.slice(0, 3)).not.toEqual(Uint8Array.from([0xef, 0xbb, 0xbf]));
		expect(saved?.at(-1)).toBe("}".charCodeAt(0));

		await service.exportSavedGame("game_golden_contract");

		expect(storage.exports).toHaveLength(1);
		expect(storage.exports[0]?.bytes).toEqual(
			readGoldenBytes("game-export-v1.json"),
		);
		expect(storage.exports[0]?.suggestedFileName).toBe(
			"game_golden_contract.json",
		);
	});

	it("behandelt beim internen Laden den Dateinamen, beim Import dagegen die Dokument-ID als maßgeblich", async () => {
		const internal = createVersionedGame("game_id_im_json", "Interne Datei");
		const internalStorage = new ContractStorage([
			stored("game_dateiname_contract.json", encodeJson(internal)),
		]);
		const loaded = await new GamePersistenceTestFacade(
			internalStorage,
		).loadGame("game_dateiname_contract");
		expect(loaded.id).toBe("game_dateiname_contract");
		expect(loaded.document.id).toBe("game_dateiname_contract");

		const external = createVersionedGame(
			"game_externe_dokument_id",
			"Externe Datei",
		);
		const externalStorage = new ContractStorage([], encodeJson(external));
		const imported = await new GamePersistenceTestFacade(
			externalStorage,
		).importSavedGame({});
		expect(imported).toMatchObject({
			status: "imported",
			id: "game_externe_dokument_id",
		});
		expect(externalStorage.documents.has("game_externe_dokument_id.json")).toBe(
			true,
		);
	});

	it("lädt eine Vorlage über Persistence und erzeugt das Spiel in Domain", async () => {
		const template = createVersionedGame(
			"template_persistence_contract",
			"Gespeicherte Vorlage",
		);
		template.isTemplate = true;
		const storage = new ContractStorage([
			stored("template_persistence_contract.json", encodeJson(template)),
		]);

		const loaded = await new GamePersistenceTestFacade(
			storage,
		).createGameFromTemplate("template_persistence_contract", "Neue Runde");

		expect(loaded).toMatchObject({
			storageKey: null,
			id: "game_neue_runde",
			name: "Neue Runde",
			document: {
				id: "game_neue_runde",
				name: "Neue Runde",
				isTemplate: false,
			},
		});
		expect(storage.documents.has("template_persistence_contract.json")).toBe(
			true,
		);
		expect(storage.documents.has("game_neue_runde.json")).toBe(false);
	});

	it.each([
		["UTF-8", (text: string) => new TextEncoder().encode(text)],
		[
			"UTF-8 mit BOM",
			(text: string) =>
				Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(text)]),
		],
		[
			"UTF-16 LE",
			(text: string) =>
				Uint8Array.from([0xff, 0xfe, ...Buffer.from(text, "utf16le")]),
		],
		["UTF-16 BE", encodeUtf16BeWithBom],
		[
			"Windows ANSI",
			(text: string) => Uint8Array.from(Buffer.from(text, "latin1")),
		],
	] as const)(
		"importiert %s und schreibt kanonisches UTF-8",
		async (_label, encode) => {
			setLanguage("de-DE");
			const document = createVersionedGame(
				"game_kodierungsvertrag",
				"Grüne Nacht",
			);
			const storage = new ContractStorage([], encode(JSON.stringify(document)));

			await new GamePersistenceTestFacade(storage).importSavedGame({});

			const written = storage.documents.get("game_kodierungsvertrag.json");
			expect(written).toBeDefined();
			expect(JSON.parse(decoder.decode(written))).toMatchObject({
				id: "game_kodierungsvertrag",
				name: "Grüne Nacht",
				fileType: "social-deduction-game",
				schemaVersion: 1,
			});
		},
	);

	it("repariert Entitäts-IDs und normalisiert die Setup-Phase vor dem Schreiben", async () => {
		const document = createVersionedGame("game_reparaturvertrag", "Reparatur");
		const role = document.ruleSetSnapshot.roles[0];
		const player = document.players.find((entry) => entry.id === "p_player1");
		if (!role || !player) throw new Error("Testfixture ist unvollständig.");
		role.id = "Seer Role";
		player.roles = {
			actualRoleId: "Seer Role",
			shownRoleIds: ["Seer Role"],
			nightRoleId: "Seer Role",
		};
		document.time = { currentNight: 3, phase: "setup" };
		const storage = new ContractStorage([], encodeJson(document));

		await new GamePersistenceTestFacade(storage).importSavedGame({});

		const written = parseStoredGame(storage, "game_reparaturvertrag.json");
		expect(written.ruleSetSnapshot.roles[0]?.id).toBe("r_seer_role");
		expect(
			written.players.find((entry) => entry.id === "p_player1")?.roles,
		).toEqual({
			actualRoleId: "r_seer_role",
			shownRoleIds: ["r_seer_role"],
			nightRoleId: "r_seer_role",
		});
		expect(written.time).toEqual({ currentNight: 3, phase: "night" });
	});

	it("repariert Entitäts-IDs nur beim externen Import, nicht beim internen Laden", async () => {
		const document = createVersionedGame(
			"game_interner_validierungsvertrag",
			"Interne Validierung",
		);
		const role = document.ruleSetSnapshot.roles[0];
		if (!role) throw new Error("Testfixture ist unvollständig.");
		role.id = "Seer Role";
		const storage = new ContractStorage([
			stored("game_interner_validierungsvertrag.json", encodeJson(document)),
		]);

		const error = await new GamePersistenceTestFacade(storage)
			.loadGame("game_interner_validierungsvertrag")
			.catch((caught: unknown) => caught);
		expect(error).toMatchObject({
			name: "ApplicationOperationError",
			code: "APPLICATION_EXPECTED_ERROR",
			source: "domain",
			expectation: "expected",
			severity: "error",
			reason: "invalidObject",
		});
		expect(error).toHaveProperty(
			"diagnostic",
			expect.stringContaining("Role id"),
		);
		expect(
			parseStoredGame(storage, "game_interner_validierungsvertrag.json")
				.ruleSetSnapshot.roles[0]?.id,
		).toBe("Seer Role");
	});

	it("meldet Kollisionen vor dem Schreiben und hält Überschreiben und Kopie auseinander", async () => {
		const existing = createVersionedGame("game_kollision", "Vorhanden");
		const imported = createVersionedGame("game_kollision", "Importiert");
		const storage = new ContractStorage(
			[stored("game_kollision.json", encodeJson(existing))],
			encodeJson(imported),
		);
		const service = new GamePersistenceTestFacade(storage);

		const conflict = await service.importSavedGame({});
		expect(conflict).toMatchObject({
			status: "decisionRequired",
			decisionKind: "importConflict",
			existing: { id: "game_kollision", name: "Vorhanden" },
			imported: { id: "game_kollision", name: "Importiert" },
		});
		if (conflict.status !== "decisionRequired")
			throw new Error("Entscheidung erwartet.");

		await service.resolveSavedGameImport(conflict.commandId, "keepBoth");
		expect(storage.documents.has("game_importiert_2.json")).toBe(true);
		expect(parseStoredGame(storage, "game_kollision.json").name).toBe(
			"Vorhanden",
		);
	});

	it("klassifiziert Recovery-Kandidaten und exportiert fehlerhafte Bytes unverändert", async () => {
		const invalidBytes = Uint8Array.from([0xff, 0x00, 0x7b, 0x3c]);
		const recovery: StorageRecoveryCandidate = {
			category: "game",
			recoveryKey: "game_recovery_contract",
			fileName: "game_recovery_contract.json",
			oldBytes: encodeJson(
				createVersionedGame("game_recovery_contract", "Alt"),
			),
			newBytes: invalidBytes,
		};
		const storage = new ContractStorage([], undefined, [recovery]);
		const service = new GamePersistenceTestFacade(storage);

		await expect(service.listWriteRecoveries()).resolves.toMatchObject([
			{
				id: "game_recovery_contract",
				hasNew: true,
				canKeepNew: false,
				availableActions: ["keepOld", "export", "later"],
			},
		]);
		await service.exportFailedWrite("game_recovery_contract");
		expect(storage.exports[0]).toEqual({
			bytes: invalidBytes,
			suggestedFileName: "game_recovery_contract.failed.json",
		});
	});
});

class ContractStorage implements DataFileStorage {
	readonly documents = new Map<string, Uint8Array>();
	readonly exports: Array<{ bytes: Uint8Array; suggestedFileName: string }> =
		[];
	readonly #externalBytes: Uint8Array | undefined;
	readonly #recoveries: StorageRecoveryCandidate[];

	constructor(
		documents: StoredByteDocument[] = [],
		externalBytes?: Uint8Array,
		recoveries: StorageRecoveryCandidate[] = [],
	) {
		for (const document of documents) {
			this.documents.set(document.fileName, document.bytes);
		}
		this.#externalBytes = externalBytes;
		this.#recoveries = recoveries;
	}

	readInternal(file: DataFileReference): Promise<DataFileReadResult> {
		const bytes = this.documents.get(file.fileName);
		return Promise.resolve(
			bytes ? { status: "success", bytes } : missingRead(file),
		);
	}

	readAllInternal(category: "library" | "template" | "game") {
		return Promise.resolve(
			[...this.documents].map(([fileName, bytes]) => ({
				category,
				fileName,
				bytes,
			})),
		);
	}

	writeInternal(
		file: DataFileReference,
		bytes: Uint8Array,
		options: DataFileWriteOptions,
	): Promise<void | StorageOperationResult<void>> {
		if (options.createOnly && this.documents.has(file.fileName)) {
			return Promise.resolve({
				status: "conflict",
				reason: "targetExists",
				file,
				diagnostic: "Datei existiert bereits.",
			});
		}
		this.documents.set(file.fileName, bytes);
		return Promise.resolve();
	}

	readExternal(): Promise<Uint8Array> {
		if (!this.#externalBytes) return Promise.reject(new Error("Keine Datei."));
		return Promise.resolve(this.#externalBytes);
	}

	writeExternal(
		bytes: Uint8Array,
		options: { suggestedFileName: string },
	): Promise<void> {
		this.exports.push({ bytes, suggestedFileName: options.suggestedFileName });
		return Promise.resolve();
	}

	listRecoveries(): Promise<StorageRecoveryCandidate[]> {
		return Promise.resolve(this.#recoveries);
	}

	requestRecovery(recoveryKey: string) {
		const candidate = this.#recoveries.find(
			(entry) => entry.recoveryKey === recoveryKey,
		);
		return Promise.resolve(
			candidate
				? {
						status: "decisionRequired" as const,
						commandId: `command:${recoveryKey}`,
						candidate,
					}
				: { status: "discarded" as const },
		);
	}
}

function createGoldenGame(): GameState {
	const game = createTestGame(1);
	game.id = "game_golden_contract";
	game.name = "Golden Contract";
	game.names = { de: "Goldene Nacht", en: "Golden Night" };
	game.time = { currentNight: 2, phase: "day" };
	const player = game.playersById.p_player1;
	if (!player) throw new Error("Testfixture ist unvollständig.");
	player.name = "Grüne Spielerin";
	player.names = { de: "Grüne Spielerin" };
	player.roles = {
		actualRoleId: "r_seer",
		shownRoleIds: ["r_seer"],
		nightRoleId: "r_seer",
	};
	game.rolesForShowing = {
		roles: ["r_seer"],
		notice: "Bitte zeigen",
		showRoleSymbols: true,
	};
	game.log = [
		{
			id: "log_golden_entry",
			night: 2,
			phase: "day",
			createdAt: "2026-01-02T04:05:06.000Z",
			type: "golden-contract",
			actor: "storyteller",
			text: "Vertragseintrag",
			payload: { playerId: "p_player1" },
		},
	];
	return game;
}

function createVersionedGame(id: string, name: string): GameExportDocument {
	const game = createTestGame(1);
	game.id = id;
	game.name = name;
	return createGameExportDocument(game);
}

function stored(fileName: string, bytes: Uint8Array): StoredByteDocument {
	return { category: "game", fileName, bytes };
}

function encodeJson(value: unknown): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(value));
}

function encodeUtf16BeWithBom(text: string): Uint8Array {
	const littleEndian = Buffer.from(text, "utf16le");
	const bigEndian = new Uint8Array(littleEndian.length + 2);
	bigEndian[0] = 0xfe;
	bigEndian[1] = 0xff;
	for (let index = 0; index < littleEndian.length; index += 2) {
		bigEndian[index + 2] = littleEndian[index + 1] ?? 0;
		bigEndian[index + 3] = littleEndian[index] ?? 0;
	}
	return bigEndian;
}

function readGoldenBytes(fileName: string): Uint8Array {
	const repositoryText = readFileSync(
		path.resolve("tests", "golden", fileName),
		"utf8",
	);
	return new TextEncoder().encode(repositoryText.replace(/\r?\n$/, ""));
}

function parseStoredGame(
	storage: ContractStorage,
	fileName: string,
): GameExportDocument {
	const bytes = storage.documents.get(fileName);
	if (!bytes) throw new Error(`Gespeicherte Datei fehlt: ${fileName}`);
	return JSON.parse(decoder.decode(bytes)) as GameExportDocument;
}
