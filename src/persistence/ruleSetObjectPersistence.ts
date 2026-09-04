import {
	DomainOperationError,
	isDomainOperationError,
} from "../domain/domainFailure";
import { repairRecoveredLibrary } from "../domain/libraryContainerRepair";
import type { RuleSet } from "../domain/ruleSet";
import {
	assertRuleSetExportable,
	createRuleSetFromDraft,
} from "../domain/ruleSetValidation";
import type { ValidId } from "../domain/stringSanitizer";
import { decodeJsonBytes } from "../serialization/jsonEncoding";
import {
	type JsonRepairOperation,
	parseRepairableJsonBytes,
} from "../serialization/jsonRepair";
import { parseJsonWithDetails } from "../serialization/jsonSyntaxError";
import {
	decodeCurrentLibraryCandidates,
	decodeCurrentLibraryDocument,
} from "../serialization/libraryDocument";
import {
	createEmptyLibraryDocument,
	recoverLibraryStructure,
} from "../serialization/libraryRepair";
import {
	createLibraryRuleSetJson,
	encodeLibraryCandidateFragments,
	encodeLibraryDocument,
} from "../serialization/librarySerializer";
import {
	assertSupportedRuleSetDocument,
	decodeRuleSetDocument,
} from "../serialization/ruleSetDocument";
import { encodeRuleSetExportDocument } from "../serialization/ruleSetExport";
import { isSerializationOperationError } from "../serialization/serializationFailure";
import { internalFileReference } from "./internalDocumentFileName";
import {
	ObjectSerializationError,
	ObjectStorageError,
} from "./objectPersistenceError";
import type {
	CachedRuleSet,
	ImportedRuleSetLibrary,
	RuleSetLibraryCache,
	RuleSetLibraryRecoverySources,
} from "./objectPersistenceInternalTypes";
import type {
	DocumentSyntaxRepair,
	ObjectContentProblem,
	ObjectExportOptions,
	ObjectListResult,
	ObjectReadProblemForKind,
	ObjectStoreImportResolution,
	ObjectStoreRecoveryInspection,
	PersistedObjectWriteResult,
	PreparedObjectStoreRestore,
	RepairedObjectStore,
	RuleSetObjectMetadata,
} from "./objectPersistenceTypes";
import type {
	DataFileReadResult,
	DataFileStorage,
} from "./ports/dataFileStorage";
import {
	hasDataFileCapability,
	unsupportedDataFileCapability,
} from "./ports/dataFileStorage";
import { translateSerializationFailure } from "./serializationFailureTranslation";
import {
	requireStorageOperationSuccess,
	translateStorageFailure,
} from "./storageFailureTranslation";

export class RuleSetObjectPersistence {
	#cache?: RuleSetLibraryCache;
	#usingTemporaryCache = false;
	readonly #pendingRestores = new Map<
		string,
		{
			validObjects: RuleSetLibraryCache;
			repairedObjects?: RuleSetLibraryCache;
			hasDiscardedObjects: boolean;
			requiresRepair: boolean;
		}
	>();

	constructor(private readonly storage: DataFileStorage) {}

	async readAllObjectMetadata(
		ansiFallbackLocale: string,
	): Promise<ObjectListResult<"ruleSet">> {
		const cache = await this.loadLibrary(ansiFallbackLocale);
		const metadata: RuleSetObjectMetadata[] = [];
		const problems: ObjectReadProblemForKind<"ruleSet">[] = [];
		for (const [id, candidate] of cache.ruleSetsById) {
			if (candidate.status === "valid") metadata.push(candidate.summary);
			else if (candidate.category === "serialization")
				problems.push({
					scope: "object",
					category: "serialization",
					kind: "ruleSet",
					id,
					reason: candidate.reason,
					repairable: candidate.repairable,
					...(candidate.diagnostic ? { diagnostic: candidate.diagnostic } : {}),
					...(candidate.details ? { details: candidate.details } : {}),
				});
			else
				problems.push({
					scope: "object",
					category: "domain",
					kind: "ruleSet",
					id,
					reason: candidate.reason,
					repairable: candidate.repairable,
					...(candidate.diagnostic ? { diagnostic: candidate.diagnostic } : {}),
					...(candidate.details ? { details: candidate.details } : {}),
				});
		}
		return {
			status: "loaded",
			metadata,
			problems,
			ids: [...cache.ruleSetsById.keys()],
		};
	}

