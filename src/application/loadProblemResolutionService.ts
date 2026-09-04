import type { LibraryRepairReport } from "../domain/libraryContainerRepair";
import type { GamePersistenceService } from "./gameUseCases";
import type {
	LibraryBrowseService,
	LibraryLoadProblem,
	LibraryRecoveryService,
} from "./libraryUseCases";
import type {
	LoadProblemAction,
	LoadProblemDecisionService,
	LoadProblemDescriptor,
} from "./loadProblemQueue";
import { loadProblemGroupKey } from "./loadProblemQueue";
import type { ApplicationObjectReadProblem } from "./objectList";
import type { ObjectReadProblemService } from "./objectReadProblemService";
import type { StorageRecoverySummary } from "./storageRecovery";

export type QueuedLoadProblem = LoadProblemDescriptor &
	(
		| { queueType: "write"; value: StorageRecoverySummary }
		| { queueType: "object"; value: ApplicationObjectReadProblem }
		| { queueType: "library"; value: LibraryLoadProblem }
	);

export type RememberedLoadProblemResult = {
	applied: boolean;
	libraryRepairReport?: LibraryRepairReport;
};

export type AppliedRememberedProblem = {
	problem: QueuedLoadProblem;
	libraryRepairReport?: LibraryRepairReport;
};

export class LoadProblemResolutionService {
	#applyingRemembered?: Promise<void>;

	constructor(
		private readonly decisions: LoadProblemDecisionService,
		private readonly gamePersistenceService?: GamePersistenceService,
		private readonly libraryRecoveryService?: LibraryRecoveryService,
		private readonly objectReadProblemService?: ObjectReadProblemService,
		private readonly libraryBrowseService?: LibraryBrowseService,
	) {}

	problemsForDisplay(
		problems: readonly QueuedLoadProblem[],
	): QueuedLoadProblem[] {
		return problems.filter(
			(problem) => this.decisions.getRememberedAction(problem) === undefined,
		);
	}

	matchingProblemCount(
		problems: readonly QueuedLoadProblem[],
		problem: QueuedLoadProblem,
	): number {
		const groupKey = loadProblemGroupKey(problem);
		return problems.filter(
			(candidate) => loadProblemGroupKey(candidate) === groupKey,
		).length;
	}

	processingKey(problems: readonly QueuedLoadProblem[]): string {
		return JSON.stringify(
			problems.map((problem) => [
				loadProblemGroupKey(problem),
				problemIdentity(problem),
			]),
		);
	}

	forget(problem: LoadProblemDescriptor): void {
		this.decisions.forget(problem);
	}

	/** Führt eine von der Application angebotene Aktion aus. */
	async resolve(
		problem: QueuedLoadProblem,
		action: LoadProblemAction,
		shouldRemember = false,
	): Promise<RememberedLoadProblemResult> {
		if (!problem.availableActions.includes(action)) return { applied: false };
		if (shouldRemember) this.decisions.remember(problem, action);

		if (problem.queueType === "write") {
			if (problem.value.kind === "ruleSet") {
				if (!this.libraryRecoveryService) return { applied: false };
				if (action === "export")
					await this.libraryRecoveryService.exportFailedWrite(
						problem.value.recoveryKey,
					);
				if (action === "later" || action === "export")
					await this.libraryRecoveryService.finishInternalStorageCommand(
						problem.value.commandId,
					);
				else if (
					action === "keepOld" ||
					action === "keepNew" ||
					action === "keepBoth"
				)
					await this.libraryRecoveryService.resolveWriteRecovery(
						problem.value.commandId,
						action,
					);
				else return { applied: false };
			} else {
				if (!this.gamePersistenceService) return { applied: false };
				if (action === "export")
					await this.gamePersistenceService.exportFailedWrite(
						problem.value.recoveryKey,
					);
				if (action === "later" || action === "export")
					await this.gamePersistenceService.finishInternalStorageCommand(
						problem.value.commandId,
					);
				else if (
					action === "keepOld" ||
					action === "keepNew" ||
					action === "keepBoth"
				)
					await this.gamePersistenceService.resolveWriteRecovery(
						problem.value.commandId,
						action,
					);
				else return { applied: false };
			}
			return { applied: true };
		}

		if (problem.queueType === "object") {
			if (action === "later") return { applied: true };
			if (action === "retry") {
				const snapshot =
					problem.value.kind === "ruleSet"
						? await this.libraryBrowseService?.listObjects("ruleSet")
						: await this.gamePersistenceService?.listObjects(
								problem.value.kind,
							);
				return {
					applied:
						snapshot?.status === "loaded" &&
						!snapshot.problems.some(
							(candidate) => candidate.problemId === problem.value.problemId,
						),
				};
			}
			if (!this.objectReadProblemService) return { applied: false };
			if (action === "export")
				await this.objectReadProblemService.export(problem.value);
			else if (action === "delete")
				await this.objectReadProblemService.delete(problem.value);
			else if (
				action === "repair" ||
				action === "repairFileName" ||
				action === "keepBoth"
			) {
				const success = await this.objectReadProblemService.repair(
					problem.value,
					action,
				);
				this.gamePersistenceService?.clearBrowseCache?.();
				return {
					applied: true,
					...(success.report ? { libraryRepairReport: success.report } : {}),
				};
			} else return { applied: false };
			this.gamePersistenceService?.clearBrowseCache?.();
			return { applied: true };
		}

		if (!this.libraryRecoveryService) return { applied: false };
		if (action === "restoreBackup")
			await this.libraryRecoveryService.restoreInternalBackup();
		else if (action === "repair") {
			const success = await this.libraryRecoveryService.repairInternalLibrary();
			return { applied: true, libraryRepairReport: success.report };
		} else if (action === "createEmpty")
			await this.libraryRecoveryService.createAndStoreEmptyLibrary();
		else if (action === "export")
			await this.libraryRecoveryService.exportInternalLibraryRaw();
		else if (action === "later")
			await this.libraryRecoveryService.useEmptyLibraryInMemory();
		else return { applied: false };
		return { applied: true };
	}

	applyRemembered(
		problems: readonly QueuedLoadProblem[],
		onApplied: (applied: AppliedRememberedProblem) => void | Promise<void>,
	): Promise<void> {
		if (this.#applyingRemembered) return this.#applyingRemembered;
		const applying = this.#applyRemembered(problems, onApplied).finally(() => {
			if (this.#applyingRemembered === applying)
				this.#applyingRemembered = undefined;
		});
		this.#applyingRemembered = applying;
		return applying;
	}

	async #applyRemembered(
		problems: readonly QueuedLoadProblem[],
		onApplied: (applied: AppliedRememberedProblem) => void | Promise<void>,
	): Promise<void> {
		if (problems.length === 0) {
			this.decisions.clear();
			return;
		}
		for (const problem of problems) {
			const action = this.decisions.getRememberedAction(problem);
			if (!action) continue;
			if (!problem.availableActions.includes(action)) {
				this.decisions.forget(problem);
				continue;
			}
			try {
				const result = await this.resolve(problem, action);
				if (!result.applied) {
					this.decisions.forget(problem);
					continue;
				}
				await onApplied({
					problem,
					...(result.libraryRepairReport
						? { libraryRepairReport: result.libraryRepairReport }
						: {}),
				});
			} catch (error) {
				this.decisions.forget(problem);
				throw error;
			}
		}
	}
}

function problemIdentity(problem: QueuedLoadProblem): string {
	if (problem.queueType === "write") return `write:${problem.value.commandId}`;
	if (problem.queueType === "object") return problem.value.problemId;
	return problem.value.problemId;
}
