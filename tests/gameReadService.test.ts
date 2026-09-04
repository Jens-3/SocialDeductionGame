import { afterEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "../src/config";
import type { GameState } from "../src/domain/gameFactory";
import type {
	DataFileReadResult,
	DataFileStorage,
	DataFileWriteOptions as StorageWriteOptions,
	StoredByteDocument,
} from "../src/persistence/ports/dataFileStorage";
import type { StorageCommandDecision } from "../src/persistence/ports/storageCommand";
import type {
	StorageRecoveryCandidate,
	StorageRecoveryResolution,
} from "../src/persistence/ports/storageRecovery";
import { createGameExportDocument } from "../src/serialization/gameExport";
import { createTestGame, createTestRuleSet } from "./fixtures";
import { GameTestFacade } from "./gameTestFacade";
import { missingRead } from "./storageReadResult";

class GameReadService extends GameTestFacade {}

async function readList<K extends "game" | "template">(
	service: GameReadService,
	kind: K,
) {
	const result = await service.listObjects(kind);
	if (result.status === "expectedFailure")
		throw new Error(result.problem.reason);
	return result;
}

async function readMetadata<K extends "game" | "template">(
	service: GameReadService,
	kind: K,
) {
	return (await readList(service, kind)).metadata;
}

afterEach(() => setLanguage("de"));

describe("GameReadService", () => {
	it("sendet einen identischen parallelen Ladevorgang nur einmal an Persistence", async () => {
		const game = createTestGame();
		const bytes = encodeGameDocument(game);
		let finishRead: ((result: DataFileReadResult) => void) | undefined;
		const readResult = new Promise<DataFileReadResult>((resolve) => {
			finishRead = resolve;
		});
		const readInternal = vi.fn(() => readResult);
		const service = new GameReadService({ readInternal });

		const first = service.loadGame(game.id);
		const second = service.loadGame(game.id);
		await Promise.resolve();
		await Promise.resolve();
		expect(readInternal).toHaveBeenCalledTimes(1);
		finishRead?.(success(bytes));
		const [firstResult, secondResult] = await Promise.all([first, second]);

		expect(firstResult).toBe(secondResult);
		expect(firstResult.document.id).toBe(game.id);
	});

	it("verwaltet gespeicherte Spielstände über gemeinsame Domain-Aktionen", async () => {
		const game = createTestGame();
		game.id = "game_original";
		game.name = "Original";
		const storage = new SavedGameActionStorage(game);
		const service = new GameReadService(storage);

		await expect(service.suggestSavedGameCopyName(game.id)).resolves.toBe(
			"Original (1)",
		);
		await expect(
			service.duplicateSavedGame(game.id, "Original (1)"),
		).resolves.toEqual({
			id: "game_original_1",
			storageKey: "game_original_1",
			name: "Original (1)",
		});
		await service.exportSavedGame(game.id);
		expect(storage.exports.at(-1)?.options.suggestedFileName).toBe(
			"game_original.json",
		);

		await expect(
			service.renameSavedGame(game.id, "Neue Runde"),
		).resolves.toEqual({
			id: "game_neue_runde",
			storageKey: "game_neue_runde",
			name: "Neue Runde",
		});
		expect(storage.has("game_original")).toBe(false);
		expect(storage.has("game_neue_runde")).toBe(true);
		await service.deleteSavedGame("game_neue_runde");
		expect(storage.has("game_neue_runde")).toBe(false);
	});

	it("macht wiederhergestellte Spielstände durch Umbenennen regulär und löschbar", async () => {
		const game = createTestGame();
		game.id = "game_restored_actions";
		const storage = new RecoveryGameReadStorage([
			{
				category: "game",
				fileName: "game_restored_actions.restored.json",
				bytes: encodeGameDocument(game),
			},
		]);
		const service = new GameReadService(storage);

		await expect(
			service.renameSavedGame("game_restored_actions.restored", "Neu"),
		).resolves.toEqual({
			id: "game_neu",
			storageKey: "game_neu",
			name: "Neu",
		});
		expect(storage.documents).toMatchObject([{ fileName: "game_neu.json" }]);
		await service.deleteSavedGame("game_neu");
		expect(storage.documents).toEqual([]);
	});

	it("behält den Zusatz, solange der Storage-Schlüssel weiterhin zum Namen passt", async () => {
		const game = createTestGame();
		game.id = "game_old_game";
		game.name = "Old Game";
		const storage = new RecoveryGameReadStorage([
			{
				category: "game",
				fileName: "game_old_game.restored.json",
				bytes: encodeGameDocument(game),
			},
		]);
		const service = new GameReadService(storage);

		await expect(readMetadata(service, "game")).resolves.toMatchObject([
			{
				storageKey: "game_old_game.restored",
				id: "game_old_game",
				restoredIndex: 1,
			},
		]);
		const loaded = await service.loadGame("game_old_game.restored");
		expect(loaded.restored).toBe(true);
		expect(loaded.restoredIndex).toBe(1);

		const saved = await service.saveLoadedGame();
		expect(saved).toMatchObject({
			storageKey: "game_old_game.restored",
			id: "game_old_game",
			restored: true,
			restoredIndex: 1,
		});
		expect(storage.writes.at(-1)?.options.createOnly).toBe(false);
		expect(storage.writes.at(-1)?.options.previousFile).toBeUndefined();
	});

	it("entfernt den alten Zusatz, wenn der Dokumentname einen neuen Dateischlüssel erzeugt", async () => {
		const game = createTestGame();
		game.id = "game_old_game";
		game.name = "Old Game";
		const storage = new RecoveryGameReadStorage([
			{
				category: "game",
				fileName: "game_old_game.restored.json",
				bytes: encodeGameDocument(game),
			},
		]);
		const service = new GameReadService(storage);
		const loaded = await service.loadGame("game_old_game.restored");
		const edited = structuredClone(loaded.document);
		edited.name = "New Game";
		service.replaceLoadedGameWithEditedCopy(edited);

		const saved = await service.saveLoadedGame();

		expect(saved).toMatchObject({
			storageKey: "game_new_game",
			id: "game_new_game",
		});
		expect(saved.restored).toBeUndefined();
		expect(saved.storageVariant).toBeUndefined();
		expect(storage.writes.at(-1)?.options.previousFile).toEqual({
			category: "game",
			fileName: "game_old_game.restored.json",
		});
	});

	it.each([
		["fehlende", undefined],
		["abweichende", "game_falscher_inhalt"],
	])(
		"leitet die interne ID aus dem Dateinamen ab und ignoriert %s JSON-IDs",
		async (_label, jsonId) => {
			const game = createTestGame();
			if (jsonId === undefined) delete (game as Partial<GameState>).id;
			else game.id = jsonId;
			const storage = new RecoveryGameReadStorage([
				{
					category: "game",
					fileName: "game_dateiname.json",
					bytes: encodeGameDocument(game),
				},
			]);
			const service = new GameReadService(storage);

			await expect(readMetadata(service, "game")).resolves.toMatchObject([
				{ id: "game_dateiname" },
			]);
			const loaded = await service.loadGame("game_dateiname");
			expect(loaded.id).toBe("game_dateiname");
			expect(loaded.document.id).toBe("game_dateiname");
		},
	);

	it("normalisiert eine Storage-Variante erst beim Speichern", async () => {
		const game = createTestGame();
		game.id = "game_id_aus_json_wird_ignoriert";
		const storageVariant = "fählerhaft_ünd_müß-unbedingt_korrigiert_werden";
		const storage = new RecoveryGameReadStorage([
			{
				category: "game",
				fileName: `game_variante.${storageVariant}.json`,
				bytes: encodeGameDocument(game),
			},
		]);
		const service = new GameReadService(storage);

		await expect(readMetadata(service, "game")).resolves.toMatchObject([
			{
				id: "game_variante",
				storageKey: `game_variante.${storageVariant}`,
			},
		]);
		const loaded = await service.loadGame(`game_variante.${storageVariant}`);
		expect(loaded.storageVariant).toBe(storageVariant);
		expect(loaded.document.id).toBe("game_variante");
		const saved = await service.saveLoadedGame();
		expect(saved.storageKey).toBe("game_test_rules_2026_01_02_3_spieler");
		expect(saved.storageVariant).toBeUndefined();
		expect(storage.writes.at(-1)?.options.previousFile).toEqual({
			category: "game",
			fileName: `game_variante.${storageVariant}.json`,
		});
	});

	it("bestimmt den kanonischen Storage-Schlüssel beim Speichern aus dem Dokumentnamen", async () => {
		const game = createTestGame();
		game.id = "game_falscher_inhalt";
		const storage = new RecoveryGameReadStorage([
			{
				category: "game",
				fileName: "game_richtige_datei.json",
				bytes: encodeGameDocument(game),
			},
		]);
		const service = new GameReadService(storage);
		await service.loadGame("game_richtige_datei");

		await service.saveLoadedGame();

		const written = storage.writes.at(-1);
		expect(written?.gameId).toBe("game_test_rules_2026_01_02_3_spieler");
		expect(JSON.parse(new TextDecoder().decode(written?.bytes))).toMatchObject({
			id: "game_test_rules_2026_01_02_3_spieler",
		});
		expect(written?.options.previousFile).toEqual({
			category: "game",
			fileName: "game_richtige_datei.json",
		});
	});

	it("validiert neue Recovery-Dateien vor Behalten oder Export", async () => {
		const validGame = createTestGame();
		validGame.id = "game_valid_recovery";
		const storage = new RecoveryGameReadStorage(
			[],
			[
				{
					category: "game",
					recoveryKey: validGame.id,
					fileName: `${validGame.id}.json`,
					oldBytes: encodeGameDocument(validGame),
					newBytes: encodeGameDocument(validGame),
				},
				{
					category: "game",
					recoveryKey: "game_invalid_recovery",
					fileName: "game_invalid_recovery.json",
					oldBytes: encodeGameDocument(validGame),
					newBytes: new TextEncoder().encode("kein JSON"),
				},
			],
		);
		const service = new GameReadService(storage);

		await expect(service.listWriteRecoveries()).resolves.toMatchObject([
			{
				id: "game_invalid_recovery",
				canKeepNew: false,
				hasNew: true,
			},
			{ id: validGame.id, canKeepNew: true, hasNew: true },
		]);
		await service.resolveWriteRecovery(`command:${validGame.id}`, "keepBoth");
		expect(storage.resolutions).toEqual([
			{ recoveryKey: validGame.id, resolution: "keepBoth" },
		]);
		await expect(
			service.resolveWriteRecovery("command:game_invalid_recovery", "keepNew"),
		).rejects.toMatchObject({ reason: "invalidDocument" });
		await service.exportFailedWrite("game_invalid_recovery");
		expect(new TextDecoder().decode(storage.exports.at(-1)?.bytes)).toBe(
			"kein JSON",
		);
	});

	it("lehnt fachlich ungültige Recovery-Dokumente trotz gültiger Struktur ab", async () => {
		const game = createTestGame();
		game.id = "game_domain_invalid_recovery";
		const role = game.ruleSetSnapshot.roles[0];
		if (!role) throw new Error("Testrolle fehlt.");
		role.id = "Ungültige Rollen-ID";
		const storage = new RecoveryGameReadStorage(
			[],
			[
				{
					category: "game",
					recoveryKey: game.id,
					fileName: `${game.id}.json`,
					oldBytes: encodeGameDocument(createTestGame()),
					newBytes: encodeGameDocument(game),
				},
			],
		);
		const service = new GameReadService(storage);

		const [recovery] = await service.listWriteRecoveries();
		expect(recovery).toMatchObject({
			id: game.id,
			canKeepNew: false,
		});
		expect(
			recovery?.validationProblem?.diagnostic ??
				recovery?.validationProblem?.details,
		).toContain("Role id");
		await expect(
			service.resolveWriteRecovery(`command:${game.id}`, "keepNew"),
		).rejects.toMatchObject({ reason: "invalidDocument" });
	});

	it("verwendet den dekodierten Auswahltext beim anschließenden Laden", async () => {
		const document = {
			...createTestGame(1),
			id: "game_utf16",
			name: "Grüne Nacht",
			ruleSetSnapshot: {
				...createTestRuleSet(),
				name: "Nächtliches Regelwerk",
			},
			time: { currentNight: 2, phase: "night" },
		};
		const storage = new ByteGameReadStorage(
			"game_utf16",
			encodeUtf16LeWithBom(
				JSON.stringify(createGameExportDocument(document as GameState)),
			),
		);
		const service = new GameReadService(storage);

		await expect(readMetadata(service, "game")).resolves.toMatchObject([
			{
				id: "game_utf16",
				name: "Grüne Nacht",
				ruleSetName: "Nächtliches Regelwerk",
			},
		]);
		expect(storage.singleReadCount).toBe(0);
		await expect(service.loadGame("game_utf16")).resolves.toMatchObject({
			id: "game_utf16",
			name: "Grüne Nacht",
		});
		expect(storage.singleReadCount).toBe(0);
		expect(storage.allReadCount).toBe(1);

		service.clearBrowseCache();
		await service.loadGame("game_utf16");
		expect(storage.singleReadCount).toBe(0);
	});

	it("liest das Verzeichnis für Spiele und Vorlagen nur einmal pro Auswahl", async () => {
		const storage = new ByteGameReadStorage(
			"game_one",
			new TextEncoder().encode(
				JSON.stringify({
					id: "game_one",
					name: "Spiel",
					seatOrder: [],
					ruleSetSnapshot: { name: "Regelwerk" },
					time: { currentNight: 0, phase: "setup" },
				}),
			),
		);
		const service = new GameReadService(storage);

		await readMetadata(service, "game");
		await readMetadata(service, "template");

		expect(storage.allReadCount).toBe(2);
	});

	it("meldet defekte Dokumente, statt sie still auszusortieren", async () => {
		const service = new GameReadService(
			new ByteGameReadStorage(
				"game_broken",
				new TextEncoder().encode('{"id":"game_broken"'),
			),
		);

		const result = await readList(service, "game");
		expect(result.metadata).toEqual([]);
		expect(result.problems).toEqual([
			expect.objectContaining({
				kind: "game",
				storageKey: "game_broken",
				id: "game_broken",
				reason: "invalidJson",
				canExport: true,
			}),
		]);
	});

	it("meldet fachlich ungültige Listendokumente als Dokumentproblem", async () => {
		const game = createTestGame();
		game.id = "game_domain_invalid_list";
		const role = game.ruleSetSnapshot.roles[0];
		if (!role) throw new Error("Testrolle fehlt.");
		role.id = "Ungültige Rollen-ID";
		const service = new GameReadService(
			new ByteGameReadStorage(game.id, encodeGameDocument(game)),
		);

		const result = await readList(service, "game");
		expect(result.metadata).toEqual([]);
		const [problem] = result.problems;
		expect(problem).toMatchObject({
			id: game.id,
			category: "domain",
			reason: "invalidObject",
			repairable: true,
			componentKind: "ruleSet",
		});
		if (problem?.category !== "domain")
			throw new Error("Das erwartete Domainproblem fehlt.");
		expect(problem.details).toContain("Role id");
		expect(problem.availableActions).toContain("repair");
	});

	it("repariert ein fachlich ungültiges eingebettetes Regelwerk über das Game", async () => {
		const game = createTestGame();
		game.id = "game_repair_ruleset";
		const role = game.ruleSetSnapshot.roles[0];
		if (!role) throw new Error("Testrolle fehlt.");
		role.id = "Ungültige Rollen-ID";
		let writtenBytes: Uint8Array | undefined;
		const writeInternal = vi.fn((_file, bytes: Uint8Array, _options) => {
			void _options;
			writtenBytes = bytes;
			return Promise.resolve();
		});
		const service = new GameReadService({
			readAllInternal: (category) =>
				Promise.resolve(
					category === "game"
						? [
								{
									category,
									fileName: `${game.id}.json`,
									bytes: encodeGameDocument(game),
								},
							]
						: [],
				),
			readInternal: (file) => Promise.resolve(missingRead(file)),
			writeInternal,
		});
		const problem = (await readList(service, "game")).problems[0];
		if (!problem) throw new Error("Domainproblem fehlt.");

		await service.objectProblems.repair(problem, "repair");

		expect(writeInternal).toHaveBeenCalledWith(
			{ category: "game", fileName: `${game.id}.json` },
			expect.any(Uint8Array),
			{ backup: true },
		);
		expect(writtenBytes).toBeDefined();
	});

	it("repariert den Dateinamen eines gültigen, falsch benannten Spielstands", async () => {
		const game = createTestGame();
		game.id = "game_falscher_name";
		game.name = "Falscher Name";
		const writeInternal = vi.fn(() => Promise.resolve());
		const deleteInternal = vi.fn(() => Promise.resolve());
		const storage: DataFileStorage = {
			readAllInternal: (category) =>
				Promise.resolve(
					category === "game"
						? [
								{
									category,
									fileName: "Falscher Name.json",
									bytes: encodeGameDocument(game),
								},
							]
						: [],
				),
			readInternal: (file) => Promise.resolve(missingRead(file)),
			writeInternal,
			deleteInternal,
		};
		const service = new GameReadService(storage);

		const result = await readList(service, "game");
		expect(result.metadata).toEqual([]);
		const problem = result.problems[0];
		expect(problem).toMatchObject({
			reason: "invalidFileName",
			kind: "game",
			storageKey: "Falscher Name",
			suggestedFileName: "game_falscher_name.json",
			canRepairFileName: true,
		});
		expect(problem).not.toHaveProperty("diagnostic");
		expect(problem?.availableActions).toContain("repairFileName");
		if (!problem) throw new Error("Der erwartete Dateifehler fehlt.");

		await service.objectProblems.repair(problem, "repairFileName");

		expect(writeInternal).toHaveBeenCalledWith(
			{ category: "game", fileName: "game_falscher_name.json" },
			expect.any(Uint8Array),
			{ createOnly: true },
		);
		expect(deleteInternal).toHaveBeenCalledWith(
			{
				category: "game",
				fileName: "Falscher Name.json",
			},
			{ includeBackup: true, includeRecovery: true },
		);
	});

	it("schreibt bei der Dateinamen-Reparatur kein fachlich ungültiges Dokument", async () => {
		const game = createTestGame();
		game.id = "game_ungueltige_reparatur";
		const role = game.ruleSetSnapshot.roles[0];
		if (!role) throw new Error("Testrolle fehlt.");
		role.id = "Ungültige Rollen-ID";
		const writeInternal = vi.fn(() => Promise.resolve());
		const deleteInternal = vi.fn(() => Promise.resolve());
		const service = new GameReadService({
			readAllInternal: (category) =>
				Promise.resolve(
					category === "game"
						? [
								{
									category,
									fileName: "Ungültige Reparatur.json",
									bytes: encodeGameDocument(game),
								},
							]
						: [],
				),
			readInternal: (file) => Promise.resolve(missingRead(file)),
			writeInternal,
			deleteInternal,
		});

		const problem = (await readList(service, "game")).problems[0];
		if (!problem) throw new Error("Der erwartete Dateifehler fehlt.");
		const error = await service.objectProblems
			.repair(
				{
					...problem,
					canRepairFileName: true,
				},
				"repairFileName",
			)
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
		expect(writeInternal).not.toHaveBeenCalled();
		expect(deleteInternal).not.toHaveBeenCalled();
	});

	it("vergibt bei belegtem Zieldateinamen für beide Dateien eine neue ID", async () => {
		const game = createTestGame();
		game.id = "game_doppelt";
		game.name = "Doppelt";
		const bytes = encodeGameDocument(game);
		const writeInternal = vi.fn(() => Promise.resolve());
		const deleteInternal = vi.fn(() => Promise.resolve());
		const storage: DataFileStorage = {
			readAllInternal: (category) =>
				Promise.resolve(
					category === "game"
						? [
								{
									category,
									fileName: `${game.id}.json`,
									bytes,
								},
								{
									category,
									fileName: "game_doppelt..json",
									bytes,
								},
							]
						: [],
				),
			readInternal: (file) => Promise.resolve(missingRead(file)),
			writeInternal,
			deleteInternal,
		};
		const service = new GameReadService(storage);
		const problem = (await readList(service, "game")).problems[0];
		expect(problem).toMatchObject({
			canRepairFileName: false,
			canKeepBoth: true,
		});
		expect(problem?.availableActions).toContain("keepBoth");
		if (!problem) throw new Error("Der erwartete Dateifehler fehlt.");

		await service.objectProblems.repair(problem, "keepBoth");

		expect(writeInternal).toHaveBeenCalledWith(
			{ category: "game", fileName: "game_doppelt_2.json" },
			expect.any(Uint8Array),
			{ createOnly: true },
		);
		expect(deleteInternal).toHaveBeenCalledWith(
			{
				category: "game",
				fileName: "game_doppelt..json",
			},
			{ includeBackup: true, includeRecovery: true },
		);
	});

	it("unterscheidet Dekodierungsfehler von ungültigen Dokumenten", async () => {
		const undecodable = new GameReadService(
			new ByteGameReadStorage(
				"game_encoding",
				Uint8Array.from([0xff, 0xfe, 0x00]),
			),
		);
		expect((await readList(undecodable, "game")).problems[0]).toMatchObject({
			category: "serialization",
			reason: "encodingFailure",
			repairable: false,
		});

		const invalidDocument = new GameReadService(
			new ByteGameReadStorage(
				"game_structure",
				new TextEncoder().encode('{"id":"game_structure"}'),
			),
		);
		const invalidProblem = (await readList(invalidDocument, "game"))
			.problems[0];
		expect(invalidProblem).toMatchObject({
			reason: "invalidDocument",
			repairable: false,
		});
		expect(invalidProblem?.availableActions).not.toContain("repair");
	});

	it("hält eine geänderte Sitzreihenfolge im geladenen Dokument", async () => {
		const document = {
			...createTestGame(3),
			id: "game_seats",
			name: "Sitztest",
		};
		const service = new GameReadService(
			new ByteGameReadStorage("game_seats", encodeGameDocument(document)),
		);
		await service.loadGame("game_seats");
		const playersBeforeMove = service.getLoadedGame()?.document.playersById;

		const updated = service.moveLoadedSeat({
			fromSeatNumber: 1,
			toSeatNumber: 2,
		});

		expect(updated.document).toMatchObject({
			seatOrder: ["p_player2", "p_player1", "p_player3"],
		});
		expect(updated.document.playersById).toEqual(playersBeforeMove);
		expect(service.getLoadedGame()).toEqual(updated);
	});

	it("löscht einen Spieler am Sitz über denselben Domain-Löschpfad", () => {
		const game = createTestGame(2);
		const service = new GameReadService(
			new ByteGameReadStorage(game.id, new TextEncoder().encode("{}")),
		);
		service.setPreparedGame(game);

		const updated = service.deleteLoadedPlayerAtSeat(1);
		const document = updated.document;

		expect(document.seatOrder).toEqual(["p_player2"]);
		expect(document.playersById.p_player1).toBeUndefined();
		expect(service.isLoadedGameDirty()).toBe(true);
	});

	it("zeigt lokalisierte Namen an, ohne gespeicherte Namen zu überschreiben", async () => {
		setLanguage("fr");
		const document = {
			...createTestGame(1),
			id: "game_french",
			name: "Jeu",
			names: { fr: "Jeu français" },
			ruleSetSnapshot: {
				...createTestRuleSet(),
				teams: createTestRuleSet().teams.filter(
					(team) => team.id === "t_unknown",
				),
				roles: [
					{
						id: "r_empath",
						name: "Empath",
						names: { de: "Empath", fr: "Empathe" },
					},
				],
				statuses: [],
			},
			statusDefinitionsById: {},
			playersById: {},
			seatOrder: [],
		};
		const service = new GameReadService(
			new ByteGameReadStorage(
				"game_french",
				encodeGameDocument(document as unknown as GameState),
			),
		);

		const loaded = await service.loadGame("game_french");

		expect(loaded.name).toBe("Jeu");
		expect(loaded.displayName).toBe("Jeu français");
		expect(loaded.document).toMatchObject({
			name: "Jeu",
			names: { fr: "Jeu français" },
			ruleSetSnapshot: {
				roles: [
					{
						name: "Empath",
						names: { de: "Empath", fr: "Empathe" },
					},
				],
			},
		});
	});

	it("schlägt den ersten Namen mit einer freien game-ID vor", async () => {
		const storage = new WritableGameReadStorage(["game_nacht", "game_nacht_1"]);
		const service = new GameReadService(storage);
		service.setPreparedGame({
			...createTestGame(),
			id: "game_nacht",
			name: "Nacht",
		});

		await expect(service.suggestLoadedGameSaveAsName()).resolves.toBe(
			"Nacht (2)",
		);
	});

	it("speichert eine Kopie über dieselbe Schreiblogik und macht sie aktuell", async () => {
		const storage = new WritableGameReadStorage(["game_nacht"]);
		const service = new GameReadService(storage);
		service.setPreparedGame({
			...createTestGame(),
			id: "game_nacht",
			name: "Nacht",
		});

		const saved = await service.saveLoadedGameAs("  Neue Nacht  ");

		expect(saved).toMatchObject({ id: "game_neue_nacht", name: "Neue Nacht" });
		expect(saved.document).toMatchObject({
			id: "game_neue_nacht",
			name: "Neue Nacht",
		});
		expect(storage.writes).toHaveLength(1);
		expect(storage.writes[0]).toMatchObject({
			gameId: "game_neue_nacht",
			options: { createOnly: true },
		});
		expect(service.getLoadedGame()).toEqual(saved);
		expect(service.isLoadedGameDirty()).toBe(false);
	});

	it("berechnet den Storage-Schlüssel erstmals lokal beim Speichern", async () => {
		const storage = new WritableGameReadStorage([]);
		const service = new GameReadService(storage);
		const game = createTestGame();
		game.id = "game_bisher_nicht_gespeichert";
		game.name = "Neue Runde";

		const prepared = service.setPreparedGame(game);
		expect(prepared.storageKey).toBeNull();
		expect(storage.writes).toHaveLength(0);

		const saved = await service.saveLoadedGame();

		expect(saved).toMatchObject({
			storageKey: "game_neue_runde",
			id: "game_neue_runde",
			name: "Neue Runde",
		});
		expect(storage.writes[0]).toMatchObject({
			gameId: "game_neue_runde",
			options: {
				createOnly: true,
				backup: false,
			},
		});
		expect(storage.writes[0]?.options.previousFile).toBeUndefined();
	});

	it("übergibt beim geänderten Dokumentnamen alten und neuen Schlüssel an Storage", async () => {
		const game = createTestGame();
		game.id = "game_alt";
		game.name = "Alt";
		const storage = new RecoveryGameReadStorage([
			{
				category: "game",
				fileName: "game_alt.json",
				bytes: encodeGameDocument(game),
			},
		]);
		const service = new GameReadService(storage);
		const loaded = await service.loadGame("game_alt");
		const edited = structuredClone(loaded.document);
		edited.name = "Neu";
		service.replaceLoadedGameWithEditedCopy(edited);

		const saved = await service.saveLoadedGame();

		expect(saved.storageKey).toBe("game_neu");
		expect(storage.writes.at(-1)).toMatchObject({
			gameId: "game_neu",
			options: {
				createOnly: true,
				backup: false,
				previousFile: {
					category: "game",
					fileName: "game_alt.json",
				},
			},
		});
	});

	it("behält bei fehlgeschlagenem Erstsave storageKey null und den Dirty-State", async () => {
		const storage = new WritableGameReadStorage([]);
		storage.writeError = new Error("Datenträger voll");
		const service = new GameReadService(storage);
		const prepared = service.setPreparedGame(createTestGame());

		await expect(service.saveLoadedGame()).rejects.toMatchObject({
			reason: "unexpectedFailure",
		});

		expect(service.getLoadedGame()).toEqual(prepared);
		expect(service.getLoadedGame()?.storageKey).toBeNull();
		expect(service.isLoadedGameDirty()).toBe(true);
	});

	it("behält bei einem Schreibfehler den bisherigen aktuellen Spielstand", async () => {
		const storage = new WritableGameReadStorage(["game_nacht"]);
		storage.writeError = new Error("Datenträger voll");
		const service = new GameReadService(storage);
		const original = service.setPreparedGame({
			...createTestGame(),
			id: "game_nacht",
			name: "Nacht",
		});

		await expect(service.saveLoadedGameAs("Neue Nacht")).rejects.toMatchObject({
			reason: "unexpectedFailure",
		});
		expect(service.getLoadedGame()).toEqual(original);
		expect(service.isLoadedGameDirty()).toBe(true);
	});

	it("markiert ein Spiel erst nach der Storage-Bestätigung als gespeichert", async () => {
		let confirmWrite: (() => void) | undefined;
		const writeConfirmation = new Promise<void>((resolve) => {
			confirmWrite = resolve;
		});
		const service = new GameReadService({
			readInternal: (file) => Promise.resolve(missingRead(file)),
			writeInternal: () => writeConfirmation,
		});
		service.setPreparedGame(createTestGame());

		const pendingSave = service.saveLoadedGame();
		expect(service.isLoadedGameDirty()).toBe(true);
		expect(service.getLoadedGame()?.storageKey).toBeNull();
		await Promise.resolve();
		expect(service.isLoadedGameDirty()).toBe(true);

		confirmWrite?.();
		await pendingSave;
		expect(service.isLoadedGameDirty()).toBe(false);
		expect(service.getLoadedGame()?.storageKey).toBe(
			"game_test_rules_2026_01_02_3_spieler",
		);
	});

	it("sendet einen identischen parallelen Spielstand nur einmal an Persistence", async () => {
		let confirmWrite: (() => void) | undefined;
		const writeConfirmation = new Promise<void>((resolve) => {
			confirmWrite = resolve;
		});
		const writeInternal = vi.fn(() => writeConfirmation);
		const service = new GameReadService({
			readInternal: (file) => Promise.resolve(missingRead(file)),
			writeInternal,
		});
		service.setPreparedGame(createTestGame());

		const first = service.saveLoadedGame();
		const second = service.saveLoadedGame();
		await Promise.resolve();
		await Promise.resolve();
		expect(writeInternal).toHaveBeenCalledTimes(1);
		confirmWrite?.();
		const [firstResult, secondResult] = await Promise.all([first, second]);

		expect(firstResult).toBe(secondResult);
		expect(service.isLoadedGameDirty()).toBe(false);
	});

	it("sendet eine neuere Dokumentrevision als eigenen Persistence-Befehl", async () => {
		const confirmations: Array<() => void> = [];
		const writeInternal = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					confirmations.push(resolve);
				}),
		);
		const service = new GameReadService({
			readInternal: (file) => Promise.resolve(missingRead(file)),
			writeInternal,
		});
		service.setPreparedGame(createTestGame());

		const first = service.saveLoadedGame();
		await Promise.resolve();
		await Promise.resolve();
		const edited = structuredClone(service.getLoadedGame()?.document);
		if (!edited) throw new Error("Geladenes Testspiel fehlt.");
		edited.name = "Neuere Revision";
		service.replaceLoadedGameWithEditedCopy(edited);
		const second = service.saveLoadedGame();
		await Promise.resolve();
		await Promise.resolve();

		expect(writeInternal).toHaveBeenCalledTimes(2);
		confirmations[0]?.();
		await first;
		expect(service.isLoadedGameDirty()).toBe(true);
		confirmations[1]?.();
		await second;
		expect(service.getLoadedGame()?.document.name).toBe("Neuere Revision");
		expect(service.isLoadedGameDirty()).toBe(false);
	});

	it("überschreibt bei einer späten Speicherbestätigung keinen neueren RAM-Stand", async () => {
		let confirmWrite: (() => void) | undefined;
		const writeConfirmation = new Promise<void>((resolve) => {
			confirmWrite = resolve;
		});
		const service = new GameReadService({
			readInternal: (file) => Promise.resolve(missingRead(file)),
			writeInternal: () => writeConfirmation,
		});
		service.setPreparedGame(createTestGame());

		const pendingSave = service.saveLoadedGame();
		const edited = structuredClone(service.getLoadedGame()?.document);
		if (!edited) throw new Error("Geladenes Testspiel fehlt.");
		edited.name = "Während des Speicherns geändert";
		service.replaceLoadedGameWithEditedCopy(edited);

		confirmWrite?.();
		const result = await pendingSave;

		expect(result.document.name).toBe("Während des Speicherns geändert");
		expect(service.getLoadedGame()?.document.name).toBe(
			"Während des Speicherns geändert",
		);
		expect(service.getLoadedGame()?.storageKey).toBe(
			"game_test_rules_2026_01_02_3_spieler",
		);
		expect(service.isLoadedGameDirty()).toBe(true);
	});

	it("ignoriert die Speicherbestätigung einer nicht mehr geladenen Session", async () => {
		let confirmWrite: (() => void) | undefined;
		const writeConfirmation = new Promise<void>((resolve) => {
			confirmWrite = resolve;
		});
		const service = new GameReadService({
			readInternal: (file) => Promise.resolve(missingRead(file)),
			writeInternal: () => writeConfirmation,
		});
		service.setPreparedGame(createTestGame());
		const pendingSave = service.saveLoadedGame();
		const nextGame = createTestGame();
		nextGame.name = "Andere Session";
		nextGame.id = "game_andere_session";
		service.setPreparedGame(nextGame);

		confirmWrite?.();
		const result = await pendingSave;

		expect(result.document.name).toBe("Andere Session");
		expect(result.storageKey).toBeNull();
		expect(service.getLoadedGame()).toEqual(result);
		expect(service.isLoadedGameDirty()).toBe(true);
	});

	it("behält bei einer verworfenen Retry-Bestätigung den Dirty-State", async () => {
		const service = new GameReadService({
			readInternal: (file) => Promise.resolve(missingRead(file)),
			continueInternalCommand: () => Promise.resolve("discarded"),
		});
		service.setPreparedGame(createTestGame());

		await expect(
			service.retryLoadedGameSave("alter-befehl"),
		).rejects.toMatchObject({ reason: "decisionExpired" });
		expect(service.isLoadedGameDirty()).toBe(true);
	});

	it("übernimmt eine bearbeitete Spielkopie als ungespeicherten aktuellen Spielstand", () => {
		const service = new GameReadService(new WritableGameReadStorage([]));
		const originalGame = createTestGame();
		originalGame.id = "game_nacht";
		originalGame.name = "Nacht";
		const original = service.setPreparedGame(originalGame);
		const edited = structuredClone(originalGame);
		const editedTeam = edited.ruleSetSnapshot.teams[0];
		if (!editedTeam) throw new Error("Testteam fehlt.");
		editedTeam.name = "Helden";

		const result = service.replaceLoadedGameWithEditedCopy(edited);

		expect(result).not.toBe(original);
		expect(result.document).not.toBe(edited);
		expect(result.id).toBe("game_nacht");
		expect(result.document.isTemplate).toBe(false);
		expect(result.document.ruleSetSnapshot.teams[0]?.name).toBe("Helden");
		expect(originalGame.ruleSetSnapshot.teams[0]?.name).toBe("Good");
		expect(service.isLoadedGameDirty()).toBe(true);
	});

	it("ersetzt die Rollen des aktuellen Spiels über die zentrale Verteilungsfunktion", () => {
		const service = new GameReadService(new WritableGameReadStorage([]));
		service.setPreparedGame(createTestGame(3));

		const result = service.assignLoadedGameRolesByTeamCounts({
			t_good: 2,
			t_evil: 1,
		});
		const game = result.document;

		for (const playerId of game.seatOrder) {
			const roles = game.playersById[playerId]?.roles;
			expect(roles?.actualRoleId).not.toBeNull();
			expect(roles?.shownRoleIds[0]).toBe(roles?.actualRoleId);
			expect(roles?.nightRoleId).toBe(roles?.actualRoleId);
		}
		expect(game.log.at(-1)?.type).toBe("roles_randomly_distributed");
		expect(service.getLoadedGame()).toEqual(result);
		expect(service.isLoadedGameDirty()).toBe(true);
	});

	it("klassifiziert ungültige Rollenverteilungen im laufenden Spiel als erwarteten Fehler", () => {
		const service = new GameReadService(new WritableGameReadStorage([]));
		const game = createTestGame(1);
		const unknownTeam = game.ruleSetSnapshot.teams.find(
			(team) => team.id === "t_unknown",
		);
		if (!unknownTeam) throw new Error("Testteam fehlt.");
		unknownTeam.name = "Unbekannt";
		service.setPreparedGame(game);
		const dirtyBeforeDistribution = service.isLoadedGameDirty();

		expect(() =>
			service.assignLoadedGameRolesByTeamCounts({ t_unknown: 1 }),
		).toThrowError(
			expect.objectContaining({
				expectation: "expected",
				reason: "roleDistributionTeamHasNoRoles",
				parameters: {
					teamName: "Unbekannt",
					requestedCount: 1,
				},
			}),
		);
		expect(service.isLoadedGameDirty()).toBe(dirtyBeforeDistribution);
	});

	it("speichert Rollen zum Zeigen im aktuellen Spiel und markiert es als ungespeichert", () => {
		const service = new GameReadService(new WritableGameReadStorage([]));
		service.setPreparedGame(createTestGame());

		const result = service.updateLoadedRolesForShowing({
			roles: ["r_seer", "r_seer", "r_wolf"],
			notice: "  Auswahl  ",
			showRoleSymbols: true,
		});

		expect(result.document.rolesForShowing).toEqual({
			roles: ["r_seer", "r_seer", "r_wolf"],
			notice: "Auswahl",
			showRoleSymbols: true,
		});
		expect(
			service.createLoadedRolesForShowingPresentation({
				roles: ["r_seer", "r_wolf"],
				notice: "Vorschau",
				showRoleSymbols: true,
			}),
		).toEqual({
			notice: "Vorschau",
			roleNames: ["◆ Seer", "◆ Wolf"],
		});
		expect(service.isLoadedGameDirty()).toBe(true);
	});

	it("schlägt einen freien Vorlagennamen aus dem aktuellen Spielnamen vor", async () => {
		const storage = new WritableGameReadStorage([
			"game_nacht",
			"template_nacht_vorlage",
			"template_nacht_vorlage_1",
		]);
		const service = new GameReadService(storage);
		service.setPreparedGame({
			...createTestGame(),
			id: "game_nacht",
			name: "Nacht",
		});

		await expect(service.suggestLoadedGameTemplateName()).resolves.toBe(
			"Nacht Vorlage (2)",
		);
	});

	it("speichert eine unabhängige Vorlage und behält das Spiel als aktuelles Dokument", async () => {
		const storage = new WritableGameReadStorage(["game_nacht"]);
		const service = new GameReadService(storage);
		const game = createTestGame();
		game.id = "game_nacht";
		game.name = "Nacht";
		(game.ruleSetSnapshot.teams[0] as { id: string }).id = "Ungültiges Team";
		const role = game.ruleSetSnapshot.roles[0];
		if (!role) throw new Error("Testrolle fehlt.");
		role.teamId = "Ungültiges Team";
		const original = service.setPreparedGame(game);
		const originalDocument = structuredClone(original.document);

		const result = await service.saveLoadedGameAsTemplate("  Meine Vorlage  ");

		expect(result.template).toMatchObject({
			id: "template_meine_vorlage",
			name: "Meine Vorlage",
			isTemplate: true,
			time: { currentNight: 0, phase: "setup" },
			log: [],
		});
		expect(result.warnings.some(({ code }) => code === "IDS_REPAIRED")).toBe(
			true,
		);
		expect(service.getLoadedGame()).toEqual(original);
		expect(service.getLoadedGame()?.document).toEqual(originalDocument);
		expect(service.getLoadedGame()?.document.ruleSetSnapshot.teams[0]?.id).toBe(
			"Ungültiges Team",
		);
		expect(service.isLoadedGameDirty()).toBe(true);
		expect(storage.writes).toHaveLength(1);
		expect(storage.writes[0]).toMatchObject({
			gameId: "template_meine_vorlage",
			options: { createOnly: true },
		});
		const write = storage.writes[0];
		if (!write) throw new Error("Erwarteter Schreibvorgang fehlt.");
		const storedTemplate = JSON.parse(
			new TextDecoder().decode(write.bytes),
		) as {
			id: string;
			isTemplate: boolean;
		};
		expect(storedTemplate).toEqual(
			expect.objectContaining({
				id: "template_meine_vorlage",
				isTemplate: true,
			}),
		);
	});

	it("verändert das aktuelle Spiel nicht, wenn das Speichern der Vorlage fehlschlägt", async () => {
		const storage = new WritableGameReadStorage(["game_nacht"]);
		storage.writeError = new Error("Datenträger voll");
		const service = new GameReadService(storage);
		const game = createTestGame();
		game.id = "game_nacht";
		(game.ruleSetSnapshot.teams[0] as { id: string }).id = "Ungültiges Team";
		const role = game.ruleSetSnapshot.roles[0];
		if (!role) throw new Error("Testrolle fehlt.");
		role.teamId = "Ungültiges Team";
		const original = service.setPreparedGame(game);

		await expect(
			service.saveLoadedGameAsTemplate("Meine Vorlage"),
		).rejects.toMatchObject({ reason: "unexpectedFailure" });

		expect(service.getLoadedGame()).toEqual(original);
		const currentGame = service.getLoadedGame();
		if (!currentGame) throw new Error("Aktuelles Spiel fehlt.");
		expect(currentGame.document.ruleSetSnapshot.teams[0]?.id).toBe(
			"Ungültiges Team",
		);
		expect(storage.writes).toHaveLength(0);
	});

	it("importiert Spielstände ohne optionale Formatmetadaten", async () => {
		const imported: Record<string, unknown> = {
			...createGameExportDocument(createTestGame()),
		};
		delete imported.fileType;
		delete imported.schemaVersion;
		const storage: DataFileStorage = {
			readInternal: (file) => Promise.resolve(missingRead(file)),
			readExternal: () => Promise.resolve(encodeJson(imported)),
			writeInternal: () => Promise.resolve(),
		};
		const service = new GameReadService(storage);

		await expect(service.importSavedGame({})).resolves.toMatchObject({
			status: "imported",
		});
	});
});

