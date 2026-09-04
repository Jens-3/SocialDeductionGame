import { describe, expect, it } from "vitest";
import { Player, Role, Team } from "../src/domain/models";
import { createTemplateFromGame } from "../src/domain/templateFactory";
import {
	createObjectPersistence,
	type ObjectPersistenceComponents,
} from "../src/persistence/objectPersistence";
import type { DataFileStorage } from "../src/persistence/ports/dataFileStorage";
import { createGameExportDocument } from "../src/serialization/gameExport";
import { createRuleSetExportJsonText } from "../src/serialization/ruleSetExport";
import { fixedDomainServices } from "./fixedClock";
import { createTestGame, createTestRuleSet } from "./fixtures";
import { missingRead } from "./storageReadResult";

const decoding = { ansiFallbackLocale: "de" } as const;

describe("ObjectPersistence-Import", () => {
	it("liefert ein validiertes RuleSet-Domainobjekt", async () => {
		const ruleSet = createTestRuleSet();
		const persistence = createImportPersistence(
			new TextEncoder().encode(createRuleSetExportJsonText(ruleSet)),
		);

		const imported = await persistence.transfer.importObject({}, decoding);
		if ("status" in imported) throw new Error("Direkter Import erwartet.");

		expect(imported).toMatchObject({
			kind: "ruleSet",
			object: { id: ruleSet.id, name: ruleSet.name },
			sourceMetadata: { schemaVersion: 1 },
		});
		if (imported.kind !== "ruleSet") throw new Error("RuleSet erwartet.");
		expect(imported.object.teams[0]).toBeInstanceOf(Team);
		expect(imported.object.roles[0]).toBeInstanceOf(Role);
		expect(imported).not.toHaveProperty("document");
		expect(imported).not.toHaveProperty("source");
	});

	it("liefert Game und Template als validierte GameState-Domainobjekte", async () => {
		const game = createTestGame(1);
		const importedGame = await createImportPersistence(
			encodeJson(createGameExportDocument(game)),
		).transfer.importObject({}, decoding);
		const template = createTemplateFromGame({
			services: fixedDomainServices,
			game,
			name: "Importvorlage",
		}).template;
		const importedTemplate = await createImportPersistence(
			encodeJson(createGameExportDocument(template)),
		).transfer.importObject({}, decoding);
		if ("status" in importedGame || "status" in importedTemplate)
			throw new Error("Direkter Import erwartet.");

		expect(importedGame).toMatchObject({
			kind: "game",
			object: { id: game.id, isTemplate: false },
			sourceMetadata: { schemaVersion: 1 },
		});
		if (importedGame.kind !== "game") throw new Error("Game erwartet.");
		expect(
			importedGame.object.playersById[importedGame.object.seatOrder[0] ?? ""],
		).toBeInstanceOf(Player);
		expect(importedTemplate).toMatchObject({
			kind: "template",
			object: { id: template.id, isTemplate: true },
			sourceMetadata: { schemaVersion: 1 },
		});
	});

	it("erkennt Game und Template ohne vorgegebenen Importfall", async () => {
		const game = createTestGame(1);
		const template = createTemplateFromGame({
			services: fixedDomainServices,
			game,
		}).template;

		const importedTemplate = await createImportPersistence(
			encodeJson(createGameExportDocument(template)),
		).transfer.importObject({}, decoding);
		if ("status" in importedTemplate)
			throw new Error("Direkter Import erwartet.");
		expect(importedTemplate.kind).toBe("template");
		const importedGame = await createImportPersistence(
			encodeJson(createGameExportDocument(game)),
		).transfer.importObject({}, decoding);
		if ("status" in importedGame) throw new Error("Direkter Import erwartet.");
		expect(importedGame.kind).toBe("game");
	});

	it("hält reparierbare Serialization-Fehler mit Command-ID im RAM", async () => {
		const source = JSON.stringify(createGameExportDocument(createTestGame(1)));
		const persistence = createImportPersistence(
			new TextEncoder().encode(source.slice(0, -1)),
		);

		const decision = await persistence.transfer.importObject({}, decoding);

		expect(decision).toMatchObject({
			status: "decisionRequired",
			decisionKind: "serializationRepair",
			availableDecisions: ["repair", "cancel"],
		});
		if (!("status" in decision)) throw new Error("Entscheidung erwartet.");
		const repaired = await persistence.transfer.resolveObjectImport(
			decision.commandId,
			"repair",
		);
		expect(repaired).toMatchObject({ kind: "game" });
	});

	it("verwirft eine abgebrochene Serialization-Reparatur aus dem RAM", async () => {
		const source = JSON.stringify(createGameExportDocument(createTestGame(1)));
		const persistence = createImportPersistence(
			new TextEncoder().encode(source.slice(0, -1)),
		);
		const decision = await persistence.transfer.importObject({}, decoding);
		if (!("status" in decision)) throw new Error("Entscheidung erwartet.");

		await expect(
			persistence.transfer.resolveObjectImport(decision.commandId, "cancel"),
		).resolves.toBeUndefined();
		await expect(
			persistence.transfer.resolveObjectImport(decision.commandId, "repair"),
		).rejects.toThrow("nicht mehr aktiv");
	});
});

function createImportPersistence(
	bytes: Uint8Array,
): ObjectPersistenceComponents {
	const storage: DataFileStorage = {
		readInternal: (file) => Promise.resolve(missingRead(file)),
		readExternal: () => Promise.resolve(bytes),
	};
	return createObjectPersistence(storage, fixedDomainServices);
}

function encodeJson(value: unknown): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(value));
}
