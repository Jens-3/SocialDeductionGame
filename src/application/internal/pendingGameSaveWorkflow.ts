import type { GameState } from "../../domain/gameFactory";
import { renameGame, renameTemplate } from "../../domain/scenarioRenaming";
import { createUniqueNameAndId } from "../../domain/stringSanitizer";
import { isObjectSaveInterruptedError } from "../../persistence/objectSaveInterruptedError";
import type { ObjectRecoveryPort } from "../../persistence/ports/objectRecoveryPort";
import { expectedApplicationError } from "../applicationError";
import type { LoadedGameDocument } from "../gameTypes";
import { executeApplicationOperation } from "./applicationErrorMapping";
import type { GameCatalog } from "./gameCatalog";
import type {
	LoadedGameSaveSnapshot,
	LoadedGameSession,
} from "./loadedGameSession";
import type { PersistenceOperationRegistry } from "./persistenceOperationRegistry";

type PendingCreatedDocument = {
	category: "game" | "template";
	document: GameState;
	name: string;
	usedIds: Set<string>;
	snapshot?: LoadedGameSaveSnapshot;
};

/** Hält und orchestriert unterbrochene „Speichern unter“-Vorgänge. */
export class PendingGameSaveWorkflow {
	readonly #pendingCreatedDocuments = new Map<string, PendingCreatedDocument>();
	readonly #pendingLoadedGameSaves = new Map<string, LoadedGameSaveSnapshot>();

	constructor(
		private readonly recovery: ObjectRecoveryPort,
		private readonly session: LoadedGameSession,
		private readonly catalog: GameCatalog,
		private readonly operations: PersistenceOperationRegistry,
	) {}

	rememberInterruptedSave(
		error: unknown,
		category: "game" | "template",
		document: GameState,
		name: string,
		usedIds: Set<string>,
		snapshot?: LoadedGameSaveSnapshot,
	): void {
		if (isObjectSaveInterruptedError(error) && error.commandId)
			this.#pendingCreatedDocuments.set(error.commandId, {
				category,
				document,
				name,
				usedIds,
				...(snapshot ? { snapshot } : {}),
			});
	}

	rememberInterruptedLoadedGameSave(
		error: unknown,
		snapshot: LoadedGameSaveSnapshot,
	): void {
		if (isObjectSaveInterruptedError(error) && error.commandId)
			this.#pendingLoadedGameSaves.set(error.commandId, snapshot);
	}

	getInterruptedLoadedGameSave(
		commandId: string,
	): LoadedGameSaveSnapshot | undefined {
		return this.#pendingLoadedGameSaves.get(commandId);
	}

	finishInterruptedLoadedGameSave(commandId: string): void {
		this.#pendingLoadedGameSaves.delete(commandId);
	}

	async continuePendingCreatedDocument(
		commandId: string,
		decision: "retry" | "cancel" | "finishLater" | "overwrite" | "keepBoth",
	): Promise<LoadedGameDocument> {
		return this.operations.continue(commandId, () =>
			this.#continuePendingCreatedDocument(commandId, decision),
		);
	}

	async #continuePendingCreatedDocument(
		commandId: string,
		decision: "retry" | "cancel" | "finishLater" | "overwrite" | "keepBoth",
	): Promise<LoadedGameDocument> {
		const pending = this.#pendingCreatedDocuments.get(commandId);
		if (!pending)
			throw expectedApplicationError("resolve", "unknown", "decisionExpired");
		let finalDocument = pending.document;
		let finalName = pending.name;
		if (decision === "keepBoth") {
			const identity = createUniqueNameAndId(
				pending.name,
				pending.category,
				pending.usedIds,
				{ firstSuffix: 2, forceSuffix: true },
			);
			finalName = identity.name;
			finalDocument =
				pending.category === "template"
					? renameTemplate(pending.document, finalName)
					: renameGame(pending.document, finalName);
		}
		const continuation = await executeApplicationOperation(
			() =>
				this.recovery.continueObjectSave(
					commandId,
					decision,
					decision === "keepBoth" ? finalDocument : undefined,
				),
			"resolve",
		);
		if (continuation.status !== "completed")
			throw expectedApplicationError(
				"resolve",
				pending.category,
				"decisionExpired",
			);
		this.#pendingCreatedDocuments.delete(commandId);
		if (
			pending.category === "game" &&
			decision !== "cancel" &&
			decision !== "finishLater"
		) {
			if (continuation.savedObject && pending.snapshot)
				this.session.commitSavedGame(
					continuation.savedObject,
					pending.snapshot,
				);
			else
				this.session.openLoadedGame({
					storageKey: String(finalDocument.id),
					id: String(finalDocument.id),
					name: finalName,
					displayName: finalName,
					document: finalDocument,
				});
		}
		this.catalog.clearBrowseCache();
		return this.session.requireLoadedGame();
	}
}
