import type { GameState } from "../domain/gameFactory";
import type { RuleSet } from "../domain/ruleSet";
import type { ValidId } from "../domain/stringSanitizer";
import type { GameObjectPersistence } from "./gameObjectPersistence";
import { repairInternalDataFileNames } from "./internalDataFileNameRepair";
import { ObjectPersistenceError } from "./objectPersistenceError";
import type { InternalFileNameRepairResult } from "./objectPersistenceInternalTypes";
import type {
	GameObjectSaveOptions,
	ObjectDecodingOptions,
	PersistedObjectReference,
	PersistedObjectWriteResult,
	RuleSetSaveOptions,
	SavedStoredGameObject,
} from "./objectPersistenceTypes";
import { ObjectSaveInterruptedError } from "./objectSaveInterruptedError";
import type { PendingGameSaveRegistry } from "./objectSaveWorkflow";
import {
	type DataFileStorage,
	hasDataFileCapability,
	isRecoverableStorageWriteError,
} from "./ports/dataFileStorage";
import type { ObjectWritePort } from "./ports/objectWritePort";
import { isStorageOperationError } from "./ports/storageFailure";
import type { RuleSetObjectPersistence } from "./ruleSetObjectPersistence";
import { translateStorageFailure } from "./storageFailureTranslation";
import { translateStorageWriteError } from "./storageWriteErrorTranslation";

type PersistableDomainObject = GameState | RuleSet;

/** Interne Implementierung der schreibenden Persistence-Capability. */
export class ObjectWritePersistence implements ObjectWritePort {
	constructor(
		private readonly storage: DataFileStorage,
		private readonly games: GameObjectPersistence,
		private readonly ruleSets: RuleSetObjectPersistence,
		private readonly pendingGameSaves: PendingGameSaveRegistry,
	) {}

	saveObject(
		object: GameState,
		decoding: ObjectDecodingOptions,
		options?: GameObjectSaveOptions,
	): ReturnType<GameObjectPersistence["saveObject"]>;
	saveObject(
		object: RuleSet,
		decoding: ObjectDecodingOptions,
		options?: RuleSetSaveOptions,
	): Promise<RuleSet>;
	saveObject(
		object: PersistableDomainObject,
		decoding: ObjectDecodingOptions,
		options: GameObjectSaveOptions | RuleSetSaveOptions = {},
	): Promise<
		RuleSet | Awaited<ReturnType<GameObjectPersistence["saveObject"]>>
	> {
		if (!isGameState(object))
			return translateStorageWriteError(() =>
				this.ruleSets.saveObject(
					object,
					decoding.ansiFallbackLocale,
					options.conflictPolicy,
				),
			);
		return this.saveGameObject(object, options);
	}

	deleteObject(
		reference: PersistedObjectReference,
		decoding: ObjectDecodingOptions,
	): Promise<void> {
		return translateStorageWriteError(
			() =>
				reference.kind === "ruleSet"
					? this.ruleSets.deleteObject(
							reference.id,
							decoding.ansiFallbackLocale,
						)
					: this.games.deleteObject(
							reference.kind,
							reference.id,
							reference.storageVariant,
						),
			"delete",
		);
	}

	replaceObject(
		oldId: ValidId,
		object: GameState,
		decoding: ObjectDecodingOptions,
		storageVariant?: string,
	): Promise<PersistedObjectWriteResult<"game" | "template", GameState>>;
	replaceObject(
		oldId: ValidId,
		object: RuleSet,
		decoding: ObjectDecodingOptions,
	): Promise<PersistedObjectWriteResult<"ruleSet", RuleSet>>;
	replaceObject(
		oldId: ValidId,
		object: GameState | RuleSet,
		decoding: ObjectDecodingOptions,
		storageVariant?: string,
	): Promise<
		| PersistedObjectWriteResult<"game" | "template", GameState>
		| PersistedObjectWriteResult<"ruleSet", RuleSet>
	> {
		return translateStorageWriteError<
			| PersistedObjectWriteResult<"game" | "template", GameState>
			| PersistedObjectWriteResult<"ruleSet", RuleSet>
		>(() =>
			isGameState(object)
				? this.games.replaceObject(oldId, object, storageVariant)
				: this.ruleSets.replaceObject(
						oldId,
						object,
						decoding.ansiFallbackLocale,
					),
		);
	}

	async repairInternalDataFileNames(): Promise<InternalFileNameRepairResult> {
		if (
			!hasDataFileCapability(this.storage, "listInternalFileNames") ||
			!hasDataFileCapability(this.storage, "renameInternal")
		)
			return { renamedFiles: 0, repairedIds: 0 };
		const result = await repairInternalDataFileNames(this.storage);
		this.games.clearCache();
		return result;
	}

	private async saveGameObject(
		document: GameState,
		options: GameObjectSaveOptions,
	): Promise<SavedStoredGameObject> {
		const prepared = this.games.prepareSaveObject(document, options);
		try {
			await this.games.savePreparedObject(prepared);
		} catch (error) {
			if (isRecoverableStorageWriteError(error)) {
				if (error.commandId)
					this.pendingGameSaves.set(error.commandId, prepared);
				throw new ObjectSaveInterruptedError(
					error.diagnostic,
					error.commandId,
					error.reason,
					undefined,
					error.file,
				);
			}
			if (error instanceof ObjectPersistenceError) throw error;
			if (isStorageOperationError(error))
				throw translateStorageFailure(error.failure, "save");
			throw error;
		}
		return this.games.completePreparedSave(prepared);
	}
}

function isGameState(object: PersistableDomainObject): object is GameState {
	return "isTemplate" in object;
}
