import { describe, expect, it } from "vitest";
import { renameRuleSet } from "../src/domain/scenarioRenaming";
import { normalizeId } from "../src/domain/stringSanitizer";
import type { DataFileStorage } from "../src/persistence/ports/dataFileStorage";
import { encodeGameExportDocument } from "../src/serialization/gameExport";
import { createTestObjectPersistence } from "./createTestObjectPersistence";
import { fixedClock } from "./fixedClock";
import { createTestGame, createTestRuleSet } from "./fixtures";
import { missingRead } from "./storageReadResult";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const decoding = { ansiFallbackLocale: "de" } as const;

describe("ObjectListResult", () => {
	it("liefert Game-Metadaten, Probleme und belegte IDs atomar", async () => {
		const game = createTestGame();
		game.name = "Canonical game";
		game.names = { fr: "Jeu affiché" };
		game.ruleSetSnapshot.name = "Canonical rules";
		game.ruleSetSnapshot.names = { fr: "Règles affichées" };
		const broken = { ...game, seatOrder: "invalid" };
		const storage: DataFileStorage = {
			readInternal: (file) => Promise.resolve(missingRead(file)),
			readAllInternal: () =>
				Promise.resolve([
					{
						category: "game",
						fileName: `${game.id}.json`,
						bytes: encodeGameExportDocument(game),
					},
					{
						category: "game",
						fileName: "game_broken.json",
						bytes: encoder.encode(JSON.stringify(broken)),
					},
				]),
		};

		const result = await createTestObjectPersistence(
			storage,
			fixedClock,
		).read.readAllObjectsOfType("game", decoding);

		expect(result).toMatchObject({
			status: "loaded",
			metadata: [{ id: game.id }],
			problems: [
				{
					scope: "object",
					category: "serialization",
					kind: "game",
					id: "game_broken",
					reason: "invalidDocument",
					repairable: false,
				},
			],
		});
		if (result.status !== "loaded") throw new Error("Snapshot fehlt.");
		expect(result.metadata[0]).toMatchObject({
			name: "Canonical game",
			names: { fr: "Jeu affiché" },
			ruleSetName: "Canonical rules",
			ruleSetNames: { fr: "Règles affichées" },
		});
		expect(result.ids).toEqual(
			expect.arrayContaining([game.id, "game_broken"]),
		);
	});

	it("liefert gültige RuleSets trotz ungültiger Nachbareinträge", async () => {
		const ruleSet = createTestRuleSet();
		ruleSet.name = "Canonical rules";
		ruleSet.names = { fr: "Règles affichées" };
		const persistence = createTestObjectPersistence(
			libraryStorage({
				[ruleSet.id]: ruleSet,
				broken: 42,
			}),
			fixedClock,
		);

		const result = await persistence.read.readAllObjectsOfType(
			"ruleSet",
			decoding,
		);

		expect(result).toMatchObject({
			status: "loaded",
			metadata: [
				{
					id: ruleSet.id,
					name: "Canonical rules",
					names: { fr: "Règles affichées" },
				},
			],
			problems: [
				{
					scope: "object",
					category: "serialization",
					kind: "ruleSet",
					id: "broken",
					reason: "invalidDocument",
					repairable: false,
				},
			],
			ids: [ruleSet.id, "broken"],
		});
		await expect(
			persistence.read.loadObject("ruleSet", ruleSet.id, decoding),
		).resolves.toEqual(expect.objectContaining({ id: ruleSet.id }));
	});

	it("löscht ein ungültiges RuleSet und erhält andere rohe Einträge", async () => {
		const ruleSet = createTestRuleSet();
		const writes: Uint8Array[] = [];
		const persistence = createTestObjectPersistence(
			libraryStorage(
				{
					[ruleSet.id]: ruleSet,
					broken: 42,
					otherBroken: null,
				},
				writes,
			),
			fixedClock,
		);

		await persistence.write.deleteObject(
			{ kind: "ruleSet", id: "broken" },
			decoding,
		);

		const stored = readWrittenRuleSets(writes);
		expect(stored).not.toHaveProperty("broken");
		expect(stored).toHaveProperty("otherBroken", null);
		expect(stored).toHaveProperty(ruleSet.id);
	});

	it("erhält ungültige Nachbareinträge beim Speichern und Ersetzen", async () => {
		const ruleSet = createTestRuleSet();
		const writes: Uint8Array[] = [];
		const persistence = createTestObjectPersistence(
			libraryStorage({ [ruleSet.id]: ruleSet, broken: 42 }, writes),
			fixedClock,
		);

		await persistence.write.saveObject(ruleSet, decoding);
		expect(readWrittenRuleSets(writes)).toHaveProperty("broken", 42);

		const renamed = renameRuleSet(ruleSet, `${ruleSet.name} Neu`);
		await persistence.write.replaceObject(
			normalizeId(ruleSet.id, "ruleSet"),
			renamed,
			decoding,
		);
		const stored = readWrittenRuleSets(writes);
		expect(stored).toHaveProperty("broken", 42);
		expect(stored).not.toHaveProperty(ruleSet.id);
		expect(stored).toHaveProperty(renamed.id);
	});

	it("liefert erwartete Storefehler als Ergebniswert", async () => {
		const persistence = createTestObjectPersistence(
			{
				readInternal: () =>
					Promise.resolve({
						status: "success",
						bytes: encoder.encode("kein JSON"),
					}),
			},
			fixedClock,
		);

		await expect(
			persistence.read.readAllObjectsOfType("ruleSet", decoding),
		).resolves.toMatchObject({
			status: "failed",
			problem: {
				scope: "store",
				category: "serialization",
				kind: "ruleSet",
				reason: "invalidJson",
			},
		});
	});

	it("wirft unbekannte Exceptions weiterhin", async () => {
		const persistence = createTestObjectPersistence(
			{
				readInternal: () => Promise.reject(new Error("Programmierfehler")),
			},
			fixedClock,
		);

		await expect(
			persistence.read.readAllObjectsOfType("ruleSet", decoding),
		).rejects.toThrow("Programmierfehler");
	});
});

function libraryStorage(
	ruleSetsById: Record<string, unknown>,
	writes: Uint8Array[] = [],
): DataFileStorage {
	const bytes = encoder.encode(
		JSON.stringify({
			storageType: "social-deduction-app-library",
			storageVersion: 1,
			ruleSetsById,
		}),
	);
	return {
		readInternal: () => Promise.resolve({ status: "success", bytes }),
		writeInternal: (_file, written) => {
			writes.push(written);
			return Promise.resolve();
		},
	};
}

function readWrittenRuleSets(writes: Uint8Array[]): Record<string, unknown> {
	const bytes = writes.at(-1);
	if (!bytes) throw new Error("Es wurde keine Library geschrieben.");
	const parsed = JSON.parse(decoder.decode(bytes)) as {
		ruleSetsById: Record<string, unknown>;
	};
	return parsed.ruleSetsById;
}
