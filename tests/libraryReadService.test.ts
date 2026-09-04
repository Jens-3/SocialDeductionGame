import { afterEach, expect, it } from "vitest";
import { ApplicationOperationError } from "../src/application/applicationError";
import {
	createLibraryUseCases,
	type LibraryBackupService,
	type LibraryBrowseService,
	type LibraryRecoveryService,
	type ScenarioImportService,
	type ScenarioManagementService,
} from "../src/application/libraryUseCases";
import { setLanguage } from "../src/config";
import { createTemplateFromGame } from "../src/domain/templateFactory";
import { ObjectSerializationError } from "../src/persistence/objectPersistenceError";
import type {
	DataFileReadResult,
	DataFileStorage,
} from "../src/persistence/ports/dataFileStorage";
import { createGameExportDocument } from "../src/serialization/gameExport";
import { createTestObjectPersistence } from "./createTestObjectPersistence";
import { fixedClock, fixedDomainServices } from "./fixedClock";
import { createTestGame, createTestRuleSet } from "./fixtures";
import { missingRead } from "./storageReadResult";

type LibraryReadStorage = DataFileStorage;

class LibraryReadService {
	readonly listObjects: LibraryBrowseService["listObjects"];
	readonly loadRuleSet: LibraryBrowseService["loadRuleSet"];
	readonly saveRuleSet: ScenarioManagementService["saveRuleSet"];
	readonly saveTemplate: ScenarioManagementService["saveTemplate"];
	readonly exportTemplate: ScenarioManagementService["exportTemplate"];
	readonly renameScenario: ScenarioManagementService["renameScenario"];
	readonly deleteScenario: ScenarioManagementService["deleteScenario"];
	readonly exportLibraryBackup: LibraryBackupService["exportLibraryBackup"];
	readonly restoreLibraryBackup: LibraryBackupService["restoreLibraryBackup"];
	readonly prepareLibraryBackupRestore: LibraryBackupService["prepareLibraryBackupRestore"];
	readonly resolveLibraryBackupRestore: LibraryBackupService["resolveLibraryBackupRestore"];
	readonly inspectLibraryLoadProblem: LibraryRecoveryService["inspectLibraryLoadProblem"];
	readonly restoreInternalBackup: LibraryRecoveryService["restoreInternalBackup"];
	readonly repairInternalLibrary: LibraryRecoveryService["repairInternalLibrary"];
	readonly createAndStoreEmptyLibrary: LibraryRecoveryService["createAndStoreEmptyLibrary"];
	readonly useEmptyLibraryInMemory: LibraryRecoveryService["useEmptyLibraryInMemory"];
	readonly exportInternalLibraryRaw: LibraryRecoveryService["exportInternalLibraryRaw"];
	readonly listWriteRecoveries: LibraryRecoveryService["listWriteRecoveries"];
	readonly resolveWriteRecovery: LibraryRecoveryService["resolveWriteRecovery"];
	readonly finishInternalStorageCommand: LibraryRecoveryService["finishInternalStorageCommand"];
	readonly exportFailedWrite: LibraryRecoveryService["exportFailedWrite"];
	readonly importScenario: ScenarioImportService["importScenario"];
	readonly resolveScenarioImport: ScenarioImportService["resolveScenarioImport"];

	constructor(storage: DataFileStorage) {
		const persistence = createTestObjectPersistence(storage, fixedClock);
		const services = createLibraryUseCases(persistence, fixedClock);
		const browse = services.browse;
		const management = services.management;
		const backup = services.backup;
		const recovery = services.recovery;
		const scenarioImport = services.import;
		this.listObjects = browse.listObjects.bind(browse);
		this.loadRuleSet = browse.loadRuleSet.bind(browse);
		this.saveRuleSet = management.saveRuleSet.bind(management);
		this.saveTemplate = management.saveTemplate.bind(management);
		this.exportTemplate = management.exportTemplate.bind(management);
		this.renameScenario = management.renameScenario.bind(management);
		this.deleteScenario = management.deleteScenario.bind(management);
		this.exportLibraryBackup = backup.exportLibraryBackup.bind(backup);
		this.restoreLibraryBackup = backup.restoreLibraryBackup.bind(backup);
		this.prepareLibraryBackupRestore =
			backup.prepareLibraryBackupRestore.bind(backup);
		this.resolveLibraryBackupRestore =
			backup.resolveLibraryBackupRestore.bind(backup);
		this.inspectLibraryLoadProblem =
			recovery.inspectLibraryLoadProblem.bind(recovery);
		this.restoreInternalBackup = recovery.restoreInternalBackup.bind(recovery);
		this.repairInternalLibrary = recovery.repairInternalLibrary.bind(recovery);
		this.createAndStoreEmptyLibrary =
			recovery.createAndStoreEmptyLibrary.bind(recovery);
		this.useEmptyLibraryInMemory =
			recovery.useEmptyLibraryInMemory.bind(recovery);
		this.exportInternalLibraryRaw =
			recovery.exportInternalLibraryRaw.bind(recovery);
		this.listWriteRecoveries = recovery.listWriteRecoveries.bind(recovery);
		this.resolveWriteRecovery = recovery.resolveWriteRecovery.bind(recovery);
		this.finishInternalStorageCommand =
			recovery.finishInternalStorageCommand.bind(recovery);
		this.exportFailedWrite = recovery.exportFailedWrite.bind(recovery);
		this.importScenario = scenarioImport.importScenario.bind(scenarioImport);
		this.resolveScenarioImport =
			scenarioImport.resolveScenarioImport.bind(scenarioImport);
	}
}

