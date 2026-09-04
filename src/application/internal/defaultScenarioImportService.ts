import { language } from "../../config";
import type { DomainServices } from "../../domain/domainServices";
import type { GameState } from "../../domain/gameFactory";
import { hydrateGameState } from "../../domain/gameValidation";
import type { RuleSet } from "../../domain/ruleSet";
import { renameRuleSet, renameTemplate } from "../../domain/scenarioRenaming";
import { createUniqueNameAndId } from "../../domain/stringSanitizer";
import { isObjectStorageError } from "../../persistence/objectPersistenceError";
import type { ImportedObject } from "../../persistence/objectPersistenceTypes";
import { isObjectSaveInterruptedError } from "../../persistence/objectSaveInterruptedError";
import type { ObjectReadPort } from "../../persistence/ports/objectReadPort";
import type { ObjectRecoveryPort } from "../../persistence/ports/objectRecoveryPort";
import type { ObjectTransferPort } from "../../persistence/ports/objectTransferPort";
import { expectedApplicationError } from "../applicationError";
import type {
	ScenarioImportResult,
	ScenarioImportService,
	ScenarioImportSuccess,
} from "../libraryUseCaseContracts";
import type { ApplicationObjectListResult } from "../objectList";
import { ApplicationObjectListError } from "../objectList";
import { executeApplicationOperation } from "./applicationErrorMapping";
import { createApplicationObjectListResult } from "./applicationObjectListMapper";
import type { ApplicationObjectWriter } from "./applicationObjectWriter";

type PendingScenarioImport =
	| {
			kind: "template";
			object: GameState;
			name: string;
			storageCommandId?: string;
	  }
	| {
			kind: "ruleSet";
			object: RuleSet;
			name: string;
	  };

export class DefaultScenarioImportService implements ScenarioImportService {
	readonly #pendingImports = new Map<string, PendingScenarioImport>();

	constructor(
		private readonly read: ObjectReadPort,
		private readonly objectWriter: ApplicationObjectWriter,
		private readonly transfer: ObjectTransferPort,
		private readonly recovery: ObjectRecoveryPort,
		private readonly domainServices: DomainServices,
	) {}

	async importScenario(selection: unknown): Promise<ScenarioImportResult> {
		const decoded = await executeApplicationOperation(
			() =>
				this.transfer.importObject(selection, {
					ansiFallbackLocale: language,
				}),
			"import",
		);
		if ("status" in decoded)
			return {
				status: decoded.status,
				decisionKind: decoded.decisionKind,
				commandId: decoded.commandId,
				reason: decoded.problem.reason,
				availableActions: decoded.availableDecisions,
				...(decoded.problem.diagnostic
					? { diagnostic: decoded.problem.diagnostic }
					: {}),
			};
		return this.#importPreparedScenario(decoded);
	}