	async loadObject(id: string, ansiFallbackLocale: string): Promise<RuleSet> {
		const cached = (
			await this.loadLibrary(ansiFallbackLocale)
		).ruleSetsById.get(id);
		if (!cached) throw new ObjectStorageError(undefined, "load", false);
		if (cached.status === "invalid" && cached.category === "domain")
			throw new DomainOperationError({
				source: "domain",
				operation: "validate",
				reason: cached.reason,
				repairable: cached.repairable,
				...(cached.diagnostic ? { diagnostic: cached.diagnostic } : {}),
				...(cached.details ? { details: cached.details } : {}),
			});
		if (cached.status === "invalid")
			throw new ObjectSerializationError(
				cached.diagnostic,
				"decode",
				cached.repairable,
				cached.details,
				cached.reason,
			);
		return parseCachedRuleSet(cached.json);
	}

	async saveObject(
		ruleSet: RuleSet,
		ansiFallbackLocale: string,
		conflictPolicy: "reject" | "replace" = "replace",
	): Promise<RuleSet> {
		if (!hasDataFileCapability(this.storage, "writeInternal"))
			throw unsupportedDataFileCapability("writeInternal");
		const validated = createRuleSetFromDraft(ruleSet, {
			mode: "stored",
		}).ruleSet;
		const cache = await this.loadLibrary(ansiFallbackLocale);
		this.#assertWritableCache();
		if (conflictPolicy === "reject" && cache.ruleSetsById.has(validated.id))
			throw new ObjectStorageError(undefined, "save", false, "targetExists");
		cache.ruleSetsById.set(validated.id, cacheRuleSet(validated));
		await this.writeLibrary(cache);
		return validated;
	}

	async deleteObject(id: string, ansiFallbackLocale: string): Promise<void> {
		const cache = await this.loadLibrary(ansiFallbackLocale);
		this.#assertWritableCache();
		if (!cache.ruleSetsById.has(id))
			throw new ObjectStorageError(undefined, "delete", false);
		cache.ruleSetsById.delete(id);
		await this.writeLibrary(cache);
	}

	async replaceObject(
		oldId: ValidId,
		ruleSet: RuleSet,
		ansiFallbackLocale: string,
	): Promise<PersistedObjectWriteResult<"ruleSet", RuleSet>> {
		const validated = createRuleSetFromDraft(ruleSet, {
			mode: "stored",
		}).ruleSet;
		const cache = await this.loadLibrary(ansiFallbackLocale);
		this.#assertWritableCache();
		if (!cache.ruleSetsById.has(oldId))
			throw new ObjectStorageError(undefined, "save", false);
		if (validated.id !== oldId && cache.ruleSetsById.has(validated.id))
			throw new ObjectStorageError(undefined, "save", false, "targetExists");
		cache.ruleSetsById.delete(oldId);
		cache.ruleSetsById.set(validated.id, cacheRuleSet(validated));
		await this.writeLibrary(cache);
		return {
			document: validated,
			reference: {
				kind: "ruleSet",
				id: validated.id,
				storageKey: validated.id,
			},
		};
	}

	encodeObject(ruleSet: RuleSet): Uint8Array {
		assertRuleSetExportable(ruleSet);
		return encodeRuleSetExportDocument(ruleSet);
	}

