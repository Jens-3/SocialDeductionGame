import { describe, expect, it } from "vitest";
import {
	analyzeInternalFileNames,
	repairInternalDataFileNames,
} from "../src/persistence/internalDataFileNameRepair";
import type {
	DataFileReadResult,
	DataFileReference,
	DataFileStorage,
} from "../src/persistence/ports/dataFileStorage";
import { missingRead } from "./storageReadResult";

describe("interne Dateinamenreparatur", () => {
	it("gruppiert ungültige Basis-IDs und dedupliziert gültige IDs", () => {
		const analysis = analyzeInternalFileNames(
			[
				"game_ok.json",
				"game_ok.restored.json",
				"Test.json",
				"Test..json",
				"Test.temp.json",
			],
			"game",
		);

		expect([...analysis.validIds]).toEqual(["game_ok"]);
		expect(analysis.invalidIds).toEqual([
			{
				oldId: "Test",
				oldFileNames: ["Test..json", "Test.json", "Test.temp.json"],
			},
		]);
	});

	it("reserviert erzeugte IDs sofort und repariert Variationen kollisionsfrei", async () => {
		const storage = new FileNameOnlyStorage({
			game: [
				"game_test.json",
				"Test.json",
				"Test..json",
				"Test.backup.json",
				"Test.temp.json",
				"Test.hello world.json",
				"Test.hello_world.json",
				"Tést.json",
			],
			template: [],
		});

		await expect(repairInternalDataFileNames(storage)).resolves.toEqual({
			renamedFiles: 7,
			repairedIds: 2,
		});

		expect(storage.readCount).toBe(0);
		expect(storage.renames).toEqual([
			["Test.json", "game_test_2.json"],
			["Test.backup.json", "game_test_2.backup.json"],
			["Test.temp.json", "game_test_2.temp.json"],
			["Test..json", "game_test_2.v.json"],
			["Test.hello_world.json", "game_test_2.hello_world.json"],
			["Test.hello world.json", "game_test_2.hello_world_2.json"],
			["Tést.json", "game_test_3.json"],
		]);
	});

	it("hält backup für bereinigte, aber nicht technische Variationen reserviert", async () => {
		const storage = new FileNameOnlyStorage({
			game: ["test.Backup?.json"],
			template: [],
		});

		await repairInternalDataFileNames(storage);

		expect(storage.renames).toEqual([
			["test.Backup?.json", "game_test.backup_2.json"],
		]);
	});

	it("vereinheitlicht auch Variationen von bereits gültigen IDs", async () => {
		const storage = new FileNameOnlyStorage({
			game: [
				"game_test.json",
				"game_test.backup.json",
				"game_test.Backup?.json",
				"game_test.foo.json",
				"game_test.foo?.json",
				"game_test..json",
				"game_test.Restored.json",
				"game_test.Restored?.json",
			],
			template: [],
		});

		await repairInternalDataFileNames(storage);

		expect(new Map(storage.renames)).toEqual(
			new Map([
				["game_test.Backup?.json", "game_test.backup_2.json"],
				["game_test.foo?.json", "game_test.foo_2.json"],
				["game_test..json", "game_test.v.json"],
				["game_test.Restored.json", "game_test.restored.json"],
				["game_test.Restored?.json", "game_test.v_restored.json"],
			]),
		);
	});

	it("repariert gemischte ID- und Storage-Variantenfehler in einem gemeinsamen Durchlauf", async () => {
		const storage = new FileNameOnlyStorage({
			game: [
				// Gültige ID und gültige beziehungsweise technische Variationen.
				"game_alpha.json",
				"game_alpha.clean.json",
				"game_alpha.temp.json",
				"game_beta.json",
				"game_beta.stable.json",
				// Gültige ID, aber ungültige Variationen.
				"game_alpha.Clean?.json",
				"game_alpha.Zwei Worte.json",
				"game_alpha..json",
				// Ungültige ID, die mit game_alpha kollidiert.
				"Alpha.clean.json",
				"Alpha.restored.json",
				"Alpha.Clean?.json",
				"Alpha..json",
				// Ungültige ID, die mit game_beta kollidiert; außerdem
				// kollidieren zwei Variationen nach ihrer Normalisierung.
				"Beta.ready.json",
				"Beta.bad_variation.json",
				"Beta.Bad Variation?.json",
			],
			template: [],
		});

		await expect(repairInternalDataFileNames(storage)).resolves.toEqual({
			renamedFiles: 10,
			repairedIds: 2,
		});

		expect(new Map(storage.renames)).toEqual(
			new Map([
				["Alpha.clean.json", "game_alpha_2.clean.json"],
				["Alpha.restored.json", "game_alpha_2.restored.json"],
				["Alpha.Clean?.json", "game_alpha_2.clean_2.json"],
				["Alpha..json", "game_alpha_2.v.json"],
				["Beta.ready.json", "game_beta_2.ready.json"],
				["Beta.bad_variation.json", "game_beta_2.bad_variation.json"],
				["Beta.Bad Variation?.json", "game_beta_2.bad_variation_2.json"],
				["game_alpha.Clean?.json", "game_alpha.clean_2.json"],
				["game_alpha.Zwei Worte.json", "game_alpha.zwei_worte.json"],
				["game_alpha..json", "game_alpha.v.json"],
			]),
		);
		expect(storage.currentFileNames("game")).toEqual(
			expect.arrayContaining([
				"game_alpha.json",
				"game_alpha.clean.json",
				"game_alpha.clean_2.json",
				"game_alpha_2.clean.json",
				"game_alpha_2.clean_2.json",
				"game_beta.stable.json",
				"game_beta_2.bad_variation.json",
				"game_beta_2.bad_variation_2.json",
			]),
		);
	});
});

class FileNameOnlyStorage implements DataFileStorage {
	readonly #fileNames: Record<"game" | "template", string[]>;
	readonly renames: Array<[string, string]> = [];
	readCount = 0;

	constructor(fileNames: Record<"game" | "template", string[]>) {
		this.#fileNames = structuredClone(fileNames);
	}

	listInternalFileNames(category: "game" | "template"): Promise<string[]> {
		return Promise.resolve([...this.#fileNames[category]]);
	}

	currentFileNames(category: "game" | "template"): string[] {
		return [...this.#fileNames[category]];
	}

	readInternal(file: DataFileReference): Promise<DataFileReadResult> {
		this.readCount += 1;
		return Promise.resolve(missingRead(file));
	}

	renameInternal(
		oldFile: DataFileReference,
		newFile: DataFileReference,
	): Promise<void> {
		this.renames.push([oldFile.fileName, newFile.fileName]);
		if (oldFile.category === "library")
			throw new Error("Die Library wird in diesem Test nicht umbenannt.");
		const fileNames = this.#fileNames[oldFile.category];
		const index = fileNames.indexOf(oldFile.fileName);
		if (index >= 0) fileNames[index] = newFile.fileName;
		return Promise.resolve();
	}
}
