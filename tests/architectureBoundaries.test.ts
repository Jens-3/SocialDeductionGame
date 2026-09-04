import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve("src");

const recoveryInfrastructureFiles = [
	"loadProblemQueue.ts",
	"loadProblemResolutionService.ts",
	"storageRecovery.ts",
];

const presentationModelFiles = [
	"gameScreenPresentation.ts",
	"playerOverview.ts",
	"rolesForShowing.ts",
];

const guiApplicationFiles = ["appSettings.ts", "scenarioEditor.ts"];

const applicationServices = [
	"appearanceService.ts",
	"applicationDecision.ts",
	"applicationError.ts",
	"appMetadata.ts",
	"appSettings.ts",
	"exportTypes.ts",
	"gamePreparationPresentation.ts",
	"gamePreparationService.ts",
	"gameScreenPresentation.ts",
	"gameTypes.ts",
	"gameUseCaseContracts.ts",
	"gameUseCases.ts",
	"imageResourceService.ts",
	"libraryUseCaseContracts.ts",
	"libraryUseCases.ts",
	"loadProblemQueue.ts",
	"loadProblemResolutionService.ts",
	"motionPreferenceService.ts",
	"objectList.ts",
	"objectReadProblemService.ts",
	"objectSuccess.ts",
	"persistenceActivityService.ts",
	"playerOverview.ts",
	"rolesForShowing.ts",
	"ruleSetExportService.ts",
	"scenarioEditor.ts",
	"scenarioPresentation.ts",
	"settingsService.ts",
	"storageRecovery.ts",
];

const applicationPorts = [
	"applicationLifecyclePort.ts",
	"hapticFeedbackPort.ts",
	"imageResourceStorage.ts",
	"motionPreferencePort.ts",
	"screenOrientationPort.ts",
	"screenWakeLockPort.ts",
	"settingsStorage.ts",
	"systemLanguagePort.ts",
	"systemThemePort.ts",
];

const persistencePorts = [
	"dataFileStorage.ts",
	"dataFileTypes.ts",
	"objectPersistenceCapabilities.ts",
	"objectReadPort.ts",
	"objectRecoveryPort.ts",
	"objectTransferPort.ts",
	"objectWritePort.ts",
	"storageCommand.ts",
	"storageFailure.ts",
	"storageRecovery.ts",
];

const objectCapabilityPorts = [
	"objectReadPort.ts",
	"objectWritePort.ts",
	"objectTransferPort.ts",
	"objectRecoveryPort.ts",
];

const serializationModules = [
	"gameDocument.ts",
	"gameDocumentFormat.ts",
	"gameExport.ts",
	"jsonEncoding.ts",
	"jsonRepair.ts",
	"jsonSyntaxError.ts",
	"libraryDocument.ts",
	"libraryRepair.ts",
	"librarySerializer.ts",
	"ruleSetDocument.ts",
	"ruleSetExport.ts",
	"scenarioDocument.ts",
	"serializationFailure.ts",
];

const allowedStorageApplicationModules = new Set([
	"../application/appSettings",
	"../application/ports/imageResourceStorage",
	"../application/ports/settingsStorage",
]);

const allowedPlatformDomainModules = new Set([
	"../domain/clock",
	"../domain/idGenerator",
	"../domain/instant",
]);

