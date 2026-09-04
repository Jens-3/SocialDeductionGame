import { describe, expect, it } from "vitest";
import { createGameUseCases } from "../src/application/gameUseCases";
import type { GameState } from "../src/domain/gameFactory";
import { Role } from "../src/domain/models";
import {
	type DataFileReadResult,
	type DataFileReference,
	type DataFileStorage,
	type DataFileWriteOptions,
	RecoverableStorageWriteError,
	type StoredByteDocument,
} from "../src/persistence/ports/dataFileStorage";
import type {
	StorageCommandContinuation,
	StorageCommandDecision,
} from "../src/persistence/ports/storageCommand";
import type {
	StorageFailure,
	StorageOperationResult,
} from "../src/persistence/ports/storageFailure";
import { createGameExportDocument } from "../src/serialization/gameExport";
import { createRuleSetExportJsonText } from "../src/serialization/ruleSetExport";
import { createTestObjectPersistence } from "./createTestObjectPersistence";
import { fixedDomainServices } from "./fixedClock";
import { createTestGame, createTestRuleSet } from "./fixtures";
import { missingRead } from "./storageReadResult";

describe("Spielzustand und Persistenz", () => {
	it("teilen das aktive Spiel, aber nicht ihre öffentlichen Methoden", async () => {
		const files = new Map<string, Uint8Array>();
		const storage: DataFileStorage = {
			readInternal: (file) => {
				const { fileName } = file;
				const bytes = files.get(fileName);
				return Promise.resolve(
					bytes ? { status: "success", bytes } : missingRead(file),
				);
			},
			writeInternal: ({ fileName }, bytes) => {
				files.set(fileName, Uint8Array.from(bytes));
				return Promise.resolve();
			},
		};
		const services = createGameUseCases(
			createTestObjectPersistence(storage, fixedDomainServices),
			fixedDomainServices,
		);
		const game = createTestGame();

		services.session.setPreparedGame(game);
		expect(services.session.isLoadedGameDirty()).toBe(true);
		const saved = await services.persistence.saveLoadedGame();
		expect(services.session.isLoadedGameDirty()).toBe(false);

		if (!saved.storageKey) throw new Error("Gespeicherter Schlüssel fehlt.");
		const loaded = await services.persistence.loadGame(saved.storageKey);
		expect(services.session.getLoadedGame()).toEqual(loaded);
		expect("saveLoadedGame" in services.session).toBe(false);
		expect("moveLoadedSeat" in services.persistence).toBe(false);
	});

	it("hält Dirty-State und aktuelles Dokument über Session und Speichern konsistent", async () => {
		const storage = new CharacterizationStorage();
		const services = createServices(storage);
		const prepared = services.session.setPreparedGame(createTestGame());

		expect(prepared.storageKey).toBeNull();
		expect(services.session.isLoadedGameDirty()).toBe(true);

		const saved = await services.persistence.saveLoadedGame();
		expect(services.session.getLoadedGame()).toEqual(saved);
		expect(services.session.isLoadedGameDirty()).toBe(false);

		const editedDocument = structuredClone(saved.document);
		editedDocument.name = "Bearbeitete Runde";
		const edited =
			services.session.replaceLoadedGameWithEditedCopy(editedDocument);
		expect(services.session.getLoadedGame()).toEqual(edited);
		expect(services.session.isLoadedGameDirty()).toBe(true);

		const storageFailure = expectedWriteFailure("Datenträger voll");
		storage.failNextWrite = storageFailure;
		const applicationError = await services.persistence
			.saveLoadedGame()
			.catch((error: unknown) => error);
		expect(applicationError).toMatchObject({
			code: "APPLICATION_EXPECTED_ERROR",
			source: "storage",
			expectation: "expected",
			severity: "error",
			reason: "diskFull",
			diagnostic: storageFailure.diagnostic,
		});
		expect(services.session.getLoadedGame()).toEqual(edited);
		expect(services.session.isLoadedGameDirty()).toBe(true);
	});

	it("markiert einen nicht ausführbaren Shuffle nicht als Änderung", async () => {
		const services = createServices(new CharacterizationStorage());
		services.session.setPreparedGame(createTestGame(1));
		await services.persistence.saveLoadedGame();

		const shuffled = services.session.shuffleLoadedPlayers();

		expect(shuffled.document.seatOrder).toEqual(["p_player1"]);
		expect(services.session.isLoadedGameDirty()).toBe(false);
	});

	it("löscht einzelne oder sämtliche Logeinträge im geladenen Spiel", async () => {
		const services = createServices(new CharacterizationStorage());
		const game = createTestGame();
		game.log = [
			{
				id: "log_1",
				night: 0,
				phase: "setup",
				createdAt: "2026-08-15T00:00:00.000Z",
				type: "test",
				actor: "storyteller",
				text: "Erster Eintrag",
			},
			{
				id: "log_2",
				night: 1,
				phase: "night",
				createdAt: "2026-08-15T00:01:00.000Z",
				type: "test",
				actor: "storyteller",
				text: "Zweiter Eintrag",
			},
		];
		services.session.setPreparedGame(game);
		await services.persistence.saveLoadedGame();

		const afterSingleDelete =
			services.session.deleteLoadedGameLogEntry("log_1");
		expect(afterSingleDelete.document.log.map(({ id }) => id)).toEqual([
			"log_2",
		]);
		expect(services.session.isLoadedGameDirty()).toBe(true);

		const afterClear = services.session.clearLoadedGameLog();
		expect(afterClear.document.log).toEqual([]);
	});

	it("schützt den Session-Zustand vor Mutation über Ein- und Ausgaben", async () => {
		const storage = new CharacterizationStorage();
		const services = createServices(storage);
		const source = createTestGame();
		const originalName = source.name;
		const sourceRole = source.ruleSetSnapshot.roles[0];
		if (!sourceRole) throw new Error("Testrolle fehlt.");
		const originalRoleName = sourceRole.name;

		const prepared = services.session.setPreparedGame(source);
		source.name = "Mutation der Eingabe";
		sourceRole.name = "Mutation der Eingaberolle";
		prepared.document.name = "Mutation der Rückgabe";

		const beforeSave = services.session.getLoadedGame();
		expect(beforeSave?.document.name).toBe(originalName);
		expect(beforeSave?.document.ruleSetSnapshot.roles[0]?.name).toBe(
			originalRoleName,
		);
		expect(beforeSave?.document.ruleSetSnapshot.roles[0]).toBeInstanceOf(Role);

		const saved = await services.persistence.saveLoadedGame();
		expect(services.session.isLoadedGameDirty()).toBe(false);
		saved.document.name = "Mutation des Speicherergebnisses";

		const firstView = services.session.getLoadedGame();
		if (!firstView) throw new Error("Geladenes Testspiel fehlt.");
		firstView.name = "Mutation der Hülle";
		firstView.document.name = "Mutation der Dokumentansicht";
		const firstRole = firstView.document.ruleSetSnapshot.roles[0];
		if (!firstRole) throw new Error("Testrolle fehlt.");
		firstRole.name = "Mutation der Rollenansicht";

		const secondView = services.session.getLoadedGame();
		expect(secondView).not.toBe(firstView);
		expect(secondView?.document).not.toBe(firstView.document);
		expect(secondView?.name).toBe(originalName);
		expect(secondView?.document.name).toBe(originalName);
		expect(secondView?.document.ruleSetSnapshot.roles[0]?.name).toBe(
			originalRoleName,
		);
		expect(secondView?.document.ruleSetSnapshot.roles[0]).toBeInstanceOf(Role);
		expect(services.session.isLoadedGameDirty()).toBe(false);
	});

	it("invalidiert den Browse-Cache erst nach erfolgreichem Schreiben", async () => {
		const storage = new CharacterizationStorage();
		const services = createServices(storage);
		services.session.setPreparedGame(createTestGame());

		await services.persistence.suggestLoadedGameSaveAsName();
		expect(storage.readAllCount).toBe(2);
		await services.persistence.suggestLoadedGameSaveAsName();
		expect(storage.readAllCount).toBe(2);

		await services.persistence.saveLoadedGameAs("Neue Runde");
		await services.persistence.suggestLoadedGameSaveAsName();
		expect(storage.readAllCount).toBe(4);
	});

	it("bewahrt einen Spielimport-Konflikt bis zur Entscheidung auf", async () => {
		const existing = createTestGame();
		existing.id = "game_importkonflikt";
		existing.name = "Vorhandene Runde";
		const imported = structuredClone(existing);
		imported.name = "Importierte Runde";
		const storage = new CharacterizationStorage([existing]);
		storage.externalBytes = encodeGame(imported);
		const services = createServices(storage);

		const conflict = await services.persistence.importSavedGame({});
		expect(conflict).toMatchObject({
			status: "decisionRequired",
			decisionKind: "importConflict",
			existing: { id: existing.id, name: existing.name },
			imported: { id: imported.id, name: imported.name },
		});
		if (conflict.status !== "decisionRequired")
			throw new Error("Importentscheidung erwartet.");

		await expect(
			services.persistence.resolveSavedGameImport(
				conflict.commandId,
				"keepBoth",
			),
		).resolves.toMatchObject({
			status: "imported",
			id: "game_importierte_runde_2",
		});
		expect(storage.hasFile("game", "game_importkonflikt.json")).toBe(true);
		expect(storage.hasFile("game", "game_importierte_runde_2.json")).toBe(true);
	});

	it("verwirft einen abgebrochenen Spielimport-Konflikt endgültig", async () => {
		const existing = createTestGame();
		existing.id = "game_importkonflikt";
		existing.name = "Vorhandene Runde";
		const imported = structuredClone(existing);
		imported.name = "Importierte Runde";
		const storage = new CharacterizationStorage([existing]);
		storage.externalBytes = encodeGame(imported);
		const services = createServices(storage);
		const conflict = await services.persistence.importSavedGame({});
		if (conflict.status !== "decisionRequired")
			throw new Error("Importentscheidung erwartet.");

		await expect(
			services.persistence.resolveSavedGameImport(conflict.commandId, "cancel"),
		).resolves.toBeUndefined();
		await expect(
			services.persistence.resolveSavedGameImport(
				conflict.commandId,
				"overwrite",
			),
		).rejects.toMatchObject({ reason: "decisionExpired" });
		expect(storage.hasFile("game", "game_importkonflikt.json")).toBe(true);
		expect(storage.hasFile("game", "game_importierte_runde_2.json")).toBe(
			false,
		);
	});

	it("überschreibt bei entsprechender Importentscheidung das vorhandene Spiel", async () => {
		const existing = createTestGame();
		existing.id = "game_importkonflikt";
		existing.name = "Vorhandene Runde";
		const imported = structuredClone(existing);
		imported.name = "Importierte Runde";
		const storage = new CharacterizationStorage([existing]);
		storage.externalBytes = encodeGame(imported);
		const services = createServices(storage);
		const conflict = await services.persistence.importSavedGame({});
		if (conflict.status !== "decisionRequired")
			throw new Error("Importentscheidung erwartet.");

		await expect(
			services.persistence.resolveSavedGameImport(
				conflict.commandId,
				"overwrite",
			),
		).resolves.toMatchObject({
			status: "imported",
			id: "game_importkonflikt",
			name: "Importierte Runde",
		});
		await expect(
			services.persistence.loadGame("game_importkonflikt"),
		).resolves.toMatchObject({ name: "Importierte Runde" });
	});

	it("lehnt beim Spielimport ein Regelwerk mit wrongObjectKind ab", async () => {
		const storage = new CharacterizationStorage();
		storage.externalBytes = new TextEncoder().encode(
			createRuleSetExportJsonText(createTestRuleSet()),
		);
		const services = createServices(storage);

		await expect(
			services.persistence.importSavedGame({}),
		).rejects.toMatchObject({
			operation: "import",
			subject: "game",
			reason: "wrongObjectKind",
		});
	});

	it("behält eine Importentscheidung nach fehlgeschlagenem Keep-Both bei", async () => {
		const existing = createTestGame();
		existing.id = "game_importkonflikt";
		existing.name = "Vorhandene Runde";
		const imported = structuredClone(existing);
		imported.name = "Importierte Runde";
		const storage = new CharacterizationStorage([existing]);
		storage.externalBytes = encodeGame(imported);
		const services = createServices(storage);

		const conflict = await services.persistence.importSavedGame({});
		if (conflict.status !== "decisionRequired")
			throw new Error("Importentscheidung erwartet.");
		storage.failNextWrite = expectedWriteFailure("Temporärer Schreibfehler");

		await expect(
			services.persistence.resolveSavedGameImport(
				conflict.commandId,
				"keepBoth",
			),
		).rejects.toThrow();
		await expect(
			services.persistence.resolveSavedGameImport(
				conflict.commandId,
				"keepBoth",
			),
		).resolves.toMatchObject({
			status: "imported",
			id: "game_importierte_runde_2",
		});
	});

	it("wiederholt Keep-Both nach bereits abgebrochenem Storage-Befehl", async () => {
		const existing = createTestGame();
		existing.id = "game_importkonflikt";
		existing.name = "Vorhandene Runde";
		const imported = structuredClone(existing);
		imported.name = "Importierte Runde";
		const storage = new CharacterizationStorage([existing]);
		storage.externalBytes = encodeGame(imported);
		storage.interruptNextWrite = {
			commandId: "command-import-conflict",
			reason: "targetExists",
		};
		const services = createServices(storage);

		const conflict = await services.persistence.importSavedGame({});
		if (conflict.status !== "decisionRequired")
			throw new Error("Importentscheidung erwartet.");
		storage.failNextWrite = expectedWriteFailure("Temporärer Schreibfehler");

		await expect(
			services.persistence.resolveSavedGameImport(
				conflict.commandId,
				"keepBoth",
			),
		).rejects.toThrow();
		await expect(
			services.persistence.resolveSavedGameImport(
				conflict.commandId,
				"keepBoth",
			),
		).resolves.toMatchObject({
			status: "imported",
			id: "game_importierte_runde_2",
		});
		expect(storage.continuations).toEqual([
			{ commandId: "command-import-conflict", decision: "cancel" },
		]);
	});

	it("behält neuere RAM-Änderungen nach einem Save-Recovery bei", async () => {
		const storage = new CharacterizationStorage();
		const services = createServices(storage);
		services.session.setPreparedGame(createTestGame());
		storage.interruptNextWrite = {
			commandId: "command-save",
			reason: "writeFailure",
		};

		await expect(services.persistence.saveLoadedGame()).rejects.toMatchObject({
			commandId: "command-save",
		});
		const edited = structuredClone(services.session.getLoadedGame()?.document);
		if (!edited) throw new Error("Geladenes Testspiel fehlt.");
		edited.name = "Neuer RAM-Stand";
		services.session.replaceLoadedGameWithEditedCopy(edited);

		const recovered =
			await services.persistence.retryLoadedGameSave("command-save");

		expect(recovered.document.name).toBe("Neuer RAM-Stand");
		expect(services.session.getLoadedGame()?.document.name).toBe(
			"Neuer RAM-Stand",
		);
		expect(services.session.isLoadedGameDirty()).toBe(true);
	});

	it("setzt ein unterbrochenes Speichern-unter über die Command-ID fort", async () => {
		const storage = new CharacterizationStorage();
		const services = createServices(storage);
		const original = services.session.setPreparedGame(createTestGame());
		storage.interruptNextWrite = {
			commandId: "command-save-as",
			reason: "writeFailure",
		};

		await expect(
			services.persistence.saveLoadedGameAs("Fortgesetzte Runde"),
		).rejects.toMatchObject({ commandId: "command-save-as" });
		expect(services.session.getLoadedGame()).toEqual(original);
		expect(services.session.isLoadedGameDirty()).toBe(true);

		const saved = await services.persistence.continuePendingCreatedDocument(
			"command-save-as",
			"retry",
		);
		expect(saved).toMatchObject({
			id: "game_fortgesetzte_runde",
			name: "Fortgesetzte Runde",
		});
		expect(services.session.getLoadedGame()).toEqual(saved);
		expect(services.session.isLoadedGameDirty()).toBe(false);
		expect(storage.continuations).toEqual([
			{ commandId: "command-save-as", decision: "retry" },
		]);
	});

	it("erstellt das Template aus einer Kopie und lässt die geladene Session unverändert", async () => {
		const storage = new CharacterizationStorage();
		const services = createServices(storage);
		const game = createTestGame();
		(game.ruleSetSnapshot.teams[0] as { id: string }).id = "Ungültiges Team";
		const role = game.ruleSetSnapshot.roles[0];
		if (!role) throw new Error("Testrolle fehlt.");
		role.teamId = "Ungültiges Team";
		const original = services.session.setPreparedGame(game);
		const originalDocument = structuredClone(original.document);

		const result =
			await services.persistence.saveLoadedGameAsTemplate("Meine Vorlage");

		expect(result.warnings).toContainEqual(
			expect.objectContaining({ code: "IDS_REPAIRED" }),
		);
		expect(result.template.ruleSetSnapshot.teams[0]?.id).toBe(
			"t_ungultiges_team",
		);
		expect(services.session.getLoadedGame()).toEqual(original);
		expect(services.session.getLoadedGame()?.document).toEqual(
			originalDocument,
		);
		expect(services.session.isLoadedGameDirty()).toBe(true);
		expect(storage.hasFile("template", "template_meine_vorlage.json")).toBe(
			true,
		);
	});
});

