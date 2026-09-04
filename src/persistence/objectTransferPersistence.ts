import type { DomainServices } from "../domain/domainServices";
import type { GameState } from "../domain/gameFactory";
import { repairGameDocument } from "../domain/gameRepair";
import { hydrateGameState, repairGameDraft } from "../domain/gameValidation";
import { repairRecoveredLibrary } from "../domain/libraryContainerRepair";
import type { RuleSet } from "../domain/ruleSet";
import { repairRuleSet } from "../domain/ruleSetRepair";
import { createRuleSetFromDraft } from "../domain/ruleSetValidation";
import type { GameDocument } from "../serialization/gameDocument";
import { decodeCurrentGameDocument } from "../serialization/gameDocumentFormat";
import { decodeJsonBytes } from "../serialization/jsonEncoding";
import { parseRepairableJsonBytes } from "../serialization/jsonRepair";
import { parseJsonWithDetails } from "../serialization/jsonSyntaxError";
import { recoverLibraryStructure } from "../serialization/libraryRepair";
import { decodeScenarioDocument } from "../serialization/scenarioDocument";
import {
	captureSerialization,
	isSerializationOperationError,
} from "../serialization/serializationFailure";
import type { GameObjectPersistence } from "./gameObjectPersistence";
import {
	ObjectPersistenceError,
	ObjectSerializationError,
	ObjectStorageError,
} from "./objectPersistenceError";
import type {
	ImportedObject,
	ImportSourceMetadata,
	ImportTargetMetadata,
	ObjectDecodingOptions,
	ObjectExportOptions,
	ObjectExportResult,
	ObjectImportPreparation,
	ObjectStoreImportResolution,
	PersistedObjectKind,
	PreparedObjectStoreRestore,
} from "./objectPersistenceTypes";
import {
	type DataFileStorage,
	hasDataFileCapability,
	unsupportedDataFileCapability,
} from "./ports/dataFileStorage";
import type { ObjectTransferPort } from "./ports/objectTransferPort";
import { isStorageOperationError } from "./ports/storageFailure";
import type { RuleSetObjectPersistence } from "./ruleSetObjectPersistence";
import { translateSerializationFailure } from "./serializationFailureTranslation";
import {
	requireStorageOperationSuccess,
	translateStorageFailure,
} from "./storageFailureTranslation";
import { translateStorageWriteError } from "./storageWriteErrorTranslation";

type PersistableDomainObject = GameState | RuleSet;

/** Interne Implementierung der Import-/Export-Capability. */
export class ObjectTransferPersistence implements ObjectTransferPort {
	readonly #pendingObjectImportRepairs = new Map<
		string,
		{ bytes: Uint8Array; ansiFallbackLocale: string }
	>();

	constructor(
		private readonly storage: DataFileStorage,
		private readonly games: GameObjectPersistence,
		private readonly ruleSets: RuleSetObjectPersistence,
		private readonly domainServices: DomainServices,
	) {}