describe("harte Architekturgrenzen", () => {
	it("verbietet sämtliche Domain-Ausgänge", () => {
		const imports = readImports().filter(
			(entry) =>
				entry.file.startsWith("domain/") && entry.specifier === "../config",
		);
		expect(formatImports(imports)).toEqual([]);

		const otherParentImports = readImports().filter(
			(entry) =>
				entry.file.startsWith("domain/") &&
				entry.specifier.startsWith("../") &&
				entry.specifier !== "../config" &&
				!entry.specifier.startsWith("../shared/"),
		);
		expect(formatImports(otherParentImports)).toEqual([]);
	});

	it("hält Shared vollständig abhängigkeitsfrei", () => {
		expect(readdirSync(path.join(sourceRoot, "shared"))).toEqual([
			"textSanitizer.ts",
		]);
		expect(
			formatImports(
				readImports().filter((entry) => entry.file.startsWith("shared/")),
			),
		).toEqual([]);
	});

	it("hält Dateiformatmetadaten vollständig aus der Domain heraus", () => {
		const violations = listSourceFiles(path.join(sourceRoot, "domain"))
			.filter((absoluteFile) =>
				/\b(?:fileType|schemaVersion)\b/u.test(
					readFileSync(absoluteFile, "utf8"),
				),
			)
			.map((absoluteFile) =>
				normalizePath(path.relative(sourceRoot, absoluteFile)),
			);
		expect(violations).toEqual([]);
	});

	it("hält die Serialization-Module ausschließlich in Serialization", () => {
		expect(
			readdirSync(path.join(sourceRoot, "serialization")).sort((a, b) =>
				a.localeCompare(b),
			),
		).toEqual(serializationModules);
		for (const module of serializationModules) {
			expect(existsSync(path.join(sourceRoot, "domain", module)), module).toBe(
				false,
			);
		}
	});

	it("hält Game-Hydrierung und fachliche Game-Werte ausschließlich in Domain", () => {
		expect(
			existsSync(path.join(sourceRoot, "domain", "gameValidation.ts")),
		).toBe(true);
		expect(
			existsSync(path.join(sourceRoot, "serialization", "gameHydration.ts")),
		).toBe(false);
	});

	it("entfernt updatedAt vollständig aus Domain und Dateiformaten", () => {
		const files = [
			["domain", "gameDraft.ts"],
			["domain", "gameFactory.ts"],
			["domain", "gameValidation.ts"],
			["domain", "libraryContainerRepair.ts"],
			["serialization", "gameDocument.ts"],
			["serialization", "gameExport.ts"],
			["serialization", "libraryDocument.ts"],
			["serialization", "libraryRepair.ts"],
			["serialization", "librarySerializer.ts"],
			["persistence", "gameObjectPersistence.ts"],
			["persistence", "ruleSetObjectPersistence.ts"],
			["application", "internal", "defaultScenarioImportService.ts"],
		];
		for (const segments of files) {
			const source = readFileSync(path.join(sourceRoot, ...segments), "utf8");
			expect(source, segments.join("/")).not.toContain("updatedAt");
		}
	});

	it("zentralisiert gültige und kollisionsfreie IDs in der Domain", () => {
		const sanitizer = readFileSync(
			path.join(sourceRoot, "domain", "stringSanitizer.ts"),
			"utf8",
		);
		const gameServices = [
			"defaultGameManagementService.ts",
			"defaultGameSaveService.ts",
			"defaultGameTemplateService.ts",
			"defaultGameImportService.ts",
			"pendingGameSaveWorkflow.ts",
		]
			.map((file) =>
				readFileSync(
					path.join(sourceRoot, "application", "internal", file),
					"utf8",
				),
			)
			.join("\n");
		const scenarioImport = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultScenarioImportService.ts",
			),
			"utf8",
		);
		const scenarioEditor = readFileSync(
			path.join(sourceRoot, "application", "scenarioEditor.ts"),
			"utf8",
		);

		expect(sanitizer).toContain("export function createIdCandidateFromName(");
		expect(sanitizer).toContain("export function normalizeId(");
		expect(sanitizer).toContain("export function findAvailableId(");
		expect(sanitizer).toContain("export function createNameFromNameAndId(");
		expect(sanitizer).toContain("export function createUniqueId(");
		expect(sanitizer).toContain("export function createUniqueIdFromName(");
		expect(sanitizer).toContain("export function createUniqueNameAndId(");
		for (const source of [gameServices, scenarioImport, scenarioEditor]) {
			expect(source).toContain("createUniqueNameAndId");
			expect(source).not.toMatch(/for \(let copyNumber/u);
		}

		const idOrchestrationConsumers = [
			["domain", "gameEditing.ts"],
			["domain", "gameIdRepair.ts"],
			["domain", "libraryContainerRepair.ts"],
			["domain", "ruleSetRepair.ts"],
			["persistence", "internalDataFileNameRepair.ts"],
		];
		for (const segments of idOrchestrationConsumers) {
			const source = readFileSync(path.join(sourceRoot, ...segments), "utf8");
			expect(source, segments.join("/")).toContain("createUniqueId");
			expect(source, segments.join("/")).not.toContain("findAvailableId");
		}

		const gameEntityIds = readFileSync(
			path.join(sourceRoot, "domain", "gameEntityIds.ts"),
			"utf8",
		);
		expect(gameEntityIds).toContain("createUniqueGameEntityIdFromName");
		expect(gameEntityIds).toContain("createUniqueGameEntityIdFromId");
	});

	it("trennt Spielvorbereitung von Persistence und ihrem Präsentationsmodell", () => {
		const preparationService = readFileSync(
			path.join(sourceRoot, "application", "gamePreparationService.ts"),
			"utf8",
		);
		const presentation = readFileSync(
			path.join(sourceRoot, "application", "gamePreparationPresentation.ts"),
			"utf8",
		);
		const useCases = readFileSync(
			path.join(sourceRoot, "application", "internal", "createGameUseCases.ts"),
			"utf8",
		);
		expect(
			existsSync(path.join(sourceRoot, "application", "gamePreparation.ts")),
		).toBe(false);
		expect(preparationService).toContain("createGameFromRuleSet({");
		expect(preparationService).toContain("assignRandomRolesByTeamCounts(");
		expect(preparationService).toContain("assignRandomRolesByRoleCounts(");
		expect(presentation).toContain("createRoleDistributionModel(");
		expect(presentation).not.toMatch(
			/createGameFromRuleSet|assignRandomRolesByTeamCounts|assignRandomRolesByRoleCounts|sanitizeText/u,
		);
		expect(useCases).toContain(
			"preparation: new GamePreparationService(domainServices)",
		);
	});

	it("trennt Library-Struktur, Reparaturorchestrierung und RuleSet-Reparatur", () => {
		const serializationRepair = readFileSync(
			path.join(sourceRoot, "serialization", "libraryRepair.ts"),
			"utf8",
		);
		const containerRepair = readFileSync(
			path.join(sourceRoot, "domain", "libraryContainerRepair.ts"),
			"utf8",
		);
		const persistenceRepair = readFileSync(
			path.join(sourceRoot, "persistence", "ruleSetObjectPersistence.ts"),
			"utf8",
		);
		const domainRepair = readFileSync(
			path.join(sourceRoot, "domain", "ruleSetRepair.ts"),
			"utf8",
		);
		const gameRepair = readFileSync(
			path.join(sourceRoot, "domain", "gameIdRepair.ts"),
			"utf8",
		);

		expect(serializationRepair).toContain("recoverLibraryStructure");
		expect(serializationRepair).not.toMatch(/\.\.\/domain|repairRuleSet/u);
		expect(serializationRepair).not.toMatch(/new Date|toISOString/u);
		expect(containerRepair).toMatch(
			/import \{[^}]*repairRuleSet[^}]*\} from "\.\/ruleSetRepair"/u,
		);
		expect(containerRepair).not.toContain("recoverLibraryStructure");
		expect(containerRepair).toContain("repairRuleSet(candidate");
		expect(persistenceRepair).toContain("parseRepairableJsonBytes(");
		expect(persistenceRepair).toContain("recoverLibraryStructure(");
		expect(persistenceRepair).toContain("repairRecoveredLibrary(");
		expect(domainRepair).not.toMatch(/usedRuleSetIds|storedId/u);
		expect(gameRepair).toContain('repairRuleSet } from "./ruleSetRepair"');
		expect(gameRepair).toContain("repairRuleSet(game.ruleSetSnapshot");
	});

	it("führt Game-Laden und -Import über die typisierte Pipeline", () => {
		const gameImport = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameImportService.ts",
			),
			"utf8",
		);
		const load = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameLoadService.ts",
			),
			"utf8",
		);
		const loadGame = load.slice(
			load.indexOf("async loadGame("),
			load.indexOf("\n}", load.indexOf("async loadGame(")),
		);
		const importGame = gameImport;
		const persistence = readFileSync(
			path.join(sourceRoot, "persistence", "gameObjectPersistence.ts"),
			"utf8",
		);
		const persistenceTransfer = readFileSync(
			path.join(sourceRoot, "persistence", "objectTransferPersistence.ts"),
			"utf8",
		);

		expect(loadGame).toContain("this.#persistence.read.loadObject(");
		expect(loadGame).toContain('"game",');
		expect(loadGame).not.toMatch(/as GameState/u);
		expect(persistence).toContain("decodeCurrentGameDocument");
		expect(persistence).toContain("hydrateGameState(decoded)");
		expect(importGame).toContain("this.#persistence.transfer.importObject(");
		expect(importGame).not.toContain("decodeCurrentGameDocument");
		expect(importGame).not.toContain("repairGameDocument");
		expect(importGame).toContain("const document = imported.object");
		expect(persistenceTransfer).toContain("translateSerializationError(() =>");
		expect(persistenceTransfer).toContain("decodeScenarioDocument(source)");
		expect(persistenceTransfer).toContain(
			"const object = createImportedGameObject(decoded.document)",
		);
		expect(persistenceTransfer).toContain("repairGameDraft(document)");
		expect(persistenceTransfer).toContain("hydrateGameState(repaired.draft)");
		expect(importGame).not.toContain('importObject(selection, "game")');
		expect(importGame).not.toMatch(/as (?:unknown as )?GameState/u);
	});

	it("erkennt Rohszenarien ausschließlich in Serialization", () => {
		const scenarioImport = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultScenarioImportService.ts",
			),
			"utf8",
		);
		const editor = readFileSync(
			path.join(sourceRoot, "application", "scenarioEditor.ts"),
			"utf8",
		);
		const decoder = readFileSync(
			path.join(sourceRoot, "serialization", "scenarioDocument.ts"),
			"utf8",
		);
		const persistence = readFileSync(
			path.join(sourceRoot, "persistence", "objectTransferPersistence.ts"),
			"utf8",
		);

		expect(scenarioImport).toContain("this.transfer.importObject(");
		expect(scenarioImport).not.toContain("decodeScenarioDocument");
		expect(scenarioImport).not.toContain("importRuleSetDocument");
		expect(scenarioImport).not.toContain("repairGameDocument");
		expect(persistence).toContain("decodeScenarioDocument(source)");
		expect(persistence).toContain(
			"createRuleSetFromDraft(decoded.document).ruleSet",
		);
		expect(scenarioImport).not.toMatch(
			/isRuleSetImportCandidate|hydrateGameInput/u,
		);
		expect(editor).not.toContain("isHydratedGameState");
		expect(editor).toContain("document: GameState");
		expect(editor).not.toContain("GameDocument");
		expect(editor).not.toContain("fromTemplateDocument");
		expect(editor).not.toContain("fromGameDocument");
		expect(editor).not.toContain("../domain/clock");
		expect(editor).not.toContain("constructor(clock");
		expect(editor).not.toContain("void clock");
		expect(editor).not.toContain("../serialization/");
		expect(decoder).toContain("decodeRuleSetDocument(candidate)");
		expect(decoder).toContain("decodeCurrentGameDocument(candidate)");
	});

	it("zentralisiert Game- und Template-Reparatur in Domain", () => {
		const source = readFileSync(
			path.join(sourceRoot, "domain", "gameRepair.ts"),
			"utf8",
		);
		expect(source).toContain("value: GameDraft");
		expect(source).not.toContain("decodeCurrentGameDocument");
		expect(source).toContain("repairGameDraft(value)");
		expect(source).toContain("hydrateGameState(repaired.draft)");
		expect(source).toContain("repairIds(document)");
		expect(source).not.toMatch(/storage|DataFile|serialization/u);

		const applicationRepairImports = readImports().filter(
			(entry) =>
				entry.file.startsWith("application/") &&
				entry.specifier.endsWith("domain/gameIdRepair"),
		);
		expect(formatImports(applicationRepairImports)).toEqual([]);
		const directDraftRepairCalls = listSourceFiles(
			path.join(sourceRoot, "application"),
		)
			.filter((file) =>
				/\brepairGameDraft\s*\(/u.test(readFileSync(file, "utf8")),
			)
			.map((file) => normalizePath(path.relative(sourceRoot, file)));
		expect(directDraftRepairCalls).toEqual([]);
	});

	it("führt Game-Speichern und -Export über Persistence", () => {
		const management = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameManagementService.ts",
			),
			"utf8",
		);
		const save = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameSaveService.ts",
			),
			"utf8",
		);
		const template = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameTemplateService.ts",
			),
			"utf8",
		);
		const writeGame = management.slice(
			management.indexOf("private async writeGameDocument("),
		);
		const exportGame = management.slice(
			management.indexOf("async exportSavedGame("),
			management.indexOf(
				"\n\tasync deleteSavedGame(",
				management.indexOf("async exportSavedGame("),
			),
		);
		const persistence = readFileSync(
			path.join(sourceRoot, "persistence", "gameObjectPersistence.ts"),
			"utf8",
		);

		expect(writeGame).toContain("this.#writer.saveObject(document, options)");
		expect(save).toContain("this.writer.saveObject(snapshot.game.document");
		expect(save).toContain("this.writer.saveObject(renamedDocument");
		expect(template).toContain("this.writer.saveObject(result.template");
		const applicationSaving = [management, save, template].join("\n");
		expect(applicationSaving).not.toContain("prepareGameSave");
		expect(applicationSaving).not.toContain("savePreparedGame");
		expect(applicationSaving).not.toContain("saveGameAt");
		expect(applicationSaving).not.toContain("parseInternalDocumentFileName");
		expect(exportGame).toContain("this.#persistence.read.loadObject(");
		expect(exportGame).toContain("this.#persistence.transfer.exportObject(");
		expect(exportGame).not.toContain("encodeGameExportDocument");
		expect(persistence).toContain("hydrateGameState(document)");
		expect(persistence).toContain("encodeGameExportDocument(validated)");
	});

	it("hält den Game-Exportserializer frei von fachlicher Validierung", () => {
		const serializer = readFileSync(
			path.join(sourceRoot, "serialization", "gameExport.ts"),
			"utf8",
		);
		expect(serializer).not.toMatch(
			/hydrateGameState|repairIds|isIdForArea|Number\.isInteger|new Set/u,
		);
	});

	it("führt Library-Lesen, -Import und -Schreiben über Persistence", () => {
		const scenarioImport = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultScenarioImportService.ts",
			),
			"utf8",
		);
		const browse = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultLibraryBrowseService.ts",
			),
			"utf8",
		);
		const management = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultScenarioManagementService.ts",
			),
			"utf8",
		);
		const backup = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultLibraryBackupService.ts",
			),
			"utf8",
		);
		const recovery = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultLibraryRecoveryService.ts",
			),
			"utf8",
		);
		const serializer = readFileSync(
			path.join(sourceRoot, "serialization", "librarySerializer.ts"),
			"utf8",
		);
		const persistence = readFileSync(
			path.join(sourceRoot, "persistence", "ruleSetObjectPersistence.ts"),
			"utf8",
		);

		expect(scenarioImport).not.toMatch(
			/decodeCurrentLibraryDocument|decodeCurrentLibraryCandidates|encodeLibraryDocument|encodeLibraryFragments|createLibraryRuleSetJson|parseJsonWithDetails|\bRuleSetLibraryCache\b|\bCachedRuleSet\b/u,
		);
		expect(persistence).toContain("decodeCurrentLibraryCandidates");
		expect(persistence).toContain('candidate.status === "invalid"');
		expect(persistence).toContain(
			"discardedRuleSetIds.push(candidate.recordId)",
		);
		const libraryDecoder = readFileSync(
			path.join(sourceRoot, "serialization", "libraryDocument.ts"),
			"utf8",
		);
		expect(libraryDecoder).toContain("decodeCurrentLibraryCandidates");
		expect(libraryDecoder).not.toMatch(
			/decodeCurrentLibraryRestore|discardedRuleSetIds|discardInvalidRuleSets/u,
		);
		expect(persistence).toContain("encodeLibraryCandidateFragments");
		expect(recovery).toContain(
			'this.recovery.createEmptyObjectStore("ruleSet"',
		);
		expect(backup).toContain("this.transfer.prepareObjectStoreRestore(");
		expect(browse).toContain("this.read.readAllObjectsOfType(");
		expect(management).toContain("this.write.replaceObject(");
		expect(scenarioImport).not.toMatch(
			/replaceStoredGameObject|replaceRuleSetObject/u,
		);
		expect(backup).toContain("this.transfer.exportObjectStore(");
		expect(recovery).toContain("this.recovery.inspectObjectStoreRecovery(");
		expect(persistence).toContain(
			"async loadLibrary(ansiFallbackLocale: string)",
		);
		expect(persistence).toContain("decodeLibraryBytes(bytes");
		expect(persistence).toContain("validateLibraryBytes(");
		expect(persistence).toContain("#usingTemporaryCache");
		expect(scenarioImport).not.toContain("usingTemporaryEmptyLibrary");
		const cacheEncoder = persistence.slice(
			persistence.indexOf("function encodeLibraryCache("),
			persistence.indexOf(
				"\nfunction requireLibraryBytes(",
				persistence.indexOf("function encodeLibraryCache("),
			),
		);
		expect(cacheEncoder).not.toContain("parseCachedRuleSet");
		expect(scenarioImport).not.toContain("InvalidStoredRuleSetError");
		expect(serializer).not.toMatch(
			/importRuleSetFromUnknown|assertRuleSet|Number\.isInteger|new Set/u,
		);
	});

	it("führt Game-Listen technisch über Persistence", () => {
		const source = readFileSync(
			path.join(sourceRoot, "application", "internal", "gameCatalog.ts"),
			"utf8",
		);
		const recoveryService = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameRecoveryService.ts",
			),
			"utf8",
		);
		const persistence = readFileSync(
			path.join(sourceRoot, "persistence", "gameObjectPersistence.ts"),
			"utf8",
		);
		const objectReadPort = readFileSync(
			path.join(sourceRoot, "persistence", "ports", "objectReadPort.ts"),
			"utf8",
		);
		const listObjects = source.slice(
			source.indexOf("async listObjects<"),
			source.indexOf(
				"\n\tclearBrowseCache(",
				source.indexOf("async listObjects<"),
			),
		);
		const objectProblemService = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultObjectReadProblemService.ts",
			),
			"utf8",
		);
		const persistenceFileNameRepair = persistence.slice(
			persistence.indexOf("async repairObjectFileName("),
			persistence.indexOf(
				"\n\tasync replaceObject(",
				persistence.indexOf("async repairObjectFileName("),
			),
		);
		const recoveryValidation = recoveryService.slice(
			recoveryService.indexOf("async listWriteRecoveries("),
			recoveryService.indexOf(
				"\n\tasync resolveWriteRecovery(",
				recoveryService.indexOf("async listWriteRecoveries("),
			),
		);
		const persistenceValidation = persistence.slice(
			persistence.indexOf("validateObjectBytes("),
			persistence.indexOf(
				"\n\tclearCache(",
				persistence.indexOf("validateObjectBytes("),
			),
		);

		expect(listObjects).toContain(
			"this.#persistence.read.readAllObjectsOfType(kind, {",
		);
		expect(listObjects).toContain("createApplicationObjectListResult");
		expect(source).not.toContain("result.metadata");
		expect(source).toContain("result.ids");
		expect(source).not.toContain("getObjectReadProblems(");
		expect(source).not.toContain("getStoredObjectIds(");
		expect(source).not.toContain("getStoredDocumentProblems(");
		expect(objectReadPort).not.toContain("clearObjectCache(");
		expect(persistence).not.toContain("#metadataResults");
		expect(listObjects).not.toContain("decodeStoredGameState");
		expect(listObjects).not.toContain("createSavedGameSummary");
		expect(persistence).toContain("this.storage.readAllInternal(kind)");
		expect(persistence).toContain("decodeListedObject");
		expect(persistence).toContain("createGameObjectMetadata");
		expect(recoveryValidation).toContain(
			"this.#writeRecovery.listWriteRecoveries({",
		);
		expect(objectProblemService).toContain(
			"this.persistence.repairObjectReadProblem(",
		);
		expect(objectProblemService).toContain("ansiFallbackLocale: language");
		expect(objectProblemService).not.toContain("decodeCurrentGameDocument");
		expect(objectProblemService).not.toContain("parseJsonWithDetails");
		expect(persistenceFileNameRepair).toContain(
			"decodeCurrentGameDocument(versioned)",
		);
		expect(persistenceFileNameRepair).toContain(
			"repairGameDocument(decoded, problem.kind)",
		);
		expect(persistenceFileNameRepair).not.toMatch(
			/as (?:unknown as )?GameState/u,
		);
		expect(persistenceValidation).toContain(
			"this.decodeObject(bytes, expectedId, kind, ansiFallbackLocale)",
		);
		expect(source).not.toContain("#readStoredDocument");
		expect(source).not.toContain("function decodeStoredGameState(");
		expect(source).not.toContain("function validateStoredGameBytes(");
		expect(source).not.toContain("function assertStoredGameDocument(");
	});

	it("veröffentlicht validierte Game-Typen außerhalb des internen Servicekerns", () => {
		const gameTypes = readFileSync(
			path.join(sourceRoot, "application", "gameTypes.ts"),
			"utf8",
		);
		const useCases = readFileSync(
			path.join(sourceRoot, "application", "gameUseCaseContracts.ts"),
			"utf8",
		);
		const guiSources = ["App.tsx", "NewGameScreen.tsx"].map((file) =>
			readFileSync(path.join(sourceRoot, "gui", file), "utf8"),
		);

		expect(gameTypes).toContain("document: GameState");
		expect(useCases).toContain('from "./gameTypes"');
		expect(useCases).not.toMatch(
			/type LoadedGameDocument[\s\S]*internal\/gameServiceCore/u,
		);
		expect(gameTypes).toContain("document: GameState;");
		for (const guiSource of guiSources)
			expect(guiSource).not.toContain("document as GameState");
	});

	it("entfernt die abgelöste Game-Übergangsinfrastruktur vollständig", () => {
		const sources = listSourceFiles(sourceRoot).map((file) => ({
			file: normalizePath(path.relative(sourceRoot, file)),
			text: readFileSync(file, "utf8"),
		}));
		const obsoleteSymbols = [
			"assertGameDocumentStructure",
			"initializeGameRoleUnicodeSymbols",
			"assertStoredGameDocument",
			"readSavedGameSummary",
		];

		for (const symbol of obsoleteSymbols) {
			expect(
				sources
					.filter(({ text }) => text.includes(symbol))
					.map(({ file }) => file),
				symbol,
			).toEqual([]);
		}

		const management = sources.find(
			({ file }) =>
				file === "application/internal/defaultGameManagementService.ts",
		)?.text;
		expect(management).toBeDefined();
		expect(management).toContain("document: GameState,");
		expect(management).not.toMatch(
			/#writeGameDocument\(\s*id: string,\s*document: unknown|#writeDocument\(\s*id: string,\s*document: unknown/u,
		);
		expect(management).not.toContain("JSON.parse(");
		expect(management).not.toContain("parseJsonWithDetails");
	});

	it("lässt Serialization ausschließlich sich selbst und Domain importieren", () => {
		const forbidden = readImports().filter(
			(entry) =>
				entry.file.startsWith("serialization/") &&
				(isExternalImport(entry.specifier) ||
					!isSourceLayerImport(entry, ["serialization", "domain", "shared"])),
		);
		expect(formatImports(forbidden)).toEqual([]);
	});

	it("erzwingt die zweistufige Bereinigung externen JSON-Texts", () => {
		const encoding = readFileSync(
			path.join(sourceRoot, "serialization", "jsonEncoding.ts"),
			"utf8",
		);
		const parser = readFileSync(
			path.join(sourceRoot, "serialization", "jsonSyntaxError.ts"),
			"utf8",
		);
		const sources = listSourceFiles(sourceRoot)
			.map((file) => readFileSync(file, "utf8"))
			.join("\n");

		expect(encoding).toContain(
			"sanitizeText(text, { preserveLineBreaks: true })",
		);
		expect(parser).toContain("sanitizeParsedText");
		expect(parser).not.toContain("lastIndexOf");
		expect(sources).not.toContain("sanitizeString");
	});

	it("liefert bei externen Importen ausschließlich Domainobjekte", () => {
		expect(
			existsSync(path.join(sourceRoot, "application", "ruleSetImport.ts")),
		).toBe(false);

		const types = readFileSync(
			path.join(sourceRoot, "persistence", "objectPersistenceTypes.ts"),
			"utf8",
		);
		expect(types).toContain("export type ImportedObject =");
		expect(types).toContain('kind: "ruleSet"');
		expect(types).toContain('kind: "game"');
		expect(types).toContain('kind: "template"');
		expect(types).toContain("object: RuleSet");
		expect(types).toContain("object: GameState");
		expect(types).toContain("sourceMetadata: ImportSourceMetadata");
		expect(types).not.toContain("GameDocument");
		expect(types).not.toContain("ScenarioDocument");
		expect(types).not.toContain("source: unknown");

		const domainValidation = readFileSync(
			path.join(sourceRoot, "domain", "ruleSetValidation.ts"),
			"utf8",
		);
		expect(domainValidation).not.toMatch(
			/\bunknown\b|\btypeof\b|Array\.isArray|\bisRecord\b/u,
		);
	});

	it("hält den RuleSet-Exportserializer frei von fachlicher Validierung", () => {
		expect(
			formatImports(
				readImports().filter(
					(entry) => entry.file === "serialization/ruleSetExport.ts",
				),
			),
		).toEqual([
			"serialization/ruleSetExport.ts -> ../domain/ruleSet",
			"serialization/ruleSetExport.ts -> ./jsonEncoding",
			"serialization/ruleSetExport.ts -> ./ruleSetDocument",
		]);
		const serializer = readFileSync(
			path.join(sourceRoot, "serialization", "ruleSetExport.ts"),
			"utf8",
		);
		expect(serializer).not.toMatch(
			/assertRuleSetExportable|ruleSetValidation|isIdForArea|Number\.isInteger|new Set|charCodeAt/u,
		);
		const persistence = readFileSync(
			path.join(sourceRoot, "persistence", "ruleSetObjectPersistence.ts"),
			"utf8",
		);
		expect(persistence).toContain("assertRuleSetExportable(ruleSet)");
		expect(
			persistence.indexOf("assertRuleSetExportable(ruleSet)"),
		).toBeLessThan(persistence.indexOf("encodeRuleSetExportDocument(ruleSet)"));
	});

	it("hält technische Zeichenkodierung aus Application heraus", () => {
		const offenders = listSourceFiles(path.join(sourceRoot, "application"))
			.filter((file) =>
				/\bText(?:En|De)coder\b/u.test(readFileSync(file, "utf8")),
			)
			.map((file) => normalizePath(path.relative(sourceRoot, file)));

		expect(offenders).toEqual([]);
	});

	it("trennt das Laden einer Vorlage von ihrer fachlichen Umwandlung", () => {
		expect(
			existsSync(path.join(sourceRoot, "application", "templateImport.ts")),
		).toBe(false);
		expect(
			existsSync(path.join(sourceRoot, "serialization", "templateImport.ts")),
		).toBe(false);

		const core = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameLoadService.ts",
			),
			"utf8",
		);
		const createGameFromTemplate = core.slice(
			core.indexOf("async createGameFromTemplate("),
			core.indexOf(
				"\n\tasync loadTemplateDocument(",
				core.indexOf("async createGameFromTemplate("),
			),
		);
		expect(createGameFromTemplate).toContain(
			'this.#persistence.read.loadObject("template"',
		);
		expect(createGameFromTemplate).toContain("executeApplicationOperation(");
		expect(createGameFromTemplate).toContain("convertTemplateToGame(template)");
		expect(createGameFromTemplate).not.toContain("#readStoredDocument");
		expect(createGameFromTemplate).not.toContain("decodeCurrentGameDocument");
	});

	it("lässt nur Persistence Serialization verwenden", () => {
		const consumers = readImports().filter(
			(entry) =>
				!entry.file.startsWith("serialization/") &&
				resolveRelativeSourceImport(entry)?.startsWith("serialization/"),
		);
		const forbidden = consumers.filter(
			(entry) => !entry.file.startsWith("persistence/"),
		);
		expect(formatImports(forbidden)).toEqual([]);
	});

	it("hält Serialization frei von technischen Laufzeit-APIs", () => {
		const forbiddenPatterns = [
			/\bglobalThis\s*\.\s*(?:fetch|localStorage|sessionStorage|indexedDB|navigator|document|window)\b/u,
			/\b(?:window|navigator|localStorage|sessionStorage|indexedDB)\s*\./u,
			/\bnew\s+(?:FileReader|Worker|WebSocket)\b/u,
			/\b(?:process|Deno)\s*\./u,
		];
		const violations = listSourceFiles(path.join(sourceRoot, "serialization"))
			.flatMap((absoluteFile) => {
				const source = readFileSync(absoluteFile, "utf8");
				return forbiddenPatterns.some((pattern) => pattern.test(source))
					? [normalizePath(path.relative(sourceRoot, absoluteFile))]
					: [];
			})
			.sort();
		expect(violations).toEqual([]);
	});

	it("hält die Recovery-Aufbereitung ausschließlich in Application", () => {
		for (const file of recoveryInfrastructureFiles) {
			expect(existsSync(path.join(sourceRoot, "application", file)), file).toBe(
				true,
			);
			expect(existsSync(path.join(sourceRoot, "domain", file)), file).toBe(
				false,
			);
		}
	});

	it("verwendet Persistence-Dateinamenfunktionen ohne Application-Weiterleitung", () => {
		expect(
			existsSync(
				path.join(sourceRoot, "application", "internalDataFileName.ts"),
			),
		).toBe(false);
		expect(
			existsSync(
				path.join(sourceRoot, "application", "internalDataFileNameRepair.ts"),
			),
		).toBe(false);
		expect(
			existsSync(
				path.join(sourceRoot, "persistence", "internalDocumentFileName.ts"),
			),
		).toBe(true);
		expect(
			existsSync(
				path.join(sourceRoot, "persistence", "internalDataFileNameRepair.ts"),
			),
		).toBe(true);
		const consumers = readImports().filter((entry) =>
			entry.specifier.endsWith("/internalDocumentFileName"),
		);
		expect(
			formatImports(consumers).every(
				(entry) =>
					entry.includes("-> ../../persistence/internalDocumentFileName") ||
					entry.startsWith("persistence/"),
			),
		).toBe(true);
	});

	it("hält Präsentationsmodelle ausschließlich in Application", () => {
		for (const file of presentationModelFiles) {
			expect(existsSync(path.join(sourceRoot, "application", file)), file).toBe(
				true,
			);
			expect(existsSync(path.join(sourceRoot, "domain", file)), file).toBe(
				false,
			);
		}
	});

	it("hält das Speichern der Rollen-Zeigeliste in Domain", () => {
		const applicationPresentation = readFileSync(
			path.join(sourceRoot, "application", "rolesForShowing.ts"),
			"utf8",
		);
		const domainEditing = readFileSync(
			path.join(sourceRoot, "domain", "gameRolesForShowing.ts"),
			"utf8",
		);
		const gameSessionService = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameSessionService.ts",
			),
			"utf8",
		);

		expect(applicationPresentation).not.toContain(
			"function saveRolesForShowing",
		);
		expect(domainEditing).toContain("export function saveRolesForShowing");
		expect(gameSessionService).toContain(
			'from "../../domain/gameRolesForShowing"',
		);
	});

	it("hält die Spielbildschirm-Präsentation frei von GameState-Mutationen", () => {
		const presentation = readFileSync(
			path.join(sourceRoot, "application", "gameScreenPresentation.ts"),
			"utf8",
		);
		const gameSessionService = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameSessionService.ts",
			),
			"utf8",
		);
		const editing = readFileSync(
			path.join(sourceRoot, "domain", "gameEditing.ts"),
			"utf8",
		);
		const formerApplicationMutations = [
			"applySeatOrderPresentationAction",
			"assignGamePlayerToEmptySeat",
			"createGamePlayerAtEmptySeat",
			"createGameSeatStatus",
			"deleteEmptyGameSeat",
			"moveGameSeatPlayerToSeat",
			"updateGameSeatPlayerName",
			"updateGameSeatRole",
			"updateGameSeatStatus",
		];

		for (const mutation of formerApplicationMutations)
			expect(presentation, mutation).not.toContain(mutation);
		expect(presentation).not.toMatch(
			/createUniqueGameEntityId|Player\.create|sanitizeText|updatedAt/u,
		);
		expect(gameSessionService).toContain('from "../../domain/gameEditing"');
		expect(editing).toContain("export function moveSeat");
		expect(editing).toContain("export function savePlayer");
		expect(editing).not.toContain("command.player.id");
	});

	it("begrenzt Sitzmeldungen der GUI auf MoveSeatCommand und SavePlayerCommand", () => {
		const screen = readFileSync(
			path.join(sourceRoot, "gui", "GameScreen.tsx"),
			"utf8",
		);
		const session = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameSessionService.ts",
			),
			"utf8",
		);
		const formerCallbacks = [
			"onRoleChange",
			"onNameChange",
			"onSeatChange",
			"onAssignPlayerToEmptySeat",
			"onCreatePlayerAtEmptySeat",
			"onCreateStatus",
			"onUpdateStatus",
		];
		const formerApplicationMethods = [
			"updateLoadedGameSeatOrder",
			"updateLoadedPlayerRole",
			"updateLoadedPlayerName",
			"moveLoadedPlayerToSeat",
			"assignLoadedPlayerToEmptySeat",
			"createLoadedPlayerAtEmptySeat",
			"createLoadedPlayerStatus",
			"updateLoadedPlayerStatus",
		];

		expect(screen).toContain("onMoveSeat: (command: MoveSeatCommand)");
		expect(screen).toContain("onSavePlayer: (command: SavePlayerCommand)");
		for (const callback of formerCallbacks)
			expect(screen, callback).not.toContain(callback);
		for (const method of formerApplicationMethods)
			expect(session, method).not.toContain(method);
		expect(session).toContain("moveLoadedSeat(command: MoveSeatCommand)");
		expect(session).toContain("saveLoadedPlayer(command: SavePlayerCommand)");
	});

	it("hält die fachliche Szenario-Umbenennung vollständig in Domain", () => {
		const gameServices = [
			"defaultGameManagementService.ts",
			"defaultGameSaveService.ts",
			"defaultGameTemplateService.ts",
			"defaultGameImportService.ts",
			"defaultGameLoadService.ts",
			"pendingGameSaveWorkflow.ts",
		]
			.map((file) =>
				readFileSync(
					path.join(sourceRoot, "application", "internal", file),
					"utf8",
				),
			)
			.join("\n");
		const scenarioImport = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultScenarioImportService.ts",
			),
			"utf8",
		);
		const scenarioManagement = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultScenarioManagementService.ts",
			),
			"utf8",
		);
		const renaming = readFileSync(
			path.join(sourceRoot, "domain", "scenarioRenaming.ts"),
			"utf8",
		);

		expect(renaming).toContain("export function renameGame");
		expect(renaming).toContain("export function renameTemplate");
		expect(renaming).toContain("export function renameRuleSet");
		expect(gameServices).toContain('from "../../domain/scenarioRenaming"');
		expect(scenarioImport).toContain('from "../../domain/scenarioRenaming"');
		expect(scenarioManagement).toContain(
			'from "../../domain/scenarioRenaming"',
		);
		expect(scenarioImport).not.toContain("renamed as RuleSet");
		expect(scenarioImport).not.toContain("createIdFromText");
		expect(scenarioManagement).not.toContain("createIdFromText");
	});

	it("hält GUI-Anwendungszustand und Editor ausschließlich in Application", () => {
		for (const file of guiApplicationFiles) {
			expect(existsSync(path.join(sourceRoot, "application", file)), file).toBe(
				true,
			);
			expect(existsSync(path.join(sourceRoot, "domain", file)), file).toBe(
				false,
			);
		}
	});

	it("hält die kleinen plattformunabhängigen Services ausschließlich in Application", () => {
		expect(
			readdirSync(path.join(sourceRoot, "application"))
				.filter((entry) => entry.endsWith(".ts"))
				.sort((a, b) => a.localeCompare(b)),
		).toEqual(applicationServices);
		for (const service of applicationServices) {
			expect(
				existsSync(path.join(sourceRoot, "domain", service)),
				service,
			).toBe(false);
		}
	});

	it("hält die anwendungsnahen Verträge unter application/ports", () => {
		expect(
			readdirSync(path.join(sourceRoot, "application", "ports")).sort((a, b) =>
				a.localeCompare(b),
			),
		).toEqual(applicationPorts);
		for (const port of applicationPorts) {
			expect(existsSync(path.join(sourceRoot, "domain", port)), port).toBe(
				false,
			);
		}
	});

	it("hält die technischen Dateiverträge unter persistence/ports", () => {
		expect(
			readdirSync(path.join(sourceRoot, "persistence", "ports")).sort((a, b) =>
				a.localeCompare(b),
			),
		).toEqual(persistencePorts);
		for (const port of persistencePorts) {
			expect(
				existsSync(path.join(sourceRoot, "application", "ports", port)),
			).toBe(false);
			expect(existsSync(path.join(sourceRoot, "domain", port)), port).toBe(
				false,
			);
		}
	});

	it("teilt den Application-facing Persistence-Vertrag nach Fähigkeiten auf", () => {
		const capabilities = readFileSync(
			path.join(
				sourceRoot,
				"persistence",
				"ports",
				"objectPersistenceCapabilities.ts",
			),
			"utf8",
		);
		for (const capability of [
			"ObjectReadPort",
			"ObjectWritePort",
			"ObjectTransferPort",
			"ObjectRecoveryPort",
		]) {
			expect(capabilities).toContain(capability);
		}
		expect(
			existsSync(
				path.join(
					sourceRoot,
					"persistence",
					"ports",
					"objectPersistencePort.ts",
				),
			),
		).toBe(false);
		expect(capabilities).not.toContain("toObjectPersistenceCapabilities");
		const ruleSetExport = readFileSync(
			path.join(sourceRoot, "application", "ruleSetExportService.ts"),
			"utf8",
		);
		expect(ruleSetExport).toContain("ObjectTransferPort");
		expect(ruleSetExport).not.toContain("ObjectPersistencePort");
	});

	it("erzeugt getrennte Persistence-Implementierungen in einer zentralen Factory", () => {
		const factory = readFileSync(
			path.join(sourceRoot, "persistence", "objectPersistence.ts"),
			"utf8",
		);
		const implementations = [
			["Read", "objectReadPersistence.ts", "ObjectReadPort"],
			["Write", "objectWritePersistence.ts", "ObjectWritePort"],
			["Transfer", "objectTransferPersistence.ts", "ObjectTransferPort"],
			["Recovery", "objectRecoveryPersistence.ts", "ObjectRecoveryPort"],
		] as const;

		for (const [name, file, port] of implementations) {
			const implementation = readFileSync(
				path.join(sourceRoot, "persistence", file),
				"utf8",
			);
			expect(factory).toContain(`new Object${name}Persistence(`);
			expect(implementation).toContain(
				`class Object${name}Persistence implements ${port}`,
			);
			expect(implementation).not.toMatch(
				/from "\.\/object(?:Read|Write|Transfer|Recovery)Persistence"/u,
			);
		}
		for (const capability of ["read", "write", "transfer", "recovery"]) {
			expect(factory).toMatch(new RegExp(`\\b${capability}(?::|,)`, "u"));
		}
		expect(factory).toContain("export function createObjectPersistence(");
		expect(factory).toContain("maintenance:");
		expect(factory).not.toContain("class ObjectPersistence");
		expect(factory).not.toContain("implements ObjectPersistencePort");
		expect(factory).not.toContain("translateStorageWriteError");
		expect(factory).not.toContain("decodeScenarioDocument");
		expect(factory).not.toContain("repairGameDraft");
		expect(factory).not.toContain("continueInternalCommand.bind");
	});

	it("deklariert technische DataFileStorage-Fähigkeiten als eigene Ports", () => {
		const dataFilePorts = readFileSync(
			path.join(sourceRoot, "persistence", "ports", "dataFileStorage.ts"),
			"utf8",
		);
		const recoveryPort = readFileSync(
			path.join(sourceRoot, "persistence", "ports", "storageRecovery.ts"),
			"utf8",
		);
		for (const capability of [
			"InternalDataFileReadPort",
			"InternalDataFileWritePort",
			"ExternalDataFileReadPort",
			"ExternalDataFileWritePort",
			"InternalStorageCommandPort",
		]) {
			expect(dataFilePorts).toContain(`interface ${capability}`);
		}
		expect(dataFilePorts).toContain("export type DataFileStorage =");
		expect(dataFilePorts).not.toContain("export interface DataFileStorage");
		expect(recoveryPort).not.toMatch(
			/\b(?:listRecoveries|requestRecovery)\?\(/u,
		);

		const browser = readFileSync(
			path.join(sourceRoot, "storage", "browserDataFileStorage.ts"),
			"utf8",
		);
		const capacitor = readFileSync(
			path.join(sourceRoot, "storage", "capacitorDataFileStorage.ts"),
			"utf8",
		);
		const dev = readFileSync(
			path.join(sourceRoot, "storage", "dataFileStorage.dev.ts"),
			"utf8",
		);
		expect(browser).toContain("ExternalDataFileReadPort");
		expect(browser).toContain("ExternalDataFileWritePort");
		expect(browser).toContain("StorageRecoveryPort");
		expect(capacitor).toContain("ExternalDataFileReadPort");
		expect(capacitor).toContain("ExternalDataFileWritePort");
		expect(capacitor).toContain("StorageRecoveryPort");
		expect(capacitor).toContain("InternalStorageCommandPort");
		expect(dev).toContain("StorageRecoveryPort");
	});

	it("definiert technische Dateigrundtypen nur einmal", () => {
		const commonTypes = readFileSync(
			path.join(sourceRoot, "persistence", "ports", "dataFileTypes.ts"),
			"utf8",
		);
		const recoveryPort = readFileSync(
			path.join(sourceRoot, "persistence", "ports", "storageRecovery.ts"),
			"utf8",
		);
		const commandPort = readFileSync(
			path.join(sourceRoot, "persistence", "ports", "storageCommand.ts"),
			"utf8",
		);
		expect(commonTypes).toContain("export const DATA_FILE_CATEGORIES");
		expect(commonTypes).toContain("export type DataFileCategory");
		expect(commonTypes).toContain("export type DataFileReference");
		expect(commonTypes).toContain("export type StandaloneDataFileCategory");
		expect(recoveryPort).toContain(
			"StorageRecoveryCandidate = DataFileReference",
		);
		expect(recoveryPort).not.toContain(
			'category: "library" | "template" | "game"',
		);
		expect(commandPort).toContain("file: DataFileReference");
		expect(commandPort).not.toContain("fileName: string");
	});

	it("verwendet für Read-Fehler ausschließlich StorageFailure", () => {
		const dataFileStorage = readFileSync(
			path.join(sourceRoot, "persistence", "ports", "dataFileStorage.ts"),
			"utf8",
		);
		expect(dataFileStorage).toContain(
			'| { status: "error"; error: StorageFailure }',
		);
		expect(dataFileStorage).not.toContain('{ status: "notFound" }');
		expect(dataFileStorage).not.toContain('{ status: "unreadable"');
		expect(dataFileStorage).not.toContain('{ status: "storageUnavailable"');
	});

	it("bezieht Zeit und neue IDs ausschließlich über Domain-Verträge", () => {
		const domainRepair = readFileSync(
			path.join(sourceRoot, "domain", "libraryContainerRepair.ts"),
			"utf8",
		);
		const scenarioImport = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultScenarioImportService.ts",
			),
			"utf8",
		);
		const systemClock = readFileSync(
			path.join(sourceRoot, "platform", "systemClock.ts"),
			"utf8",
		);

		expect(domainRepair).not.toMatch(/new Date/u);
		expect(scenarioImport).not.toMatch(/new Date/u);
		expect(scenarioImport).not.toContain("this.domainServices.clock.now()");
		expect(scenarioImport).toContain(
			"this.domainServices.idGenerator.createId",
		);
		expect(systemClock).toContain("implements Clock");
		expect(systemClock).toContain("createInstant(new Date().toISOString())");

		const forbiddenDomainRuntimeAccess = listSourceFiles(
			path.join(sourceRoot, "domain"),
		)
			.filter((file) =>
				/\b(?:Date\.now|globalThis\.crypto|crypto\.randomUUID)\b|new Date\(\)/u.test(
					readFileSync(file, "utf8"),
				),
			)
			.map((file) => normalizePath(path.relative(sourceRoot, file)));
		expect(forbiddenDomainRuntimeAccess).toEqual([]);
	});

	it("bindet die GUI bei schichtübergreifenden Code-Importen ausschließlich an Application", () => {
		const forbidden = readImports().filter(
			(entry) =>
				entry.file.startsWith("gui/") &&
				((entry.specifier.startsWith("../") &&
					!entry.specifier.startsWith("../application/") &&
					!entry.specifier.startsWith("../shared/") &&
					entry.specifier !== "../../LICENSE?raw" &&
					entry.specifier !== "../../THIRD_PARTY_LICENSES.txt?raw") ||
					entry.specifier.startsWith("@capacitor/")),
		);
		expect(formatImports(forbidden)).toEqual([]);
	});

	it("lässt Application nur nach innen und auf globale Konfiguration zugreifen", () => {
		const forbidden = readImports().filter(
			(entry) =>
				entry.file.startsWith("application/") &&
				(/^(?:\.\.\/)+(?:gui|storage|platform)\//u.test(entry.specifier) ||
					isExternalImport(entry.specifier)),
		);
		expect(formatImports(forbidden)).toEqual([]);
	});

	it("hält Persistence frei von Application-Abhängigkeiten", () => {
		const forbidden = readImports().filter(
			(entry) =>
				entry.file.startsWith("persistence/") &&
				resolveRelativeSourceImport(entry)?.startsWith("application/"),
		);
		expect(formatImports(forbidden)).toEqual([]);
	});

	it("übergibt den ANSI-Fallback explizit und lokalisiert Metadaten erst in Application", () => {
		const persistenceConfigImports = readImports().filter(
			(entry) =>
				entry.file.startsWith("persistence/") &&
				resolveRelativeSourceImport(entry) === "config",
		);
		expect(formatImports(persistenceConfigImports)).toEqual([]);

		const publicTypes = readFileSync(
			path.join(sourceRoot, "persistence", "objectPersistenceTypes.ts"),
			"utf8",
		);
		const internalTypes = readFileSync(
			path.join(sourceRoot, "persistence", "objectPersistenceInternalTypes.ts"),
			"utf8",
		);
		const objectListMapper = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"applicationObjectListMapper.ts",
			),
			"utf8",
		);
		const ports = [
			"objectReadPort.ts",
			"objectWritePort.ts",
			"objectTransferPort.ts",
			"objectRecoveryPort.ts",
		]
			.map((file) =>
				readFileSync(
					path.join(sourceRoot, "persistence", "ports", file),
					"utf8",
				),
			)
			.join("\n");

		expect(publicTypes).toContain("export type ObjectDecodingOptions");
		expect(publicTypes).toContain("ansiFallbackLocale: string");
		expect(publicTypes).toContain("names?: Record<string, string>");
		expect(publicTypes).toContain("ruleSetNames?: Record<string, string>");
		expect(internalTypes).not.toContain("language:");
		expect(ports).toContain("ObjectDecodingOptions");
		expect(objectListMapper).toContain("getDisplayName");
		expect(objectListMapper).toContain("language: string");
	});

	it("veröffentlicht Persistence-DTOs unabhängig von Implementierungsklassen", () => {
		const concreteModules = new Set([
			"persistence/gameObjectPersistence",
			"persistence/ruleSetObjectPersistence",
		]);
		const concreteConsumers = readImports().filter((entry) => {
			const resolved = resolveRelativeSourceImport(entry);
			return resolved !== undefined && concreteModules.has(resolved);
		});
		expect(formatImports(concreteConsumers)).toEqual([
			"persistence/objectPersistence.ts -> ./gameObjectPersistence",
			"persistence/objectPersistence.ts -> ./ruleSetObjectPersistence",
			"persistence/objectReadPersistence.ts -> ./gameObjectPersistence",
			"persistence/objectReadPersistence.ts -> ./ruleSetObjectPersistence",
			"persistence/objectRecoveryPersistence.ts -> ./gameObjectPersistence",
			"persistence/objectRecoveryPersistence.ts -> ./ruleSetObjectPersistence",
			"persistence/objectSaveWorkflow.ts -> ./gameObjectPersistence",
			"persistence/objectTransferPersistence.ts -> ./gameObjectPersistence",
			"persistence/objectTransferPersistence.ts -> ./ruleSetObjectPersistence",
			"persistence/objectWritePersistence.ts -> ./gameObjectPersistence",
			"persistence/objectWritePersistence.ts -> ./ruleSetObjectPersistence",
		]);

		const port = readFileSync(
			path.join(sourceRoot, "persistence", "ports", "objectReadPort.ts"),
			"utf8",
		);
		const gameTypes = readFileSync(
			path.join(sourceRoot, "application", "gameTypes.ts"),
			"utf8",
		);
		const publicTypes = readFileSync(
			path.join(sourceRoot, "persistence", "objectPersistenceTypes.ts"),
			"utf8",
		);
		const internalTypes = readFileSync(
			path.join(sourceRoot, "persistence", "objectPersistenceInternalTypes.ts"),
			"utf8",
		);
		expect(port).toContain('from "../objectPersistenceTypes"');
		expect(gameTypes).toContain('from "./objectList"');
		expect(publicTypes).not.toMatch(
			/LibraryRuleSetJson|LibraryDocumentMetadata|RuleSetLibraryCache|CachedRuleSet|ImportedRuleSetLibrary|RuleSetLibraryRecoverySources|InternalFileNameRepairResult/u,
		);
		expect(internalTypes).toMatch(
			/RuleSetLibraryCache|CachedRuleSet|ImportedRuleSetLibrary|RuleSetLibraryRecoverySources|InternalFileNameRepairResult/u,
		);
		const forbiddenInternalTypeConsumers = readImports().filter(
			(entry) =>
				resolveRelativeSourceImport(entry) ===
					"persistence/objectPersistenceInternalTypes" &&
				!entry.file.startsWith("persistence/"),
		);
		expect(formatImports(forbiddenInternalTypeConsumers)).toEqual([]);
		for (const relativeModule of concreteModules) {
			const relativeFile = `${relativeModule}.ts`;
			const source = readFileSync(path.join(sourceRoot, relativeFile), "utf8");
			expect(source, relativeFile).not.toMatch(/^export type /mu);
		}
	});

	it("kapselt die technische Objektlöschung in Persistence", () => {
		const types = readFileSync(
			path.join(sourceRoot, "persistence", "objectPersistenceTypes.ts"),
			"utf8",
		);
		const port = ["objectWritePort.ts", "objectRecoveryPort.ts"]
			.map((file) =>
				readFileSync(
					path.join(sourceRoot, "persistence", "ports", file),
					"utf8",
				),
			)
			.join("\n");
		const facade = readFileSync(
			path.join(sourceRoot, "persistence", "objectPersistence.ts"),
			"utf8",
		);
		const gamePersistence = readFileSync(
			path.join(sourceRoot, "persistence", "gameObjectPersistence.ts"),
			"utf8",
		);
		const ruleSetPersistence = readFileSync(
			path.join(sourceRoot, "persistence", "ruleSetObjectPersistence.ts"),
			"utf8",
		);
		const gameManagement = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameManagementService.ts",
			),
			"utf8",
		);
		const scenarioManagement = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultScenarioManagementService.ts",
			),
			"utf8",
		);
		const deleteSavedGame = gameManagement.slice(
			gameManagement.indexOf("async deleteSavedGame("),
			gameManagement.indexOf(
				"\n\tprivate async writeGameDocument(",
				gameManagement.indexOf("async deleteSavedGame("),
			),
		);
		const objectProblemService = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultObjectReadProblemService.ts",
			),
			"utf8",
		);
		const deleteScenario = scenarioManagement.slice(
			scenarioManagement.indexOf("async deleteScenario("),
		);

		expect(types).toContain("export type PersistedObjectReference =");
		expect(types).toContain("export type GameObjectReadProblem =");
		expect(types).toContain("kind: PersistedGameObjectKind");
		expect(types).toContain("storageKey: string");
		expect(types).not.toContain("invalidFileName?:");
		expect(types).toContain('kind: "ruleSet"');
		expect(types).toContain("kind: PersistedGameObjectKind");
		expect(port).toContain("deleteObject(");
		expect(port).toContain("reference: PersistedObjectReference");
		expect(port).toContain("decoding: ObjectDecodingOptions");
		expect(port).toContain(
			"problem: ObjectReadProblem,\n\t\toptions: ObjectDecodingOptions,",
		);
		const writePersistence = readFileSync(
			path.join(sourceRoot, "persistence", "objectWritePersistence.ts"),
			"utf8",
		);
		expect(facade).toContain("const write = new ObjectWritePersistence(");
		expect(writePersistence).toContain('reference.kind === "ruleSet"');
		expect(gamePersistence).toContain("this.storage.deleteInternal(");
		expect(gamePersistence).toMatch(
			/fileName: `\$\{problem\.storageKey\}\.json`/u,
		);
		expect(ruleSetPersistence).toContain("cache.ruleSetsById.delete(id)");
		expect(objectProblemService).toContain(
			"this.persistence.deleteObjectReadProblem(problem, {",
		);
		expect(objectProblemService).not.toContain("deleteInternal");
		expect(deleteSavedGame).toContain("this.#persistence.write.deleteObject(");
		expect(deleteSavedGame).not.toContain("deleteInternal");
		expect(deleteScenario).toContain("this.write.deleteObject(");
		expect(deleteScenario).not.toContain("deleteInternal");
	});

	it("implementiert Library-Browse und Szenarioverwaltung in eigenständigen Services", () => {
		const useCases = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"createLibraryUseCases.ts",
			),
			"utf8",
		);
		const browse = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultLibraryBrowseService.ts",
			),
			"utf8",
		);
		const management = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultScenarioManagementService.ts",
			),
			"utf8",
		);
		expect(useCases).toContain(
			"const browse = new DefaultLibraryBrowseService(objectPersistence.read)",
		);
		expect(useCases).toContain("new DefaultScenarioManagementService(");
		expect(useCases).toContain(
			"browse: bindMethods(protectedBrowse, browseMethods)",
		);
		expect(browse).toContain(
			"export class DefaultLibraryBrowseService implements LibraryBrowseService",
		);
		expect(management).toContain(
			"export class DefaultScenarioManagementService",
		);
		expect(management).toContain("implements ScenarioManagementService");
		expect(browse).toContain("private readonly read: ObjectReadPort");
		expect(management).toContain("private readonly write: ObjectWritePort");
		expect(management).toContain(
			"private readonly transfer: ObjectTransferPort",
		);
		expect(browse).not.toContain("LibraryServiceCore");
		expect(management).not.toContain("LibraryServiceCore");
	});

	it("implementiert Library-Recovery und Backup in eigenständigen Services", () => {
		const useCases = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"createLibraryUseCases.ts",
			),
			"utf8",
		);
		const recovery = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultLibraryRecoveryService.ts",
			),
			"utf8",
		);
		const backup = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultLibraryBackupService.ts",
			),
			"utf8",
		);
		expect(useCases).toContain(
			"const backup = new DefaultLibraryBackupService(objectPersistence.transfer)",
		);
		expect(useCases).toContain("new DefaultLibraryRecoveryService(");
		expect(useCases).toContain(
			"backup: bindMethods(protectedBackup, backupMethods)",
		);
		expect(recovery).toContain("export class DefaultLibraryRecoveryService");
		expect(recovery).toContain("implements LibraryRecoveryService");
		expect(backup).toContain("export class DefaultLibraryBackupService");
		expect(backup).toContain("implements LibraryBackupService");
		expect(recovery).toContain("private readonly read: ObjectReadPort");
		expect(recovery).toContain("private readonly recovery: ObjectRecoveryPort");
		expect(backup).toContain("private readonly transfer: ObjectTransferPort");
		expect(backup).toContain("readonly #pendingRestores");
		expect(recovery).not.toContain("LibraryServiceCore");
		expect(backup).not.toContain("LibraryServiceCore");
	});

	it("implementiert den Szenarioimport ohne gemeinsamen Library-Kern", () => {
		const useCases = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"createLibraryUseCases.ts",
			),
			"utf8",
		);
		const scenarioImport = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultScenarioImportService.ts",
			),
			"utf8",
		);

		expect(useCases).toContain(
			"const scenarioImport = new DefaultScenarioImportService(",
		);
		expect(useCases).toContain(
			"import: bindMethods(protectedImport, importMethods)",
		);
		expect(scenarioImport).toContain(
			"export class DefaultScenarioImportService implements ScenarioImportService",
		);
		for (const [field, port] of [
			["read", "ObjectReadPort"],
			["objectWriter", "ApplicationObjectWriter"],
			["transfer", "ObjectTransferPort"],
			["recovery", "ObjectRecoveryPort"],
		])
			expect(scenarioImport).toContain(`private readonly ${field}: ${port}`);
		expect(scenarioImport).toContain("readonly #pendingImports");
		expect(scenarioImport).not.toContain("LibraryServiceCore");
		expect(
			existsSync(
				path.join(
					sourceRoot,
					"application",
					"internal",
					"libraryServiceCore.ts",
				),
			),
		).toBe(false);
	});

	it("übergibt Application direkt das Persistence-Capability-Bundle", () => {
		for (const relativeFile of [
			"application/internal/createGameUseCases.ts",
			"application/internal/createLibraryUseCases.ts",
		]) {
			const source = readFileSync(path.join(sourceRoot, relativeFile), "utf8");
			expect(source, relativeFile).toContain("ObjectPersistenceCapabilities");
			expect(source, relativeFile).not.toContain("ObjectPersistencePort");
			expect(source, relativeFile).not.toContain(
				"toObjectPersistenceCapabilities",
			);
			expect(source, relativeFile).not.toContain("DataFileStorage");
			expect(source, relativeFile).not.toContain("createObjectPersistence");
		}
		const gameApplicationServices = [
			"gameCatalog.ts",
			"defaultGameLoadService.ts",
			"defaultGameManagementService.ts",
			"defaultGameRecoveryService.ts",
			"defaultGameSaveService.ts",
			"defaultGameTemplateService.ts",
			"defaultGameImportService.ts",
			"pendingGameSaveWorkflow.ts",
		]
			.map((file) =>
				readFileSync(
					path.join(sourceRoot, "application", "internal", file),
					"utf8",
				),
			)
			.join("\n");
		for (const capability of ["read", "write", "transfer", "recovery"])
			expect(gameApplicationServices).toContain(
				`this.#persistence.${capability}.`,
			);
		const aggregateConsumers = readImports().filter(
			(entry) =>
				resolveRelativeSourceImport(entry) ===
				"persistence/ports/objectPersistencePort",
		);
		expect(formatImports(aggregateConsumers)).toEqual([]);

		const bootstrap = readFileSync(
			path.join(sourceRoot, "bootstrapApplication.tsx"),
			"utf8",
		);
		expect(bootstrap.match(/createObjectPersistence\(/gu)).toHaveLength(1);
		expect(bootstrap).toContain(
			"createGameUseCases(objectPersistence, domainServices)",
		);
		expect(bootstrap).toContain("createLibraryUseCases(");
		expect(bootstrap).toContain("objectPersistence,");
		expect(bootstrap).toContain(
			"objectPersistence.maintenance.repairInternalDataFileNames()",
		);
		expect(bootstrap).toContain("objectPersistence.transfer,");
	});

	it("orchestriert externe Importe und Exporte ausschließlich in Persistence", () => {
		const applicationFiles = listSourceFiles(
			path.join(sourceRoot, "application"),
		);
		const directExternalAccess = applicationFiles
			.filter((file) =>
				/\.(?:readExternal|writeExternal)\b/u.test(readFileSync(file, "utf8")),
			)
			.map((file) => normalizePath(path.relative(sourceRoot, file)));
		expect(directExternalAccess).toEqual([]);

		const port = readFileSync(
			path.join(sourceRoot, "persistence", "ports", "objectTransferPort.ts"),
			"utf8",
		);
		expect(port).not.toContain("DataFileStorage");
		expect(port).not.toContain("readExternal");
		expect(port).not.toContain("writeExternal");
		expect(port).toContain("importObject(");
		expect(port).toContain("exportObject(");
		expect(port).toContain("prepareObjectStoreRestore(");
		expect(port).toContain("resolveObjectStoreRestore(");
		expect(port).toContain("exportObjectStore(");
		expect(port).not.toMatch(/RuleSetLibraryRestore|RuleSetLibrary/u);
		expect(port).not.toMatch(
			/\bRuleSetLibraryCache\b|decodeRuleSetLibraryBytes|writeRecoveredRuleSetLibrary|writeRuleSetLibrary|replaceRuleSetLibraryCache/u,
		);
	});

	it("trennt Application-facing Persistence-Capabilities vollständig von DataFileStorage", () => {
		const port = objectCapabilityPorts
			.map((file) =>
				readFileSync(
					path.join(sourceRoot, "persistence", "ports", file),
					"utf8",
				),
			)
			.join("\n");
		expect(port).not.toContain("DataFileStorage");
		expect(port).not.toMatch(
			/\b(?:readInternal|writeInternal|deleteInternal|renameInternal|listInternalFiles|listInternalFileNames|readAllInternal)\b/u,
		);

		const applicationFiles = listSourceFiles(
			path.join(sourceRoot, "application"),
		);
		const directInternalAccess = applicationFiles
			.filter((file) =>
				/#objectPersistence\.(?:readInternal|writeInternal|deleteInternal|renameInternal|listInternalFiles|listInternalFileNames|readAllInternal)\b/u.test(
					readFileSync(file, "utf8"),
				),
			)
			.map((file) => normalizePath(path.relative(sourceRoot, file)));
		expect(directInternalAccess).toEqual([]);
		expect(port).toContain("findLatestStoredGame(");
		expect(port).toContain("exportObjectReadProblem(");
		expect(port).toContain("replaceObject(");
		expect(port).toContain("storageVariant?: string");
		expect(port).not.toMatch(/replaceStoredGameObject|replaceRuleSetObject/u);
		expect(port).not.toContain("validateObjectBytes(");
		expect(port).not.toContain("repairInternalDataFileNames(");
		expect(port).not.toContain("cachedText");
	});

	it("übersetzt Low-Level-Schreibfehler an der Persistence-Grenze", () => {
		const applicationImports = readImports().filter(
			(entry) =>
				entry.file.startsWith("application/") &&
				entry.specifier.includes("dataFileStorage"),
		);
		expect(formatImports(applicationImports)).toEqual([]);

		const persistence = [
			"objectWritePersistence.ts",
			"objectTransferPersistence.ts",
			"objectRecoveryPersistence.ts",
			"storageWriteErrorTranslation.ts",
		]
			.map((file) =>
				readFileSync(path.join(sourceRoot, "persistence", file), "utf8"),
			)
			.join("\n");
		const applicationCore = [
			"defaultGameImportService.ts",
			"pendingGameSaveWorkflow.ts",
		]
			.map((file) =>
				readFileSync(
					path.join(sourceRoot, "application", "internal", file),
					"utf8",
				),
			)
			.join("\n");
		const applicationRecovery = readFileSync(
			path.join(sourceRoot, "application", "storageRecovery.ts"),
			"utf8",
		);
		expect(persistence).toContain("translateStorageWriteError");
		expect(persistence).toContain("new ObjectSaveInterruptedError(");
		expect(applicationCore).toContain("isObjectSaveInterruptedError");
		expect(applicationRecovery).toContain("isObjectSaveInterruptedError");
		expect(applicationCore).not.toContain("isRecoverableStorageWriteError");
		expect(applicationRecovery).not.toContain("isRecoverableStorageWriteError");
	});

	it("unterscheidet Storage- und Serialization-Fehler in Persistence", () => {
		const hierarchy = readFileSync(
			path.join(sourceRoot, "persistence", "objectPersistenceError.ts"),
			"utf8",
		);
		const interruptedSave = readFileSync(
			path.join(sourceRoot, "persistence", "objectSaveInterruptedError.ts"),
			"utf8",
		);
		const serializationFailure = readFileSync(
			path.join(sourceRoot, "serialization", "serializationFailure.ts"),
			"utf8",
		);
		const domainFailure = readFileSync(
			path.join(sourceRoot, "domain", "domainFailure.ts"),
			"utf8",
		);
		const scenarioPresentation = readFileSync(
			path.join(sourceRoot, "application", "scenarioPresentation.ts"),
			"utf8",
		);
		expect(hierarchy).toContain(
			"export abstract class ObjectPersistenceError extends Error",
		);
		expect(hierarchy).toContain(
			"export class ObjectStorageError extends ObjectPersistenceError",
		);
		expect(hierarchy).toContain(
			"export class ObjectSerializationError extends ObjectPersistenceError",
		);
		expect(hierarchy).toContain("export type ObjectStorageProblemReason =");
		expect(hierarchy).toContain(
			"export type ObjectSerializationProblemReason =",
		);
		expect(hierarchy).toContain("export type ObjectPersistenceProblemReason =");
		expect(
			existsSync(
				path.join(sourceRoot, "application", "documentLoadProblem.ts"),
			),
		).toBe(false);
		expect(hierarchy).toContain("getObjectPersistenceProblemReason");
		expect(interruptedSave).toContain("extends ObjectStorageError");
		expect(serializationFailure).toContain("repairable: boolean");
		expect(domainFailure).toContain("export type DomainFailure =");
		expect(domainFailure).toContain("repairable: boolean");
		expect(
			readFileSync(
				path.join(sourceRoot, "persistence", "objectPersistenceTypes.ts"),
				"utf8",
			),
		).not.toContain("RuleSetLibraryReadError");
		expect(scenarioPresentation).toContain("isObjectSerializationError");
		expect(scenarioPresentation).not.toContain("JsonSyntaxError");
		expect(scenarioPresentation).not.toContain("../serialization/");
	});

	it("kapselt technische Recovery-Aufrufe in Persistence", () => {
		const applicationFiles = listSourceFiles(
			path.join(sourceRoot, "application"),
		);
		const directRecoveryAccess = applicationFiles
			.filter((file) =>
				/\.(?:listRecoveries|requestRecovery|continueInternalCommand)\b/u.test(
					readFileSync(file, "utf8"),
				),
			)
			.map((file) => normalizePath(path.relative(sourceRoot, file)));
		expect(directRecoveryAccess).toEqual([]);

		const port = readFileSync(
			path.join(sourceRoot, "persistence", "ports", "objectRecoveryPort.ts"),
			"utf8",
		);
		const persistenceTypes = readFileSync(
			path.join(sourceRoot, "persistence", "objectPersistenceTypes.ts"),
			"utf8",
		);
		const applicationStoragePortImports = readImports().filter(
			(entry) =>
				entry.file.startsWith("application/") &&
				(resolveRelativeSourceImport(entry) ===
					"persistence/ports/storageRecovery" ||
					resolveRelativeSourceImport(entry) ===
						"persistence/ports/storageCommand"),
		);
		expect(formatImports(applicationStoragePortImports)).toEqual([]);
		expect(port).toContain("prepareWriteRecoveries(");
		expect(port).toContain("resolveWriteRecovery(");
		expect(port).toContain("finishStorageCommand(");
		expect(port).toContain("continueObjectSave(");
		expect(port).toContain("inspectObjectStoreRecovery(");
		expect(port).toContain("repairObjectStore(");
		expect(port).toContain("options: ObjectDecodingOptions");
		expect(port).toContain("createEmptyObjectStore(");
		expect(port).not.toMatch(/RuleSetLibraryRecovery|RepairedRuleSetLibrary/u);
		expect(port).not.toContain("now: Instant");
		expect(port).not.toContain("prepareGameSave(");
		expect(port).not.toContain("savePreparedGame(");
		expect(port).not.toContain("saveGameAt(");
		expect(port).not.toContain("DataFileWriteOptions");
		expect(port).not.toContain("StorageRecoveryResolution");
		expect(port).not.toContain("StorageCommandDecision");
		expect(persistenceTypes).not.toContain("DataFileWriteOptions");
		expect(persistenceTypes).toContain("export type ObjectRecoverySource");
		expect(persistenceTypes).toContain("export type ObjectRecoveryResolution");
		expect(persistenceTypes).toContain(
			"export type ObjectSaveContinuationDecision",
		);
		expect(persistenceTypes).not.toContain('from "./ports/storageRecovery"');
		expect(persistenceTypes).not.toContain('from "./ports/storageCommand"');
	});

	it("hält die Application-facing Persistence-Capabilities frei von ungenutzten Methoden", () => {
		const port = objectCapabilityPorts
			.map((file) =>
				readFileSync(
					path.join(sourceRoot, "persistence", "ports", file),
					"utf8",
				),
			)
			.join("\n");
		const methodNames = new Set(
			[...port.matchAll(/^\s*([A-Za-z]\w*)\s*\(/gmu)].map((match) => match[1]),
		);
		const applicationSource = listSourceFiles(
			path.join(sourceRoot, "application"),
		)
			.map((file) => readFileSync(file, "utf8"))
			.join("\n");
		const unusedMethods = [...methodNames].filter(
			(methodName) =>
				!applicationSource.includes(`.${methodName}(`) &&
				!applicationSource.includes(`.${methodName}\n`),
		);

		expect(unusedMethods).toEqual([]);
	});

	it("beschränkt Storage auf technische Persistence- und Application-Verträge", () => {
		const forbidden = readImports().filter(
			(entry) =>
				entry.file.startsWith("storage/") &&
				(entry.specifier.startsWith("../domain/") ||
					entry.specifier.startsWith("../gui/") ||
					entry.specifier.startsWith("../platform/") ||
					entry.specifier === "../config" ||
					(entry.specifier.startsWith("../persistence/") &&
						!entry.specifier.startsWith("../persistence/ports/")) ||
					(entry.specifier.startsWith("../application/") &&
						!allowedStorageApplicationModules.has(entry.specifier))),
		);
		expect(formatImports(forbidden)).toEqual([]);
	});

	it("beschränkt Platform auf technische Verträge und eigene Adapter", () => {
		const forbidden = readImports().filter(
			(entry) =>
				entry.file.startsWith("platform/") &&
				((entry.specifier.startsWith("../domain/") &&
					!allowedPlatformDomainModules.has(entry.specifier)) ||
					entry.specifier.startsWith("../gui/") ||
					entry.specifier.startsWith("../storage/") ||
					entry.specifier === "../config" ||
					(entry.specifier.startsWith("../application/") &&
						!entry.specifier.startsWith("../application/ports/"))),
		);
		expect(formatImports(forbidden)).toEqual([]);
	});

	it("trennt Einstiegspunkt und einzigen Composition Root", () => {
		expect(existsSync(path.join(sourceRoot, "main.tsx"))).toBe(true);
		expect(existsSync(path.join(sourceRoot, "bootstrapApplication.tsx"))).toBe(
			true,
		);
		expect(existsSync(path.join(sourceRoot, "gui", "main.tsx"))).toBe(false);
		const forbidden = readImports().filter(
			(entry) =>
				entry.file !== "bootstrapApplication.tsx" &&
				!entry.file.startsWith("gui/") &&
				!entry.file.startsWith("storage/") &&
				!entry.file.startsWith("platform/") &&
				(entry.specifier.startsWith("./gui/") ||
					entry.specifier.startsWith("../gui/") ||
					entry.specifier.startsWith("./storage/") ||
					entry.specifier.startsWith("../storage/") ||
					entry.specifier.startsWith("./platform/") ||
					entry.specifier.startsWith("../platform/")),
		);
		expect(formatImports(forbidden)).toEqual([]);
		const main = readFileSync(path.join(sourceRoot, "main.tsx"), "utf8");
		expect(main).toContain(
			'import { bootstrapApplication } from "./bootstrapApplication";',
		);
		expect(main).toContain("void bootstrapApplication();");
		const rootImports = readImports().filter(
			(entry) => entry.file === "bootstrapApplication.tsx",
		);
		expect(
			rootImports.some((entry) => entry.specifier.startsWith("./gui/")),
		).toBe(true);
		expect(
			rootImports.some((entry) => entry.specifier.startsWith("./application/")),
		).toBe(true);
		expect(
			rootImports.some((entry) => entry.specifier.startsWith("./storage/")),
		).toBe(true);
		expect(
			rootImports.some((entry) => entry.specifier.startsWith("./platform/")),
		).toBe(true);
	});

	it("orchestriert den RuleSet-Export technisch in Persistence", () => {
		const serializerConsumers = readImports().filter((entry) =>
			entry.specifier.endsWith("/ruleSetExport"),
		);
		expect(formatImports(serializerConsumers)).toEqual([
			"persistence/ruleSetObjectPersistence.ts -> ../serialization/ruleSetExport",
			"serialization/gameExport.ts -> ./ruleSetExport",
			"serialization/librarySerializer.ts -> ./ruleSetExport",
		]);
		const applicationExport = readFileSync(
			path.join(sourceRoot, "application", "ruleSetExportService.ts"),
			"utf8",
		);
		expect(applicationExport).toContain("this.#persistence.exportObject(");
		expect(applicationExport).not.toContain("encodeRuleSetExportDocument");
		expect(
			formatImports(readImports()).some(
				(entry) =>
					entry ===
					"gui/ScenarioLibrary.tsx -> ../application/ruleSetExportService",
			),
		).toBe(true);
	});

	it("entfernt den abgelösten gemeinsamen Library-Kern vollständig", () => {
		const internalConsumers = readImports().filter((entry) =>
			entry.specifier.includes("internal/libraryServiceCore"),
		);
		expect(formatImports(internalConsumers)).toEqual([]);
		expect(
			existsSync(
				path.join(
					sourceRoot,
					"application",
					"internal",
					"libraryServiceCore.ts",
				),
			),
		).toBe(false);
	});

	it("hält konkrete Library-Serviceimplementierungen hinter öffentlichen Interfaces intern", () => {
		const useCases = readFileSync(
			path.join(sourceRoot, "application", "libraryUseCaseContracts.ts"),
			"utf8",
		);
		for (const contract of [
			"LibraryBrowseService",
			"ScenarioImportService",
			"ScenarioManagementService",
			"LibraryBackupService",
			"LibraryRecoveryService",
		])
			expect(useCases).toContain(`export interface ${contract}`);
		expect(useCases).not.toMatch(/export class (?:Library|Scenario).+Service/u);

		const implementationConsumers = readImports().filter((entry) =>
			/(?:defaultLibrary|defaultScenario)/u.test(entry.specifier),
		);
		expect(formatImports(implementationConsumers)).toEqual([
			"application/internal/createLibraryUseCases.ts -> ./defaultLibraryBackupService",
			"application/internal/createLibraryUseCases.ts -> ./defaultLibraryBrowseService",
			"application/internal/createLibraryUseCases.ts -> ./defaultLibraryRecoveryService",
			"application/internal/createLibraryUseCases.ts -> ./defaultScenarioImportService",
			"application/internal/createLibraryUseCases.ts -> ./defaultScenarioManagementService",
		]);

		for (const formerFile of [
			"libraryBackupService.ts",
			"libraryBrowseService.ts",
			"libraryRecoveryService.ts",
			"scenarioImportService.ts",
			"scenarioManagementService.ts",
		])
			expect(existsSync(path.join(sourceRoot, "application", formerFile))).toBe(
				false,
			);
	});

	it("trennt öffentliche Application-Typen von interner Übersetzung", () => {
		const errorContract = readFileSync(
			path.join(sourceRoot, "application", "applicationError.ts"),
			"utf8",
		);
		const errorMapping = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"applicationErrorMapping.ts",
			),
			"utf8",
		);
		const exportContract = readFileSync(
			path.join(sourceRoot, "application", "exportTypes.ts"),
			"utf8",
		);
		const exportMapping = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"exportResultMapping.ts",
			),
			"utf8",
		);
		const objectListContract = readFileSync(
			path.join(sourceRoot, "application", "objectList.ts"),
			"utf8",
		);
		const objectListMapping = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"applicationObjectListMapper.ts",
			),
			"utf8",
		);

		expect(errorContract).toContain("export class ApplicationOperationError");
		expect(errorContract).not.toContain("executeApplicationOperation");
		expect(errorContract).not.toContain("isObjectStorageError");
		expect(errorMapping).toContain(
			"export async function executeApplicationOperation",
		);
		expect(errorMapping).toContain("isObjectStorageError");

		expect(exportContract).toContain("export type ApplicationExportResult");
		expect(exportContract).not.toContain("ObjectExportResult");
		expect(exportContract).not.toContain("exportOptionsFromDecision");
		expect(exportMapping).toContain("exportOptionsFromDecision");
		expect(exportMapping).toContain("toApplicationExportResult");

		expect(objectListContract).toContain(
			"export type ApplicationObjectListResult",
		);
		expect(objectListContract).not.toContain(
			"createApplicationObjectListResult",
		);
		expect(objectListContract).not.toContain("getDisplayName");
		expect(objectListMapping).toContain(
			"export function createApplicationObjectListResult",
		);
		expect(objectListMapping).toContain("getDisplayName");
	});

	it("hält Fehleranzeige in der GUI und Reparaturdarstellung intern", () => {
		expect(
			existsSync(
				path.join(
					sourceRoot,
					"application",
					"internal",
					"libraryPersistenceProblemPresentation.ts",
				),
			),
		).toBe(false);
		expect(
			existsSync(
				path.join(sourceRoot, "gui", "applicationFailurePresentation.ts"),
			),
		).toBe(true);
		expect(
			existsSync(
				path.join(
					sourceRoot,
					"application",
					"internal",
					"libraryRepairPresentation.ts",
				),
			),
		).toBe(true);
	});

	it("trennt öffentliche Use-Case-Verträge von ihrer internen Verdrahtung", () => {
		const gameContract = readFileSync(
			path.join(sourceRoot, "application", "gameUseCaseContracts.ts"),
			"utf8",
		);
		const libraryContract = readFileSync(
			path.join(sourceRoot, "application", "libraryUseCaseContracts.ts"),
			"utf8",
		);
		const gameFacade = readFileSync(
			path.join(sourceRoot, "application", "gameUseCases.ts"),
			"utf8",
		);
		const libraryFacade = readFileSync(
			path.join(sourceRoot, "application", "libraryUseCases.ts"),
			"utf8",
		);
		const gameFactory = readFileSync(
			path.join(sourceRoot, "application", "internal", "createGameUseCases.ts"),
			"utf8",
		);
		const libraryFactory = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"createLibraryUseCases.ts",
			),
			"utf8",
		);

		expect(gameContract).toContain("export type GameUseCases = {");
		expect(gameContract).not.toContain("ReturnType<");
		expect(gameFacade).toContain('export type * from "./gameUseCaseContracts"');
		expect(gameFacade).toContain(
			'export { createGameUseCases } from "./internal/createGameUseCases"',
		);
		expect(libraryFacade).toContain(
			'export type * from "./libraryUseCaseContracts"',
		);
		expect(libraryFacade).toContain(
			'export { createLibraryUseCases } from "./internal/createLibraryUseCases"',
		);
		for (const contract of [gameContract, libraryContract]) {
			expect(contract).not.toContain("bindMethods(");
			expect(contract).not.toMatch(/new Default[A-Z]/u);
		}
		expect(gameFactory).toContain("export function createGameUseCases(");
		expect(gameFactory).toContain("const sessionMethods = [");
		expect(libraryFactory).toContain("export function createLibraryUseCases(");
		expect(libraryFactory).toContain("const browseMethods = [");
		const internalFacadeConsumers = readImports().filter(
			(entry) =>
				entry.file.startsWith("application/internal/") &&
				/(?:game|library)UseCases$/u.test(entry.specifier),
		);
		expect(formatImports(internalFacadeConsumers)).toEqual([]);

		const bindingConsumers = readImports().filter((entry) =>
			entry.specifier.endsWith("bindMethods"),
		);
		expect(formatImports(bindingConsumers)).toEqual([
			"application/internal/createGameUseCases.ts -> ./bindMethods",
			"application/internal/createLibraryUseCases.ts -> ./bindMethods",
		]);
	});

	it("hält die konkrete Objektproblembehandlung hinter einem öffentlichen Interface intern", () => {
		const contract = readFileSync(
			path.join(sourceRoot, "application", "objectReadProblemService.ts"),
			"utf8",
		);
		const implementation = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultObjectReadProblemService.ts",
			),
			"utf8",
		);
		const gameUseCases = readFileSync(
			path.join(sourceRoot, "application", "internal", "createGameUseCases.ts"),
			"utf8",
		);

		expect(contract).toContain("export interface ObjectReadProblemService");
		expect(contract).not.toContain("ObjectRecoveryPort");
		expect(contract).not.toContain("export class ObjectReadProblemService");
		expect(implementation).toContain(
			"export class DefaultObjectReadProblemService",
		);
		expect(implementation).toContain("implements ObjectReadProblemService");
		expect(gameUseCases).toContain(
			"const objectProblems: ObjectReadProblemService =",
		);

		const implementationConsumers = readImports().filter((entry) =>
			entry.specifier.endsWith("defaultObjectReadProblemService"),
		);
		expect(formatImports(implementationConsumers)).toEqual([
			"application/internal/createGameUseCases.ts -> ./defaultObjectReadProblemService",
			"application/internal/createLibraryUseCases.ts -> ./defaultObjectReadProblemService",
		]);
	});

	it("entfernt den ehemaligen Spiel-Kern vollständig", () => {
		expect(
			existsSync(
				path.join(sourceRoot, "application", "internal", "gameServiceCore.ts"),
			),
		).toBe(false);
		const internalConsumers = readImports().filter((entry) =>
			entry.specifier.includes("internal/gameServiceCore"),
		);
		expect(formatImports(internalConsumers)).toEqual([]);
	});

	it("kapselt aktiven Spielzustand in LoadedGameSession", () => {
		const session = readFileSync(
			path.join(sourceRoot, "application", "internal", "loadedGameSession.ts"),
			"utf8",
		);
		const useCases = readFileSync(
			path.join(sourceRoot, "application", "internal", "createGameUseCases.ts"),
			"utf8",
		);

		expect(session).toContain("export class LoadedGameSession");
		expect(session).toContain("#loadedGame?: LoadedGameDocument");
		expect(session).toContain("#dirty = false");
		expect(session).toContain(
			"this.#loadedGame = cloneLoadedGameDocument(game)",
		);
		expect(session).toContain(
			"return cloneLoadedGameDocument(this.#loadedGame)",
		);
		expect(session).toContain("Reflect.getPrototypeOf(value)");
		expect(session).not.toContain("moveSeat(document, command");
		expect(session).not.toContain("../../domain/gameEditing");
		expect(useCases).toContain(
			"const loadedGameSession = new LoadedGameSession()",
		);

		const consumers = readImports().filter((entry) =>
			entry.specifier.endsWith("loadedGameSession"),
		);
		expect(formatImports(consumers)).toEqual([
			"application/internal/createGameUseCases.ts -> ./loadedGameSession",
			"application/internal/defaultGameLoadService.ts -> ./loadedGameSession",
			"application/internal/defaultGameManagementService.ts -> ./loadedGameSession",
			"application/internal/defaultGameRecoveryService.ts -> ./loadedGameSession",
			"application/internal/defaultGameSaveService.ts -> ./loadedGameSession",
			"application/internal/defaultGameSessionService.ts -> ./loadedGameSession",
			"application/internal/defaultGameTemplateService.ts -> ./loadedGameSession",
			"application/internal/pendingGameSaveWorkflow.ts -> ./loadedGameSession",
		]);
	});

	it("implementiert GameSessionService als konkreten internen Use-Case-Service", () => {
		const service = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameSessionService.ts",
			),
			"utf8",
		);
		const useCases = readFileSync(
			path.join(sourceRoot, "application", "internal", "createGameUseCases.ts"),
			"utf8",
		);

		expect(service).toContain(
			"export class DefaultGameSessionService implements GameSessionService",
		);
		expect(service).toContain("moveSeat(document, command");
		expect(service).toContain("usePlayerAbility(");
		expect(service).toContain("saveRolesForShowing(document, draft)");
		expect(useCases).toContain(
			"const gameSessionService = new DefaultGameSessionService(",
		);
		expect(useCases).toContain(
			"const session: GameSessionService = bindMethods(",
		);
		expect(useCases).toContain("gameSessionService,\n\t\tsessionMethods");

		const consumers = readImports().filter((entry) =>
			entry.specifier.endsWith("defaultGameSessionService"),
		);
		expect(formatImports(consumers)).toEqual([
			"application/internal/createGameUseCases.ts -> ./defaultGameSessionService",
		]);
	});

	it("kapselt Game-Katalog und ausschließlich benötigte Browse-IDs", () => {
		const catalog = readFileSync(
			path.join(sourceRoot, "application", "internal", "gameCatalog.ts"),
			"utf8",
		);
		const useCases = readFileSync(
			path.join(sourceRoot, "application", "internal", "createGameUseCases.ts"),
			"utf8",
		);

		expect(catalog).toContain("export class GameCatalog");
		expect(catalog).toContain("#browseCacheGeneration = 0");
		expect(catalog).toContain("async getStoredDocumentIds()");
		expect(catalog).toContain("cacheObjectIds(");
		expect(catalog).not.toContain("CachedBrowseDocument");
		expect(catalog).not.toContain("#browseDocuments");
		expect(useCases).toContain(
			"const gameCatalog = new GameCatalog(objectPersistence)",
		);
		expect(useCases).toContain(
			"...bindMethods(protectedCatalog, catalogMethods)",
		);

		const consumers = readImports().filter((entry) =>
			entry.specifier.endsWith("gameCatalog"),
		);
		expect(formatImports(consumers)).toEqual([
			"application/internal/createGameUseCases.ts -> ./gameCatalog",
			"application/internal/defaultGameImportService.ts -> ./gameCatalog",
			"application/internal/defaultGameManagementService.ts -> ./gameCatalog",
			"application/internal/defaultGameRecoveryService.ts -> ./gameCatalog",
			"application/internal/defaultGameSaveService.ts -> ./gameCatalog",
			"application/internal/defaultGameTemplateService.ts -> ./gameCatalog",
			"application/internal/pendingGameSaveWorkflow.ts -> ./gameCatalog",
		]);
	});

	it("zerlegt Game-Persistenz bis zu Save, Template und Pending-Save", () => {
		const useCases = readFileSync(
			path.join(sourceRoot, "application", "internal", "createGameUseCases.ts"),
			"utf8",
		);
		const services = [
			["defaultGameLoadService.ts", "DefaultGameLoadService"],
			["defaultGameRecoveryService.ts", "DefaultGameRecoveryService"],
			["defaultGameImportService.ts", "DefaultGameImportService"],
			["defaultGameManagementService.ts", "DefaultGameManagementService"],
			["defaultGameSaveService.ts", "DefaultGameSaveService"],
			["defaultGameTemplateService.ts", "DefaultGameTemplateService"],
			["pendingGameSaveWorkflow.ts", "PendingGameSaveWorkflow"],
		] as const;

		for (const [file, className] of services) {
			const source = readFileSync(
				path.join(sourceRoot, "application", "internal", file),
				"utf8",
			);
			expect(source, file).toContain(`export class ${className}`);
			expect(useCases).toContain(`new ${className}(`);
		}
		const gameManagement = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameManagementService.ts",
			),
			"utf8",
		);
		const gameSave = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameSaveService.ts",
			),
			"utf8",
		);
		const gameTemplate = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameTemplateService.ts",
			),
			"utf8",
		);
		const pendingSave = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"pendingGameSaveWorkflow.ts",
			),
			"utf8",
		);
		expect(gameManagement).not.toMatch(
			/saveLoadedGame|saveLoadedGameAsTemplate|continuePendingCreatedDocument/u,
		);
		expect(gameSave).toContain("async saveLoadedGame()");
		expect(gameSave).toContain("async saveLoadedGameAs(name: string)");
		expect(gameTemplate).toContain("createTemplateFromGame({");
		expect(gameTemplate).toContain("async saveLoadedGameAsTemplate(");
		expect(pendingSave).toContain("readonly #pendingCreatedDocuments");
		expect(pendingSave).toContain("async continuePendingCreatedDocument(");
		expect(useCases).toContain("...bindMethods(loadService, loadMethods)");
		expect(useCases).toContain("...bindMethods(saveService, saveMethods)");
		expect(useCases).toContain(
			"...bindMethods(managementService, managementMethods)",
		);
		expect(useCases).toContain(
			"...bindMethods(templateService, templateMethods)",
		);
		expect(useCases).toContain(
			"...bindMethods(pendingSaveWorkflow, pendingSaveMethods)",
		);
		expect(useCases).toContain(
			"...bindMethods(recoveryService, recoveryMethods)",
		);
		expect(useCases).toContain(
			"...bindMethods(protectedImportService, importMethods)",
		);
		expect(useCases).not.toContain("GameServiceCore");
	});

	it("vereinheitlicht die Application-Orchestrierung für Write-Recoveries", () => {
		const coordinator = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"writeRecoveryCoordinator.ts",
			),
			"utf8",
		);
		const gameRecovery = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameRecoveryService.ts",
			),
			"utf8",
		);
		const libraryRecovery = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultLibraryRecoveryService.ts",
			),
			"utf8",
		);

		expect(coordinator).toContain("export class WriteRecoveryCoordinator");
		expect(coordinator).toContain("this.recovery.prepareWriteRecoveries(");
		expect(coordinator).toContain("normalizeLoadProblemActions([");
		expect(coordinator).toContain("sortLoadProblems(summaries");
		for (const service of [gameRecovery, libraryRecovery]) {
			const listWriteRecoveries = service.slice(
				service.indexOf("async listWriteRecoveries("),
				service.indexOf(
					"\n\tasync resolveWriteRecovery(",
					service.indexOf("async listWriteRecoveries("),
				),
			);
			expect(listWriteRecoveries).toContain(".listWriteRecoveries({");
			expect(listWriteRecoveries).not.toContain("prepareWriteRecoveries(");
			expect(listWriteRecoveries).not.toContain(
				"normalizeLoadProblemActions([",
			);
			expect(listWriteRecoveries).not.toContain("sortLoadProblems(summaries");
		}

		const consumers = readImports().filter((entry) =>
			entry.specifier.endsWith("writeRecoveryCoordinator"),
		);
		expect(formatImports(consumers)).toEqual([
			"application/internal/createGameUseCases.ts -> ./writeRecoveryCoordinator",
			"application/internal/createLibraryUseCases.ts -> ./writeRecoveryCoordinator",
			"application/internal/defaultGameRecoveryService.ts -> ./writeRecoveryCoordinator",
			"application/internal/defaultLibraryRecoveryService.ts -> ./writeRecoveryCoordinator",
		]);
	});

	it("führt alle Application-Saves über den gemeinsamen ObjectWriter", () => {
		const applicationDirectory = path.join(sourceRoot, "application");
		const directPersistenceSavers = listSourceFiles(applicationDirectory)
			.filter((file) =>
				/this\.(?:#persistence\.write|#write|write)\.saveObject\(/u.test(
					readFileSync(file, "utf8"),
				),
			)
			.map((file) => normalizePath(path.relative(sourceRoot, file)));
		expect(directPersistenceSavers).toEqual([
			"application/internal/applicationObjectWriter.ts",
		]);

		const templateFactory = readFileSync(
			path.join(sourceRoot, "domain", "templateFactory.ts"),
			"utf8",
		);
		const template = readFileSync(
			path.join(
				sourceRoot,
				"application",
				"internal",
				"defaultGameTemplateService.ts",
			),
			"utf8",
		);
		expect(templateFactory).toContain(
			'const repairedGame = repairGameState(params.game, "game")',
		);
		expect(template).not.toContain("repairGameState");
		expect(template).not.toContain("currentGame:");
	});

	it("stellt die lokalen Storage-Endpunkte auch in der Produktionsvorschau bereit", () => {
		const viteConfig = readFileSync(path.resolve("vite.config.mts"), "utf8");
		expect(viteConfig).toContain(
			"configureServer: (server) => installMiddleware(server, true)",
		);
		expect(viteConfig).toContain(
			"configurePreviewServer: (server) => installMiddleware(server, false)",
		);
	});
});