function createServices(storage: DataFileStorage) {
	return createGameUseCases(
		createTestObjectPersistence(storage, fixedDomainServices),
		fixedDomainServices,
	);
}

class CharacterizationStorage implements DataFileStorage {
	readonly #documents = new Map<string, StoredByteDocument>();
	externalBytes?: Uint8Array;
	readAllCount = 0;
	failNextWrite?: StorageFailure;
	interruptNextWrite?: {
		commandId: string;
		reason: "writeFailure" | "targetExists";
	};
	readonly continuations: Array<{
		commandId: string;
		decision: StorageCommandDecision;
	}> = [];

	constructor(documents: GameState[] = []) {
		for (const document of documents)
			this.store(
				document.isTemplate ? "template" : "game",
				`${document.id}.json`,
				encodeGame(document),
			);
	}

	readInternal(file: DataFileReference): Promise<DataFileReadResult> {
		const stored = this.#documents.get(this.key(file.category, file.fileName));
		return Promise.resolve(
			stored ? { status: "success", bytes: stored.bytes } : missingRead(file),
		);
	}

	readAllInternal(category: DataFileReference["category"]) {
		this.readAllCount++;
		return Promise.resolve(
			[...this.#documents.values()].filter(
				(document) => document.category === category,
			),
		);
	}

