import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createGameUseCases } from "../src/application/gameUseCases";
import {
	createLibraryUseCases,
	type RenameScenarioRequest,
} from "../src/application/libraryUseCases";
import { RuleSetExportService } from "../src/application/ruleSetExportService";
import type { GameState } from "../src/domain/gameFactory";
import { Role, Team } from "../src/domain/models";
import type { RuleSet } from "../src/domain/ruleSet";
import type { DataFileStorage } from "../src/persistence/ports/dataFileStorage";
import { createRuleSetExportJsonText } from "../src/serialization/ruleSetExport";
import { createTestObjectPersistence } from "./createTestObjectPersistence";
import { fixedDomainServices } from "./fixedClock";
import { missingRead } from "./storageReadResult";

describe("öffentliche Application-Verträge", () => {
	it("koppelt beim Umbenennen Szenariotyp und Dokumenttyp", () => {
		expectTypeOf<
			Extract<RenameScenarioRequest, { type: "ruleSet" }>["document"]
		>().toEqualTypeOf<RuleSet>();
		expectTypeOf<
			Extract<RenameScenarioRequest, { type: "template" }>["document"]
		>().toEqualTypeOf<GameState>();
	});

	it("fixiert das kanonische RuleSet-Exportformat bytegenau", () => {
		expect(createRuleSetExportJsonText(createGoldenRuleSet())).toBe(
			readGoldenRuleSet(),
		);
	});

	it("fixiert Ergebnisbytes und Optionen des öffentlichen RuleSet-Exports", async () => {
		let exported:
			| {
					bytes: Uint8Array;
					options: { suggestedFileName: string; description?: string };
			  }
			| undefined;
		const storage: DataFileStorage = {
			readInternal: (file) => Promise.resolve(missingRead(file)),
			writeExternal: (bytes, options) => {
				exported = { bytes, options };
				return Promise.resolve();
			},
		};

		await new RuleSetExportService(
			createTestObjectPersistence(storage, fixedDomainServices).transfer,
		).exportRuleSet(createGoldenRuleSet());

		expect(new TextDecoder().decode(exported?.bytes)).toBe(readGoldenRuleSet());
		expect(exported?.options).toEqual({
			suggestedFileName: "ruleset_golden.json",
			description: "Regelwerk",
			conflictPolicy: "reject",
			targetPolicy: "suggested",
		});
	});

	it("fixiert die öffentlichen Use-Case-Fassaden", () => {
		const objectPersistence = createTestObjectPersistence(
			{
				readInternal: (file) => Promise.resolve(missingRead(file)),
			},
			fixedDomainServices,
		);
		const gameServices = createGameUseCases(
			objectPersistence,
			fixedDomainServices,
		);
		const libraryServices = createLibraryUseCases(
			objectPersistence,
			fixedDomainServices,
		);
		expectExactObjectMethods(gameServices.persistence, [
			"listObjects",
			"findLatestStoredGame",
			"clearBrowseCache",
			"createGameFromTemplate",
			"loadTemplateDocument",
			"loadGame",
			"saveLoadedGame",
			"listWriteRecoveries",
			"resolveWriteRecovery",
			"finishInternalStorageCommand",
			"retryLoadedGameSave",
			"exportFailedWrite",
			"suggestLoadedGameSaveAsName",
			"saveLoadedGameAs",
			"suggestSavedGameCopyName",
			"renameSavedGame",
			"duplicateSavedGame",
			"importSavedGame",
			"resolveSavedGameImport",
			"exportSavedGame",
			"shareSavedGame",
			"deleteSavedGame",
			"suggestLoadedGameTemplateName",
			"saveLoadedGameAsTemplate",
			"continuePendingCreatedDocument",
		]);
		expectExactObjectMethods(gameServices.session, [
			"getLoadedGame",
			"setPreparedGame",
			"isLoadedGameDirty",
			"replaceLoadedGameWithEditedCopy",
			"moveLoadedSeat",
			"shuffleLoadedPlayers",
			"moveLoadedShownRole",
			"changeLoadedShownRole",
			"saveLoadedPlayer",
			"deleteLoadedEmptySeat",
			"deleteLoadedPlayerAtSeat",
			"deleteLoadedGameLogEntry",
			"clearLoadedGameLog",
			"useLoadedPlayerAbility",
			"advanceLoadedGameTime",
			"rewindLoadedGameTime",
			"assignLoadedGameRolesByTeamCounts",
			"assignLoadedGameRolesByRoleCounts",
			"getLoadedRolesForShowingEditorModel",
			"createLoadedRolesForShowingPresentation",
			"updateLoadedRolesForShowing",
		]);
		for (const method of ["createGameFromRuleSet", "distributeRoles"] as const)
			expect(typeof gameServices.preparation[method]).toBe("function");
		expect("moveLoadedSeat" in gameServices.persistence).toBe(false);
		expect("saveLoadedGame" in gameServices.session).toBe(false);
		expect("createGameFromRuleSet" in gameServices.persistence).toBe(false);

		expectExactObjectMethods(libraryServices.browse, [
			"listObjects",
			"loadRuleSet",
		]);
		expectExactObjectMethods(libraryServices.import, [
			"importScenario",
			"resolveScenarioImport",
		]);
		expectExactObjectMethods(libraryServices.management, [
			"exportTemplate",
			"shareTemplate",
			"saveRuleSet",
			"saveTemplate",
			"renameScenario",
			"deleteScenario",
		]);
		expectExactObjectMethods(libraryServices.backup, [
			"exportLibraryBackup",
			"shareLibraryBackup",
			"restoreLibraryBackup",
			"prepareLibraryBackupRestore",
			"resolveLibraryBackupRestore",
		]);
		expectExactObjectMethods(libraryServices.recovery, [
			"inspectLibraryLoadProblem",
			"restoreInternalBackup",
			"repairInternalLibrary",
			"createAndStoreEmptyLibrary",
			"useEmptyLibraryInMemory",
			"exportInternalLibraryRaw",
			"listWriteRecoveries",
			"resolveWriteRecovery",
			"finishInternalStorageCommand",
			"exportFailedWrite",
		]);

		expect(typeof RuleSetExportService.prototype.exportRuleSet).toBe(
			"function",
		);
	});
});

function expectExactObjectMethods(
	service: object,
	methods: readonly string[],
): void {
	expect(Object.keys(service).sort()).toEqual([...methods].sort());
	for (const method of methods)
		expect(typeof (service as Record<string, unknown>)[method]).toBe(
			"function",
		);
}

function createGoldenRuleSet(): RuleSet {
	return {
		id: "ruleset_golden",
		name: "Golden Rules",
		names: { de: "Goldene Regeln" },
		version: 2,
		teams: [
			new Team({ id: "t_good", name: "Good", teamOrder: 10 }),
			new Team({
				id: "t_unknown",
				name: "Unknown",
				teamOrder: 99,
				isSystem: true,
			}),
		],
		roles: [
			new Role({
				id: "r_seer",
				name: "Seer",
				teamId: "t_good",
				night: { first: { order: 10, note: "Show a token." } },
				expectsVisual: true,
				isUnique: true,
				unicodeEscaped: "\\u{1F441}",
				kills_someone: false,
				resurrect_someone: true,
				apply_status_effect: ["d_poisoned"],
			}),
		],
		statuses: [{ id: "d_poisoned", name: "Poisoned", defaultDuration: 0 }],
	};
}

function readGoldenRuleSet(): string {
	return readFileSync(
		path.resolve("tests", "golden", "ruleset-export-v1.json"),
		"utf8",
	).trimEnd();
}