async function readRuleSetList(service: LibraryReadService) {
	const result = await service.listObjects("ruleSet");
	if (result.status === "expectedFailure")
		throw new Error(result.problem.reason);
	return result;
}

async function readRuleSetMetadata(service: LibraryReadService) {
	return (await readRuleSetList(service)).metadata;
}

async function readRuleSetProblemsForTest(service: LibraryReadService) {
	return (await readRuleSetList(service)).problems;
}

function readSuccess(bytes: Uint8Array): Promise<DataFileReadResult> {
	return Promise.resolve({ status: "success", bytes });
}

function readLibrary(primary: Uint8Array, backup?: Uint8Array) {
	return (
		file: Parameters<NonNullable<DataFileStorage["readInternal"]>>[0],
		version?: "primary" | "backup",
	) =>
		version === "backup"
			? backup
				? readSuccess(backup)
				: Promise.resolve(missingRead(file))
			: readSuccess(primary);
}

afterEach(() => setLanguage("de"));

it("meldet eine fehlende Bibliothek mit eigenem Fehlergrund", async () => {
	const service = new LibraryReadService({
		readInternal: (file) => Promise.resolve(missingRead(file)),
	});

	const problem = await service.inspectLibraryLoadProblem();
	expect(problem).toMatchObject({
		reason: "missingLibrary",
		hasReadableOriginal: false,
		hasReadableBackup: false,
	});
});

it("kennzeichnet ein verwaistes Bibliotheks-Backup mit seiner Quelle", async () => {
	const backup = new TextEncoder().encode(
		JSON.stringify({
			storageType: "social-deduction-app-library",
			storageVersion: 1,
			ruleSetsById: {},
		}),
	);
	const service = new LibraryReadService({
		readInternal: (file, version) =>
			version === "backup"
				? readSuccess(backup)
				: Promise.resolve(missingRead(file)),
	});

	await expect(service.inspectLibraryLoadProblem()).resolves.toMatchObject({
		reason: "orphanedRecovery",
		recoverySource: "backup",
	});
});

it("erkennt eine unlesbare Library und validiert das interne Backup", async () => {
	const ruleSet = createTestRuleSet();
	const original = new TextEncoder().encode("kein JSON");
	const backup = new TextEncoder().encode(
		JSON.stringify({
			storageType: "social-deduction-app-library",
			storageVersion: 1,
			ruleSetsById: { [ruleSet.id]: ruleSet },
		}),
	);
	const writes: Array<{ bytes: Uint8Array; options: unknown }> = [];
	const exports: Array<{ bytes: Uint8Array; options: unknown }> = [];
	const storage: LibraryReadStorage = {
		readInternal: readLibrary(original, backup),
		writeInternal: (_file, bytes, options) => {
			writes.push({ bytes, options });
			return Promise.resolve();
		},
		writeExternal: (bytes, options) => {
			exports.push({ bytes, options });
			return Promise.resolve();
		},
	};
	const service = new LibraryReadService(storage);

	await expect(service.inspectLibraryLoadProblem()).resolves.toMatchObject({
		reason: "invalidJson",
		hasReadableOriginal: true,
		hasReadableBackup: true,
		canRestoreBackup: true,
		canRepair: false,
		canExport: true,
	});
	await service.exportInternalLibraryRaw();
	expect(new TextDecoder().decode(exports[0]?.bytes)).toBe("kein JSON");
	await service.restoreInternalBackup();
	expect(writes[0]?.options).toEqual({
		backup: false,
	});
	await expect(readRuleSetMetadata(service)).resolves.toHaveLength(1);
});

it("repariert RuleSets einzeln und speichert nur die validierte Arbeitskopie", async () => {
	const original = new TextEncoder().encode(
		JSON.stringify({
			storageType: "social-deduction-app-library",
			storageVersion: 1,
			ruleSetsById: {
				current: {
					name: "Current",
					teams: [],
					roles: [],
				},
				broken: 42,
			},
		}),
	);
	const writes: Array<{ bytes: Uint8Array; options: unknown }> = [];
	const storage: LibraryReadStorage = {
		readInternal: readLibrary(original),
		writeInternal: (_file, bytes, options) => {
			writes.push({ bytes, options });
			return Promise.resolve();
		},
	};
	const service = new LibraryReadService(storage);

	await expect(service.inspectLibraryLoadProblem()).resolves.toBeUndefined();
	await expect(readRuleSetProblemsForTest(service)).resolves.toContainEqual(
		expect.objectContaining({
			id: "broken",
			reason: "invalidDocument",
		}),
	);
	const report = await service.repairInternalLibrary();
	expect(report.report.repairedRuleSetCount).toBe(1);
	expect(report.report.removedRuleSets).toHaveLength(1);
	expect(writes[0]?.options).toEqual({
		backup: false,
	});
	await expect(readRuleSetMetadata(service)).resolves.toMatchObject([
		{ id: "ruleset_current", name: "Current" },
	]);
});