	writeInternal(
		file: DataFileReference,
		bytes: Uint8Array,
		options: DataFileWriteOptions,
	): Promise<void | StorageOperationResult<void>> {
		if (this.failNextWrite) {
			const error = this.failNextWrite;
			this.failNextWrite = undefined;
			return Promise.resolve({ status: "error", error });
		}
		if (this.interruptNextWrite) {
			const interruption = this.interruptNextWrite;
			this.interruptNextWrite = undefined;
			return Promise.reject(
				new RecoverableStorageWriteError(
					"Speichern unterbrochen",
					interruption.commandId,
					interruption.reason,
					file,
				),
			);
		}
		const key = this.key(file.category, file.fileName);
		if (options.createOnly && this.#documents.has(key))
			return Promise.resolve({
				status: "conflict",
				reason: "targetExists",
				file,
			});
		if (options.previousFile)
			this.#documents.delete(
				this.key(options.previousFile.category, options.previousFile.fileName),
			);
		this.store(file.category, file.fileName, bytes);
		return Promise.resolve();
	}

	readExternal(): Promise<Uint8Array> {
		return this.externalBytes
			? Promise.resolve(this.externalBytes)
			: Promise.reject(new Error("Keine Importdatei."));
	}

	continueInternalCommand(
		commandId: string,
		decision: StorageCommandDecision,
		continuation?: StorageCommandContinuation,
	): Promise<"completed"> {
		this.continuations.push({ commandId, decision });
		if (continuation)
			this.store(
				continuation.file.category,
				continuation.file.fileName,
				continuation.bytes,
			);
		return Promise.resolve("completed");
	}

	hasFile(category: "game" | "template", fileName: string): boolean {
		return this.#documents.has(this.key(category, fileName));
	}

	private store(
		category: DataFileReference["category"],
		fileName: string,
		bytes: Uint8Array,
	): void {
		this.#documents.set(this.key(category, fileName), {
			category,
			fileName,
			bytes,
		});
	}

	private key(
		category: DataFileReference["category"],
		fileName: string,
	): string {
		return `${category}:${fileName}`;
	}
}

function encodeGame(document: GameState): Uint8Array {
	return new TextEncoder().encode(
		JSON.stringify(createGameExportDocument(document)),
	);
}

function expectedWriteFailure(diagnostic: string): StorageFailure {
	return {
		source: "storage",
		operation: "write",
		reason: "diskFull",
		retryable: true,
		repairable: false,
		diagnostic,
	};
}
