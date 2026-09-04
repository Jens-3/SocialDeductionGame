import { language } from "../../config";
import type { GameState } from "../../domain/gameFactory";
import { getDisplayName } from "../../domain/localizedNames";
import { renameGame } from "../../domain/scenarioRenaming";
import { createUniqueNameAndId } from "../../domain/stringSanitizer";
import type {
	GameObjectSaveOptions,
	SavedStoredGameObject,
} from "../../persistence/objectPersistenceTypes";
import type { ObjectPersistenceCapabilities } from "../../persistence/ports/objectPersistenceCapabilities";
import { expectedApplicationError } from "../applicationError";
import type { ApplicationExportResult, ExportDecision } from "../exportTypes";
import type { RenameObjectSuccess } from "../objectSuccess";
import { executeApplicationOperation } from "./applicationErrorMapping";
import type { ApplicationObjectWriter } from "./applicationObjectWriter";
import {
	exportOptionsFromDecision,
	toApplicationExportResult,
} from "./exportResultMapping";
import type { GameCatalog } from "./gameCatalog";
import type { LoadedGameSession } from "./loadedGameSession";
import type { PersistenceOperationRegistry } from "./persistenceOperationRegistry";

/** Verwaltet Kopieren, Umbenennen, Export und Löschen gespeicherter Games. */
export class DefaultGameManagementService {
	readonly #persistence: ObjectPersistenceCapabilities;
	readonly #session: LoadedGameSession;
	readonly #catalog: GameCatalog;
	readonly #writer: ApplicationObjectWriter;
	readonly #operations: PersistenceOperationRegistry;

	constructor(
		persistence: ObjectPersistenceCapabilities,
		session: LoadedGameSession,
		catalog: GameCatalog,
		writer: ApplicationObjectWriter,
		operations: PersistenceOperationRegistry,
	) {
		this.#persistence = persistence;
		this.#session = session;
		this.#catalog = catalog;
		this.#writer = writer;
		this.#operations = operations;
	}