it("kennzeichnet ein ungültiges Regelwerk innerhalb der Library", async () => {
	const original = new TextEncoder().encode(
		JSON.stringify({
			storageType: "social-deduction-app-library",
			storageVersion: 1,
			ruleSetsById: { broken: 42 },
		}),
	);
	const service = new LibraryReadService({
		readInternal: readLibrary(original),
	});

	await expect(service.inspectLibraryLoadProblem()).resolves.toBeUndefined();
	await expect(readRuleSetProblemsForTest(service)).resolves.toMatchObject([
		{
			id: "broken",
			reason: "invalidDocument",
		},
	]);
});

it("normalisiert beschädigte RuleSet-IDs beim Laden nicht", async () => {
	const ruleSet = createTestRuleSet();
	const original = new TextEncoder().encode(
		JSON.stringify({
			storageType: "social-deduction-app-library",
			storageVersion: 1,
			ruleSetsById: {
				ruleset_wrong: ruleSet,
			},
		}),
	);
	const service = new LibraryReadService({
		readInternal: readLibrary(original),
	});

	await expect(service.inspectLibraryLoadProblem()).resolves.toBeUndefined();
	const [problem] = await readRuleSetProblemsForTest(service);
	expect(problem).toMatchObject({
		id: "ruleset_wrong",
		category: "domain",
		reason: "invalidObject",
		repairable: true,
	});
	expect(problem).not.toHaveProperty("diagnostic");
	expect(problem?.availableActions).toContain("repair");
});

it("dekodiert, sanitisiert und vervollständigt beschädigtes Library-JSON", async () => {
	const malformedText =
		'{\u202e"storageType":"social-deduction-app-library","storageVersion":1,"ruleSetsById":{"current":{"name":"Current","teams":[],"roles":[]}}';
	const original = Uint8Array.from([
		0xff,
		0xfe,
		...Buffer.from(malformedText, "utf16le"),
	]);
	const writes: Uint8Array[] = [];
	const storage: LibraryReadStorage = {
		readInternal: readLibrary(original),
		writeInternal: (_file, bytes) => {
			writes.push(bytes);
			return Promise.resolve();
		},
	};
	const service = new LibraryReadService(storage);

	await expect(service.inspectLibraryLoadProblem()).resolves.toMatchObject({
		canRepair: true,
	});
	const report = await service.repairInternalLibrary();
	expect(report.report.changes).toContainEqual({
		kind: "addedClosingBraces",
		count: 1,
	});
	expect(writes).toHaveLength(1);
	await expect(readRuleSetMetadata(service)).resolves.toMatchObject([
		{ id: "ruleset_current", name: "Current" },
	]);
});

it("erhält Serialization-Grund und Operation beim Library-Repair bis zur Application", async () => {
	const original = new TextEncoder().encode(
		JSON.stringify({
			storageType: "social-deduction-app-library",
			storageVersion: 2,
			ruleSetsById: {},
		}),
	);
	const service = new LibraryReadService({
		readInternal: readLibrary(original),
	});

	const error = await service
		.repairInternalLibrary()
		.catch((caught: unknown) => caught);

	expect(error).toBeInstanceOf(ApplicationOperationError);
	expect(error).toMatchObject({
		source: "serialization",
		expectation: "expected",
		operation: "repair",
		subject: "ruleSet",
		reason: "unsupportedVersion",
		repairable: false,
	});
	expect((error as ApplicationOperationError).cause).toBeInstanceOf(
		ObjectSerializationError,
	);
	expect((error as ApplicationOperationError).cause).toMatchObject({
		kind: "serialization",
		operation: "repair",
		reason: "unsupportedVersion",
	});
});

it("verwendet nach später entscheiden eine nicht persistierte leere Library", async () => {
	const original = new TextEncoder().encode("kein JSON");
	let writes = 0;
	const storage: LibraryReadStorage = {
		readInternal: readLibrary(original),
		writeInternal: () => {
			writes += 1;
			return Promise.resolve();
		},
	};
	const service = new LibraryReadService(storage);

	await service.useEmptyLibraryInMemory();
	await expect(readRuleSetMetadata(service)).resolves.toEqual([]);
	await expect(service.inspectLibraryLoadProblem()).resolves.toBeUndefined();
	await expect(service.saveRuleSet(createTestRuleSet())).rejects.toMatchObject({
		reason: "storageFailure",
	});
	expect(writes).toBe(0);
});

