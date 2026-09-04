import { isDomainOperationError } from "../domain/domainFailure";
import type { DomainServices } from "../domain/domainServices";
import type { GameState } from "../domain/gameFactory";
import { repairGameDocument } from "../domain/gameRepair";
import { hydrateGameState } from "../domain/gameValidation";
import { renameGame } from "../domain/scenarioRenaming";
import {
	createIdFromText,
	createUniqueNameAndId,
	type ValidId,
} from "../domain/stringSanitizer";
import {
	decodeCurrentGameDocument,
	withCurrentGameDocumentVersion,
} from "../serialization/gameDocumentFormat";
import { encodeGameExportDocument } from "../serialization/gameExport";
import { decodeJsonBytes } from "../serialization/jsonEncoding";
import { parseRepairableJsonBytes } from "../serialization/jsonRepair";
import { parseJsonWithDetails } from "../serialization/jsonSyntaxError";
import { isSerializationOperationError } from "../serialization/serializationFailure";
import {
	documentIdFromStorageKey,
	fileReferenceFromStorageKey,
	internalDocumentFileName,
	internalFileReference,
	parseInternalDocumentFileName,
} from "./internalDocumentFileName";
import {
	ObjectPersistenceError,
	ObjectSerializationError,
	ObjectStorageError,
} from "./objectPersistenceError";
import type {
	GameObjectMetadata,
	GameObjectReadProblem,
	GameObjectSaveOptions,
	ImportTargetMetadata,
	LatestStoredGameObject,
	LoadedStoredGameObject,
	ObjectContentProblem,
	ObjectListResult,
	ObjectReadProblemForKind,
	PersistedGameObjectKind,
	PersistedObjectWriteResult,
	SavedStoredGameObject,
	StandaloneObjectReadProblem,
} from "./objectPersistenceTypes";
import type {
	DataFileReadResult,
	DataFileStorage,
	DataFileWriteOptions,
	StoredByteDocument,
	StoredFileMetadata,
} from "./ports/dataFileStorage";
import {
	hasDataFileCapability,
	unsupportedDataFileCapability,
} from "./ports/dataFileStorage";
import { isStorageOperationError } from "./ports/storageFailure";
import { translateSerializationFailure } from "./serializationFailureTranslation";
import {
	requireStorageOperationSuccess,
	translateStorageFailure,
} from "./storageFailureTranslation";

type PreparedGameSave = Omit<SavedStoredGameObject, "storedAt"> & {
	writeOptions: DataFileWriteOptions;
};

export class GameObjectPersistence {
	readonly #loadedTexts = new Map<string, string>();

	constructor(
		private readonly storage: DataFileStorage,
		private readonly domainServices: DomainServices,
	) {}

	async loadObject(
		kind: PersistedGameObjectKind,
		storageKey: string,
		ansiFallbackLocale: string,
		cachedText?: string,
	): Promise<LoadedStoredGameObject> {
		const id = documentIdFromStorageKey(storageKey);
		const parsedFileName = parseInternalDocumentFileName(
			kind,
			`${storageKey}.json`,
		);
		if (!parsedFileName)
			throw new ObjectStorageError(undefined, "load", false, "invalidFileName");
		const cacheKey = `${kind}:${storageKey}`;
		let text = cachedText ?? this.#loadedTexts.get(cacheKey);
		if (text === undefined) {
			let result: DataFileReadResult;
			try {
				result = await this.storage.readInternal(
					fileReferenceFromStorageKey(storageKey),
				);
			} catch (error) {
				throw toGameStorageError(error, "load");
			}
			const bytes = requireStoredGameBytes(result);
			text = decodeGameBytes(bytes, ansiFallbackLocale);
		}
		this.#loadedTexts.set(cacheKey, text);
		const document = this.decodeObjectText(text, id, kind);
		return {
			document,
			id,
			storageKey,
			restoredIndex: parsedFileName.restoredIndex,
			...(parsedFileName.storageVariant
				? { storageVariant: parsedFileName.storageVariant }
				: {}),
		};
	}