	async importObject(
		selection: unknown,
		options: ObjectDecodingOptions,
	): Promise<ObjectImportPreparation> {
		const bytes = await this.readExternalBytes(selection);
		try {
			return this.decodeImportedObject(
				this.decodeExternalJsonBytes(bytes, options.ansiFallbackLocale),
			);
		} catch (error) {
			if (
				!(error instanceof ObjectSerializationError) ||
				error.reason === "unsupportedVersion" ||
				!error.repairable
			)
				throw error;
			const repaired = this.tryRepairImportedObject(
				bytes,
				options.ansiFallbackLocale,
			);
			if (!repaired) throw error;
			const commandId = this.domainServices.idGenerator.createId("import");
			this.#pendingObjectImportRepairs.set(commandId, {
				bytes,
				ansiFallbackLocale: options.ansiFallbackLocale,
			});
			return {
				status: "decisionRequired",
				decisionKind: "serializationRepair",
				commandId,
				problem: {
					category: "serialization",
					reason: error.reason,
					repairable: error.repairable,
					...(error.diagnostic ? { diagnostic: error.diagnostic } : {}),
					...(error.details ? { details: error.details } : {}),
				},
				availableDecisions: ["repair", "cancel"],
			};
		}
	}

	resolveObjectImport(
		commandId: string,
		resolution: "repair" | "cancel",
	): Promise<ImportedObject | undefined> {
		const pending = this.#pendingObjectImportRepairs.get(commandId);
		if (!pending)
			return Promise.reject(
				new Error("Der Import-Reparaturauftrag ist nicht mehr aktiv."),
			);
		this.#pendingObjectImportRepairs.delete(commandId);
		if (resolution === "cancel") return Promise.resolve(undefined);
		const repaired = this.tryRepairImportedObject(
			pending.bytes,
			pending.ansiFallbackLocale,
		);
		if (!repaired)
			return Promise.reject(
				new Error("Die Importdatei konnte nicht repariert werden."),
			);
		return Promise.resolve(repaired);
	}

	async exportObject(
		object: PersistableDomainObject,
		options: ObjectExportOptions = {},
	): Promise<ObjectExportResult> {
		if (!hasDataFileCapability(this.storage, "writeExternal"))
			throw unsupportedDataFileCapability("writeExternal");
		const gameObject = isGameState(object);
		const bytes = gameObject
			? this.games.encodeObject(object, object.isTemplate ? "template" : "game")
			: this.ruleSets.encodeObject(object);
		try {
			await requireStorageOperationSuccess(
				this.storage.writeExternal(bytes, {
					suggestedFileName: `${object.id}.json`,
					...options,
					...(gameObject
						? object.isTemplate
							? { description: "Vorlage" }
							: {}
						: { description: "Regelwerk" }),
				}),
				"export",
			);
			return { status: "exported" };
		} catch (error) {
			if (isObjectExportConflict(error))
				return {
					status: "conflict",
					reason: "targetExists",
					continuation: "restart",
					...(error.diagnostic ? { diagnostic: error.diagnostic } : {}),
				};
			if (error instanceof ObjectPersistenceError) throw error;
			if (isStorageOperationError(error))
				throw translateStorageFailure(error.failure, "export");
			throw error;
		}
	}

	inspectImportTarget(
		kind: "game" | "template",
		id: string,
		options: ObjectDecodingOptions,
	): Promise<ImportTargetMetadata> {
		return this.games.inspectImportTarget(kind, id, options.ansiFallbackLocale);
	}

	async prepareObjectStoreRestore(
		kind: PersistedObjectKind,
		selection: unknown,
		options: ObjectDecodingOptions,
	): Promise<PreparedObjectStoreRestore> {
		requireRuleSetStore(kind, "save");
		const bytes = await this.readExternalBytes(selection);
		const commandId = this.domainServices.idGenerator.createId("import");
		try {
			const source = this.decodeExternalJsonBytes(
				bytes,
				options.ansiFallbackLocale,
			);
			if (!isRuleSetStoreDocument(source))
				throw new ObjectSerializationError(
					"Die Datei enthält keinen vollständigen RuleSet-Store.",
					"decode",
					false,
					undefined,
					"invalidDocument",
				);
			return await translateSerializationErrorAsync(() =>
				this.ruleSets.prepareLibraryRestore(
					source,
					commandId,
					options.ansiFallbackLocale,
				),
			);
		} catch (error) {
			if (
				!(error instanceof ObjectSerializationError) ||
				error.reason === "unsupportedVersion"
			)
				throw error;
			const repaired = this.tryRepairRuleSetStore(
				bytes,
				options.ansiFallbackLocale,
			);
			if (!repaired) throw error;
			return translateSerializationErrorAsync(() =>
				this.ruleSets.prepareLibraryRestore(
					repaired,
					commandId,
					options.ansiFallbackLocale,
					true,
				),
			);
		}
	}

	resolveObjectStoreRestore(
		kind: PersistedObjectKind,
		commandId: string,
		resolution: ObjectStoreImportResolution,
	): Promise<void> {
		requireRuleSetStore(kind, "save");
		return translateStorageWriteError(() =>
			this.ruleSets.resolveLibraryRestore(commandId, resolution),
		);
	}

	async exportObjectStore(
		kind: PersistedObjectKind,
		decoding: ObjectDecodingOptions,
		options: ObjectExportOptions = {},
	): Promise<ObjectExportResult> {
		requireRuleSetStore(kind, "export");
		try {
			await translateStorageWriteError(
				() => this.ruleSets.exportLibrary(decoding.ansiFallbackLocale, options),
				"export",
			);
			return { status: "exported" };
		} catch (error) {
			if (isObjectExportConflict(error))
				return {
					status: "conflict",
					reason: "targetExists",
					continuation: "restart",
					...(error.diagnostic ? { diagnostic: error.diagnostic } : {}),
				};
			throw error;
		}
	}

	private async readExternalBytes(selection: unknown): Promise<Uint8Array> {
		if (!hasDataFileCapability(this.storage, "readExternal"))
			throw unsupportedDataFileCapability("readExternal");
		try {
			return await requireStorageOperationSuccess(
				this.storage.readExternal(selection),
				"import",
			);
		} catch (error) {
			if (isAbortError(error) || error instanceof ObjectPersistenceError)
				throw error;
			if (isStorageOperationError(error))
				throw translateStorageFailure(error.failure, "import");
			throw error;
		}
	}

	private decodeExternalJsonBytes(
		bytes: Uint8Array,
		ansiFallbackLocale: string,
	): unknown {
		try {
			const { text } = decodeJsonBytes(bytes, ansiFallbackLocale);
			return parseJsonWithDetails(text);
		} catch (error) {
			if (error instanceof ObjectPersistenceError) throw error;
			if (isSerializationOperationError(error))
				throw translateSerializationFailure(error.failure);
			throw new ObjectSerializationError(
				error instanceof Error ? error.message : String(error),
				"decode",
				false,
				undefined,
				"decodeFailed",
			);
		}
	}

	private decodeImportedObject(source: unknown): ImportedObject {
		const sourceMetadata = readImportSourceMetadata(source);
		if (isRuleSetStoreDocument(source))
			throw new ObjectSerializationError(
				"Die Datei enthält einen vollständigen RuleSet-Store.",
				"decode",
				false,
				undefined,
				"invalidDocument",
			);
		const decoded = translateSerializationError(() =>
			decodeScenarioDocument(source),
		);
		if (decoded.kind === "ruleSet")
			return {
				kind: "ruleSet",
				object: createRuleSetFromDraft(decoded.document).ruleSet,
				sourceMetadata,
			};
		const object = createImportedGameObject(decoded.document);
		return {
			kind: object.isTemplate ? "template" : "game",
			object,
			sourceMetadata,
		};
	}

	private tryRepairImportedObject(
		bytes: Uint8Array,
		ansiFallbackLocale: string,
	): ImportedObject | undefined {
		try {
			const parsed = parseRepairableJsonBytes(bytes, ansiFallbackLocale);
			if (parsed.status !== "successful") return undefined;
			const source = parsed.value;
			if (isRuleSetStoreDocument(source)) return undefined;
			const sourceMetadata = readImportSourceMetadata(source);
			if (looksLikeRuleSetDocument(source)) {
				const repaired = repairRuleSet(source).ruleSet;
				return { kind: "ruleSet", object: repaired, sourceMetadata };
			}
			const repaired = repairGameDocument(
				decodeCurrentGameDocument(source),
			).document;
			return {
				kind: repaired.isTemplate ? "template" : "game",
				object: repaired,
				sourceMetadata,
			};
		} catch {
			return undefined;
		}
	}

	private tryRepairRuleSetStore(
		bytes: Uint8Array,
		ansiFallbackLocale: string,
	): unknown {
		try {
			const parsed = parseRepairableJsonBytes(bytes, ansiFallbackLocale);
			if (parsed.status !== "successful") return undefined;
			return repairRecoveredLibrary(recoverLibraryStructure(parsed.value))
				.document;
		} catch {
			return undefined;
		}
	}
}

