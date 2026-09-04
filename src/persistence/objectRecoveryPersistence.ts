import type { GameState } from "../domain/gameFactory";
import { createIdFromText } from "../domain/stringSanitizer";
import type { GameObjectPersistence } from "./gameObjectPersistence";
import {
	internalFileReference,
	parseInternalDocumentFileName,
} from "./internalDocumentFileName";
import {
	ObjectSerializationError,
	ObjectStorageError,
} from "./objectPersistenceError";
import type {
	ObjectDecodingOptions,
	ObjectReadProblem,
	ObjectRecoveryKind,
	ObjectRecoveryResolution,
	ObjectRecoverySource,
	ObjectSaveContinuationDecision,
	ObjectSaveContinuationResult,
	ObjectStoreRecoveryInspection,
	PersistedObjectKind,
	PreparedWriteRecovery,
	RepairedObjectStore,
} from "./objectPersistenceTypes";
import type { PendingGameSaveRegistry } from "./objectSaveWorkflow";
import {
	type DataFileStorage,
	hasDataFileCapability,
	unsupportedDataFileCapability,
} from "./ports/dataFileStorage";
import type { DataFileCategory } from "./ports/dataFileTypes";
import type { ObjectRecoveryPort } from "./ports/objectRecoveryPort";
import type { StorageCommandDecision } from "./ports/storageCommand";
import type {
	StorageRecoveryCandidate,
	StorageRecoveryResolution,
} from "./ports/storageRecovery";
import type { RuleSetObjectPersistence } from "./ruleSetObjectPersistence";
import { requireStorageOperationSuccess } from "./storageFailureTranslation";
import { translateStorageWriteError } from "./storageWriteErrorTranslation";

/** Interne Implementierung der Recovery-Capability. */
export class ObjectRecoveryPersistence implements ObjectRecoveryPort {
	readonly #preparedRecoveries = new Map<
		string,
		{ candidate: StorageRecoveryCandidate; ansiFallbackLocale: string }
	>();

	constructor(
		private readonly storage: DataFileStorage,
		private readonly games: GameObjectPersistence,
		private readonly ruleSets: RuleSetObjectPersistence,
		private readonly pendingGameSaves: PendingGameSaveRegistry,
	) {}

