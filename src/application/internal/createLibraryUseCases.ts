import type { DomainServices } from "../../domain/domainServices";
import type { ObjectPersistenceCapabilities } from "../../persistence/ports/objectPersistenceCapabilities";
import type {
	LibraryBackupService,
	LibraryBrowseService,
	LibraryRecoveryService,
	LibraryUseCases,
	ScenarioImportService,
	ScenarioManagementService,
} from "../libraryUseCaseContracts";
import { ScenarioEditorFactory } from "../scenarioEditor";
import { ApplicationObjectWriter } from "./applicationObjectWriter";
import { bindMethods } from "./bindMethods";
import { DefaultLibraryBackupService } from "./defaultLibraryBackupService";
import { DefaultLibraryBrowseService } from "./defaultLibraryBrowseService";
import { DefaultLibraryRecoveryService } from "./defaultLibraryRecoveryService";
import { DefaultObjectReadProblemService } from "./defaultObjectReadProblemService";
import { DefaultScenarioImportService } from "./defaultScenarioImportService";
import { DefaultScenarioManagementService } from "./defaultScenarioManagementService";
import { PersistenceOperationRegistry } from "./persistenceOperationRegistry";
import { WriteRecoveryCoordinator } from "./writeRecoveryCoordinator";

const browseMethods = [
	"listObjects",
	"loadRuleSet",
] as const satisfies readonly (keyof LibraryBrowseService)[];

const importMethods = [
	"importScenario",
	"resolveScenarioImport",
] as const satisfies readonly (keyof ScenarioImportService)[];

const managementMethods = [
	"saveRuleSet",
	"saveTemplate",
	"exportTemplate",
	"shareTemplate",
	"renameScenario",
	"deleteScenario",
] as const satisfies readonly (keyof ScenarioManagementService)[];

const backupMethods = [
	"exportLibraryBackup",
	"shareLibraryBackup",
	"restoreLibraryBackup",
	"prepareLibraryBackupRestore",
	"resolveLibraryBackupRestore",
] as const satisfies readonly (keyof LibraryBackupService)[];

const recoveryMethods = [
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
] as const satisfies readonly (keyof LibraryRecoveryService)[];