	clearCache(): void {
		if (this.#usingTemporaryCache) return;
		this.#cache = undefined;
	}

	async writeLibrary(cache = this.#cache): Promise<void> {
		if (!hasDataFileCapability(this.storage, "writeInternal"))
			throw unsupportedDataFileCapability("writeInternal");
		if (!cache) throw new Error("Der RuleSet-Library-Cache fehlt.");
		this.#assertWritableCache();
		this.#cache = cache;
		await requireStorageOperationSuccess(
			this.storage.writeInternal(
				internalFileReference("library", "library"),
				encodeLibraryCache(cache),
				{ backup: true },
			),
		);
	}

	async exportLibrary(
		ansiFallbackLocale: string,
		options: ObjectExportOptions = {},
	): Promise<void> {
		if (!hasDataFileCapability(this.storage, "writeExternal"))
			throw unsupportedDataFileCapability("writeExternal");
		const cache = await this.loadLibrary(ansiFallbackLocale);
		await requireStorageOperationSuccess(
			this.storage.writeExternal(encodeLibraryCache(cache), {
				suggestedFileName: "library_backup.json",
				description: "Bibliothek",
				...options,
			}),
		);
	}

	async restoreLibrary(cache: RuleSetLibraryCache): Promise<void> {
		if (!hasDataFileCapability(this.storage, "writeInternal"))
			throw unsupportedDataFileCapability("writeInternal");
		await requireStorageOperationSuccess(
			this.storage.writeInternal(
				internalFileReference("library", "library"),
				encodeLibraryCache(cache),
				{ backup: true },
			),
		);
		this.#cache = cache;
		this.#usingTemporaryCache = false;
	}

	async createEmptyLibrary(mode: "stored" | "temporary"): Promise<void> {
		const document = decodeCurrentLibraryDocument(createEmptyLibraryDocument());
		const bytes = encodeLibraryDocument(document);
		if (mode === "stored") {
			await this.writeRecoveredLibrary(bytes, "und");
			return;
		}
		this.#cache = this.decodeLibraryBytes(bytes, "und");
		this.#usingTemporaryCache = true;
	}

	async loadLibrary(ansiFallbackLocale: string): Promise<RuleSetLibraryCache> {
		if (this.#cache) return this.#cache;
		const result = await this.storage.readInternal(
			internalFileReference("library", "library"),
		);
		if (result.status === "error") {
			if (result.error.reason === "notFound")
				throw new ObjectStorageError(
					result.error.diagnostic,
					"load",
					false,
					"missingLibrary",
					result.error,
					{ kind: "ruleSet" },
				);
			throw translateStorageFailure(result.error, "load");
		}
		const bytes = result.bytes;
		const cache = this.decodeLibraryBytes(bytes, ansiFallbackLocale);
		this.#cache = cache;
		return cache;
	}

	decodeLibraryBytes(
		bytes: Uint8Array,
		ansiFallbackLocale: string,
	): RuleSetLibraryCache {
		let text: string;
		try {
			text = decodeJsonBytes(bytes, ansiFallbackLocale).text;
		} catch (error) {
			if (isSerializationOperationError(error))
				throw translateSerializationFailure(error.failure, {
					kind: "ruleSet",
				});
			throw error;
		}
		let parsed: unknown;
		try {
			parsed = parseJsonWithDetails(text);
		} catch (error) {
			if (isSerializationOperationError(error))
				throw translateSerializationFailure(error.failure, {
					kind: "ruleSet",
				});
			throw error;
		}
		try {
			return createLibraryCache(parsed);
		} catch (error) {
			if (isSerializationOperationError(error))
				throw translateSerializationFailure(error.failure, {
					kind: "ruleSet",
				});
			throw error;
		}
	}

	validateLibraryBytes(
		bytes: Uint8Array,
		ansiFallbackLocale: string,
	): ObjectContentProblem | undefined {
		try {
			this.decodeLibraryBytes(bytes, ansiFallbackLocale);
		} catch (error) {
			if (!(error instanceof ObjectSerializationError)) throw error;
			return {
				category: "serialization",
				reason: error.reason,
				repairable: error.repairable,
				...(error.diagnostic ? { diagnostic: error.diagnostic } : {}),
				...(error.details ? { details: error.details } : {}),
			};
		}
		return undefined;
	}

	decodeLibraryImport(value: unknown): ImportedRuleSetLibrary {
		const decoded = decodeCurrentLibraryCandidates(value);
		const ruleSetsById = new Map<string, CachedRuleSet>();
		const discardedRuleSetIds: string[] = [];
		const problems: ObjectReadProblemForKind<"ruleSet">[] = [];
		for (const candidate of decoded.ruleSetCandidates) {
			if (candidate.status === "invalid") {
				const failure = candidate.error.failure;
				discardedRuleSetIds.push(candidate.recordId);
				problems.push({
					scope: "object",
					category: "serialization",
					kind: "ruleSet",
					id: candidate.recordId,
					reason: failure.reason,
					repairable: failure.repairable,
					...(failure.diagnostic ? { diagnostic: failure.diagnostic } : {}),
					...(failure.details ? { details: failure.details } : {}),
				});
				continue;
			}
			const { recordId, document } = candidate;
			try {
				const ruleSet = createRuleSetFromDraft(document, {
					mode: "stored",
				}).ruleSet;
				if (ruleSet.id !== recordId) {
					discardedRuleSetIds.push(recordId);
					problems.push({
						scope: "object",
						category: "domain",
						kind: "ruleSet",
						id: recordId,
						reason: "invalidObject",
						repairable: true,
						details: `Die fachliche ID "${ruleSet.id}" stimmt nicht mit dem Library-Schlüssel "${recordId}" überein.`,
					});
					continue;
				}
				ruleSetsById.set(recordId, cacheRuleSet(ruleSet));
			} catch (error) {
				if (!isDomainOperationError(error)) throw error;
				const failure = error.failure;
				discardedRuleSetIds.push(recordId);
				problems.push({
					scope: "object",
					category: "domain",
					kind: "ruleSet",
					id: recordId,
					reason: failure.reason,
					repairable: failure.repairable,
					...(failure.diagnostic ? { diagnostic: failure.diagnostic } : {}),
					...(failure.details ? { details: failure.details } : {}),
				});
			}
		}
		return {
			cache: { metadata: decoded.metadata, ruleSetsById },
			storageVersion: 1,
			totalObjectCount: decoded.ruleSetCandidates.length,
			discardedRuleSetIds,
			problems,
		};
	}

	async prepareLibraryRestore(
		value: unknown,
		commandId: string,
		ansiFallbackLocale: string,
		requiresRepair = false,
	): Promise<PreparedObjectStoreRestore> {
		const imported = this.decodeLibraryImport(value);
		const repairedObjects =
			imported.discardedRuleSetIds.length > 0
				? createLibraryCache(
						repairRecoveredLibrary(recoverLibraryStructure(value)).document,
					)
				: undefined;
		let currentStorageVersion: number | undefined;
		try {
			currentStorageVersion = (await this.loadLibrary(ansiFallbackLocale))
				.metadata.storageVersion;
		} catch {
			// Eine defekte bestehende Bibliothek darf durch einen gültigen Import
			// ersetzt werden.
		}
		this.#pendingRestores.set(commandId, {
			validObjects: imported.cache,
			...(repairedObjects ? { repairedObjects } : {}),
			hasDiscardedObjects: imported.discardedRuleSetIds.length > 0,
			requiresRepair,
		});
		return {
			commandId,
			...(currentStorageVersion === undefined ? {} : { currentStorageVersion }),
			importedStorageVersion: imported.storageVersion,
			totalObjectCount: imported.totalObjectCount,
			validObjectCount: imported.cache.ruleSetsById.size,
			discardedObjectCount: imported.discardedRuleSetIds.length,
			discardedRuleSetIds: imported.discardedRuleSetIds,
			problems: imported.problems,
			availableDecisions: requiresRepair
				? (["repair", "cancel"] as const)
				: imported.discardedRuleSetIds.length > 0
					? (["repair", "importValidObjects", "cancel"] as const)
					: (["replace", "cancel"] as const),
		};
	}