	async findLatestStoredObject(): Promise<LatestStoredGameObject | undefined> {
		if (!hasDataFileCapability(this.storage, "listInternalFiles"))
			return undefined;
		let files: StoredFileMetadata[];
		try {
			files = await this.storage.listInternalFiles("game");
		} catch (error) {
			throw toGameStorageError(error, "load");
		}
		const latest = files
			.map((file) => ({
				...file,
				parsed: parseInternalDocumentFileName("game", file.fileName),
			}))
			.filter(
				(file): file is typeof file & { modifiedAt: number } =>
					file.modifiedAt !== undefined &&
					file.parsed !== undefined &&
					file.parsed.storageVariant === undefined,
			)
			.sort((left, right) => right.modifiedAt - left.modifiedAt)[0];
		return latest
			? {
					id: latest.parsed?.id ?? "",
					storageKey: latest.parsed?.storageKey ?? "",
				}
			: undefined;
	}

	async readAllObjectMetadata<K extends PersistedGameObjectKind>(
		kind: K,
		ansiFallbackLocale: string,
	): Promise<ObjectListResult<K>> {
		if (!hasDataFileCapability(this.storage, "readAllInternal"))
			throw unsupportedDataFileCapability("readAllInternal");
		let storedDocuments: StoredByteDocument[];
		let storedFileMetadata: StoredFileMetadata[];
		try {
			[storedDocuments, storedFileMetadata] = await Promise.all([
				this.storage.readAllInternal(kind),
				hasDataFileCapability(this.storage, "listInternalFiles")
					? this.storage.listInternalFiles(kind)
					: Promise.resolve([]),
			]);
		} catch (error) {
			throw toGameStorageError(error, "load");
		}
		this.#clearCachedKind(kind);
		const modifiedAtByFileName = new Map(
			storedFileMetadata.map(({ fileName, modifiedAt }) => [
				fileName,
				modifiedAt,
			]),
		);
		const metadata: GameObjectMetadata[] = [];
		const problems: StandaloneObjectReadProblem<K>[] = [];
		const occupiedIds = storedDocuments.flatMap(({ fileName }) => {
			const parsed = parseInternalDocumentFileName(kind, fileName);
			return parsed ? [parsed.id] : [];
		});
		const ids = new Set(occupiedIds);

		for (const stored of storedDocuments) {
			const { fileName, bytes } = stored;
			const parsedFileName = parseInternalDocumentFileName(kind, fileName);
			const rawStorageKey = fileName.replace(/\.json$/, "");
			const rawId = rawStorageKey.split(".", 1)[0] ?? rawStorageKey;
			const id = parsedFileName?.id ?? createIdFromText(rawId, kind);
			ids.add(id);
			const storageKey = parsedFileName?.storageKey ?? rawStorageKey;
			const restoredIndex = parsedFileName?.restoredIndex ?? 0;
			const storageVariant = parsedFileName?.storageVariant;
			const hasInvalidFileName = parsedFileName === undefined;
			const reportProblem = (
				reason: StandaloneObjectReadProblem<K>["reason"],
				error: unknown,
				details: {
					id?: string;
					suggestedFileName?: string;
					canRepairFileName?: boolean;
					canKeepBoth?: boolean;
					sourceBytes?: Uint8Array;
				} = {},
			) => {
				const context = {
					scope: "object" as const,
					id: details.id ?? id,
					kind,
					storageKey,
					...(restoredIndex > 0 ? { restoredIndex } : {}),
					...(details.sourceBytes ? { sourceBytes: details.sourceBytes } : {}),
				};
				if (reason === "invalidFileName") {
					problems.push({
						...context,
						category: "storage",
						reason,
						...(error === undefined ? {} : optionalDiagnostic(error)),
						...(details.suggestedFileName
							? { suggestedFileName: details.suggestedFileName }
							: {}),
						...(details.canRepairFileName === undefined
							? {}
							: { canRepairFileName: details.canRepairFileName }),
						...(details.canKeepBoth === undefined
							? {}
							: { canKeepBoth: details.canKeepBoth }),
					});
					return;
				}
				if (isSerializationOperationError(error)) {
					const failure = error.failure;
					problems.push({
						...context,
						category: "serialization",
						reason: failure.reason,
						repairable: failure.repairable,
						...(failure.componentKind
							? { componentKind: failure.componentKind }
							: {}),
						...(failure.diagnostic ? { diagnostic: failure.diagnostic } : {}),
						...(failure.details ? { details: failure.details } : {}),
					});
					return;
				}
				if (isDomainOperationError(error)) {
					const failure = error.failure;
					problems.push({
						...context,
						category: "domain",
						reason: failure.reason,
						repairable: failure.repairable,
						...(failure.componentKind
							? { componentKind: failure.componentKind }
							: {}),
						...(failure.diagnostic ? { diagnostic: failure.diagnostic } : {}),
						...(failure.details ? { details: failure.details } : {}),
					});
					return;
				}
				if (error instanceof ObjectSerializationError) {
					problems.push({
						...context,
						category: "serialization",
						reason: error.reason,
						repairable: error.repairable,
						...(error.diagnostic ? { diagnostic: error.diagnostic } : {}),
						...(error.details ? { details: error.details } : {}),
					});
					return;
				}
				throw error;
			};

			let text: string;
			try {
				text = decodeJsonBytes(bytes, ansiFallbackLocale).text;
			} catch (error) {
				reportProblem(
					hasInvalidFileName ? "invalidFileName" : "decodeFailed",
					hasInvalidFileName ? undefined : error,
					{ sourceBytes: bytes },
				);
				continue;
			}

			let parsed: unknown;
			try {
				parsed = parseJsonWithDetails(text);
			} catch (error) {
				reportProblem(
					hasInvalidFileName ? "invalidFileName" : "invalidJson",
					hasInvalidFileName ? undefined : error,
					{ sourceBytes: bytes },
				);
				continue;
			}

			try {
				const game = decodeListedObject(parsed, id, kind);
				if (hasInvalidFileName) {
					const targetExists = occupiedIds.includes(id);
					reportProblem("invalidFileName", undefined, {
						id,
						suggestedFileName: internalDocumentFileName(id),
						canRepairFileName: !targetExists,
						canKeepBoth: targetExists,
						sourceBytes: bytes,
					});
					continue;
				}
				this.#loadedTexts.set(`${kind}:${storageKey}`, text);
				metadata.push(
					createGameObjectMetadata(
						game,
						storageKey,
						restoredIndex,
						storageVariant,
						modifiedAtByFileName.get(fileName),
					),
				);
			} catch (error) {
				reportProblem(
					hasInvalidFileName ? "invalidFileName" : "invalidDocument",
					error,
					{ sourceBytes: bytes },
				);
			}
		}

		return {
			status: "loaded",
			metadata,
			problems: problems as ObjectReadProblemForKind<K>[],
			ids: [...ids],
		};
	}