function isGameState(object: PersistableDomainObject): object is GameState {
	return "isTemplate" in object;
}

function isRuleSetStoreDocument(value: unknown): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		(("storageType" in value &&
			value.storageType === "social-deduction-app-library") ||
			"ruleSetsById" in value)
	);
}

function looksLikeRuleSetDocument(
	value: unknown,
): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		(("fileType" in value && value.fileType === "social-deduction-ruleset") ||
			("teams" in value &&
				Array.isArray(value.teams) &&
				"roles" in value &&
				Array.isArray(value.roles)))
	);
}

function isObjectExportConflict(
	error: unknown,
): error is ObjectStorageError & { reason: "targetExists" } {
	return error instanceof ObjectStorageError && error.reason === "targetExists";
}

function requireRuleSetStore(
	kind: PersistedObjectKind,
	operation: "save" | "export",
): asserts kind is "ruleSet" {
	if (kind === "ruleSet") return;
	throw new ObjectStorageError(undefined, operation, false);
}

function createImportedGameObject(document: GameDocument): GameState {
	const repaired = repairGameDraft(document);
	if (typeof repaired === "string")
		throw new ObjectSerializationError(
			repaired,
			"decode",
			false,
			undefined,
			"invalidDocument",
		);
	return hydrateGameState(repaired.draft);
}

function readImportSourceMetadata(source: unknown): ImportSourceMetadata {
	if (typeof source !== "object" || source === null || Array.isArray(source))
		return {};
	const schemaVersion = (source as Record<string, unknown>).schemaVersion;
	return typeof schemaVersion === "number" ? { schemaVersion } : {};
}

function translateSerializationError<T>(operation: () => T): T {
	const result = captureSerialization(operation);
	if (result.status === "error")
		throw translateSerializationFailure(result.error);
	return result.value;
}

async function translateSerializationErrorAsync<T>(
	operation: () => Promise<T>,
): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		if (error instanceof ObjectPersistenceError) throw error;
		if (isSerializationOperationError(error))
			throw translateSerializationFailure(error.failure);
		throw error;
	}
}

function isAbortError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		error.name === "AbortError"
	);
}
