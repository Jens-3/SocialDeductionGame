import type { GameState } from "../../domain/gameFactory";
import type { RuleSet } from "../../domain/ruleSet";
import type { ValidId } from "../../domain/stringSanitizer";
import type {
	GameObjectSaveOptions,
	ObjectDecodingOptions,
	PersistedObjectReference,
	PersistedObjectWriteResult,
	RuleSetSaveOptions,
	SavedStoredGameObject,
} from "../objectPersistenceTypes";

/** Schreiben und Entfernen intern persistierter Domainobjekte. */
export interface ObjectWritePort {
	saveObject(
		object: GameState,
		decoding: ObjectDecodingOptions,
		options?: GameObjectSaveOptions,
	): Promise<SavedStoredGameObject>;
	saveObject(
		object: RuleSet,
		decoding: ObjectDecodingOptions,
		options?: RuleSetSaveOptions,
	): Promise<RuleSet>;
	deleteObject(
		reference: PersistedObjectReference,
		decoding: ObjectDecodingOptions,
	): Promise<void>;
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
}