type SourceImport = { file: string; specifier: string };

function readImports(): SourceImport[] {
	return listSourceFiles(sourceRoot).flatMap((absoluteFile) => {
		const source = readFileSync(absoluteFile, "utf8");
		const file = normalizePath(path.relative(sourceRoot, absoluteFile));
		return [...source.matchAll(/\bfrom\s+["']([^"']+)["']/gu)].map((match) => ({
			file,
			specifier: match[1],
		}));
	});
}

function listSourceFiles(directory: string): string[] {
	return readdirSync(directory)
		.flatMap((entry) => {
			const absolute = path.join(directory, entry);
			return statSync(absolute).isDirectory()
				? listSourceFiles(absolute)
				: /\.(?:ts|tsx)$/u.test(entry)
					? [absolute]
					: [];
		})
		.sort();
}

function formatImports(imports: SourceImport[]): string[] {
	return imports
		.map(formatImport)
		.sort((left, right) => left.localeCompare(right));
}

function formatImport({ file, specifier }: SourceImport): string {
	return `${file} -> ${specifier}`;
}

function isSourceLayerImport(
	entry: SourceImport,
	allowedLayers: readonly string[],
): boolean {
	const resolved = resolveRelativeSourceImport(entry);
	return (
		resolved !== undefined &&
		allowedLayers.some(
			(layer) => resolved === layer || resolved.startsWith(`${layer}/`),
		)
	);
}

function resolveRelativeSourceImport(entry: SourceImport): string | undefined {
	if (isExternalImport(entry.specifier)) return undefined;
	return normalizePath(
		path.normalize(path.join(path.dirname(entry.file), entry.specifier)),
	);
}

function normalizePath(value: string): string {
	return value.replaceAll(path.sep, "/");
}

function isExternalImport(specifier: string): boolean {
	return !specifier.startsWith(".");
}