export function createLibraryUseCases(
	objectPersistence: ObjectPersistenceCapabilities,
	domainServices: DomainServices,
): LibraryUseCases {
	const persistenceOperations = new PersistenceOperationRegistry();
	const objectWriter = new ApplicationObjectWriter(objectPersistence.write);
	const browse = new DefaultLibraryBrowseService(objectPersistence.read);
	const scenarioImport = new DefaultScenarioImportService(
		objectPersistence.read,
		objectWriter,
		objectPersistence.transfer,
		objectPersistence.recovery,
		domainServices,
	);
	const management = new DefaultScenarioManagementService(
		objectPersistence.write,
		objectPersistence.transfer,
		objectWriter,
	);
	const backup = new DefaultLibraryBackupService(objectPersistence.transfer);
	const writeRecoveryCoordinator = new WriteRecoveryCoordinator(
		objectPersistence.recovery,
	);
	const recovery = new DefaultLibraryRecoveryService(
		objectPersistence.read,
		objectPersistence.recovery,
		writeRecoveryCoordinator,
	);
	const protectedBrowse: LibraryBrowseService = {
		listObjects: (kind) =>
			persistenceOperations.run(`list:${kind}`, () => browse.listObjects(kind)),
		loadRuleSet: (ruleSetId) =>
			persistenceOperations.run(`load:ruleSet:${ruleSetId}`, () =>
				browse.loadRuleSet(ruleSetId),
			),
	};
	const protectedImport: ScenarioImportService = {
		importScenario: (selection) =>
			persistenceOperations.run(
				`import:scenario:${persistenceOperations.argumentKey(selection)}`,
				() => scenarioImport.importScenario(selection),
				{
					decisionCommandId: (result) =>
						result.status === "decisionRequired" ? result.commandId : undefined,
				},
			),
		resolveScenarioImport: (commandId, resolution) =>
			persistenceOperations.continue(
				commandId,
				() => scenarioImport.resolveScenarioImport(commandId, resolution),
				{
					decisionCommandId: (result) =>
						result?.status === "decisionRequired"
							? result.commandId
							: undefined,
				},
			),
	};
	const protectedManagement: ScenarioManagementService = {
		saveRuleSet: (ruleSet) =>
			persistenceOperations.run(
				`save:ruleSet:${persistenceOperations.argumentKey(ruleSet)}`,
				() => management.saveRuleSet(ruleSet),
			),
		saveTemplate: (document) =>
			persistenceOperations.run(
				`save:template:${persistenceOperations.argumentKey(document)}`,
				() => management.saveTemplate(document),
			),
		exportTemplate: (document, decision) =>
			persistenceOperations.run(
				`export:template:${persistenceOperations.argumentKey(document)}:${decision ?? "default"}`,
				() => management.exportTemplate(document, decision),
			),
		shareTemplate: (document) =>
			persistenceOperations.run(
				`share:template:${persistenceOperations.argumentKey(document)}`,
				() => management.shareTemplate(document),
			),
		renameScenario: (request) =>
			persistenceOperations.run(
				`rename:${request.type}:${request.oldId}:${JSON.stringify(request.newName)}`,
				() => management.renameScenario(request),
			),
		deleteScenario: (type, id) =>
			persistenceOperations.run(`delete:${type}:${id}`, () =>
				management.deleteScenario(type, id),
			),
	};
	const protectedBackup: LibraryBackupService = {
		exportLibraryBackup: (decision) =>
			persistenceOperations.run(`export:library:${decision ?? "default"}`, () =>
				backup.exportLibraryBackup(decision),
			),
		shareLibraryBackup: () =>
			persistenceOperations.run("share:library", () =>
				backup.shareLibraryBackup(),
			),
		restoreLibraryBackup: (selection) =>
			persistenceOperations.run(
				`restore:library:${persistenceOperations.argumentKey(selection)}`,
				() => backup.restoreLibraryBackup(selection),
			),
		prepareLibraryBackupRestore: (selection) =>
			persistenceOperations.run(
				`prepare-restore:library:${persistenceOperations.argumentKey(selection)}`,
				() => backup.prepareLibraryBackupRestore(selection),
				{ decisionCommandId: (result) => result.commandId },
			),
		resolveLibraryBackupRestore: (commandId, resolution) =>
			persistenceOperations.continue(commandId, () =>
				backup.resolveLibraryBackupRestore(commandId, resolution),
			),
	};
	const protectedRecovery: LibraryRecoveryService = {
		inspectLibraryLoadProblem: () =>
			persistenceOperations.run("inspect:library", () =>
				recovery.inspectLibraryLoadProblem(),
			),
		restoreInternalBackup: () =>
			persistenceOperations.run("restore:library:internal-backup", () =>
				recovery.restoreInternalBackup(),
			),
		repairInternalLibrary: () =>
			persistenceOperations.run("repair:library", () =>
				recovery.repairInternalLibrary(),
			),
		createAndStoreEmptyLibrary: () =>
			persistenceOperations.run("create:library:empty", () =>
				recovery.createAndStoreEmptyLibrary(),
			),
		useEmptyLibraryInMemory: () =>
			persistenceOperations.run("use:library:empty", () =>
				recovery.useEmptyLibraryInMemory(),
			),
		exportInternalLibraryRaw: () =>
			persistenceOperations.run("export:library:raw", () =>
				recovery.exportInternalLibraryRaw(),
			),
		listWriteRecoveries: () =>
			persistenceOperations.run("list:library:write-recoveries", () =>
				recovery.listWriteRecoveries(),
			),
		resolveWriteRecovery: (commandId, resolution) =>
			persistenceOperations.continue(commandId, () =>
				recovery.resolveWriteRecovery(commandId, resolution),
			),
		finishInternalStorageCommand: (commandId) =>
			persistenceOperations.continue(commandId, () =>
				recovery.finishInternalStorageCommand(commandId),
			),
		exportFailedWrite: (recoveryKey) =>
			persistenceOperations.run(`export:failed-write:${recoveryKey}`, () =>
				recovery.exportFailedWrite(recoveryKey),
			),
	};
	return {
		editor: new ScenarioEditorFactory(),
		objectProblems: new DefaultObjectReadProblemService(
			objectPersistence.recovery,
		),
		browse: bindMethods(protectedBrowse, browseMethods),
		import: bindMethods(protectedImport, importMethods),
		management: bindMethods(protectedManagement, managementMethods),
		backup: bindMethods(protectedBackup, backupMethods),
		recovery: bindMethods(protectedRecovery, recoveryMethods),
	};
}