	async suggestSavedGameCopyName(storageKey: string): Promise<string> {
		return this.#operations.run(`suggest-copy:game:${storageKey}`, () =>
			this.#suggestSavedGameCopyName(storageKey),
		);
	}

	async #suggestSavedGameCopyName(storageKey: string): Promise<string> {
		const { document } = await executeApplicationOperation(
			() =>
				this.#persistence.read.loadObject("game", storageKey, {
					ansiFallbackLocale: language,
				}),
			"load",
		);
		const usedIds = await this.#catalog.getStoredDocumentIds();
		return createUniqueNameAndId(document.name.trim(), "game", usedIds, {
			forceSuffix: true,
		}).name;
	}

	async renameSavedGame(
		storageKey: string,
		newName: string,
	): Promise<RenameObjectSuccess> {
		return this.#operations.run(
			`rename:game:${storageKey}:${JSON.stringify(newName)}`,
			() => this.#renameSavedGame(storageKey, newName),
		);
	}

	async #renameSavedGame(
		storageKey: string,
		newName: string,
	): Promise<RenameObjectSuccess> {
		const loaded = await executeApplicationOperation(
			() =>
				this.#persistence.read.loadObject("game", storageKey, {
					ansiFallbackLocale: language,
				}),
			"load",
		);
		const isCurrentLoadedGame = this.#session.isCurrent(storageKey);
		if (isCurrentLoadedGame && this.#session.isLoadedGameDirty())
			throw expectedApplicationError("rename", "game", "protectedObject");
		const renamedDocument = renameGame(loaded.document, newName);
		const saved = await this.writeGameDocument(renamedDocument, {
			previousStorageKey: loaded.storageKey,
			conflictPolicy:
				renamedDocument.id === loaded.id && loaded.storageVariant === undefined
					? "replace"
					: "reject",
		});
		const { document, storageKey: renamedStorageKey } = saved;
		const { id, name } = document;
		if (isCurrentLoadedGame)
			this.#session.openLoadedGame({
				storageKey: renamedStorageKey,
				id,
				name,
				displayName: getDisplayName(document, language),
				document,
			});
		return { id, storageKey: renamedStorageKey, name };
	}

	async duplicateSavedGame(
		storageKey: string,
		newName: string,
	): Promise<{ id: string; storageKey: string; name: string }> {
		return this.#operations.run(
			`duplicate:game:${storageKey}:${JSON.stringify(newName)}`,
			() => this.#duplicateSavedGame(storageKey, newName),
		);
	}

	async #duplicateSavedGame(
		storageKey: string,
		newName: string,
	): Promise<{ id: string; storageKey: string; name: string }> {
		const loaded = await executeApplicationOperation(
			() =>
				this.#persistence.read.loadObject("game", storageKey, {
					ansiFallbackLocale: language,
				}),
			"load",
		);
		const renamedDocument = renameGame(loaded.document, newName);
		const { id } = renamedDocument;
		const usedIds = await this.#catalog.getStoredDocumentIds();
		if (usedIds.has(id))
			throw expectedApplicationError(
				"save",
				"game",
				"targetExists",
				`id=${id}`,
			);
		const saved = await this.writeGameDocument(renamedDocument, {
			previousStorageKey: null,
			conflictPolicy: "reject",
		});
		return {
			id: saved.document.id,
			storageKey: saved.storageKey,
			name: saved.document.name,
		};
	}

	async exportSavedGame(
		storageKey: string,
		decision?: Exclude<ExportDecision, "cancel">,
	): Promise<ApplicationExportResult> {
		return this.#operations.run(
			`export:game:${storageKey}:${decision ?? "default"}`,
			() => this.#exportSavedGame(storageKey, decision),
		);
	}

	async shareSavedGame(storageKey: string): Promise<ApplicationExportResult> {
		return this.#operations.run(`share:game:${storageKey}`, async () => {
			const { document: game } = await executeApplicationOperation(
				() =>
					this.#persistence.read.loadObject("game", storageKey, {
						ansiFallbackLocale: language,
					}),
				"load",
			);
			if (game.isTemplate)
				throw expectedApplicationError("export", "game", "wrongObjectKind");
			return toApplicationExportResult(
				await executeApplicationOperation(
					() =>
						this.#persistence.transfer.exportObject(game, {
							delivery: "share",
						}),
					"export",
				),
				"game",
			);
		});
	}

	async #exportSavedGame(
		storageKey: string,
		decision?: Exclude<ExportDecision, "cancel">,
	): Promise<ApplicationExportResult> {
		const { document: game } = await executeApplicationOperation(
			() =>
				this.#persistence.read.loadObject("game", storageKey, {
					ansiFallbackLocale: language,
				}),
			"load",
		);
		if (game.isTemplate)
			throw expectedApplicationError("export", "game", "wrongObjectKind");
		return toApplicationExportResult(
			await executeApplicationOperation(
				() =>
					this.#persistence.transfer.exportObject(
						game,
						exportOptionsFromDecision(decision),
					),
				"export",
			),
			"game",
		);
	}

	async deleteSavedGame(storageKey: string): Promise<void> {
		return this.#operations.run(`delete:game:${storageKey}`, () =>
			this.#deleteSavedGame(storageKey),
		);
	}

	async #deleteSavedGame(storageKey: string): Promise<void> {
		if (this.#session.isCurrent(storageKey))
			throw expectedApplicationError("delete", "game", "protectedObject");
		const loaded = await executeApplicationOperation(
			() =>
				this.#persistence.read.loadObject("game", storageKey, {
					ansiFallbackLocale: language,
				}),
			"load",
		);
		await executeApplicationOperation(
			() =>
				this.#persistence.write.deleteObject(
					{
						kind: "game",
						id: loaded.id,
						...(loaded.storageVariant
							? { storageVariant: loaded.storageVariant }
							: {}),
					},
					{ ansiFallbackLocale: language },
				),
			"delete",
		);
		this.#catalog.clearBrowseCache();
	}

	private async writeGameDocument(
		document: GameState,
		options: GameObjectSaveOptions,
	): Promise<SavedStoredGameObject> {
		return this.#writer.saveObject(document, options);
	}
}
