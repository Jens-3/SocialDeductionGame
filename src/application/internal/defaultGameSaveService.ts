import { renameGame } from "../../domain/scenarioRenaming";
import { createUniqueNameAndId } from "../../domain/stringSanitizer";
import { expectedApplicationError } from "../applicationError";
import type { LoadedGameDocument } from "../gameTypes";
import type { ApplicationObjectWriter } from "./applicationObjectWriter";
import type { GameCatalog } from "./gameCatalog";
import type { LoadedGameSession } from "./loadedGameSession";
import type { PendingGameSaveWorkflow } from "./pendingGameSaveWorkflow";
import type { PersistenceOperationRegistry } from "./persistenceOperationRegistry";

/** Speichert die geladene Game-Session regulär oder unter neuer Identität. */
export class DefaultGameSaveService {
	constructor(
		private readonly session: LoadedGameSession,
		private readonly catalog: GameCatalog,
		private readonly writer: ApplicationObjectWriter,
		private readonly pendingSave: PendingGameSaveWorkflow,
		private readonly operations: PersistenceOperationRegistry,
	) {}

	async saveLoadedGame(): Promise<LoadedGameDocument> {
		const snapshot = this.session.captureSaveSnapshot();
		return this.operations.run(saveOperationKey(snapshot), async () => {
			try {
				const saved = await this.writer.saveObject(snapshot.game.document, {
					previousStorageKey: snapshot.game.storageKey,
				});
				return this.session.commitSavedGame(saved, snapshot);
			} catch (error) {
				this.pendingSave.rememberInterruptedLoadedGameSave(error, snapshot);
				throw error;
			}
		});
	}

	async suggestLoadedGameSaveAsName(): Promise<string> {
		const snapshot = this.session.captureSaveSnapshot();
		return this.operations.run(
			`suggest-save-as:${saveOperationKey(snapshot)}`,
			async () => {
				const usedIds = await this.catalog.getStoredDocumentIds();
				return createUniqueNameAndId(snapshot.game.name, "game", usedIds, {
					forceSuffix: true,
				}).name;
			},
		);
	}

	async saveLoadedGameAs(name: string): Promise<LoadedGameDocument> {
		const snapshot = this.session.captureSaveSnapshot();
		const renamedDocument = renameGame(snapshot.game.document, name);
		const { id, name: renamedName } = renamedDocument;
		return this.operations.run(
			`${saveOperationKey(snapshot)}:as:${id}`,
			async () => {
				const usedIds = await this.catalog.getStoredDocumentIds();
				if (usedIds.has(id))
					throw expectedApplicationError(
						"save",
						"game",
						"targetExists",
						`id=${id}`,
					);
				try {
					const saved = await this.writer.saveObject(renamedDocument, {
						previousStorageKey: null,
						conflictPolicy: "reject",
					});
					return this.session.commitSavedGame(saved, snapshot);
				} catch (error) {
					this.pendingSave.rememberInterruptedSave(
						error,
						"game",
						renamedDocument,
						renamedName,
						usedIds,
						snapshot,
					);
					throw error;
				}
			},
		);
	}
}

function saveOperationKey(
	snapshot: ReturnType<LoadedGameSession["captureSaveSnapshot"]>,
): string {
	return `save:game:${snapshot.sessionGeneration}:${snapshot.documentRevision}`;
}