it("erlaubt das Behalten einer neuen Library erst nach vollständiger Validierung", async () => {
	const ruleSet = createTestRuleSet();
	const validLibrary = new TextEncoder().encode(
		JSON.stringify({
			storageType: "social-deduction-app-library",
			storageVersion: 1,
			ruleSetsById: { [ruleSet.id]: ruleSet },
		}),
	);
	const resolutions: unknown[] = [];
	const storage: LibraryReadStorage = {
		readInternal: readLibrary(validLibrary),
		listRecoveries: () =>
			Promise.resolve([
				{
					category: "library",
					recoveryKey: "library",
					fileName: "library.json",
					oldBytes: validLibrary,
					newBytes: validLibrary,
				},
			]),
		requestRecovery: (recoveryKey) =>
			Promise.resolve({
				status: "decisionRequired",
				commandId: `command:${recoveryKey}`,
				candidate: {
					category: "library",
					recoveryKey,
					fileName: "library.json",
					oldBytes: validLibrary,
					newBytes: validLibrary,
				},
			}),
		continueInternalCommand: (commandId, resolution) => {
			resolutions.push({ commandId, resolution });
			return Promise.resolve("completed");
		},
	};
	const service = new LibraryReadService(storage);

	await expect(service.listWriteRecoveries()).resolves.toMatchObject([
		{
			commandId: "command:library",
			recoveryKey: "library",
			id: "ruleSet",
			kind: "ruleSet",
			hasNew: true,
			canKeepNew: true,
		},
	]);
	await service.resolveWriteRecovery("command:library", "keepNew");
	expect(resolutions).toEqual([
		{ commandId: "command:library", resolution: "keepNew" },
	]);
});

it("liest die Library einmal als Bytes und liefert Regelwerk-Zusammenfassungen", async () => {
	const ruleSet = createTestRuleSet();
	let reads = 0;
	const storage: LibraryReadStorage = {
		readInternal: () => {
			reads++;
			return readSuccess(
				new TextEncoder().encode(
					JSON.stringify({
						storageType: "social-deduction-app-library",
						storageVersion: 1,
						ruleSetsById: { [ruleSet.id]: ruleSet },
					}),
				),
			);
		},
	};
	const service = new LibraryReadService(storage);

	expect(await readRuleSetMetadata(service)).toEqual([
		{
			id: ruleSet.id,
			name: ruleSet.name,
			version: 1,
			teamCount: 3,
			roleCount: 3,
		},
	]);
	expect((await service.loadRuleSet(ruleSet.id)).id).toBe(ruleSet.id);
	expect(reads).toBe(1);
	expect(await readRuleSetMetadata(service)).toHaveLength(1);
	expect(reads).toBe(1);
});

it("materialisiert ein Regelwerk für jede Bearbeitung neu aus seinem Cache-Text", async () => {
	const ruleSet = createTestRuleSet();
	const storage: LibraryReadStorage = {
		readInternal: () =>
			readSuccess(
				new TextEncoder().encode(
					JSON.stringify({
						storageType: "social-deduction-app-library",
						storageVersion: 1,
						ruleSetsById: { [ruleSet.id]: ruleSet },
					}),
				),
			),
	};
	const service = new LibraryReadService(storage);
	const first = await service.loadRuleSet(ruleSet.id);
	first.name = "Nur in der Arbeitskopie";

	expect((await service.loadRuleSet(ruleSet.id)).name).toBe(ruleSet.name);
});

it("lokalisiert nur die Zusammenfassung und bewahrt den Basisnamen", async () => {
	const ruleSet = {
		...createTestRuleSet(),
		name: "Canonical rules",
		names: { de: "Angezeigte Regeln", fr: "Règles affichées" },
	};
	let reads = 0;
	const storage: LibraryReadStorage = {
		readInternal: () => {
			reads++;
			return readSuccess(
				new TextEncoder().encode(
					JSON.stringify({
						storageType: "social-deduction-app-library",
						storageVersion: 1,
						ruleSetsById: { [ruleSet.id]: ruleSet },
					}),
				),
			);
		},
	};
	const service = new LibraryReadService(storage);

	expect((await readRuleSetMetadata(service))[0]?.name).toBe(
		"Angezeigte Regeln",
	);
	setLanguage("fr");
	expect((await readRuleSetMetadata(service))[0]?.name).toBe(
		"Règles affichées",
	);
	expect(reads).toBe(1);
	expect((await service.loadRuleSet(ruleSet.id)).name).toBe("Canonical rules");
});

it("importiert ein Regelwerk ohne Formatmetadaten und schreibt die Library atomar", async () => {
	const ruleSet = createTestRuleSet();
	const writes: Array<{ bytes: Uint8Array; options: unknown }> = [];
	const storage: LibraryReadStorage = {
		readInternal: () =>
			readSuccess(
				new TextEncoder().encode(
					JSON.stringify({
						storageType: "social-deduction-app-library",
						storageVersion: 1,
						ruleSetsById: {},
					}),
				),
			),
		readExternal: () =>
			Promise.resolve(
				new TextEncoder().encode(`\u0000\t${JSON.stringify(ruleSet)}\r\n`),
			),
		writeInternal: (_file, bytes, options) => {
			writes.push({ bytes, options });
			return Promise.resolve();
		},
	};
	const result = await new LibraryReadService(storage).importScenario({});

	if (result.status !== "imported") throw new Error("Import erwartet.");
	expect(result.kind).toBe("ruleSet");
	expect(writes[0]?.options).toEqual({
		backup: true,
	});
	expect(
		JSON.parse(new TextDecoder().decode(writes[0]?.bytes)) as unknown,
	).toMatchObject({
		ruleSetsById: { [ruleSet.id]: { id: ruleSet.id } },
	});
});

