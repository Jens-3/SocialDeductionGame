import type { ObjectRecoveryResolution } from "../../persistence/objectPersistenceTypes";
import type { ObjectRecoveryPort } from "../../persistence/ports/objectRecoveryPort";
import { expectedApplicationError } from "../applicationError";
import type { LoadedGameDocument } from "../gameTypes";
import type { ObjectRecoverySuccess } from "../objectSuccess";
import type { StorageRecoverySummary } from "../storageRecovery";
import {
	createContextualApplicationOperationError,
	executeApplicationOperation,
} from "./applicationErrorMapping";
import type { GameCatalog } from "./gameCatalog";
import type { LoadedGameSession } from "./loadedGameSession";
import type { PendingGameSaveWorkflow } from "./pendingGameSaveWorkflow";
import type { PersistenceOperationRegistry } from "./persistenceOperationRegistry";
import type { WriteRecoveryCoordinator } from "./writeRecoveryCoordinator";

/** Orchestriert Wiederaufnahme und Auflösung unterbrochener Game-Schreibvorgänge. */
export class DefaultGameRecoveryService {
	readonly #recovery: ObjectRecoveryPort;
	readonly #session: LoadedGameSession;
	readonly #catalog: GameCatalog;
	readonly #writeRecovery: WriteRecoveryCoordinator;
	readonly #pendingSave: PendingGameSaveWorkflow;
	readonly #operations: PersistenceOperationRegistry;
	readonly #writeRecoveriesByCommandId = new Map<
		string,
		StorageRecoverySummary
	>();

	constructor(
		recovery: ObjectRecoveryPort,
		session: LoadedGameSession,
		catalog: GameCatalog,
		writeRecovery: WriteRecoveryCoordinator,
		pendingSave: PendingGameSaveWorkflow,
		operations: PersistenceOperationRegistry,
	) {
		this.#recovery = recovery;
		this.#session = session;
		this.#catalog = catalog;
		this.#writeRecovery = writeRecovery;
		this.#pendingSave = pendingSave;
		this.#operations = operations;
	}

	async listWriteRecoveries(
		category?: "game" | "template",
	): Promise<StorageRecoverySummary[]> {
		return this.#operations.run(
			`list:write-recoveries:${category ?? "all"}`,
			() => this.#listWriteRecoveries(category),
		);
	}

	async #listWriteRecoveries(
		category?: "game" | "template",
	): Promise<StorageRecoverySummary[]> {
		const summaries = await executeApplicationOperation(
			() =>
				this.#writeRecovery.listWriteRecoveries({
					kinds: category ? [category] : ["game", "template"],
				}),
			"recover",
		);
		for (const summary of summaries)
			this.#writeRecoveriesByCommandId.set(summary.commandId, summary);
		return summaries;
	}

	async resolveWriteRecovery(
		commandId: string,
		resolution: ObjectRecoveryResolution | "cancel",
	): Promise<ObjectRecoverySuccess | undefined> {
		return this.#operations.continue(commandId, () =>
			this.#resolveWriteRecovery(commandId, resolution),
		);
	}

	async #resolveWriteRecovery(
		commandId: string,
		resolution: ObjectRecoveryResolution | "cancel",
	): Promise<ObjectRecoverySuccess | undefined> {
		const summary =
			this.#writeRecoveriesByCommandId.get(commandId) ??
			(await this.listWriteRecoveries()).find(
				(candidate) => candidate.commandId === commandId,
			);
		if (!summary)
			throw expectedApplicationError("resolve", "unknown", "decisionExpired");
		try {
			await this.#writeRecovery.resolveWriteRecovery(commandId, resolution);
		} catch (error) {
			throw createContextualApplicationOperationError(error, "recover");
		}
		this.#writeRecoveriesByCommandId.delete(commandId);
		this.#pendingSave.finishInterruptedLoadedGameSave(commandId);
		this.#catalog.clearBrowseCache();
		if (resolution === "cancel") return undefined;
		return {
			status: "recovered",
			kind: summary.kind,
			id: summary.id,
			...(summary.recoverySource
				? { recoverySource: summary.recoverySource }
				: {}),
		};
	}

	async finishInternalStorageCommand(commandId: string): Promise<void> {
		return this.#operations.continue(commandId, () =>
			this.#finishInternalStorageCommand(commandId),
		);
	}

	async #finishInternalStorageCommand(commandId: string): Promise<void> {
		await executeApplicationOperation(
			() => this.#writeRecovery.finishInternalStorageCommand(commandId),
			"resolve",
		);
		this.#pendingSave.finishInterruptedLoadedGameSave(commandId);
	}

	async retryLoadedGameSave(commandId: string): Promise<LoadedGameDocument> {
		return this.#operations.continue(commandId, () =>
			this.#retryLoadedGameSave(commandId),
		);
	}

	async #retryLoadedGameSave(commandId: string): Promise<LoadedGameDocument> {
		this.#session.requireLoadedGame();
		const snapshot = this.#pendingSave.getInterruptedLoadedGameSave(commandId);
		if (!snapshot)
			throw expectedApplicationError("resolve", "game", "decisionExpired");
		const confirmation = await executeApplicationOperation(
			() => this.#recovery.continueObjectSave(commandId, "retry"),
			"save",
		);
		if (confirmation.status !== "completed" || !confirmation.savedObject)
			throw expectedApplicationError("resolve", "game", "decisionExpired");
		this.#pendingSave.finishInterruptedLoadedGameSave(commandId);
		this.#catalog.clearBrowseCache();
		return this.#session.commitSavedGame(confirmation.savedObject, snapshot);
	}

	async exportFailedWrite(recoveryKey: string): Promise<void> {
		return this.#operations.run(`export:failed-write:${recoveryKey}`, () =>
			executeApplicationOperation(
				() => this.#writeRecovery.exportFailedWrite(recoveryKey),
				"export",
			),
		);
	}
}
