import { language } from "../../config";
import type { DomainServices } from "../../domain/domainServices";
import { createUniqueNameAndId } from "../../domain/stringSanitizer";
import { createTemplateFromGame } from "../../domain/templateFactory";
import { expectedApplicationError } from "../applicationError";
import type { SaveLoadedGameAsTemplateResult } from "../gameTypes";
import type { ApplicationObjectWriter } from "./applicationObjectWriter";
import type { GameCatalog } from "./gameCatalog";
import type { LoadedGameSession } from "./loadedGameSession";
import type { PendingGameSaveWorkflow } from "./pendingGameSaveWorkflow";
import type { PersistenceOperationRegistry } from "./persistenceOperationRegistry";

/** Erzeugt aus der geladenen Game-Session eine neue persistierte Vorlage. */
export class DefaultGameTemplateService {
	constructor(
		private readonly domainServices: DomainServices,
		private readonly session: LoadedGameSession,
		private readonly catalog: GameCatalog,
		private readonly writer: ApplicationObjectWriter,
		private readonly pendingSave: PendingGameSaveWorkflow,
		private readonly operations: PersistenceOperationRegistry,
	) {}

	async suggestLoadedGameTemplateName(): Promise<string> {
		const snapshot = this.session.captureSaveSnapshot();
		return this.operations.run(
			`suggest-template:${snapshot.sessionGeneration}:${snapshot.documentRevision}`,
			async () => {
				const usedIds = await this.catalog.getStoredDocumentIds();
				return createUniqueNameAndId(
					`${snapshot.game.name} Vorlage`,
					"template",
					usedIds,
				).name;
			},
		);
	}

	async saveLoadedGameAsTemplate(
		name: string,
	): Promise<SaveLoadedGameAsTemplateResult> {
		const snapshot = this.session.captureSaveSnapshot();
		const result = createTemplateFromGame({
			services: this.domainServices,
			game: snapshot.game.document,
			name,
			language,
		});
		return this.operations.run(
			`save:template:${snapshot.sessionGeneration}:${snapshot.documentRevision}:${result.template.id}`,
			async () => {
				const usedIds = await this.catalog.getStoredDocumentIds();
				if (usedIds.has(result.template.id))
					throw expectedApplicationError(
						"save",
						"template",
						"targetExists",
						`id=${result.template.id}`,
					);
				try {
					await this.writer.saveObject(result.template, {
						previousStorageKey: null,
						conflictPolicy: "reject",
					});
				} catch (error) {
					this.pendingSave.rememberInterruptedSave(
						error,
						"template",
						result.template,
						result.template.name,
						usedIds,
					);
					throw error;
				}
				return result;
			},
		);
	}
}