it("lehnt einen Spielstand beim Szenarioimport mit wrongObjectKind ab", async () => {
	const storage: LibraryReadStorage = {
		readInternal: (file) => Promise.resolve(missingRead(file)),
		readExternal: () =>
			Promise.resolve(
				new TextEncoder().encode(
					JSON.stringify(createGameExportDocument(createTestGame())),
				),
			),
	};

	await expect(
		new LibraryReadService(storage).importScenario({}),
	).rejects.toMatchObject({
		operation: "import",
		subject: "unknown",
		reason: "wrongObjectKind",
	});
});

it("hält auch RuleSet-Kollisionen als Importentscheidung an", async () => {
	const ruleSet = createTestRuleSet();
	const library = {
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		ruleSetsById: { [ruleSet.id]: ruleSet },
	};
	const writes: Uint8Array[] = [];
	const storage: LibraryReadStorage = {
		readInternal: () =>
			readSuccess(new TextEncoder().encode(JSON.stringify(library))),
		readExternal: () =>
			Promise.resolve(new TextEncoder().encode(JSON.stringify(ruleSet))),
		writeInternal: (_file, bytes) => {
			writes.push(bytes);
			return Promise.resolve();
		},
	};
	const service = new LibraryReadService(storage);

	const decision = await service.importScenario({});

	expect(decision).toMatchObject({
		status: "decisionRequired",
		decisionKind: "importConflict",
		type: "ruleSet",
		reason: "targetExists",
	});
	expect(writes).toHaveLength(0);
	if (
		decision.status !== "decisionRequired" ||
		decision.decisionKind !== "importConflict"
	)
		throw new Error("Entscheidung erwartet.");
	await service.resolveScenarioImport(decision.commandId, "keepBoth");
	expect(writes).toHaveLength(1);
});

it.each([
	["cancel", 0, "Canonical rules"],
	["overwrite", 1, "Imported rules"],
] as const)(
	"löst eine RuleSet-Importkollision mit %s auf",
	async (resolution, expectedWrites, expectedName) => {
		const existing = createTestRuleSet();
		existing.name = "Canonical rules";
		const imported = structuredClone(existing);
		imported.name = "Imported rules";
		const library = {
			storageType: "social-deduction-app-library",
			storageVersion: 1,
			ruleSetsById: { [existing.id]: existing },
		};
		const writes: Uint8Array[] = [];
		const storage: LibraryReadStorage = {
			readInternal: () =>
				readSuccess(new TextEncoder().encode(JSON.stringify(library))),
			readExternal: () =>
				Promise.resolve(new TextEncoder().encode(JSON.stringify(imported))),
			writeInternal: (_file, bytes) => {
				writes.push(bytes);
				return Promise.resolve();
			},
		};
		const service = new LibraryReadService(storage);
		const conflict = await service.importScenario({});
		if (
			conflict.status !== "decisionRequired" ||
			conflict.decisionKind !== "importConflict"
		)
			throw new Error("Importentscheidung erwartet.");

		const result = await service.resolveScenarioImport(
			conflict.commandId,
			resolution,
		);

		if (resolution === "cancel") expect(result).toBeUndefined();
		else
			expect(result).toMatchObject({
				status: "imported",
				kind: "ruleSet",
				name: "Imported rules",
			});
		expect(writes).toHaveLength(expectedWrites);
		const stored =
			writes.length === 0
				? library
				: (JSON.parse(new TextDecoder().decode(writes[0])) as typeof library);
		expect(stored.ruleSetsById[existing.id]?.name).toBe(expectedName);
	},
);

it("behält eine RuleSet-Importentscheidung nach einem Schreibfehler bei", async () => {
	const ruleSet = createTestRuleSet();
	const library = {
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		ruleSetsById: { [ruleSet.id]: ruleSet },
	};
	let failNextWrite = false;
	const writes: Uint8Array[] = [];
	const storage: LibraryReadStorage = {
		readInternal: () =>
			readSuccess(new TextEncoder().encode(JSON.stringify(library))),
		readExternal: () =>
			Promise.resolve(new TextEncoder().encode(JSON.stringify(ruleSet))),
		writeInternal: (_file, bytes) => {
			if (failNextWrite) {
				failNextWrite = false;
				return Promise.reject(new Error("Temporärer Schreibfehler"));
			}
			writes.push(bytes);
			return Promise.resolve();
		},
	};
	const service = new LibraryReadService(storage);
	const decision = await service.importScenario({});
	if (
		decision.status !== "decisionRequired" ||
		decision.decisionKind !== "importConflict"
	)
		throw new Error("Importentscheidung erwartet.");
	failNextWrite = true;

	await expect(
		service.resolveScenarioImport(decision.commandId, "keepBoth"),
	).rejects.toThrow();
	await expect(
		service.resolveScenarioImport(decision.commandId, "keepBoth"),
	).resolves.toMatchObject({
		status: "imported",
		kind: "ruleSet",
	});
	expect(writes).toHaveLength(1);
});

