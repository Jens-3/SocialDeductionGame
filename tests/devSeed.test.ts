import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeDevDataFromBundle } from "../src/storage/devSeed";

describe("Entwicklungs-Startdaten", () => {
	const originalWorkingDirectory = process.cwd();
	let temporaryDirectory: string;

	beforeEach(async () => {
		temporaryDirectory = await mkdtemp(path.join(tmpdir(), "dev-seed-test-"));
		process.chdir(temporaryDirectory);
		await mkdir("app-seed/assets/backgrounds", { recursive: true });
		await writeFile(
			"app-seed/manifest.json",
			JSON.stringify({
				files: ["library.json"],
				assets: ["assets/backgrounds/main.png"],
			}),
			"utf8",
		);
		await writeFile("app-seed/library.json", "seed-library", "utf8");
		await writeFile(
			"app-seed/assets/backgrounds/main.png",
			"seed-image",
			"utf8",
		);
	});

	afterEach(async () => {
		process.chdir(originalWorkingDirectory);
		await rm(temporaryDirectory, { recursive: true, force: true });
	});

	it("legt fehlende Entwicklungsdaten aus dem App-Seed an", async () => {
		await initializeDevDataFromBundle();

		await expect(readFile("dev-data/library.json", "utf8")).resolves.toBe(
			"seed-library",
		);
		await expect(
			readFile("dev-data/assets/backgrounds/main.png", "utf8"),
		).resolves.toBe("seed-image");
	});

	it("überschreibt keine vorhandenen Entwicklungsdaten", async () => {
		await mkdir("dev-data", { recursive: true });
		await writeFile("dev-data/library.json", "custom-library", "utf8");

		await initializeDevDataFromBundle();

		await expect(readFile("dev-data/library.json", "utf8")).resolves.toBe(
			"custom-library",
		);
	});

	it("stellt eine später fehlende Library beim nächsten Start wieder her", async () => {
		await initializeDevDataFromBundle();
		await rm("dev-data/library.json");

		await initializeDevDataFromBundle();

		await expect(readFile("dev-data/library.json", "utf8")).resolves.toBe(
			"seed-library",
		);
	});

	it("setzt nur die Library einschließlich Recovery-Dateien zurück", async () => {
		await mkdir("dev-data/game", { recursive: true });
		await writeFile("dev-data/library.json", "custom-library", "utf8");
		await writeFile("dev-data/library.backup.json", "backup", "utf8");
		await writeFile("dev-data/library.temp.json", "temporary", "utf8");
		await writeFile("dev-data/game/game_saved.json", "saved-game", "utf8");

		await initializeDevDataFromBundle({ resetLibrary: true });

		await expect(readFile("dev-data/library.json", "utf8")).resolves.toBe(
			"seed-library",
		);
		await expect(
			readFile("dev-data/library.backup.json", "utf8"),
		).rejects.toMatchObject({ code: "ENOENT" });
		await expect(
			readFile("dev-data/library.temp.json", "utf8"),
		).rejects.toMatchObject({ code: "ENOENT" });
		await expect(
			readFile("dev-data/game/game_saved.json", "utf8"),
		).resolves.toBe("saved-game");
	});
});