	async inspectImportTarget(
		kind: PersistedGameObjectKind,
		id: string,
		ansiFallbackLocale: string,
	): Promise<ImportTargetMetadata> {
		let result: DataFileReadResult;
		try {
			result = await this.storage.readInternal(internalFileReference(kind, id));
		} catch (error) {
			throw toGameStorageError(error, "load");
		}
		if (result.status === "error") {
			if (result.error.reason === "notFound") return { status: "notFound" };
			throw translateStorageFailure(result.error, "load");
		}
		const source = parseGameJson(
			decodeGameBytes(result.bytes, ansiFallbackLocale),
		);
		return {
			status: "exists",
			id,
			name: readDocumentName(source) ?? id,
			...readSchemaVersion(source),
		};
	}

	decodeObject(
		bytes: Uint8Array,
		expectedId: string,
		kind: PersistedGameObjectKind,
		ansiFallbackLocale: string,
	): GameState {
		return this.decodeObjectText(
			decodeGameBytes(bytes, ansiFallbackLocale),
			expectedId,
			kind,
		);
	}

	validateObjectBytes(
		kind: PersistedGameObjectKind,
		expectedId: string,
		bytes: Uint8Array,
		ansiFallbackLocale: string,
	): ObjectContentProblem | undefined {
		try {
			this.decodeObject(bytes, expectedId, kind, ansiFallbackLocale);
		} catch (error) {
			if (isDomainOperationError(error)) {
				const failure = error.failure;
				return {
					category: "domain",
					reason: failure.reason,
					repairable: failure.repairable,
					...(failure.diagnostic ? { diagnostic: failure.diagnostic } : {}),
					...(failure.details ? { details: failure.details } : {}),
				};
			}
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

	clearCache(): void {
		this.#loadedTexts.clear();
	}

	#clearCachedKind(kind: PersistedGameObjectKind): void {
		const prefix = `${kind}:`;
		for (const key of this.#loadedTexts.keys())
			if (key.startsWith(prefix)) this.#loadedTexts.delete(key);
	}

	decodeObjectText(
		text: string,
		expectedId: string,
		kind: PersistedGameObjectKind,
	): GameState {
		let parsed: unknown;
		try {
			parsed = parseJsonWithDetails(text);
		} catch (error) {
			throw toGameJsonError(error);
		}
		if (!isRecord(parsed))
			throw new ObjectSerializationError(
				undefined,
				"decode",
				false,
				undefined,
				"invalidDocument",
			);
		let document: GameState;
		try {
			const decoded = decodeCurrentGameDocument({ ...parsed, id: expectedId });
			document = hydrateGameState(decoded);
		} catch (error) {
			throw toInvalidGameDocumentError(error);
		}
		if (document.isTemplate !== (kind === "template"))
			throw new ObjectSerializationError(
				undefined,
				"decode",
				false,
				undefined,
				"invalidDocument",
			);
		return document;
	}

	async saveObject(
		document: GameState,
		options: GameObjectSaveOptions = {},
	): Promise<SavedStoredGameObject> {
		const prepared = this.prepareSaveObject(document, options);
		await this.savePreparedObject(prepared);
		return this.completePreparedSave(prepared);
	}

	prepareSaveObject(
		document: GameState,
		options: GameObjectSaveOptions = {},
	): PreparedGameSave {
		if (!hasDataFileCapability(this.storage, "writeInternal"))
			throw unsupportedDataFileCapability("writeInternal");
		const kind: PersistedGameObjectKind = document.isTemplate
			? "template"
			: "game";
		let storageKey =
			kind === "template"
				? document.id
				: options.identityPolicy === "preserve"
					? document.id
					: createIdFromText(document.name, "game");
		const previousStorageKey = options.previousStorageKey ?? undefined;
		if (
			previousStorageKey &&
			documentIdFromStorageKey(previousStorageKey) === storageKey
		)
			storageKey = previousStorageKey;
		let persistedDocument: GameState;
		try {
			persistedDocument =
				kind === "game" && document.id !== documentIdFromStorageKey(storageKey)
					? renameGame(document, document.name)
					: hydrateGameState({
							...document,
							id: documentIdFromStorageKey(storageKey),
						});
		} catch (error) {
			throw toInvalidGameDocumentError(error);
		}
		const changesFile =
			options.previousStorageKey === null ||
			(previousStorageKey !== undefined && previousStorageKey !== storageKey);
		const writeOptions: DataFileWriteOptions = {
			createOnly:
				options.conflictPolicy === "reject"
					? true
					: options.conflictPolicy === "replace"
						? false
						: changesFile,
			backup: kind === "template" && options.previousStorageKey !== null,
			...(previousStorageKey && changesFile
				? { previousFile: fileReferenceFromStorageKey(previousStorageKey) }
				: {}),
		};
		const parsedStorageKey = parseInternalDocumentFileName(
			kind,
			`${storageKey}.json`,
		);
		return {
			document: persistedDocument,
			storageKey,
			restoredIndex: parsedStorageKey?.restoredIndex ?? 0,
			...(parsedStorageKey?.storageVariant
				? { storageVariant: parsedStorageKey.storageVariant }
				: {}),
			...(previousStorageKey ? { previousStorageKey } : {}),
			changesFile,
			writeOptions,
		};
	}

	async savePreparedObject(prepared: PreparedGameSave): Promise<void> {
		if (!hasDataFileCapability(this.storage, "writeInternal"))
			throw unsupportedDataFileCapability("writeInternal");
		const kind: PersistedGameObjectKind = prepared.document.isTemplate
			? "template"
			: "game";
		await requireStorageOperationSuccess(
			this.storage.writeInternal(
				fileReferenceFromStorageKey(prepared.storageKey),
				this.encodeObject(prepared.document, kind),
				prepared.writeOptions,
			),
		);
		this.clearCache();
	}

	completePreparedSave(prepared: PreparedGameSave): SavedStoredGameObject {
		const { writeOptions: _writeOptions, ...saved } = prepared;
		void _writeOptions;
		return {
			...saved,
			storedAt: this.domainServices.clock.now(),
		};
	}

	async #saveObjectAt(
		storageKey: string,
		document: GameState,
		options: DataFileWriteOptions,
	): Promise<GameState> {
		if (!hasDataFileCapability(this.storage, "writeInternal"))
			throw unsupportedDataFileCapability("writeInternal");
		const kind: PersistedGameObjectKind = document.isTemplate
			? "template"
			: "game";
		const id = documentIdFromStorageKey(storageKey);
		const persistedDocument = hydrateGameState({ ...document, id });
		await requireStorageOperationSuccess(
			this.storage.writeInternal(
				kind === "template"
					? internalFileReference("template", id)
					: fileReferenceFromStorageKey(storageKey),
				this.encodeObject(persistedDocument, kind),
				options,
			),
		);
		this.clearCache();
		return persistedDocument;
	}

	async deleteObject(
		kind: PersistedGameObjectKind,
		id: string,
		storageVariant?: string,
	): Promise<void> {
		if (!hasDataFileCapability(this.storage, "deleteInternal"))
			throw unsupportedDataFileCapability("deleteInternal");
		await requireStorageOperationSuccess(
			this.storage.deleteInternal(
				internalFileReference(kind, id, storageVariant),
				{
					includeBackup: true,
					includeRecovery: true,
				},
			),
		);
		this.clearCache();
	}

	async deleteObjectReadProblem(problem: GameObjectReadProblem): Promise<void> {
		if (!hasDataFileCapability(this.storage, "deleteInternal"))
			throw unsupportedDataFileCapability("deleteInternal");
		await requireStorageOperationSuccess(
			this.storage.deleteInternal(
				{
					category: problem.kind,
					fileName: `${problem.storageKey}.json`,
				},
				{
					includeBackup: true,
					includeRecovery: true,
				},
			),
		);
		this.clearCache();
	}

	async exportObjectReadProblem(problem: GameObjectReadProblem): Promise<void> {
		if (!hasDataFileCapability(this.storage, "writeExternal"))
			throw unsupportedDataFileCapability("writeExternal");
		let bytes = problem.sourceBytes;
		if (!bytes) {
			let result: DataFileReadResult;
			try {
				result = await this.storage.readInternal({
					category: problem.kind,
					fileName: `${problem.storageKey}.json`,
				});
			} catch (error) {
				throw toGameStorageError(error, "export");
			}
			bytes = requireStoredGameBytes(result, "export");
		}
		try {
			await requireStorageOperationSuccess(
				this.storage.writeExternal(bytes, {
					suggestedFileName:
						problem.reason === "invalidFileName"
							? `${problem.storageKey}.json`
							: `${problem.storageKey}.failed.json`,
					description:
						problem.reason === "invalidFileName"
							? problem.kind === "template"
								? "Vorlage"
								: "Spielstand"
							: problem.kind === "template"
								? "Fehlerhafte Vorlage"
								: "Fehlerhafter Spielstand",
				}),
			);
		} catch (error) {
			throw toGameStorageError(error, "export");
		}
	}

	async repairObjectReadProblem(
		problem: GameObjectReadProblem,
		ansiFallbackLocale: string,
	): Promise<void> {
		if (
			problem.category === "storage" ||
			!problem.repairable ||
			!problem.sourceBytes
		)
			throw new ObjectSerializationError(
				undefined,
				"decode",
				false,
				undefined,
				"invalidDocument",
			);
		const syntaxRepair = parseRepairableJsonBytes(
			problem.sourceBytes,
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
		let repaired: GameState;
		try {
			const decoded = decodeCurrentGameDocument({
				...(isRecord(syntaxRepair.value) ? syntaxRepair.value : {}),
				id: problem.id,
			});
			repaired = repairGameDocument(decoded, problem.kind).document;
		} catch (error) {
			throw toInvalidGameDocumentError(error);
		}
		if (!hasDataFileCapability(this.storage, "writeInternal"))
			throw unsupportedDataFileCapability("writeInternal");
		await requireStorageOperationSuccess(
			this.storage.writeInternal(
				fileReferenceFromStorageKey(problem.storageKey),
				this.encodeObject(repaired, problem.kind),
				{ backup: true },
			),
		);
		this.clearCache();
	}

	async repairObjectFileName(
		problem: GameObjectReadProblem,
		ansiFallbackLocale: string,
		keepBoth = false,
	): Promise<void> {
		if (problem.reason !== "invalidFileName" || !problem.sourceBytes)
			throw new ObjectStorageError(undefined, "load", false);
		const text = decodeGameBytes(problem.sourceBytes, ansiFallbackLocale);
		let parsed: unknown;
		try {
			parsed = parseJsonWithDetails(text);
		} catch (error) {
			throw toGameJsonError(error);
		}
		if (!isRecord(parsed))
			throw new ObjectSerializationError(
				undefined,
				"decode",
				false,
				undefined,
				"invalidDocument",
			);
		let document: Record<string, unknown> = structuredClone(parsed);
		let targetId = problem.id;
		if (keepBoth) {
			const snapshots = await Promise.all([
				this.readAllObjectMetadata("game", ansiFallbackLocale),
				this.readAllObjectMetadata("template", ansiFallbackLocale),
			]);
			const usedIds = new Set([
				...snapshots.flatMap((snapshot) =>
					snapshot.status === "loaded" ? snapshot.ids : [],
				),
			]);
			const baseName = readDocumentName(document) ?? targetId;
			const identity = createUniqueNameAndId(baseName, problem.kind, usedIds, {
				firstSuffix: 2,
				forceSuffix: true,
			});
			targetId = identity.id;
			document = { ...document, id: identity.id, name: identity.name };
		} else if (!problem.canRepairFileName)
			throw new ObjectStorageError(undefined, "save", false, "targetExists");
		document = { ...document, id: targetId };
		let validated: GameState;
		try {
			const versioned = withCurrentGameDocumentVersion(document);
			const decoded = decodeCurrentGameDocument(versioned);
			validated = keepBoth
				? repairGameDocument(decoded, problem.kind).document
				: hydrateGameState(decoded);
		} catch (error) {
			throw toInvalidGameDocumentError(error);
		}
		await this.#saveObjectAt(targetId, validated, { createOnly: true });
		await this.deleteObjectReadProblem(problem);
		this.clearCache();
	}

	async replaceObject(
		oldId: ValidId,
		document: GameState,
		storageVariant?: string,
	): Promise<PersistedObjectWriteResult<"game" | "template", GameState>> {
		if (
			!hasDataFileCapability(this.storage, "writeInternal") ||
			!hasDataFileCapability(this.storage, "deleteInternal")
		)
			throw unsupportedDataFileCapability(
				!hasDataFileCapability(this.storage, "writeInternal")
					? "writeInternal"
					: "deleteInternal",
			);
		const kind: PersistedGameObjectKind = document.isTemplate
			? "template"
			: "game";
		const validated = hydrateGameState(document);
		const target = internalFileReference(kind, validated.id);
		await requireStorageOperationSuccess(
			this.storage.writeInternal(target, this.encodeObject(validated, kind), {
				createOnly: true,
				backup: true,
			}),
		);
		await requireStorageOperationSuccess(
			this.storage.deleteInternal(
				internalFileReference(kind, oldId, storageVariant),
				{
					includeBackup: true,
					includeRecovery: true,
				},
			),
		);
		this.clearCache();
		const storedFile = parseInternalDocumentFileName(kind, target.fileName);
		return {
			document: validated,
			reference: {
				kind,
				id: validated.id,
				storageKey: storedFile?.storageKey ?? validated.id,
			},
		};
	}

	encodeObject(
		document: GameState,
		expectedKind: PersistedGameObjectKind,
	): Uint8Array {
		let validated: GameState;
		try {
			validated = hydrateGameState(document);
		} catch (error) {
			throw toInvalidGameDocumentError(error);
		}
		if (validated.isTemplate !== (expectedKind === "template"))
			throw new ObjectSerializationError(
				undefined,
				"encode",
				false,
				undefined,
				"invalidDocument",
			);
		try {
			return encodeGameExportDocument(validated);
		} catch (error) {
			throw new ObjectSerializationError(
				error instanceof Error ? error.message : String(error),
				"encode",
				false,
			);
		}
	}
}

function requireStoredGameBytes(
	result: DataFileReadResult,
	operation: "load" | "export" = "load",
): Uint8Array {
	if (result.status === "success") return result.bytes;
	throw translateStorageFailure(result.error, operation);
}

function decodeGameBytes(
	bytes: Uint8Array,
	ansiFallbackLocale: string,
): string {
	try {
		return decodeJsonBytes(bytes, ansiFallbackLocale).text;
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

function parseGameJson(text: string): unknown {
	try {
		return parseJsonWithDetails(text);
	} catch (error) {
		throw toGameJsonError(error);
	}
}

function toGameJsonError(error: unknown): ObjectSerializationError {
	if (isSerializationOperationError(error))
		return translateSerializationFailure(error.failure);
	throw error;
}

function toInvalidGameDocumentError(error: unknown): ObjectSerializationError {
	if (error instanceof ObjectSerializationError) return error;
	if (isDomainOperationError(error)) throw error;
	if (isSerializationOperationError(error))
		return translateSerializationFailure(error.failure);
	throw error;
}

function toGameStorageError(
	error: unknown,
	operation: "load" | "save" | "delete" | "export",
): ObjectStorageError {
	if (error instanceof ObjectStorageError) return error;
	if (isStorageOperationError(error))
		return translateStorageFailure(error.failure, operation);
	throw error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalDiagnostic(error: unknown): { diagnostic?: string } {
	if (error instanceof Error && error.message)
		return { diagnostic: error.message };
	return typeof error === "string" && error ? { diagnostic: error } : {};
}

function decodeListedObject(
	document: unknown,
	expectedId: string,
	kind: PersistedGameObjectKind,
): GameState {
	const identifiedDocument = isRecord(document)
		? { ...document, id: expectedId }
		: document;
	const game = hydrateGameState({
		...decodeCurrentGameDocument(identifiedDocument),
	});
	if (game.isTemplate !== (kind === "template"))
		throw new ObjectSerializationError(
			undefined,
			"decode",
			false,
			undefined,
			"invalidDocument",
		);
	return game;
}

function createGameObjectMetadata(
	document: GameState,
	storageKey: string,
	restoredIndex: number,
	storageVariant?: string,
	modifiedAt?: number,
): GameObjectMetadata {
	return {
		...(storageKey !== document.id ? { storageKey } : {}),
		...(storageVariant ? { storageVariant } : {}),
		...(restoredIndex > 0 ? { restoredIndex } : {}),
		id: document.id,
		name: document.name,
		...(document.names ? { names: { ...document.names } } : {}),
		storedAt:
			modifiedAt === undefined || !Number.isFinite(modifiedAt)
				? ""
				: new Date(modifiedAt).toISOString(),
		playerCount: document.seatOrder.length,
		ruleSetName: document.ruleSetSnapshot.name,
		...(document.ruleSetSnapshot.names
			? { ruleSetNames: { ...document.ruleSetSnapshot.names } }
			: {}),
		currentNight: document.time.currentNight,
		phase: document.time.phase,
	};
}

function readDocumentName(value: unknown): string | undefined {
	const name = isRecord(value) ? value.name : undefined;
	return typeof name === "string" && name.trim() ? name.trim() : undefined;
}

function readSchemaVersion(value: unknown): { schemaVersion?: number } {
	const schemaVersion = isRecord(value) ? value.schemaVersion : undefined;
	return typeof schemaVersion === "number" ? { schemaVersion } : {};
}
