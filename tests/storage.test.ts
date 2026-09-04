import {
	mkdir,
	mkdtemp,
	readFile,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type DataFileReadResult,
	RecoverableStorageWriteError,
} from "../src/persistence/ports/dataFileStorage";
import { DevDataFileStorage } from "../src/storage/dataFileStorage.dev";
import { readBytesDev } from "../src/storage/fileByteStorage.dev";

async function successfulBytes(
	resultPromise: Promise<DataFileReadResult>,
): Promise<Uint8Array> {
	const result = await resultPromise;
	if (result.status !== "success")
		throw new Error(`Erwartete success, erhielt ${result.status}.`);
	return result.bytes;
}

describe("Entwicklungs-Storage", () => {
	const originalWorkingDirectory = process.cwd();
	let temporaryDirectory: string;

	beforeEach(async () => {
		temporaryDirectory = await mkdtemp(
			path.join(tmpdir(), "social-deduction-test-"),
		);
		process.chdir(temporaryDirectory);
	});

	afterEach(async () => {
		process.chdir(originalWorkingDirectory);
		await rm(temporaryDirectory, { recursive: true, force: true });
	});

	it("liest mit derselben Byte-Funktion eine Datei oder ein Verzeichnis", async () => {
		const directory = path.resolve("byte-source");
		await mkdir(directory, { recursive: true });
		await writeFile(path.join(directory, "first.json"), "eins", "utf8");
		await writeFile(path.join(directory, "second.json"), "zwei", "utf8");
		await writeFile(path.join(directory, "ignored.txt"), "drei", "utf8");

		expect(
			new TextDecoder().decode(
				await readBytesDev({
					mode: "single",
					filePath: path.join(directory, "first.json"),
				}),
			),
		).toBe("eins");
		const files = await readBytesDev({
			mode: "all",
			directoryPath: directory,
			acceptFile: (fileName) => fileName.endsWith(".json"),
		});
		files.sort((left, right) => left.fileName.localeCompare(right.fileName));
		expect(
			files.map(({ fileName, bytes }) => [
				fileName,
				new TextDecoder().decode(bytes),
			]),
		).toEqual([
			["first.json", "eins"],
			["second.json", "zwei"],
		]);
	});

	describe("Spielstände", () => {
		it("listet ausschließlich JSON-Dateinamen und benennt sie ohne Inhaltslesen um", async () => {
			const storage = new DevDataFileStorage();
			const directory = path.resolve("dev-data/game");
			await mkdir(directory, { recursive: true });
			await writeFile(path.join(directory, "Test.json"), "kein JSON", "utf8");
			await writeFile(
				path.join(directory, "Test.temp.json"),
				"alte Version",
				"utf8",
			);
			await writeFile(path.join(directory, "ignorieren.txt"), "Text", "utf8");

			await expect(storage.listInternalFileNames("game")).resolves.toEqual([
				"Test.json",
				"Test.temp.json",
			]);
			await storage.renameInternal(
				{ category: "game", fileName: "Test.json" },
				{ category: "game", fileName: "game_test.json" },
			);
			await storage.renameInternal(
				{ category: "game", fileName: "Test.temp.json" },
				{ category: "game", fileName: "game_test.temp.json" },
			);

			await expect(
				readFile(path.join(directory, "Test.json"), "utf8"),
			).rejects.toMatchObject({ code: "ENOENT" });
			expect(
				await readFile(path.join(directory, "game_test.json"), "utf8"),
			).toBe("kein JSON");
			expect(
				await readFile(path.join(directory, "game_test.temp.json"), "utf8"),
			).toBe("alte Version");
		});

		it("schreibt einen neuen kanonischen Dateinamen vor dem Aufräumen der alten Datei", async () => {
			const storage = new DevDataFileStorage();
			const oldFile = {
				category: "game" as const,
				fileName: "game_alt.restored.json",
			};
			const newFile = {
				category: "game" as const,
				fileName: "game_neu.json",
			};
			await storage.writeInternal(oldFile, new TextEncoder().encode("älter"), {
				createOnly: true,
			});
			await storage.writeInternal(oldFile, new TextEncoder().encode("alt"), {
				backup: true,
			});

			await storage.writeInternal(newFile, new TextEncoder().encode("neu"), {
				createOnly: true,
				backup: true,
				previousFile: oldFile,
			});

			expect(
				new TextDecoder().decode(
					await successfulBytes(storage.readInternal(newFile)),
				),
			).toBe("neu");
			expect(
				new TextDecoder().decode(
					await successfulBytes(storage.readInternal(newFile, "backup")),
				),
			).toBe("alt");
			await expect(storage.readInternal(oldFile)).resolves.toMatchObject({
				status: "error",
				error: { reason: "notFound", file: oldFile },
			});
			await expect(
				storage.readInternal(oldFile, "backup"),
			).resolves.toMatchObject({
				status: "error",
				error: { reason: "notFound", file: oldFile },
			});
		});

		it("löscht beim Schlüsselwechsel die alte Datei, wenn kein Backup gewünscht ist", async () => {
			const storage = new DevDataFileStorage();
			const oldFile = {
				category: "game" as const,
				fileName: "game_alt.json",
			};
			const newFile = {
				category: "game" as const,
				fileName: "game_neu.json",
			};
			await storage.writeInternal(oldFile, new TextEncoder().encode("alt"), {
				createOnly: true,
			});

			await storage.writeInternal(newFile, new TextEncoder().encode("neu"), {
				createOnly: true,
				backup: false,
				previousFile: oldFile,
			});

			await expect(storage.readInternal(oldFile)).resolves.toMatchObject({
				status: "error",
				error: { reason: "notFound", file: oldFile },
			});
			await expect(
				storage.readInternal(newFile, "backup"),
			).resolves.toMatchObject({
				status: "error",
				error: { reason: "notFound", file: newFile },
			});
		});

		it("überschreibt beim Umbenennen keine bereits vorhandene Zieldatei", async () => {
			const storage = new DevDataFileStorage();
			const directory = path.resolve("dev-data/game");
			await mkdir(directory, { recursive: true });
			await writeFile(path.join(directory, "Test.json"), "Quelle", "utf8");
			await writeFile(path.join(directory, "game_test.json"), "Ziel", "utf8");

			await expect(
				storage.renameInternal(
					{ category: "game", fileName: "Test.json" },
					{ category: "game", fileName: "game_test.json" },
				),
			).resolves.toMatchObject({
				status: "conflict",
				reason: "targetExists",
			});
			expect(await readFile(path.join(directory, "Test.json"), "utf8")).toBe(
				"Quelle",
			);
			expect(
				await readFile(path.join(directory, "game_test.json"), "utf8"),
			).toBe("Ziel");
		});

		it("liefert beliebige sichere JSON-Dateinamen und kann sie gezielt löschen", async () => {
			const storage = new DevDataFileStorage();
			const directory = path.resolve("dev-data/game");
			await mkdir(directory, { recursive: true });
			await writeFile(
				path.join(directory, "Mein Spiel.json"),
				'{"id":"game_mein_spiel"}',
				"utf8",
			);
			await writeFile(
				path.join(directory, "game_recovery.temp.json"),
				"{}",
				"utf8",
			);

			const documents = await storage.readAllInternal("game");

			expect(documents).toHaveLength(1);
			expect(documents[0]).toMatchObject({
				category: "game",
				fileName: "Mein Spiel.json",
			});
			await storage.deleteInternal({
				category: "game",
				fileName: "Mein Spiel.json",
			});
			await expect(
				readFile(path.join(directory, "Mein Spiel.json")),
			).rejects.toMatchObject({ code: "ENOENT" });
		});

		it("erkennt ein verwaistes Backup ohne Originaldatei", async () => {
			const storage = new DevDataFileStorage();
			const directory = path.resolve("dev-data/game");
			await mkdir(directory, { recursive: true });
			await writeFile(
				path.join(directory, "game_orphan.backup.json"),
				'{"id":"game_orphan"}',
				"utf8",
			);

			const recoveries = await storage.listRecoveries("game");

			expect(recoveries).toHaveLength(1);
			expect(recoveries[0]?.recoveryKey).toBe("game:game_orphan.json:backup");
			expect(recoveries[0]?.recoverySource).toBe("backup");
			expect(recoveries[0]?.newBytes).toBeUndefined();
		});

		it("erkennt einen unvollständigen Speichervorgang und behält auf Wunsch beide Dateien", async () => {
			const storage = new DevDataFileStorage();
			const directory = path.resolve("dev-data/game");
			await mkdir(directory, { recursive: true });
			const targetPath = path.join(directory, "game_recovery.json");
			const pendingPath = path.join(directory, "game_recovery.temp.json");
			await writeFile(targetPath, '{"name":"Alt"}', "utf8");
			await rename(targetPath, pendingPath);
			await writeFile(targetPath, '{"name":"Neu"}', "utf8");

			const [recovery] = await storage.listRecoveries();
			expect(recovery?.recoveryKey).toBe("game:game_recovery.json");
			expect(recovery?.recoverySource).toBe("temporary");
			expect(new TextDecoder().decode(recovery?.oldBytes)).toBe(
				'{"name":"Alt"}',
			);
			expect(new TextDecoder().decode(recovery?.newBytes)).toBe(
				'{"name":"Neu"}',
			);

			const request = await storage.requestRecovery("game:game_recovery.json");
			expect(request.status).toBe("decisionRequired");
			if (request.status !== "decisionRequired") return;
			await storage.continueInternalCommand(request.commandId, "keepBoth");
			const documents = await storage.readAllInternal("game");
			expect(documents.map(({ fileName }) => fileName)).toEqual([
				"game_recovery.json",
				"game_recovery.restored.json",
			]);
			expect(await storage.listRecoveries()).toEqual([]);
		});

		it("verwirft eine doppelte Recovery-Entscheidung ohne weitere Dateiänderung", async () => {
			const storage = new DevDataFileStorage();
			const directory = path.resolve("dev-data/game");
			await mkdir(directory, { recursive: true });
			await writeFile(
				path.join(directory, "game_duplicate.temp.json"),
				"alt",
				"utf8",
			);
			await writeFile(
				path.join(directory, "game_duplicate.json"),
				"neu",
				"utf8",
			);

			const request = await storage.requestRecovery("game:game_duplicate.json");
			if (request.status !== "decisionRequired")
				throw new Error("Recovery-Anfrage wurde unerwartet verworfen.");
			await expect(
				storage.continueInternalCommand(request.commandId, "keepOld"),
			).resolves.toBe("completed");
			await expect(
				storage.continueInternalCommand(request.commandId, "keepOld"),
			).resolves.toBe("discarded");
			expect(
				await readFile(path.join(directory, "game_duplicate.json"), "utf8"),
			).toBe("alt");
		});

		it("verwirft eine Recovery, wenn sich die Dateien nach der Anfrage geändert haben", async () => {
			const storage = new DevDataFileStorage();
			const directory = path.resolve("dev-data/game");
			const recoveryPath = path.join(directory, "game_stale.temp.json");
			const targetPath = path.join(directory, "game_stale.json");
			await mkdir(directory, { recursive: true });
			await writeFile(recoveryPath, "ursprünglich alt", "utf8");
			await writeFile(targetPath, "ursprünglich neu", "utf8");

			const request = await storage.requestRecovery("game:game_stale.json");
			if (request.status !== "decisionRequired")
				throw new Error("Recovery-Anfrage wurde unerwartet verworfen.");
			await writeFile(recoveryPath, "zwischenzeitlich geändert", "utf8");

			await expect(
				storage.continueInternalCommand(request.commandId, "keepOld"),
			).resolves.toBe("discarded");
			expect(await readFile(targetPath, "utf8")).toBe("ursprünglich neu");
			expect(await readFile(recoveryPath, "utf8")).toBe(
				"zwischenzeitlich geändert",
			);
		});

		it("überschreibt bei createOnly keinen vorhandenen Spielstand", async () => {
			const storage = new DevDataFileStorage();
			const original = new TextEncoder().encode('{"name":"Original"}');
			await storage.writeInternal(
				{ category: "game", fileName: "game_exclusive.json" },
				original,
				{},
			);

			const collision = await storage
				.writeInternal(
					{ category: "game", fileName: "game_exclusive.json" },
					new TextEncoder().encode('{"name":"Neu"}'),
					{ createOnly: true },
				)
				.catch((error: unknown) => error);
			expect(collision).toBeInstanceOf(RecoverableStorageWriteError);
			expect(collision).toMatchObject({ reason: "targetExists" });
			await storage.continueInternalCommand(
				(collision as RecoverableStorageWriteError).commandId as string,
				"cancel",
			);
			expect(
				new TextDecoder().decode(
					await successfulBytes(
						storage.readInternal({
							category: "game",
							fileName: "game_exclusive.json",
						}),
					),
				),
			).toBe('{"name":"Original"}');
		});

		it("setzt eine Zielkollision nach Bestätigung als Überschreiben fort", async () => {
			const storage = new DevDataFileStorage();
			const file = {
				category: "game" as const,
				fileName: "game_collision.json",
			};
			await storage.writeInternal(
				file,
				new TextEncoder().encode('{"name":"Alt"}'),
				{},
			);
			const collision = (await storage
				.writeInternal(file, new TextEncoder().encode('{"name":"Neu"}'), {
					createOnly: true,
				})
				.catch((error: unknown) => error)) as RecoverableStorageWriteError;

			await storage.continueInternalCommand(
				collision.commandId as string,
				"overwrite",
			);

			expect(
				new TextDecoder().decode(
					await successfulBytes(storage.readInternal(file)),
				),
			).toBe('{"name":"Neu"}');
		});

		it("setzt 'Beide behalten' mit neuer Domain-ID im selben Befehl fort", async () => {
			const storage = new DevDataFileStorage();
			const oldFile = {
				category: "game" as const,
				fileName: "game_both.json",
			};
			await storage.writeInternal(
				oldFile,
				new TextEncoder().encode('{"id":"game_both"}'),
				{},
			);
			const collision = (await storage
				.writeInternal(
					oldFile,
					new TextEncoder().encode('{"id":"game_both"}'),
					{ createOnly: true },
				)
				.catch((error: unknown) => error)) as RecoverableStorageWriteError;
			const newBytes = new TextEncoder().encode('{"id":"game_both_2"}');

			await storage.continueInternalCommand(
				collision.commandId as string,
				"keepBoth",
				{
					file: { category: "game", fileName: "game_both_2.json" },
					bytes: newBytes,
				},
			);

			expect(
				new TextDecoder().decode(
					await successfulBytes(storage.readInternal(oldFile)),
				),
			).toBe('{"id":"game_both"}');
			expect(
				new TextDecoder().decode(
					await successfulBytes(
						storage.readInternal({
							category: "game",
							fileName: "game_both_2.json",
						}),
					),
				),
			).toBe('{"id":"game_both_2"}');
		});

		it("prüft, benennt um und löscht Spielstände über den gemeinsamen Storage", async () => {
			const storage = new DevDataFileStorage();
			await storage.writeInternal(
				{ category: "game", fileName: "game_original.json" },
				new TextEncoder().encode('{"id":"game_original","name":"Alt"}'),
				{},
			);

			await storage.writeInternal(
				{ category: "game", fileName: "game_neu.json" },
				new TextEncoder().encode('{"id":"game_neu","name":"Neu"}'),
				{ createOnly: true },
			);
			await storage.deleteInternal({
				category: "game",
				fileName: "game_original.json",
			});
			await expect(
				storage.readInternal({
					category: "game",
					fileName: "game_original.json",
				}),
			).resolves.toMatchObject({
				status: "error",
				error: {
					reason: "notFound",
					file: { category: "game", fileName: "game_original.json" },
				},
			});
			expect(
				new TextDecoder().decode(
					await successfulBytes(
						storage.readInternal({
							category: "game",
							fileName: "game_neu.json",
						}),
					),
				),
			).toBe('{"id":"game_neu","name":"Neu"}');

			await storage.deleteInternal({
				category: "game",
				fileName: "game_neu.json",
			});
			await expect(
				storage.readInternal({
					category: "game",
					fileName: "game_neu.json",
				}),
			).resolves.toMatchObject({
				status: "error",
				error: {
					reason: "notFound",
					file: {
						category: "game",
						fileName: "game_neu.json",
					},
				},
			});
		});

		it("benennt eine Restored-Datei in einen regulären Spielstand um", async () => {
			const storage = new DevDataFileStorage();
			const directory = path.resolve("dev-data/game");
			await mkdir(directory, { recursive: true });
			await writeFile(
				path.join(directory, "game_alt.restored_2.json"),
				'{"id":"game_alt","name":"Alt"}',
				"utf8",
			);

			await storage.writeInternal(
				{ category: "game", fileName: "game_neu.json" },
				new TextEncoder().encode('{"id":"game_neu","name":"Neu"}'),
				{ createOnly: true },
			);
			await storage.deleteInternal({
				category: "game",
				fileName: "game_alt.restored_2.json",
			});

			await expect(
				storage.readInternal({
					category: "game",
					fileName: "game_alt.restored_2.json",
				}),
			).resolves.toMatchObject({
				status: "error",
				error: {
					reason: "notFound",
					file: {
						category: "game",
						fileName: "game_alt.restored_2.json",
					},
				},
			});
			expect(
				new TextDecoder().decode(
					await successfulBytes(
						storage.readInternal({
							category: "game",
							fileName: "game_neu.json",
						}),
					),
				),
			).toBe('{"id":"game_neu","name":"Neu"}');
		});
	});

	describe("Vorlagen-Recovery", () => {
		it("findet eine Tempdatei und behält mit keepBoth beide Vorlagen", async () => {
			const storage = new DevDataFileStorage();
			const directory = path.resolve("dev-data/template");
			await mkdir(directory, { recursive: true });
			await writeFile(
				path.join(directory, "template_recovery.temp.json"),
				'{"name":"Alte Vorlage"}',
				"utf8",
			);
			await writeFile(
				path.join(directory, "template_recovery.json"),
				'{"name":"Neue Vorlage"}',
				"utf8",
			);

			const recoveries = await storage.listRecoveries();
			expect(recoveries).toHaveLength(1);
			expect(recoveries[0]).toMatchObject({
				category: "template",
				recoveryKey: "template:template_recovery.json",
				fileName: "template_recovery.json",
			});

			const request = await storage.requestRecovery(
				"template:template_recovery.json",
			);
			expect(request.status).toBe("decisionRequired");
			if (request.status !== "decisionRequired") return;
			await storage.continueInternalCommand(request.commandId, "keepBoth");

			const documents = await storage.readAllInternal("template");
			documents.sort((left, right) =>
				left.fileName.localeCompare(right.fileName),
			);
			expect(
				documents.map(({ fileName, bytes }) => ({
					fileName,
					text: new TextDecoder().decode(bytes),
				})),
			).toEqual([
				{
					fileName: "template_recovery.json",
					text: '{"name":"Neue Vorlage"}',
				},
				{
					fileName: "template_recovery.restored.json",
					text: '{"name":"Alte Vorlage"}',
				},
			]);
			expect(await storage.listRecoveries()).toEqual([]);
		});
	});

	describe("Library", () => {
		it("stellt Original und Backup getrennt für die Domain bereit", async () => {
			const directory = path.resolve("dev-data");
			await mkdir(directory, { recursive: true });
			await writeFile(path.join(directory, "library.json"), "original", "utf8");
			await writeFile(
				path.join(directory, "library.backup.json"),
				"backup",
				"utf8",
			);

			const storage = new DevDataFileStorage();
			expect(
				new TextDecoder().decode(
					await successfulBytes(
						storage.readInternal({
							category: "library",
							fileName: "library.json",
						}),
					),
				),
			).toBe("original");
			expect(
				new TextDecoder().decode(
					await successfulBytes(
						storage.readInternal(
							{ category: "library", fileName: "library.json" },
							"backup",
						),
					),
				),
			).toBe("backup");
		});

		it("legt über die gemeinsame Schreibfunktion ein Backup an", async () => {
			const storage = new DevDataFileStorage();
			const first = new TextEncoder().encode('{"version":1}');
			const second = new TextEncoder().encode('{"version":2}');
			await storage.writeInternal(
				{ category: "library", fileName: "library.json" },
				first,
				{ backup: true },
			);
			await storage.writeInternal(
				{ category: "library", fileName: "library.json" },
				second,
				{ backup: true },
			);

			expect(
				new TextDecoder().decode(
					await successfulBytes(
						storage.readInternal({
							category: "library",
							fileName: "library.json",
						}),
					),
				),
			).toBe('{"version":2}');
			expect(
				await readFile(path.resolve("dev-data/library.backup.json"), "utf8"),
			).toBe('{"version":1}');
		});
	});

	it("leitet die Kategorie ausschließlich auf das technische Unterverzeichnis ab", async () => {
		const storage = new DevDataFileStorage();
		const bytes = new TextEncoder().encode('{"id":"template_demo"}');
		await storage.writeInternal(
			{ category: "template", fileName: "template_demo.json" },
			bytes,
			{ createOnly: true },
		);

		expect(
			await readFile(
				path.resolve("dev-data/template/template_demo.json"),
				"utf8",
			),
		).toBe('{"id":"template_demo"}');
		await expect(
			readFile(path.resolve("dev-data/game/template_demo.json"), "utf8"),
		).rejects.toThrow();
	});
});
