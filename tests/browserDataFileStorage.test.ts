import { afterEach, describe, expect, it, vi } from "vitest";
import { storageFailureCapabilities } from "../src/persistence/ports/storageFailure";
import { BrowserDataFileStorage } from "../src/storage/browserDataFileStorage";

afterEach(() => vi.unstubAllGlobals());

describe("BrowserDataFileStorage.readInternal", () => {
	it("übergibt beim Schlüsselwechsel die bisherige Datei an den Dev-Storage", async () => {
		const fetchMock = vi.fn(() =>
			Promise.resolve(new Response(null, { status: 200 })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await new BrowserDataFileStorage().writeInternal(
			{ category: "game", fileName: "game_neu.json" },
			Uint8Array.from([1, 2, 3]),
			{
				createOnly: true,
				backup: true,
				previousFile: {
					category: "game",
					fileName: "game_alt.restored.json",
				},
			},
		);

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/dev/data-files?category=game&fileName=game_neu.json&createOnly=1&backup=1&previousFileName=game_alt.restored.json&previousCategory=game",
			{ method: "PUT", body: Uint8Array.from([1, 2, 3]).buffer },
		);
	});

	it("liest nur die Dateinamen und leitet Umbenennungen weiter", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify(["Test.json", "game_ok.json"]), {
					status: 200,
				}),
			)
			.mockResolvedValueOnce(new Response(null, { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);
		const storage = new BrowserDataFileStorage();

		await expect(storage.listInternalFileNames("game")).resolves.toEqual([
			"Test.json",
			"game_ok.json",
		]);
		await storage.renameInternal(
			{ category: "game", fileName: "Test.json" },
			{ category: "game", fileName: "game_test.json" },
		);

		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			"/api/dev/data-files?category=game&names=1",
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"/api/dev/data-files?category=game&fileName=Test.json&newFileName=game_test.json&newCategory=game",
			{ method: "PATCH" },
		);
	});

	it("liefert gelesene Bytes als success", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() =>
				Promise.resolve(
					new Response(Uint8Array.from([1, 2, 3]), { status: 200 }),
				),
			),
		);

		await expect(
			new BrowserDataFileStorage().readInternal({
				category: "game",
				fileName: "game_test.json",
			}),
		).resolves.toEqual({
			status: "success",
			bytes: Uint8Array.from([1, 2, 3]),
		});
	});

	it.each([
		[404, "notFound", undefined],
		[422, "unreadable", "Keine Leseberechtigung."],
		[503, "storageUnavailable", "Datenträger fehlt."],
	] as const)(
		"bildet HTTP %i auf den strukturierten Lesezustand ab",
		async (code, reason, diagnostic) => {
			const body = {
				status: "error",
				error: {
					source: "storage",
					operation: "read",
					reason,
					...storageFailureCapabilities(reason),
					...(diagnostic ? { diagnostic } : {}),
				},
			};
			vi.stubGlobal(
				"fetch",
				vi.fn(() =>
					Promise.resolve(
						new Response(JSON.stringify(body), {
							status: code,
							headers: { "Content-Type": "application/json" },
						}),
					),
				),
			);

			const file = {
				category: "game" as const,
				fileName: "game_test.json",
			};
			await expect(
				new BrowserDataFileStorage().readInternal(file),
			).resolves.toEqual({
				status: "error",
				error: {
					source: "storage",
					operation: "read",
					reason,
					...storageFailureCapabilities(reason),
					category: "game",
					file,
					...(diagnostic ? { diagnostic } : {}),
				},
			});
		},
	);

	it("behandelt einen nicht erreichbaren Storage als storageUnavailable", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.reject(new Error("offline"))),
		);

		const file = {
			category: "game" as const,
			fileName: "game_test.json",
		};
		await expect(
			new BrowserDataFileStorage().readInternal(file),
		).resolves.toEqual({
			status: "error",
			error: {
				source: "storage",
				operation: "read",
				reason: "storageUnavailable",
				...storageFailureCapabilities("storageUnavailable"),
				category: "game",
				file,
				diagnostic: "offline",
			},
		});
	});

	it("behält bei HTTP-Fehlern die Listenoperation und bereinigt nur den externen Text", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() =>
				Promise.resolve(
					new Response(JSON.stringify({ error: "Server\tkaputt\u202e" }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					}),
				),
			),
		);

		const error = await new BrowserDataFileStorage()
			.listInternalFiles("game")
			.catch((caught: unknown) => caught);

		expect(error).toMatchObject({
			failure: {
				source: "storage",
				operation: "list",
				reason: "storageUnavailable",
				category: "game",
				diagnostic: "Server kaputt",
			},
		});
	});

	it("validiert Metadaten ausschließlich gegen den Portvertrag", async () => {
		const metadata = [
			{ category: "game", fileName: "", modifiedAt: 123 },
			{ category: "template", fileName: "fachlich ungeprüft.json" },
		];
		vi.stubGlobal(
			"fetch",
			vi.fn(() =>
				Promise.resolve(
					new Response(JSON.stringify(metadata), {
						headers: { "Content-Type": "application/json" },
					}),
				),
			),
		);

		await expect(
			new BrowserDataFileStorage().listInternalFiles("game"),
		).resolves.toEqual(metadata);
	});

	it.each([
		[null],
		["game_test.json"],
		[{ category: "unknown", fileName: "game_test.json" }],
		[{ category: "game", fileName: 1 }],
		[{ category: "game", fileName: "game_test.json", modifiedAt: "123" }],
	])("lehnt Metadaten außerhalb des Portvertrags ab", async (metadata) => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() =>
				Promise.resolve(
					new Response(JSON.stringify(metadata), {
						headers: { "Content-Type": "application/json" },
					}),
				),
			),
		);

		const error = await new BrowserDataFileStorage()
			.listInternalFiles("game")
			.catch((caught: unknown) => caught);
		expect(error).toMatchObject({
			failure: {
				source: "storage",
				operation: "list",
				reason: "storageUnavailable",
				category: "game",
			},
		});
	});

	it("erzeugt für eine ungültige Adapterantwort keine interne Diagnostic", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() =>
				Promise.resolve(
					new Response(JSON.stringify([null]), {
						headers: { "Content-Type": "application/json" },
					}),
				),
			),
		);

		const error = await new BrowserDataFileStorage()
			.readAllInternal("game")
			.catch((caught: unknown) => caught);

		expect(error).toMatchObject({
			failure: {
				source: "storage",
				operation: "read",
				reason: "storageUnavailable",
				category: "game",
			},
		});
		expect(error).not.toHaveProperty("failure.diagnostic");
	});

	it("liest Backups über denselben Endpunkt mit einer Versionsangabe", async () => {
		const fetchMock = vi.fn(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({
						status: "error",
						error: {
							source: "storage",
							operation: "read",
							reason: "notFound",
						},
					}),
					{ status: 404 },
				),
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		await new BrowserDataFileStorage().readInternal(
			{ category: "library", fileName: "library.json" },
			"backup",
		);

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/dev/data-files?category=library&fileName=library.json&version=backup",
		);
	});

	it("übernimmt einen vollen Datenträger als strukturierten Recovery-Grund", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							error: "No space left on device",
							code: "FILE_WRITE_RECOVERY_REQUIRED",
							reason: "diskFull",
						}),
						{
							status: 409,
							headers: { "Content-Type": "application/json" },
						},
					),
				),
			),
		);

		const error = await new BrowserDataFileStorage()
			.writeInternal(
				{ category: "game", fileName: "game_test.json" },
				Uint8Array.from([1]),
				{},
			)
			.catch((caught: unknown) => caught);

		expect(error).toMatchObject({
			code: "FILE_WRITE_RECOVERY_REQUIRED",
			reason: "diskFull",
		});
	});

	it("ordnet das Auflisten und Lesen von Recoveries den primitiven Operationen zu", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() =>
				Promise.resolve(
					new Response(JSON.stringify({ error: "Storage offline" }), {
						status: 500,
					}),
				),
			),
		);
		const storage = new BrowserDataFileStorage();

		const listError = await storage
			.listRecoveries("game")
			.catch((caught: unknown) => caught);
		expect(listError).toMatchObject({
			failure: { operation: "list", category: "game" },
		});

		const readError = await storage
			.requestRecovery("game:game_test.json")
			.catch((caught: unknown) => caught);
		expect(readError).toMatchObject({
			failure: { operation: "read" },
		});
	});

	it.each([
		["retry", "write"],
		["overwrite", "write"],
		["cancel", "write"],
		["finishLater", "write"],
		["keepOld", "rename"],
		["keepNew", "delete"],
		["keepBoth", "rename"],
	] as const)(
		"ordnet die Recovery-Entscheidung %s der Operation %s zu",
		async (decision, operation) => {
			vi.stubGlobal(
				"fetch",
				vi.fn(() =>
					Promise.resolve(
						new Response(JSON.stringify({ error: "Storage offline" }), {
							status: 500,
						}),
					),
				),
			);

			const error = await new BrowserDataFileStorage()
				.continueInternalCommand("command-test", decision)
				.catch((caught: unknown) => caught);

			expect(error).toMatchObject({ failure: { operation } });
		},
	);
});
