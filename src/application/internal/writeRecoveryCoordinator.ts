import { language } from "../../config";
import type {
	ObjectRecoveryKind,
	ObjectRecoveryResolution,
	PreparedWriteRecovery,
} from "../../persistence/objectPersistenceTypes";
import type { ObjectRecoveryPort } from "../../persistence/ports/objectRecoveryPort";
import {
	normalizeLoadProblemActions,
	sortLoadProblems,
} from "../loadProblemQueue";
import type { StorageRecoverySummary } from "../storageRecovery";

type WriteRecoveryListOptions = {
	kinds: ObjectRecoveryKind[];
	id?: (prepared: PreparedWriteRecovery) => string;
};

/** Gemeinsame Application-Orchestrierung für unterbrochene Schreibvorgänge. */
export class WriteRecoveryCoordinator {
	constructor(private readonly recovery: ObjectRecoveryPort) {}

	async listWriteRecoveries(
		options: WriteRecoveryListOptions,
	): Promise<StorageRecoverySummary[]> {
		const summaries: StorageRecoverySummary[] = [];
		for (const prepared of await this.recovery.prepareWriteRecoveries(
			options.kinds,
			{ ansiFallbackLocale: language },
		)) {
			const validationProblem = prepared.validationProblem;
			const canKeepNew = prepared.hasNew && validationProblem === undefined;
			summaries.push({
				status: "decisionRequired",
				decisionKind: "writeRecovery",
				commandId: prepared.commandId,
				recoveryKey: prepared.recoveryKey,
				id: options.id?.(prepared) ?? prepared.id,
				kind: prepared.kind,
				hasNew: prepared.hasNew,
				canKeepNew,
				availableActions: normalizeLoadProblemActions([
					"keepOld",
					...(canKeepNew ? (["keepNew", "keepBoth"] as const) : []),
					...(prepared.hasNew ? (["export"] as const) : []),
					"later",
				]),
				...(prepared.recoverySource
					? { recoverySource: prepared.recoverySource }
					: {}),
				reason: prepared.hasNew ? "interruptedWrite" : "orphanedRecovery",
				...(validationProblem ? { validationProblem } : {}),
			});
		}
		return sortLoadProblems(summaries, (problem) => problem.recoveryKey);
	}

	resolveWriteRecovery(
		commandId: string,
		resolution: ObjectRecoveryResolution | "cancel",
	): Promise<void> {
		return this.recovery.resolveWriteRecovery(commandId, resolution);
	}

	finishInternalStorageCommand(commandId: string): Promise<void> {
		return this.recovery.finishStorageCommand(commandId);
	}

	exportFailedWrite(recoveryKey: string): Promise<void> {
		return this.recovery.exportFailedWrite(recoveryKey);
	}
}