	async prepareWriteRecoveries(
		kinds: ObjectRecoveryKind[],
		options: ObjectDecodingOptions,
	): Promise<PreparedWriteRecovery[]> {
		if (
			!hasDataFileCapability(this.storage, "listRecoveries") ||
			!hasDataFileCapability(this.storage, "requestRecovery")
		)
			return [];
		const categories = kinds.map(toDataFileCategory);
		const discovered =
			categories.length === 1
				? await this.storage.listRecoveries(categories[0])
				: (await this.storage.listRecoveries()).filter((candidate) =>
						categories.includes(candidate.category),
					);
		const prepared: PreparedWriteRecovery[] = [];
		for (const entry of discovered) {
			const request = await this.storage.requestRecovery(entry.recoveryKey);
			if (request.status === "discarded") continue;
			const { candidate } = request;
			if (!categories.includes(candidate.category)) continue;
			this.#preparedRecoveries.set(request.commandId, {
				candidate,
				ansiFallbackLocale: options.ansiFallbackLocale,
			});
			const id =
				candidate.category === "library"
					? "ruleSet"
					: (parseInternalDocumentFileName(
							candidate.category,
							candidate.fileName,
						)?.id ??
						createIdFromText(
							candidate.fileName.split(".", 1)[0] ?? "",
							candidate.category,
						));
			const validationProblem = candidate.newBytes
				? candidate.category === "library"
					? this.ruleSets.validateLibraryBytes(
							candidate.newBytes,
							options.ansiFallbackLocale,
						)
					: this.games.validateObjectBytes(
							candidate.category,
							id,
							candidate.newBytes,
							options.ansiFallbackLocale,
						)
				: undefined;
			prepared.push({
				commandId: request.commandId,
				recoveryKey: candidate.recoveryKey,
				id,
				kind: toObjectRecoveryKind(candidate.category),
				hasNew: candidate.newBytes !== undefined,
				...(validationProblem ? { validationProblem } : {}),
				...(candidate.recoverySource
					? {
							recoverySource: toObjectRecoverySource(candidate.recoverySource),
						}
					: {}),
			});
		}
		return prepared;
	}

	async resolveWriteRecovery(
		commandId: string,
		resolution: ObjectRecoveryResolution | "cancel",
	): Promise<void> {
		if (!hasDataFileCapability(this.storage, "continueInternalCommand"))
			throw unsupportedDataFileCapability("continueInternalCommand");
		const continueInternalCommand = this.storage.continueInternalCommand.bind(
			this.storage,
		);
		const prepared = this.#preparedRecoveries.get(commandId);
		const candidate = prepared?.candidate;
		if (
			candidate &&
			resolution !== "keepOld" &&
			resolution !== "cancel" &&
			(!candidate.newBytes ||
				(candidate.category === "library"
					? this.ruleSets.validateLibraryBytes(
							candidate.newBytes,
							prepared.ansiFallbackLocale,
						)
					: this.games.validateObjectBytes(
							candidate.category,
							parseInternalDocumentFileName(
								candidate.category,
								candidate.fileName,
							)?.id ?? "",
							candidate.newBytes,
							prepared.ansiFallbackLocale,
						)))
		)
			throw new ObjectSerializationError(
				undefined,
				"decode",
				false,
				undefined,
				"invalidDocument",
			);
		this.#preparedRecoveries.delete(commandId);
		await translateStorageWriteError(() =>
			continueInternalCommand(commandId, toStorageRecoveryDecision(resolution)),
		);
		if (candidate) this.invalidateCacheForCategory(candidate.category);
	}

	async finishStorageCommand(commandId: string): Promise<void> {
		if (!hasDataFileCapability(this.storage, "continueInternalCommand"))
			throw unsupportedDataFileCapability("continueInternalCommand");
		const continueInternalCommand = this.storage.continueInternalCommand.bind(
			this.storage,
		);
		const candidate = this.#preparedRecoveries.get(commandId)?.candidate;
		this.#preparedRecoveries.delete(commandId);
		await translateStorageWriteError(() =>
			continueInternalCommand(commandId, "finishLater"),
		);
		if (candidate) this.invalidateCacheForCategory(candidate.category);
	}

	async continueObjectSave(
		commandId: string,
		decision: ObjectSaveContinuationDecision,
		continuationObject?: GameState,
	): Promise<ObjectSaveContinuationResult> {
		if (!hasDataFileCapability(this.storage, "continueInternalCommand"))
			throw unsupportedDataFileCapability("continueInternalCommand");
		const continueInternalCommand = this.storage.continueInternalCommand.bind(
			this.storage,
		);
		const pending = continuationObject
			? this.games.prepareSaveObject(continuationObject, {
					conflictPolicy: "reject",
				})
			: this.pendingGameSaves.get(commandId);
		const continuation = continuationObject
			? {
					file: internalFileReference(
						continuationObject.isTemplate ? "template" : "game",
						continuationObject.id,
					),
					bytes: this.games.encodeObject(
						continuationObject,
						continuationObject.isTemplate ? "template" : "game",
					),
				}
			: undefined;
		const status = await translateStorageWriteError(() =>
			continueInternalCommand(
				commandId,
				toStorageCommandDecision(decision),
				continuation,
			),
		);
		this.pendingGameSaves.delete(commandId);
		this.games.clearCache();
		return status === "completed"
			? {
					status,
					...(pending
						? { savedObject: this.games.completePreparedSave(pending) }
						: {}),
				}
			: { status };
	}

	async exportFailedWrite(recoveryKey: string): Promise<void> {
		if (
			!hasDataFileCapability(this.storage, "listRecoveries") ||
			!hasDataFileCapability(this.storage, "writeExternal")
		)
			throw unsupportedDataFileCapability(
				!hasDataFileCapability(this.storage, "listRecoveries")
					? "listRecoveries"
					: "writeExternal",
			);
		const candidate = (await this.storage.listRecoveries()).find(
			(entry) => entry.recoveryKey === recoveryKey,
		);
		if (!candidate?.newBytes)
			throw new ObjectStorageError(undefined, "export", false);
		await requireStorageOperationSuccess(
			this.storage.writeExternal(candidate.newBytes, {
				suggestedFileName:
					candidate.category === "library"
						? "library.failed.json"
						: candidate.fileName.replace(/\.json$/, ".failed.json"),
				...(candidate.category === "library"
					? { description: "Bibliothek" }
					: {}),
			}),
		);
	}

	inspectObjectStoreRecovery(
		kind: PersistedObjectKind,
		options: ObjectDecodingOptions,
	): Promise<ObjectStoreRecoveryInspection | undefined> {
		return kind === "ruleSet"
			? this.ruleSets.inspectRecoverySources(options.ansiFallbackLocale)
			: Promise.resolve(undefined);
	}

	repairObjectStore(
		kind: PersistedObjectKind,
		options: ObjectDecodingOptions,
	): Promise<RepairedObjectStore> {
		requireRuleSetStore(kind, "save");
		return translateStorageWriteError(() =>
			this.ruleSets.repairLibrary(options.ansiFallbackLocale),
		);
	}

	restoreObjectStoreBackup(
		kind: PersistedObjectKind,
		options: ObjectDecodingOptions,
	): Promise<void> {
		requireRuleSetStore(kind, "save");
		return translateStorageWriteError(() =>
			this.ruleSets.restoreInternalBackup(options.ansiFallbackLocale),
		);
	}

	createEmptyObjectStore(
		kind: PersistedObjectKind,
		mode: "stored" | "temporary",
	): Promise<void> {
		requireRuleSetStore(kind, "save");
		return translateStorageWriteError(() =>
			this.ruleSets.createEmptyLibrary(mode),
		);
	}

	exportUnreadableObjectStore(kind: PersistedObjectKind): Promise<void> {
		requireRuleSetStore(kind, "export");
		return translateStorageWriteError(
			() => this.ruleSets.exportUnreadableLibrary(),
			"export",
		);
	}

	deleteObjectReadProblem(
		problem: ObjectReadProblem,
		options: ObjectDecodingOptions,
	): Promise<void> {
		return translateStorageWriteError(
			() =>
				problem.kind === "ruleSet"
					? this.ruleSets.deleteObject(problem.id, options.ansiFallbackLocale)
					: this.games.deleteObjectReadProblem(problem),
			"delete",
		);
	}

	exportObjectReadProblem(problem: ObjectReadProblem): Promise<void> {
		if (problem.kind === "ruleSet")
			return Promise.reject(
				new Error("Ein einzelnes Regelwerk kann nicht roh exportiert werden."),
			);
		return this.games.exportObjectReadProblem(problem);
	}

	repairObjectReadProblem(
		problem: ObjectReadProblem,
		options: ObjectDecodingOptions,
		keepBoth = false,
	): Promise<RepairedObjectStore | undefined> {
		if (problem.kind === "ruleSet")
			return translateStorageWriteError(() =>
				this.ruleSets.repairLibrary(options.ansiFallbackLocale),
			);
		if (problem.category !== "storage")
			return translateStorageWriteError(() =>
				this.games
					.repairObjectReadProblem(problem, options.ansiFallbackLocale)
					.then(() => undefined),
			);
		return translateStorageWriteError(() =>
			this.games.repairObjectFileName(
				problem,
				options.ansiFallbackLocale,
				keepBoth,
			),
		).then(() => undefined);
	}

	private invalidateCacheForCategory(category: DataFileCategory): void {
		if (category === "library") this.ruleSets.clearCache();
		else this.games.clearCache();
	}
}

