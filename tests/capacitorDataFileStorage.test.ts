import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const files = new Map<string, { data: string; mtime: number }>();
const filesystem = vi.hoisted(() => ({
	readFile: vi.fn(({ path }: { path: string }) => {
		const file = files.get(path);
		if (!file) return Promise.reject(new Error("File does not exist"));
		return Promise.resolve({ data: file.data });
	}),
	writeFile: vi.fn(({ path, data }: { path: string; data: string | Blob }) => {
		if (typeof data !== "string")
			return Promise.reject(new Error("Unexpected Blob"));
		files.set(path, { data, mtime: Date.now() });
		return Promise.resolve({ uri: `file://${path}` });
	}),
	deleteFile: vi.fn(({ path }: { path: string }) => {
		return files.delete(path)
			? Promise.resolve()
			: Promise.reject(new Error("File does not exist"));
	}),
	stat: vi.fn(({ path }: { path: string }) => {
		const file = files.get(path);
		if (!file) return Promise.reject(new Error("File does not exist"));
		return Promise.resolve({
			name: path.split("/").at(-1) ?? path,
			type: "file" as const,
			size: file.data.length,
			mtime: file.mtime,
			uri: `file://${path}`,
		});
	}),
	readdir: vi.fn(({ path }: { path: string }) =>
		Promise.resolve({
			files: [...files.entries()]
				.filter(([filePath]) => {
					const remainder = filePath.slice(`${path}/`.length);
					return filePath.startsWith(`${path}/`) && !remainder.includes("/");
				})
				.map(([filePath, file]) => ({
					name: filePath.split("/").at(-1) ?? filePath,
					type: "file" as const,
					size: file.data.length,
					mtime: file.mtime,
					uri: `file://${filePath}`,
				})),
		}),
	),
	rename: vi.fn(({ from, to }: { from: string; to: string }) => {
		const file = files.get(from);
		if (!file) return Promise.reject(new Error("File does not exist"));
		files.delete(from);
		files.set(to, file);
		return Promise.resolve();
	}),
	copy: vi.fn(({ from, to }: { from: string; to: string }) => {
		const file = files.get(from);
		if (!file) return Promise.reject(new Error("File does not exist"));
		files.set(to, { ...file });
		return Promise.resolve({ uri: `file://${to}` });
	}),
	getUri: vi.fn(({ path }: { path: string }) =>
		Promise.resolve({ uri: `content://app/${path}` }),
	),
}));

vi.mock("@capacitor/filesystem", () => ({
	Directory: { Data: "DATA", Cache: "CACHE" },
	Filesystem: filesystem,
}));

afterEach(() => vi.unstubAllGlobals());

import { repairInternalDataFileNames } from "../src/persistence/internalDataFileNameRepair";
import {
	CapacitorDataFileStorage,
	type NativeDataFilePlugin,
} from "../src/storage/capacitorDataFileStorage";