	async #importPreparedScenario(
		decoded: ImportedObject,
	): Promise<ScenarioImportResult> {
		if (decoded.kind === "ruleSet") {
			const ruleSet = decoded.object;
			const current = (await this.#readLoadedSnapshot("ruleSet")).metadata.find(
				(summary) => summary.id === ruleSet.id,
			);
			if (current && ruleSet.version < current.version) {
				throw expectedApplicationError(
					"import",
					"ruleSet",
					"decisionRequired",
					`currentVersion=${current.version}; importedVersion=${ruleSet.version}`,
				);
			}
			try {
				await this.objectWriter.saveObject(ruleSet, {
					conflictPolicy: "reject",
				});
				return scenarioImportSuccess(ruleSet, "ruleSet");
			} catch (error) {
				if (!isScenarioTargetExists(error)) throw error;
				const commandId = this.domainServices.idGenerator.createId("import");
				this.#pendingImports.set(commandId, {
					kind: "ruleSet",
					object: ruleSet,
					name: ruleSet.name,
				});
				return {
					status: "decisionRequired",
					decisionKind: "importConflict",
					reason: "targetExists",
					commandId,
					type: "ruleSet",
					availableActions: ["overwrite", "keepBoth", "cancel"],
					existing: {
						id: current?.id ?? ruleSet.id,
						name: current?.name ?? ruleSet.id,
					},
					imported: {
						id: ruleSet.id,
						name: ruleSet.name,
						...decoded.sourceMetadata,
					},
				};
			}
		}

		if (decoded.kind === "template") {
			const document = decoded.object;
			const templateName = document.name.trim()
				? document.name.trim()
				: document.id;
			const existing = await executeApplicationOperation(
				() =>
					this.transfer.inspectImportTarget("template", document.id, {
						ansiFallbackLocale: language,
					}),
				"validate",
			);
			try {
				return await this.#storeImportedTemplate(document, templateName, true);
			} catch (error) {
				if (!isScenarioTargetExists(error)) throw error;
				const storageCommandId =
					isObjectSaveInterruptedError(error) && error.commandId
						? error.commandId
						: undefined;
				const commandId =
					storageCommandId ??
					this.domainServices.idGenerator.createId("import");
				this.#pendingImports.set(commandId, {
					kind: "template",
					object: document,
					name: templateName,
					...(storageCommandId ? { storageCommandId } : {}),
				});
				const existingMetadata =
					existing.status === "exists"
						? existing
						: {
								id: document.id,
								name: document.id,
								schemaVersion: undefined,
							};
				return {
					status: "decisionRequired",
					decisionKind: "importConflict",
					reason: "targetExists",
					commandId,
					type: "template",
					availableActions: ["overwrite", "keepBoth", "cancel"],
					existing: {
						id: existingMetadata.id,
						name: existingMetadata.name,
						...(existingMetadata.schemaVersion === undefined
							? {}
							: { schemaVersion: existingMetadata.schemaVersion }),
					},
					imported: {
						id: document.id,
						name: templateName,
						...decoded.sourceMetadata,
					},
				};
			}
		}
		throw expectedApplicationError(
			"import",
			"unknown",
			"wrongObjectKind",
			`actualKind=${decoded.kind}`,
		);
	}

	async resolveScenarioImport(
		commandId: string,
		resolution: "overwrite" | "keepBoth" | "repair" | "cancel",
	): Promise<ScenarioImportResult | undefined> {
		const pending = this.#pendingImports.get(commandId);
		if (!pending) {
			if (resolution !== "repair" && resolution !== "cancel")
				throw expectedApplicationError("resolve", "unknown", "decisionExpired");
			const repaired = await executeApplicationOperation(
				() => this.transfer.resolveObjectImport(commandId, resolution),
				"resolve",
			);
			if (!repaired) return undefined;
			return this.#importPreparedScenario(repaired);
		}
		if (resolution === "repair")
			throw expectedApplicationError(
				"resolve",
				pending.kind,
				"invalidDecision",
			);
		if (resolution === "cancel") {
			if (pending.kind === "template" && pending.storageCommandId)
				await executeApplicationOperation(
					() =>
						this.recovery.continueObjectSave(
							pending.storageCommandId ?? commandId,
							"cancel",
						),
					"resolve",
				);
			this.#pendingImports.delete(commandId);
			return undefined;
		}
		if (resolution === "overwrite") {
			if (pending.kind === "ruleSet") {
				await this.objectWriter.saveObject(pending.object, {
					conflictPolicy: "replace",
				});
				this.#pendingImports.delete(commandId);
				return scenarioImportSuccess(pending.object, "ruleSet");
			}
			if (pending.storageCommandId) {
				await executeApplicationOperation(
					() =>
						this.recovery.continueObjectSave(
							pending.storageCommandId ?? commandId,
							"overwrite",
						),
					"resolve",
				);
				this.#pendingImports.delete(commandId);
				return scenarioImportSuccess(pending.object, "template");
			}
			const result = await this.#storeImportedTemplate(
				pending.object,
				pending.name,
				false,
			);
			this.#pendingImports.delete(commandId);
			return result;
		}

		let retryablePending = pending;
		if (pending.kind === "template" && pending.storageCommandId) {
			await executeApplicationOperation(
				() =>
					this.recovery.continueObjectSave(
						pending.storageCommandId ?? commandId,
						"cancel",
					),
				"resolve",
			);
			retryablePending = {
				kind: "template",
				object: pending.object,
				name: pending.name,
			};
			this.#pendingImports.set(commandId, retryablePending);
		}
		const usedIds = new Set(
			(await this.#readLoadedSnapshot(retryablePending.kind)).ids,
		);
		const identity = createUniqueNameAndId(
			retryablePending.name,
			retryablePending.kind,
			usedIds,
			{
				firstSuffix: 2,
				forceSuffix: true,
			},
		);
		if (retryablePending.kind === "ruleSet") {
			const renamedRuleSet = renameRuleSet(
				retryablePending.object,
				identity.name,
				{ language },
			);
			await this.objectWriter.saveObject(renamedRuleSet, {
				conflictPolicy: "reject",
			});
			this.#pendingImports.delete(commandId);
			return scenarioImportSuccess(renamedRuleSet, "ruleSet");
		}
		const renamedTemplate = renameTemplate(
			retryablePending.object,
			identity.name,
		);
		const result = await this.#storeImportedTemplate(
			renamedTemplate,
			renamedTemplate.name,
			true,
		);
		this.#pendingImports.delete(commandId);
		return result;
	}

	async #storeImportedTemplate(
		document: GameState,
		name: string,
		createOnly: boolean,
	): Promise<ScenarioImportSuccess> {
		const template = hydrateGameState(document);
		if (!template.isTemplate)
			throw expectedApplicationError("import", "template", "wrongObjectKind");
		await this.objectWriter.saveObject(template, {
			previousStorageKey: null,
			conflictPolicy: createOnly ? "reject" : "replace",
		});
		return {
			status: "imported",
			kind: "template",
			id: template.id,
			name,
		};
	}

	async #readObjectList<K extends "template" | "ruleSet">(
		kind: K,
	): Promise<ApplicationObjectListResult<K>> {
		return createApplicationObjectListResult(
			await executeApplicationOperation(
				() =>
					this.read.readAllObjectsOfType(kind, {
						ansiFallbackLocale: language,
					}),
				"list",
			),
			language,
		);
	}

	async #readLoadedSnapshot<K extends "template" | "ruleSet">(
		kind: K,
	): Promise<Extract<ApplicationObjectListResult<K>, { status: "loaded" }>> {
		const snapshot = await this.#readObjectList(kind);
		if (snapshot.status === "expectedFailure")
			throw new ApplicationObjectListError(snapshot.problem);
		return snapshot;
	}
}

function isScenarioTargetExists(error: unknown): boolean {
	return (
		(isObjectSaveInterruptedError(error) && error.reason === "targetExists") ||
		(isObjectStorageError(error) && error.reason === "targetExists")
	);
}

function scenarioImportSuccess(
	object: RuleSet | GameState,
	kind: "ruleSet" | "template",
): ScenarioImportSuccess {
	return {
		status: "imported",
		kind,
		id: object.id,
		name: object.name,
	};
}
