import { language } from "../../config";
import type { DomainServices } from "../../domain/domainServices";
import type { GameState } from "../../domain/gameFactory";
import { renameGame } from "../../domain/scenarioRenaming";
import { createUniqueNameAndId } from "../../domain/stringSanitizer";
import { isObjectStorageError } from "../../persistence/objectPersistenceError";
import type { ImportedObject } from "../../persistence/objectPersistenceTypes";
import { isObjectSaveInterruptedError } from "../../persistence/objectSaveInterruptedError";
import type { ObjectPersistenceCapabilities } from "../../persistence/ports/objectPersistenceCapabilities";
import { expectedApplicationError } from "../applicationError";
import type {
	SavedGameImportResult,
	SavedGameImportSuccess,
} from "../gameTypes";
import { executeApplicationOperation } from "./applicationErrorMapping";
import type { ApplicationObjectWriter } from "./applicationObjectWriter";
import type { GameCatalog } from "./gameCatalog";

/** Importiert gespeicherte Spiele und hält offene Importentscheidungen. */
export class DefaultGameImportService {
	readonly #persistence: ObjectPersistenceCapabilities;
	readonly #domainServices: DomainServices;
	readonly #catalog: GameCatalog;
	readonly #writer: ApplicationObjectWriter;
	readonly #pendingGameImports = new Map<
		string,
		{
			document: GameState;
			name: string;
			storageCommandId?: string;
		}
	>();

	constructor(
		persistence: ObjectPersistenceCapabilities,
		domainServices: DomainServices,
		catalog: GameCatalog,
		writer: ApplicationObjectWriter,
	) {
		this.#persistence = persistence;
		this.#domainServices = domainServices;
		this.#catalog = catalog;
		this.#writer = writer;
	}

	async importSavedGame(selection: unknown): Promise<SavedGameImportResult> {
		const imported = await executeApplicationOperation(
			() =>
				this.#persistence.transfer.importObject(selection, {
					ansiFallbackLocale: language,
				}),
			"import",
		);
		if ("status" in imported)
			return {
				status: imported.status,
				decisionKind: imported.decisionKind,
				commandId: imported.commandId,
				reason: imported.problem.reason,
				availableActions: imported.availableDecisions,
				...(imported.problem.diagnostic
					? { diagnostic: imported.problem.diagnostic }
					: {}),
			};
		return this.importPreparedSavedGame(imported);
	}

	async resolveSavedGameImport(
		commandId: string,
		resolution: "overwrite" | "keepBoth" | "repair" | "cancel",
	): Promise<SavedGameImportResult | undefined> {
		const pending = this.#pendingGameImports.get(commandId);
		if (!pending) {
			if (resolution !== "repair" && resolution !== "cancel")
				throw expectedApplicationError("resolve", "game", "decisionExpired");
			const repaired = await executeApplicationOperation(
				() =>
					this.#persistence.transfer.resolveObjectImport(commandId, resolution),
				"resolve",
			);
			if (!repaired) return undefined;
			return this.importPreparedSavedGame(repaired);
		}
		if (resolution === "repair")
			throw expectedApplicationError("resolve", "game", "invalidDecision");
		if (resolution === "cancel") {
			if (pending.storageCommandId)
				await executeApplicationOperation(
					() =>
						this.#persistence.recovery.continueObjectSave(
							pending.storageCommandId ?? commandId,
							"cancel",
						),
					"resolve",
				);
			this.#pendingGameImports.delete(commandId);
			return undefined;
		}
		if (resolution === "overwrite") {
			if (pending.storageCommandId) {
				await executeApplicationOperation(
					() =>
						this.#persistence.recovery.continueObjectSave(
							pending.storageCommandId ?? commandId,
							"overwrite",
						),
					"resolve",
				);
				this.#catalog.clearBrowseCache();
				this.#pendingGameImports.delete(commandId);
				return importedGameSuccess(pending.document, pending.name);
			}
			const result = await this.storeImportedGame(
				pending.document,
				pending.name,
				false,
			);
			this.#pendingGameImports.delete(commandId);
			return result;
		}
		let retryablePending = pending;
		if (pending.storageCommandId) {
			await executeApplicationOperation(
				() =>
					this.#persistence.recovery.continueObjectSave(
						pending.storageCommandId ?? commandId,
						"cancel",
					),
				"resolve",
			);
			retryablePending = {
				document: pending.document,
				name: pending.name,
			};
			this.#pendingGameImports.set(commandId, retryablePending);
		}
		const usedIds = await this.#catalog.getStoredDocumentIds();
		const identity = createUniqueNameAndId(
			retryablePending.name,
			"game",
			usedIds,
			{
				firstSuffix: 2,
				forceSuffix: true,
			},
		);
		const renamedDocument = renameGame(
			retryablePending.document,
			identity.name,
		);
		const result = await this.storeImportedGame(
			renamedDocument,
			renamedDocument.name,
			true,
		);
		this.#pendingGameImports.delete(commandId);
		return result;
	}

	private async importPreparedSavedGame(
		imported: ImportedObject,
	): Promise<SavedGameImportResult> {
		if (imported.kind !== "game")
			throw expectedApplicationError(
				"import",
				"game",
				"wrongObjectKind",
				`actualKind=${imported.kind}`,
			);
		const document = imported.object;
		const id = document.id;
		const name = document.name.trim();
		const existing = await executeApplicationOperation(
			() =>
				this.#persistence.transfer.inspectImportTarget("game", id, {
					ansiFallbackLocale: language,
				}),
			"validate",
		);
		try {
			return await this.storeImportedGame(document, name, true);
		} catch (error) {
			if (!isTargetExists(error)) throw error;
			const storageCommandId =
				isObjectSaveInterruptedError(error) && error.commandId
					? error.commandId
					: undefined;
			const commandId =
				storageCommandId ?? this.#domainServices.idGenerator.createId("import");
			this.#pendingGameImports.set(commandId, {
				document,
				name,
				...(storageCommandId ? { storageCommandId } : {}),
			});
			const existingMetadata =
				existing.status === "exists"
					? existing
					: { id, name: id, schemaVersion: undefined };
			return {
				status: "decisionRequired",
				decisionKind: "importConflict",
				reason: "targetExists",
				commandId,
				availableActions: ["overwrite", "keepBoth", "cancel"],
				existing: {
					id: existingMetadata.id,
					name: existingMetadata.name,
					...(existingMetadata.schemaVersion === undefined
						? {}
						: { schemaVersion: existingMetadata.schemaVersion }),
				},
				imported: { id, name, ...imported.sourceMetadata },
			};
		}
	}

	private async storeImportedGame(
		document: GameState,
		name: string,
		createOnly: boolean,
	): Promise<SavedGameImportSuccess> {
		await this.#writer.saveObject(document, {
			previousStorageKey: null,
			conflictPolicy: createOnly ? "reject" : "replace",
			identityPolicy: "preserve",
		});
		return {
			status: "imported",
			kind: "game",
			id: document.id,
			name,
		};
	}
}

function isTargetExists(error: unknown): boolean {
	return (
		(isObjectSaveInterruptedError(error) && error.reason === "targetExists") ||
		(isObjectStorageError(error) && error.reason === "targetExists")
	);
}

function importedGameSuccess(
	document: GameState,
	name: string,
): SavedGameImportSuccess {
	return {
		status: "imported",
		kind: "game",
		id: document.id,
		name,
	};
}