describe("CapacitorDataFileStorage", () => {
	beforeEach(() => {
		files.clear();
		vi.clearAllMocks();
		vi.stubGlobal("document", { baseURI: "https://app.test/" });
	});

	it("kopiert Library, Templates und Games beim ersten Start genau einmal", async () => {
		const payloads = new Map([
			["library.json", '{"library":true}'],
			["template/template_one.json", '{"template":true}'],
			["game/game_one.json", '{"game":true}'],
		]);
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) => {
				const url =
					typeof input === "string"
						? input
						: input instanceof URL
							? input.toString()
							: input.url;
				if (url.endsWith("/native-seed/manifest.json"))
					return Promise.resolve(
						new Response(JSON.stringify({ files: [...payloads.keys()] })),
					);
				const path = [...payloads.keys()].find((entry) =>
					url.endsWith(`/native-seed/${entry}`),
				);
				return Promise.resolve(
					path
						? new Response(payloads.get(path))
						: new Response(undefined, { status: 404 }),
				);
			}),
		);
		const storage = new CapacitorDataFileStorage();
		await storage.initializeFromBundle();
		expect(await storage.listInternalFileNames("template")).toEqual([
			"template_one.json",
		]);
		expect(await storage.listInternalFileNames("game")).toEqual([
			"game_one.json",
		]);
		files.set("social-deduction-game/library.json", {
			data: btoa("changed"),
			mtime: Date.now(),
		});
		await storage.initializeFromBundle();
		expect(filesystem.writeFile).toHaveBeenCalledTimes(4);
		expect(
			await storage.readInternal({
				category: "library",
				fileName: "library.json",
			}),
		).toMatchObject({
			status: "success",
			bytes: new TextEncoder().encode("changed"),
		});
	});

	it("schreibt, liest, sichert und benennt native Spieldateien um", async () => {
		const storage = new CapacitorDataFileStorage();
		const file = { category: "game" as const, fileName: "game_one.json" };
		await storage.writeInternal(file, new TextEncoder().encode("old"), {
			createOnly: true,
		});
		await storage.writeInternal(file, new TextEncoder().encode("new"), {
			backup: true,
		});
		expect(await storage.readInternal(file, "backup")).toMatchObject({
			status: "success",
			bytes: new TextEncoder().encode("old"),
		});
		await storage.renameInternal(file, {
			category: "game",
			fileName: "game_renamed.json",
		});
		expect(await storage.listInternalFileNames("game")).toEqual([
			"game_one.backup.json",
			"game_renamed.json",
		]);
	});

	it("bezieht Backup- und Tempdateien in die Dateinamenreparatur ein", async () => {
		for (const fileName of ["Test.json", "Test.backup.json", "Test.temp.json"])
			files.set(`social-deduction-game/game/${fileName}`, {
				data: btoa(fileName),
				mtime: Date.now(),
			});
		const storage = new CapacitorDataFileStorage();

		await expect(repairInternalDataFileNames(storage)).resolves.toEqual({
			renamedFiles: 3,
			repairedIds: 1,
		});
		expect(await storage.listInternalFileNames("game")).toEqual([
			"game_test.backup.json",
			"game_test.json",
			"game_test.temp.json",
		]);
	});

	it("verschiebt die bisherige native Datei beim Speichern zum neuen Backupnamen", async () => {
		const storage = new CapacitorDataFileStorage();
		const oldFile = {
			category: "game" as const,
			fileName: "game_alt.restored.json",
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
			backup: true,
			previousFile: oldFile,
		});

		expect(await storage.readInternal(newFile)).toMatchObject({
			status: "success",
			bytes: new TextEncoder().encode("neu"),
		});
		expect(await storage.readInternal(newFile, "backup")).toMatchObject({
			status: "success",
			bytes: new TextEncoder().encode("alt"),
		});
		expect(await storage.readInternal(oldFile)).toMatchObject({
			status: "error",
			error: { reason: "notFound", file: oldFile },
		});
	});

	it("klassifiziert einen vollen nativen Datenträger", async () => {
		filesystem.writeFile.mockRejectedValueOnce(
			Object.assign(new Error("No space left on device"), { code: "ENOSPC" }),
		);
		const file = {
			category: "game" as const,
			fileName: "game_disk_full.json",
		};

		const storage = new CapacitorDataFileStorage();
		const error = await storage
			.writeInternal(file, Uint8Array.from([1]), {})
			.catch((caught: unknown) => caught);

		expect(error).toMatchObject({
			name: "RecoverableStorageWriteError",
			reason: "diskFull",
			file,
		});
		expect(error).toHaveProperty("commandId", expect.any(String));
		await expect(
			storage.continueInternalCommand(
				(error as { commandId: string }).commandId,
				"cancel",
			),
		).resolves.toBe("completed");
	});

	it("importiert und exportiert externe Dateien über den nativen Adapter", async () => {
		const writeExternal = vi.fn<NativeDataFilePlugin["writeExternal"]>(() =>
			Promise.resolve({ status: "success" }),
		);
		const storage = new CapacitorDataFileStorage({ writeExternal });
		const bytes = new TextEncoder().encode('{"native":true}');

		await expect(
			storage.readExternal(new File([bytes], "import.json")),
		).resolves.toEqual(bytes);
		await storage.writeExternal(bytes, {
			suggestedFileName: "export.json",
			description: "JSON-Datei",
		});

		expect(writeExternal).toHaveBeenCalledWith({
			bytesBase64: btoa('{"native":true}'),
			suggestedFileName: "export.json",
			description: "JSON-Datei",
		});
	});

	it("teilt Exporte als temporäre Cache-Datei", async () => {
		const share = vi.fn(() => Promise.resolve({ activityType: "test" }));
		const storage = new CapacitorDataFileStorage(
			{ writeExternal: () => Promise.resolve({ status: "success" }) },
			{ share },
		);
		const bytes = new TextEncoder().encode('{"shared":true}');

		await storage.writeExternal(bytes, {
			suggestedFileName: "game_shared.json",
			description: "Spielstand",
			delivery: "share",
		});

		expect(filesystem.writeFile).toHaveBeenCalledWith({
			path: "shared-exports/game_shared.json",
			data: btoa('{"shared":true}'),
			directory: "CACHE",
			recursive: true,
		});
		expect(share).toHaveBeenCalledWith({
			files: ["content://app/shared-exports/game_shared.json"],
			title: "Spielstand",
			dialogTitle: "Spielstand",
		});
		expect(files.has("shared-exports/game_shared.json")).toBe(false);
	});

	it("erkennt und löst persistente native Schreib-Recoveries", async () => {
		files.set("social-deduction-game/game/game_recovery.temp.json", {
			data: btoa("alt"),
			mtime: Date.now(),
		});
		files.set("social-deduction-game/game/game_recovery.json", {
			data: btoa("neu"),
			mtime: Date.now(),
		});
		const storage = new CapacitorDataFileStorage();

		const [candidate] = await storage.listRecoveries("game");
		expect(candidate).toMatchObject({
			recoveryKey: "game:game_recovery.json",
			recoverySource: "temporary",
			oldBytes: new TextEncoder().encode("alt"),
			newBytes: new TextEncoder().encode("neu"),
		});
		const request = await storage.requestRecovery(candidate?.recoveryKey ?? "");
		expect(request.status).toBe("decisionRequired");
		if (request.status !== "decisionRequired") return;

		await expect(
			storage.continueInternalCommand(request.commandId, "keepBoth"),
		).resolves.toBe("completed");
		expect(
			files.get("social-deduction-game/game/game_recovery.json")?.data,
		).toBe(btoa("neu"));
		expect(
			files.get("social-deduction-game/game/game_recovery.restored.json")?.data,
		).toBe(btoa("alt"));
	});

	it.each([
		["keepOld", "alt", false],
		["keepNew", "neu", false],
	] as const)(
		"löst native Schreib-Recoveries mit %s auf",
		async (resolution, expectedContent, recoveryRemains) => {
			files.set("social-deduction-game/game/game_recovery.temp.json", {
				data: btoa("alt"),
				mtime: Date.now(),
			});
			files.set("social-deduction-game/game/game_recovery.json", {
				data: btoa("neu"),
				mtime: Date.now(),
			});
			const storage = new CapacitorDataFileStorage();
			const request = await storage.requestRecovery("game:game_recovery.json");
			if (request.status !== "decisionRequired")
				throw new Error("Recovery-Entscheidung erwartet.");

			await expect(
				storage.continueInternalCommand(request.commandId, resolution),
			).resolves.toBe("completed");
			expect(
				atob(
					files.get("social-deduction-game/game/game_recovery.json")?.data ??
						"",
				),
			).toBe(expectedContent);
			expect(
				files.has("social-deduction-game/game/game_recovery.temp.json"),
			).toBe(recoveryRemains);
		},
	);
});