function toDataFileCategory(kind: ObjectRecoveryKind): DataFileCategory {
	return kind === "ruleSet" ? "library" : kind;
}

function toObjectRecoveryKind(category: DataFileCategory): ObjectRecoveryKind {
	return category === "library" ? "ruleSet" : category;
}

function requireRuleSetStore(
	kind: PersistedObjectKind,
	operation: "save" | "export",
): asserts kind is "ruleSet" {
	if (kind === "ruleSet") return;
	throw new ObjectStorageError(undefined, operation, false);
}

function toObjectRecoverySource(
	source: StorageRecoveryCandidate["recoverySource"] & string,
): ObjectRecoverySource {
	switch (source) {
		case "temporary":
			return "temporary";
		case "backup":
			return "backup";
	}
}

function toStorageRecoveryDecision(
	resolution: ObjectRecoveryResolution | "cancel",
): StorageRecoveryResolution | "cancel" {
	switch (resolution) {
		case "keepOld":
			return "keepOld";
		case "keepNew":
			return "keepNew";
		case "keepBoth":
			return "keepBoth";
		case "cancel":
			return "cancel";
	}
}

function toStorageCommandDecision(
	decision: ObjectSaveContinuationDecision,
): StorageCommandDecision {
	switch (decision) {
		case "keepOld":
			return "keepOld";
		case "keepNew":
			return "keepNew";
		case "keepBoth":
			return "keepBoth";
		case "retry":
			return "retry";
		case "finishLater":
			return "finishLater";
		case "cancel":
			return "cancel";
		case "overwrite":
			return "overwrite";
	}
}