it("hält einen Vorlagenimport bei einer ID-Kollision bis zur Entscheidung an", async () => {
	const template = createTemplateFromGame({
		services: fixedDomainServices,
		game: createTestGame(),
		name: "Vorlage",
	}).template;
	const writes: Array<{
		id: string;
		value: Record<string, unknown>;
		options: unknown;
	}> = [];
	const storage: LibraryReadStorage = {
		readExternal: () =>
			Promise.resolve(
				new TextEncoder().encode(
					JSON.stringify(createGameExportDocument(template)),
				),
			),
		readInternal: () =>
			readSuccess(
				new TextEncoder().encode(
					JSON.stringify(createGameExportDocument(template)),
				),
			),
		readAllInternal: () =>
			Promise.resolve([
				{
					category: "template",
					fileName: `${template.id}.json`,
					bytes: new TextEncoder().encode(
						JSON.stringify(createGameExportDocument(template)),
					),
				},
			]),
		writeInternal: (file, bytes, options) => {
			if (
				options.createOnly &&
				file.fileName === `${template.id}.json` &&
				writes.length === 0
			)
				return Promise.resolve({
					status: "conflict",
					reason: "targetExists",
					file,
				});
			writes.push({
				id: file.fileName.replace(/\.json$/, ""),
				value: JSON.parse(new TextDecoder().decode(bytes)) as Record<
					string,
					unknown
				>,
				options,
			});
			return Promise.resolve();
		},
	};
	const service = new LibraryReadService(storage);
	const conflict = await service.importScenario({});

	expect(conflict).toMatchObject({
		status: "decisionRequired",
		decisionKind: "importConflict",
		imported: { schemaVersion: 1 },
	});
	expect(writes).toHaveLength(0);
	if (conflict.status !== "decisionRequired")
		throw new Error("Entscheidung erwartet.");
	await service.resolveScenarioImport(conflict.commandId, "keepBoth");
	expect(writes).toMatchObject([
		{
			id: "template_vorlage_2",
			value: { id: "template_vorlage_2", name: "Vorlage (2)" },
			options: { createOnly: true, backup: false },
		},
	]);
});

it("exportiert eine Vorlage als externe Datei über den Storage", async () => {
	const template = createTemplateFromGame({
		services: fixedDomainServices,
		game: createTestGame(),
		name: "Testvorlage",
	}).template;
	const exports: Array<{ bytes: Uint8Array; options: unknown }> = [];
	const storage: LibraryReadStorage = {
		readInternal: () => readSuccess(new Uint8Array()),
		writeExternal: (bytes, options) => {
			exports.push({ bytes, options });
			return Promise.resolve();
		},
	};

	await new LibraryReadService(storage).exportTemplate(template);

	expect(exports[0]?.options).toEqual({
		description: "Vorlage",
		suggestedFileName: "template_testvorlage.json",
		conflictPolicy: "reject",
		targetPolicy: "suggested",
	});
	expect(
		JSON.parse(new TextDecoder().decode(exports[0]?.bytes)) as unknown,
	).toMatchObject({
		id: "template_testvorlage",
		name: "Testvorlage",
	});
	expect(
		JSON.parse(new TextDecoder().decode(exports[0]?.bytes)) as Record<
			string,
			unknown
		>,
	).toMatchObject({
		fileType: "social-deduction-template",
		schemaVersion: 1,
	});
});

it("verweigert das Umbenennen eines Regelwerks auf eine belegte ID", async () => {
	const first = createTestRuleSet();
	const second = {
		...createTestRuleSet(),
		id: "ruleset_belegt",
		name: "Belegt",
	};
	const storage: LibraryReadStorage = {
		readInternal: () =>
			readSuccess(
				new TextEncoder().encode(
					JSON.stringify({
						storageType: "social-deduction-app-library",
						storageVersion: 1,
						ruleSetsById: { [first.id]: first, [second.id]: second },
					}),
				),
			),
		writeInternal: () => Promise.resolve(),
	};
	const service = new LibraryReadService(storage);

	await expect(
		service.renameScenario({
			type: "ruleSet",
			oldId: first.id,
			newName: "Belegt",
			document: first,
		}),
	).rejects.toMatchObject({ reason: "targetExists" });
});