	async resolveLibraryRestore(
		commandId: string,
		resolution: ObjectStoreImportResolution,
	): Promise<void> {
		const pending = this.#pendingRestores.get(commandId);
		if (!pending) throw new ObjectStorageError(undefined, "save", false);
		if (resolution === "cancel") {
			this.#pendingRestores.delete(commandId);
			return;
		}
		if (pending.requiresRepair) {
			if (resolution !== "repair")
				throw new Error(
					"Der beschädigte Store muss vor dem Import repariert werden.",
				);
			await this.restoreLibrary(
				pending.repairedObjects ?? pending.validObjects,
			);
			this.#pendingRestores.delete(commandId);
			return;
		}
		if (pending.hasDiscardedObjects) {
			if (resolution === "replace")
				throw new Error(
					"Eine teilweise ungültige Library kann nicht ungeprüft ersetzt werden.",
				);
			await this.restoreLibrary(
				resolution === "repair"
					? (pending.repairedObjects ?? pending.validObjects)
					: pending.validObjects,
			);
			this.#pendingRestores.delete(commandId);
			return;
		}
		if (resolution !== "replace")
			throw new Error("Für eine gültige Library ist nur Ersetzen zulässig.");
		await this.restoreLibrary(pending.validObjects);
		this.#pendingRestores.delete(commandId);
	}

	async readRecoverySources(): Promise<RuleSetLibraryRecoverySources> {
		const file = internalFileReference("library", "library");
		const [original, backup] = await Promise.all([
			this.storage.readInternal(file),
			this.storage.readInternal(file, "backup"),
		]);
		return {
			...optionalRecoveryBytes(original),
			...optionalRecoveryBytes(backup, true),
		};
	}

