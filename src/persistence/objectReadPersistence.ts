import type { RuleSet } from "../domain/ruleSet";
import type { GameObjectPersistence } from "./gameObjectPersistence";
import {
	ObjectSerializationError,
	ObjectStorageError,
} from "./objectPersistenceError";
import type {
	LatestStoredGameObject,
	ObjectDecodingOptions,
	ObjectListResult,
	PersistedObjectKind,
} from "./objectPersistenceTypes";
import type { ObjectReadPort } from "./ports/objectReadPort";
import type { RuleSetObjectPersistence } from "./ruleSetObjectPersistence";

/** Interne Implementierung der lesenden Persistence-Capability. */
export class ObjectReadPersistence implements ObjectReadPort {
	constructor(
		private readonly games: GameObjectPersistence,
		private readonly ruleSets: RuleSetObjectPersistence,
	) {}

	loadObject(
		kind: "game" | "template",
		id: string,
		options: ObjectDecodingOptions,
	): ReturnType<GameObjectPersistence["loadObject"]>;
	loadObject(
		kind: "ruleSet",
		id: string,
		options: ObjectDecodingOptions,
	): Promise<RuleSet>;
	loadObject(
		kind: PersistedObjectKind,
		id: string,
		options: ObjectDecodingOptions,
	): Promise<
		RuleSet | Awaited<ReturnType<GameObjectPersistence["loadObject"]>>
	> {
		return kind === "ruleSet"
			? this.ruleSets.loadObject(id, options.ansiFallbackLocale)
			: this.games.loadObject(kind, id, options.ansiFallbackLocale);
	}

	findLatestStoredGame(): Promise<LatestStoredGameObject | undefined> {
		return this.games.findLatestStoredObject();
	}

	async readAllObjectsOfType<K extends PersistedObjectKind>(
		kind: K,
		options: ObjectDecodingOptions,
	): Promise<ObjectListResult<K>> {
		try {
			const result =
				kind === "ruleSet"
					? await this.ruleSets.readAllObjectMetadata(
							options.ansiFallbackLocale,
						)
					: await this.games.readAllObjectMetadata(
							kind,
							options.ansiFallbackLocale,
						);
			return result as ObjectListResult<K>;
		} catch (error) {
			if (error instanceof ObjectStorageError)
				return {
					status: "failed",
					problem: {
						scope: "store",
						category: "storage",
						kind,
						reason:
							error.reason === "missingLibrary"
								? "missingLibrary"
								: "storageFailure",
						retryable: error.retryable,
						repairable: error.repairable,
						...(error.diagnostic ? { diagnostic: error.diagnostic } : {}),
					},
				};
			if (error instanceof ObjectSerializationError)
				return {
					status: "failed",
					problem: {
						scope: "store",
						category: "serialization",
						kind,
						reason: error.reason,
						repairable: error.repairable,
						...(error.diagnostic ? { diagnostic: error.diagnostic } : {}),
						...(error.details ? { details: error.details } : {}),
					},
				};
			throw error;
		}
	}
}