it("liefert beim Umbenennen eines Regelwerks dessen logischen Storage-Schlüssel", async () => {
	const ruleSet = createTestRuleSet();
	const storage: LibraryReadStorage = {
		readInternal: () =>
			readSuccess(
				new TextEncoder().encode(
					JSON.stringify({
						storageType: "social-deduction-app-library",
						storageVersion: 1,
						ruleSetsById: { [ruleSet.id]: ruleSet },
					}),
				),
			),
		writeInternal: () => Promise.resolve(),
	};

	await expect(
		new LibraryReadService(storage).renameScenario({
			type: "ruleSet",
			oldId: ruleSet.id,
			newName: "Neue Regeln",
			document: ruleSet,
		}),
	).resolves.toEqual({
		id: "ruleset_neue_regeln",
		storageKey: "ruleset_neue_regeln",
		name: "Neue Regeln",
	});
});

it("entfernt ein Regelwerk aus der Library und schreibt sie mit Backup", async () => {
	const ruleSet = createTestRuleSet();
	const writes: Array<{ bytes: Uint8Array; options: unknown }> = [];
	const storage: LibraryReadStorage = {
		readInternal: () =>
			readSuccess(
				new TextEncoder().encode(
					JSON.stringify({
						storageType: "social-deduction-app-library",
						storageVersion: 1,
						ruleSetsById: { [ruleSet.id]: ruleSet },
					}),
				),
			),
		writeInternal: (_file, bytes, options) => {
			writes.push({ bytes, options });
			return Promise.resolve();
		},
	};

	await new LibraryReadService(storage).deleteScenario("ruleSet", ruleSet.id);

	expect(writes[0]?.options).toEqual({
		backup: true,
	});
	expect(
		JSON.parse(new TextDecoder().decode(writes[0]?.bytes)) as {
			ruleSetsById: unknown;
		},
	).toMatchObject({ ruleSetsById: {} });
});

it("lässt beim Löschen einer Vorlage auch deren Backup entfernen", async () => {
	const deletes: unknown[] = [];
	const storage: LibraryReadStorage = {
		readInternal: () => readSuccess(new Uint8Array()),
		deleteInternal: (file, options) => {
			deletes.push({ file, options });
			return Promise.resolve();
		},
	};

	await new LibraryReadService(storage).deleteScenario(
		"template",
		"template_demo",
	);

	expect(deletes).toEqual([
		{
			file: { category: "template", fileName: "template_demo.json" },
			options: { includeBackup: true, includeRecovery: true },
		},
	]);
});

it("benennt Vorlagen durch createOnly-Schreiben und anschließendes Löschen um", async () => {
	const operations: unknown[] = [];
	const storage: DataFileStorage = {
		readInternal: () => readSuccess(new Uint8Array()),
		writeInternal: (file, _bytes, options) => {
			operations.push({ type: "write", file, options });
			return Promise.resolve();
		},
		deleteInternal: (file, options) => {
			operations.push({ type: "delete", file, options });
			return Promise.resolve();
		},
	};

	const renamed = await new LibraryReadService(storage).renameScenario({
		type: "template",
		oldId: "template_alt",
		newName: "Neu",
		document: createTemplateFromGame({
			services: fixedDomainServices,
			game: createTestGame(),
			name: "Alt",
		}).template,
	});
	expect(renamed).toEqual({
		id: "template_neu",
		storageKey: "template_neu",
		name: "Neu",
	});

	expect(operations).toEqual([
		{
			type: "write",
			file: { category: "template", fileName: "template_neu.json" },
			options: { backup: true, createOnly: true },
		},
		{
			type: "delete",
			file: { category: "template", fileName: "template_alt.json" },
			options: { includeBackup: true, includeRecovery: true },
		},
	]);
});

it("exportiert die vollständige Library als externes Backup", async () => {
	const ruleSet = createTestRuleSet();
	const exports: Array<{ bytes: Uint8Array; options: unknown }> = [];
	const library = {
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		ruleSetsById: { [ruleSet.id]: ruleSet },
	};
	const storage: LibraryReadStorage = {
		readInternal: () =>
			readSuccess(new TextEncoder().encode(JSON.stringify(library))),
		writeExternal: (bytes, options) => {
			exports.push({ bytes, options });
			return Promise.resolve();
		},
	};

	await new LibraryReadService(storage).exportLibraryBackup();

	expect(exports[0]?.options).toEqual({
		description: "Bibliothek",
		suggestedFileName: "library_backup.json",
		conflictPolicy: "reject",
		targetPolicy: "suggested",
	});
	expect(
		JSON.parse(new TextDecoder().decode(exports[0]?.bytes)) as unknown,
	).toMatchObject({
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		ruleSetsById: { [ruleSet.id]: { id: ruleSet.id, name: ruleSet.name } },
	});
});

it("ersetzt die Library erst nach erfolgreicher externer Validierung", async () => {
	const ruleSet = createTestRuleSet();
	const restored = {
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		ruleSetsById: { [ruleSet.id]: ruleSet },
	};
	const writes: Array<{ bytes: Uint8Array; options: unknown }> = [];
	const storage: LibraryReadStorage = {
		readInternal: () => readSuccess(new Uint8Array()),
		readExternal: () =>
			Promise.resolve(
				new TextEncoder().encode(`\u0000${JSON.stringify(restored)}\r\n`),
			),
		writeInternal: (_file, bytes, options) => {
			writes.push({ bytes, options });
			return Promise.resolve();
		},
	};
	const service = new LibraryReadService(storage);

	await service.restoreLibraryBackup({});

	expect(writes[0]?.options).toEqual({
		backup: true,
	});
	expect(await readRuleSetMetadata(service)).toHaveLength(1);
});