	async inspectRecoverySources(
		ansiFallbackLocale: string,
	): Promise<ObjectStoreRecoveryInspection> {
		const sources = await this.readRecoverySources();
		return {
			hasPrimary: sources.original !== undefined,
			hasBackup: sources.backup !== undefined,
			...(sources.backup
				? {
						backupProblem: this.validateLibraryBytes(
							sources.backup,
							ansiFallbackLocale,
						),
					}
				: {}),
			...(sources.original
				? {
						repairProblem: validateRepairableJsonBytes(
							sources.original,
							ansiFallbackLocale,
						),
					}
				: {}),
		};
	}

	async repairLibrary(
		ansiFallbackLocale: string,
	): Promise<RepairedObjectStore> {
		const sources = await this.readRecoverySources();
		if (!sources.original)
			throw new ObjectStorageError(undefined, "load", false, "missingLibrary");
		const syntaxRepair = parseRepairableJsonBytes(
			sources.original,
			ansiFallbackLocale,
		);
		if (syntaxRepair.status === "failed")
			throw new ObjectSerializationError(
				undefined,
				"decode",
				false,
				undefined,
				"invalidJson",
			);
		try {
			const repaired = repairRecoveredLibrary(
				recoverLibraryStructure(syntaxRepair.value),
			);
			const bytes = encodeLibraryDocument(
				decodeCurrentLibraryDocument(repaired.document),
			);
			await this.writeRecoveredLibrary(bytes, ansiFallbackLocale);
			return {
				report: repaired.report,
				syntaxRepairs: syntaxRepair.operations.map(toDocumentSyntaxRepair),
			};
		} catch (error) {
			if (isSerializationOperationError(error))
				throw translateSerializationFailure(error.failure, {
					kind: "ruleSet",
				});
			throw error;
		}
	}

	async writeRecoveredLibrary(
		bytes: Uint8Array,
		ansiFallbackLocale: string,
	): Promise<RuleSetLibraryCache> {
		if (!hasDataFileCapability(this.storage, "writeInternal"))
			throw unsupportedDataFileCapability("writeInternal");
		const cache = this.decodeLibraryBytes(bytes, ansiFallbackLocale);
		await requireStorageOperationSuccess(
			this.storage.writeInternal(
				internalFileReference("library", "library"),
				bytes,
				{ backup: false },
			),
		);
		this.#cache = cache;
		this.#usingTemporaryCache = false;
		return cache;
	}

	async restoreInternalBackup(ansiFallbackLocale: string): Promise<void> {
		const sources = await this.readRecoverySources();
		if (!sources.backup) throw new ObjectStorageError(undefined, "load", false);
		const validationProblem = this.validateLibraryBytes(
			sources.backup,
			ansiFallbackLocale,
		);
		if (validationProblem?.category === "domain")
			throw new DomainOperationError({
				source: "domain",
				operation: "validate",
				reason: validationProblem.reason,
				repairable: validationProblem.repairable,
				...(validationProblem.diagnostic
					? { diagnostic: validationProblem.diagnostic }
					: {}),
				...(validationProblem.details
					? { details: validationProblem.details }
					: {}),
			});
		if (validationProblem)
			throw new ObjectSerializationError(
				validationProblem.diagnostic,
				"decode",
				validationProblem.repairable,
				validationProblem.details,
				validationProblem.reason,
			);
		await this.writeRecoveredLibrary(sources.backup, ansiFallbackLocale);
	}

	async exportUnreadableLibrary(): Promise<void> {
		if (!hasDataFileCapability(this.storage, "writeExternal"))
			throw unsupportedDataFileCapability("writeExternal");
		const sources = await this.readRecoverySources();
		if (!sources.original)
			throw new ObjectStorageError(
				undefined,
				"export",
				false,
				"missingLibrary",
			);
		await requireStorageOperationSuccess(
			this.storage.writeExternal(sources.original, {
				suggestedFileName: "library_unreadable.json",
				description: "Bibliothek",
			}),
		);
	}

	#assertWritableCache(): void {
		if (this.#usingTemporaryCache)
			throw new ObjectStorageError(undefined, "save", false);
	}
}

