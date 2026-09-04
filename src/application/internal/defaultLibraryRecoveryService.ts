import { language } from "../../config";
import type { ObjectPersistenceProblemReason } from "../../persistence/objectPersistenceError";
import type {
	ObjectRecoveryResolution,
	ObjectStoreReadProblem,
} from "../../persistence/objectPersistenceTypes";
import type { ObjectReadPort } from "../../persistence/ports/objectReadPort";
import type { ObjectRecoveryPort } from "../../persistence/ports/objectRecoveryPort";
import { ApplicationInvariantError } from "../applicationError";
import type {
	LibraryLoadProblem,
	LibraryRecoveryService,
} from "../libraryUseCaseContracts";
import { normalizeLoadProblemActions } from "../loadProblemQueue";
import type {
	LibraryRepairSuccess,
	ObjectRecoverySuccess,
	ObjectRestoreSuccess,
} from "../objectSuccess";
import type { StorageRecoverySummary } from "../storageRecovery";
import { executeApplicationOperation } from "./applicationErrorMapping";
import { createApplicationObjectListResult } from "./applicationObjectListMapper";
import { describeDocumentSyntaxRepairs } from "./libraryRepairPresentation";
import type { WriteRecoveryCoordinator } from "./writeRecoveryCoordinator";

export class DefaultLibraryRecoveryService implements LibraryRecoveryService {
	constructor(
		private readonly read: ObjectReadPort,
		private readonly recovery: ObjectRecoveryPort,
		private readonly writeRecovery: WriteRecoveryCoordinator,
	) {}

	async inspectLibraryLoadProblem(): Promise<LibraryLoadProblem | undefined> {
		const snapshot = createApplicationObjectListResult(
			await executeApplicationOperation(
				() =>
					this.read.readAllObjectsOfType("ruleSet", {
						ansiFallbackLocale: language,
					}),
				"load",
			),
			language,
		);
		if (snapshot.status === "loaded") return undefined;
		const sources = await executeApplicationOperation(
			() =>
				this.recovery.inspectObjectStoreRecovery("ruleSet", {
					ansiFallbackLocale: language,
				}),
			"recover",
		);
		if (!sources)
			throw new ApplicationInvariantError(
				"Der Regelwerk-Store unterstützt keine storeweite Wiederherstellung.",
			);
		const { backupProblem, repairProblem } = sources;
		const canRestoreBackup = sources.hasBackup && backupProblem === undefined;
		const canRepair = sources.hasPrimary && repairProblem === undefined;
		const canExport = sources.hasPrimary;
		return {
			problemId: `store:ruleSet:${snapshot.problem.category}:${snapshot.problem.reason}`,
			source: snapshot.problem.category,
			operation: "load",
			subject: "library",
			reference: { kind: "library" },
			reason:
				sources.hasBackup && !sources.hasPrimary
					? "orphanedRecovery"
					: toLoadProblemReason(snapshot.problem),
			...(sources.hasBackup && !sources.hasPrimary
				? { recoverySource: "backup" as const }
				: {}),
			...(snapshot.problem.category === "serialization"
				? { invalidDocumentKind: "library" as const }
				: {}),
			hasReadableOriginal: sources.hasPrimary,
			hasReadableBackup: sources.hasBackup,
			canRestoreBackup,
			canRepair,
			canExport,
			availableActions: normalizeLoadProblemActions([
				...(canRestoreBackup ? (["restoreBackup"] as const) : []),
				...(canRepair ? (["repair"] as const) : []),
				"createEmpty",
				...(canExport ? (["export"] as const) : []),
				"later",
			]),
			...(backupProblem ? { backupProblem } : {}),
			...(repairProblem ? { repairProblem } : {}),
		};
	}

	async restoreInternalBackup(): Promise<ObjectRestoreSuccess> {
		await executeApplicationOperation(
			() =>
				this.recovery.restoreObjectStoreBackup("ruleSet", {
					ansiFallbackLocale: language,
				}),
			"recover",
		);
		return { status: "restored", kind: "library", source: "backup" };
	}

	async repairInternalLibrary(): Promise<LibraryRepairSuccess> {
		const repaired = await executeApplicationOperation(
			() =>
				this.recovery.repairObjectStore("ruleSet", {
					ansiFallbackLocale: language,
				}),
			"repair",
		);
		repaired.report.changes = [
			...describeDocumentSyntaxRepairs(repaired.syntaxRepairs),
			...repaired.report.changes,
		];
		return {
			status: "repaired",
			kind: "library",
			report: repaired.report,
		};
	}

	async createAndStoreEmptyLibrary(): Promise<void> {
		await executeApplicationOperation(
			() => this.recovery.createEmptyObjectStore("ruleSet", "stored"),
			"save",
		);
	}

	async useEmptyLibraryInMemory(): Promise<void> {
		await executeApplicationOperation(
			() => this.recovery.createEmptyObjectStore("ruleSet", "temporary"),
			"recover",
		);
	}

	async exportInternalLibraryRaw(): Promise<void> {
		await executeApplicationOperation(
			() => this.recovery.exportUnreadableObjectStore("ruleSet"),
			"export",
		);
	}

	async listWriteRecoveries(): Promise<StorageRecoverySummary[]> {
		return executeApplicationOperation(
			() =>
				this.writeRecovery.listWriteRecoveries({
					kinds: ["ruleSet"],
					id: () => "ruleSet",
				}),
			"recover",
		);
	}

	async resolveWriteRecovery(
		commandId: string,
		resolution: ObjectRecoveryResolution,
	): Promise<ObjectRecoverySuccess> {
		await executeApplicationOperation(
			() => this.writeRecovery.resolveWriteRecovery(commandId, resolution),
			"resolve",
		);
		return { status: "recovered", kind: "library" };
	}

	async finishInternalStorageCommand(commandId: string): Promise<void> {
		await executeApplicationOperation(
			() => this.writeRecovery.finishInternalStorageCommand(commandId),
			"resolve",
		);
	}

	async exportFailedWrite(recoveryKey: string): Promise<void> {
		await executeApplicationOperation(
			() => this.writeRecovery.exportFailedWrite(recoveryKey),
			"export",
		);
	}
}

function toLoadProblemReason(
	problem: ObjectStoreReadProblem,
): ObjectPersistenceProblemReason {
	switch (problem.reason) {
		case "missingLibrary":
		case "decodeFailed":
		case "invalidJson":
		case "invalidDocument":
			return problem.reason;
		case "unsupportedVersion":
			return "invalidDocument";
		case "encodingFailure":
			return "decodeFailed";
		case "storageFailure":
		case "serializationFailure":
			return "invalidDocument";
	}
}