it("lehnt Bibliotheks-Backups einer anderen Version ab", async () => {
	const restored = {
		storageType: "social-deduction-app-library",
		storageVersion: 0,
		ruleSetsById: {},
	};
	const service = new LibraryReadService({
		readInternal: () => readSuccess(new Uint8Array()),
		readExternal: () =>
			Promise.resolve(new TextEncoder().encode(JSON.stringify(restored))),
		writeInternal: () => Promise.resolve(),
	});

	const error = await service
		.prepareLibraryBackupRestore({})
		.catch((caught: unknown) => caught);
	expect(error).toMatchObject({
		name: "ApplicationOperationError",
		code: "APPLICATION_EXPECTED_ERROR",
		source: "serialization",
		expectation: "expected",
		severity: "error",
		reason: "invalidDocument",
	});
	expect(error).toHaveProperty(
		"diagnostic",
		expect.stringContaining("keine unterstützte Struktur"),
	);
});

it("verwirft beim Bibliotheksimport nur ungültige Regelwerke", async () => {
	const ruleSet = createTestRuleSet();
	const restored = {
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		ruleSetsById: {
			[ruleSet.id]: ruleSet,
			broken: 42,
			wrong: { ...ruleSet, id: "wrong" },
		},
	};
	const writes: Uint8Array[] = [];
	const storage: LibraryReadStorage = {
		readInternal: () => readSuccess(new Uint8Array()),
		readExternal: () =>
			Promise.resolve(new TextEncoder().encode(JSON.stringify(restored))),
		writeInternal: (_file, bytes) => {
			writes.push(bytes);
			return Promise.resolve();
		},
	};
	const service = new LibraryReadService(storage);
	const preview = await service.prepareLibraryBackupRestore({});

	expect(preview.discardedRuleSetIds).toEqual(["broken", "wrong"]);
	expect(preview).toMatchObject({
		totalObjectCount: 3,
		validObjectCount: 1,
		discardedObjectCount: 2,
		availableDecisions: ["repair", "importValidObjects", "cancel"],
	});
	expect(preview.problems).toHaveLength(2);
	expect(writes).toHaveLength(0);
	await service.resolveLibraryBackupRestore(
		preview.commandId,
		"importValidObjects",
	);
	expect(writes).toHaveLength(1);
	expect(await readRuleSetMetadata(service)).toMatchObject([
		{ id: ruleSet.id },
	]);
});

it("behält einen Library-Restore nach einem Schreibfehler zur Wiederholung bei", async () => {
	const ruleSet = createTestRuleSet();
	const restored = {
		storageType: "social-deduction-app-library",
		storageVersion: 1,
		ruleSetsById: { [ruleSet.id]: ruleSet },
	};
	let failNextWrite = true;
	let writes = 0;
	const storage: LibraryReadStorage = {
		readInternal: () => readSuccess(new Uint8Array()),
		readExternal: () =>
			Promise.resolve(new TextEncoder().encode(JSON.stringify(restored))),
		writeInternal: () => {
			if (failNextWrite) {
				failNextWrite = false;
				return Promise.reject(new Error("Temporärer Schreibfehler"));
			}
			writes += 1;
			return Promise.resolve();
		},
	};
	const service = new LibraryReadService(storage);
	const preview = await service.prepareLibraryBackupRestore({});

	await expect(
		service.resolveLibraryBackupRestore(preview.commandId, "replace"),
	).rejects.toThrow();
	await expect(
		service.resolveLibraryBackupRestore(preview.commandId, "replace"),
	).resolves.toMatchObject({
		status: "restored",
		kind: "library",
		source: "backup",
		preview,
	});
	expect(writes).toBe(1);
});

it("schreibt bei einer ungültigen Bibliothek keine internen Daten", async () => {
	let writes = 0;
	const storage: LibraryReadStorage = {
		readInternal: () => readSuccess(new Uint8Array()),
		readExternal: () =>
			Promise.resolve(new TextEncoder().encode('{"ruleSetsById":{}}')),
		writeInternal: () => {
			writes += 1;
			return Promise.resolve();
		},
	};

	const error = await new LibraryReadService(storage)
		.restoreLibraryBackup({})
		.catch((caught: unknown) => caught);
	expect(error).toMatchObject({
		name: "ApplicationOperationError",
		code: "APPLICATION_EXPECTED_ERROR",
		source: "serialization",
		expectation: "expected",
		severity: "error",
		reason: "invalidDocument",
	});
	expect(error).toHaveProperty(
		"diagnostic",
		expect.stringContaining("Die Library hat keine unterstützte Struktur."),
	);
	expect(writes).toBe(0);
});