class ByteGameReadStorage implements DataFileStorage {
	readonly #gameId: string;
	readonly #bytes: Uint8Array;
	singleReadCount = 0;
	allReadCount = 0;

	constructor(gameId: string, bytes: Uint8Array) {
		this.#gameId = gameId;
		this.#bytes = bytes;
	}

	readAllInternal(category: "game" | "template" | "library") {
		this.allReadCount++;
		const storedCategory: "template" | "game" = this.#gameId.startsWith(
			"template_",
		)
			? "template"
			: "game";
		return Promise.resolve(
			category === storedCategory
				? [
						{
							category: storedCategory,
							fileName: `${this.#gameId}.json`,
							bytes: this.#bytes,
						},
					]
				: [],
		);
	}

	readInternal(): Promise<DataFileReadResult> {
		this.singleReadCount++;
		return Promise.resolve(success(this.#bytes));
	}
}

class WritableGameReadStorage implements DataFileStorage {
	readonly ids: string[];
	readonly writes: Array<{
		gameId: string;
		bytes: Uint8Array;
		options: StorageWriteOptions;
	}> = [];
	readonly exports: Array<{
		bytes: Uint8Array;
		options: { suggestedFileName: string };
	}> = [];
	writeError?: Error;

	constructor(ids: string[]) {
		this.ids = [...ids];
	}

	readAllInternal(category: "game" | "template" | "library") {
		return Promise.resolve(
			this.ids
				.filter(
					(id) =>
						(id.startsWith("template_") ? "template" : "game") === category,
				)
				.map((id) => ({
					category,
					fileName: `${id}.json`,
					bytes: new Uint8Array(),
				})),
		);
	}

	readInternal(): Promise<DataFileReadResult> {
		throw new Error("Für diesen Test nicht benötigt.");
	}

	writeInternal(
		file: { fileName: string },
		bytes: Uint8Array,
		options: StorageWriteOptions,
	): Promise<void> {
		if (this.writeError) return Promise.reject(this.writeError);
		const id = file.fileName.replace(/\.json$/, "");
		this.writes.push({ gameId: id, bytes, options });
		if (options.previousFile) {
			const previousId = options.previousFile.fileName.replace(/\.json$/, "");
			const previousIndex = this.ids.indexOf(previousId);
			if (previousIndex >= 0) this.ids.splice(previousIndex, 1);
		}
		this.ids.push(id);
		return Promise.resolve();
	}

	writeExternal(
		bytes: Uint8Array,
		options: { suggestedFileName: string },
	): Promise<void> {
		this.exports.push({ bytes, options });
		return Promise.resolve();
	}
}

class RecoveryGameReadStorage implements DataFileStorage {
	readonly documents: StoredByteDocument[];
	readonly recoveries: StorageRecoveryCandidate[];
	readonly writes: Array<{
		gameId: string;
		bytes: Uint8Array;
		options: StorageWriteOptions;
	}> = [];
	readonly exports: Array<{
		bytes: Uint8Array;
		options: { suggestedFileName: string };
	}> = [];
	readonly resolutions: Array<{
		recoveryKey: string;
		resolution: StorageRecoveryResolution;
	}> = [];

	constructor(
		documents: StoredByteDocument[],
		recoveries: StorageRecoveryCandidate[] = [],
	) {
		this.documents = documents;
		this.recoveries = recoveries;
	}

	readAllInternal(
		category: "game" | "template" | "library",
	): Promise<StoredByteDocument[]> {
		return Promise.resolve(
			this.documents.filter((entry) => entry.category === category),
		);
	}

	readInternal(file: { fileName: string }): Promise<DataFileReadResult> {
		const document = this.documents.find(
			(entry) => entry.fileName === file.fileName,
		);
		if (!document) throw new Error("Datei nicht gefunden.");
		return Promise.resolve(success(document.bytes));
	}

	writeInternal(
		file: { fileName: string },
		bytes: Uint8Array,
		options: StorageWriteOptions,
	): Promise<void> {
		const id = file.fileName.replace(/\.json$/, "").split(".", 1)[0] ?? "";
		this.writes.push({ gameId: id, bytes, options });
		if (
			options.createOnly &&
			this.documents.some((entry) => entry.fileName === file.fileName)
		)
			throw new Error("Datei existiert bereits.");
		if (options.previousFile) {
			const previousIndex = this.documents.findIndex(
				(entry) =>
					entry.category === options.previousFile?.category &&
					entry.fileName === options.previousFile.fileName,
			);
			if (previousIndex >= 0) this.documents.splice(previousIndex, 1);
		}
		this.documents.push({
			category: id.startsWith("template_") ? "template" : "game",
			fileName: file.fileName,
			bytes,
		});
		return Promise.resolve();
	}

	deleteInternal(file: { fileName: string }): Promise<void> {
		const index = this.documents.findIndex(
			(document) => document.fileName === file.fileName,
		);
		if (index >= 0) this.documents.splice(index, 1);
		return Promise.resolve();
	}

	listRecoveries(): Promise<StorageRecoveryCandidate[]> {
		return Promise.resolve(this.recoveries);
	}

	requestRecovery(recoveryKey: string) {
		const candidate = this.recoveries.find(
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

	continueInternalCommand(
		commandId: string,
		resolution: StorageCommandDecision,
	): Promise<"completed"> {
		const recoveryKey = commandId.replace(/^command:/, "");
		if (
			resolution !== "keepOld" &&
			resolution !== "keepNew" &&
			resolution !== "keepBoth"
		)
			return Promise.resolve("completed");
		this.resolutions.push({ recoveryKey, resolution });
		return Promise.resolve("completed");
	}

	writeExternal(
		bytes: Uint8Array,
		options: { suggestedFileName: string },
	): Promise<void> {
		this.exports.push({ bytes, options });
		return Promise.resolve();
	}
}

class SavedGameActionStorage implements DataFileStorage {
	readonly documents = new Map<string, Uint8Array>();
	readonly exports: Array<{
		bytes: Uint8Array;
		options: { suggestedFileName: string };
	}> = [];

	constructor(game: GameState) {
		this.documents.set(game.id, encodeGameDocument(game));
	}

	has(id: string): boolean {
		return this.documents.has(id);
	}

	readAllInternal(
		category: "game" | "template" | "library",
	): Promise<StoredByteDocument[]> {
		return Promise.resolve(
			[...this.documents]
				.filter(
					([id]) =>
						(id.startsWith("template_") ? "template" : "game") === category,
				)
				.map(([id, bytes]) => ({ category, fileName: `${id}.json`, bytes })),
		);
	}

	readInternal(file: { fileName: string }): Promise<DataFileReadResult> {
		const id = file.fileName.replace(/\.json$/, "").split(".", 1)[0] ?? "";
		const bytes = this.documents.get(id);
		if (!bytes) throw new Error("Datei nicht gefunden.");
		return Promise.resolve(success(bytes));
	}

	writeInternal(
		file: { fileName: string },
		bytes: Uint8Array,
		options: StorageWriteOptions,
	): Promise<void> {
		const id = file.fileName.replace(/\.json$/, "").split(".", 1)[0] ?? "";
		if (options.createOnly && this.documents.has(id))
			throw new Error("Datei existiert bereits.");
		if (options.previousFile) {
			const previousId =
				options.previousFile.fileName.replace(/\.json$/, "").split(".", 1)[0] ??
				"";
			this.documents.delete(previousId);
		}
		this.documents.set(id, bytes);
		return Promise.resolve();
	}

	deleteInternal(file: { fileName: string }): Promise<void> {
		const id = file.fileName.replace(/\.json$/, "").split(".", 1)[0] ?? "";
		this.documents.delete(id);
		return Promise.resolve();
	}

	writeExternal(
		bytes: Uint8Array,
		options: { suggestedFileName: string },
	): Promise<void> {
		this.exports.push({ bytes, options });
		return Promise.resolve();
	}
}

function encodeJson(value: unknown): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(value));
}

function encodeGameDocument(document: GameState): Uint8Array {
	return encodeJson(createGameExportDocument(document));
}

function success(bytes: Uint8Array): DataFileReadResult {
	return { status: "success", bytes };
}

function encodeUtf16LeWithBom(text: string): Uint8Array {
	return Uint8Array.from([0xff, 0xfe, ...Buffer.from(text, "utf16le")]);
}