function toDocumentSyntaxRepair(
	operation: JsonRepairOperation,
): DocumentSyntaxRepair {
	switch (operation.type) {
		case "insertedMissingQuote":
			return {
				kind: operation.type,
				position: operation.position,
			};
		case "addedClosingBraces":
		case "addedOpeningBraces":
			return {
				kind: operation.type,
				count: operation.count,
			};
		default:
			return assertNever(operation);
	}
}

function assertNever(value: never): never {
	throw new Error(`Unbekannte JSON-Reparaturoperation: ${String(value)}`);
}

function createLibraryCache(parsed: unknown): RuleSetLibraryCache {
	const library = decodeCurrentLibraryCandidates(parsed);
	const ruleSetsById = new Map<string, CachedRuleSet>();
	for (const candidate of library.ruleSetCandidates) {
		const { recordId, raw } = candidate;
		if (candidate.status === "invalid") {
			const failure = candidate.error.failure;
			ruleSetsById.set(recordId, {
				status: "invalid",
				raw,
				category: "serialization",
				reason: failure.reason,
				repairable: failure.repairable,
				...(failure.diagnostic ? { diagnostic: failure.diagnostic } : {}),
				...(failure.details ? { details: failure.details } : {}),
			});
			continue;
		}
		try {
			const ruleSet = createRuleSetFromDraft(candidate.document, {
				mode: "stored",
			}).ruleSet;
			if (ruleSet.id !== recordId) {
				ruleSetsById.set(recordId, {
					status: "invalid",
					raw,
					category: "domain",
					reason: "invalidObject",
					repairable: true,
				});
				continue;
			}
			ruleSetsById.set(recordId, cacheRuleSet(ruleSet, raw));
		} catch (error) {
			if (!isDomainOperationError(error)) throw error;
			const failure = error.failure;
			ruleSetsById.set(recordId, {
				status: "invalid",
				raw,
				category: "domain",
				reason: failure.reason,
				repairable: failure.repairable,
				...(failure.diagnostic ? { diagnostic: failure.diagnostic } : {}),
				...(failure.details ? { details: failure.details } : {}),
			});
		}
	}
	return {
		metadata: library.metadata,
		ruleSetsById,
	};
}

function cacheRuleSet(ruleSet: RuleSet, raw: unknown = ruleSet): CachedRuleSet {
	return {
		status: "valid",
		raw,
		json: createLibraryRuleSetJson(ruleSet),
		summary: {
			id: ruleSet.id,
			name: ruleSet.name,
			...(ruleSet.names ? { names: { ...ruleSet.names } } : {}),
			version: ruleSet.version,
			teamCount: ruleSet.teams.length,
			roleCount: ruleSet.roles.length,
		},
	};
}

function parseCachedRuleSet(text: string): RuleSet {
	const parsed = parseJsonWithDetails(text);
	const value =
		typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
			? parsed
			: {};
	const document = decodeRuleSetDocument(value);
	assertSupportedRuleSetDocument(document);
	return createRuleSetFromDraft(document, { mode: "stored" }).ruleSet;
}

function encodeLibraryCache(cache: RuleSetLibraryCache): Uint8Array {
	return encodeLibraryCandidateFragments(
		cache.metadata,
		new Map(
			[...cache.ruleSetsById.entries()].map(([id, cached]) => {
				return [
					id,
					cached.status === "valid"
						? { status: "encoded" as const, json: cached.json }
						: { status: "raw" as const, value: cached.raw },
				];
			}),
		),
	);
}

function optionalRecoveryBytes(
	result: DataFileReadResult,
	backup = false,
): RuleSetLibraryRecoverySources {
	if (result.status === "success")
		return backup ? { backup: result.bytes } : { original: result.bytes };
	if (
		result.error.reason === "notFound" ||
		result.error.reason === "unreadable"
	)
		return {};
	throw translateStorageFailure(result.error, "load");
}

function validateRepairableJsonBytes(
	bytes: Uint8Array,
	ansiFallbackLocale: string,
): ObjectContentProblem | undefined {
	try {
		return parseRepairableJsonBytes(bytes, ansiFallbackLocale).status ===
			"successful"
			? undefined
			: {
					category: "serialization",
					reason: "invalidJson",
					repairable: false,
				};
	} catch (error) {
		return {
			category: "serialization",
			reason: "decodeFailed",
			repairable: false,
			...(error instanceof Error && error.message
				? { diagnostic: error.message }
				: {}),
		};
	}
}
