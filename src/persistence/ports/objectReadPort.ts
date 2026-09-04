import type { RuleSet } from "../../domain/ruleSet";
import type {
	LatestStoredGameObject,
	LoadedStoredGameObject,
	ObjectDecodingOptions,
	ObjectListResult,
	PersistedGameObjectKind,
	PersistedObjectKind,
} from "../objectPersistenceTypes";

/** Lesen intern persistierter Domainobjekte und ihrer Anzeigedaten. */
export interface ObjectReadPort {
	loadObject(
		kind: PersistedGameObjectKind,
		id: string,
		options: ObjectDecodingOptions,
	): Promise<LoadedStoredGameObject>;
	loadObject(
		kind: "ruleSet",
		id: string,
		options: ObjectDecodingOptions,
	): Promise<RuleSet>;
	findLatestStoredGame(): Promise<LatestStoredGameObject | undefined>;
	readAllObjectsOfType<K extends PersistedObjectKind>(
		kind: K,
		options: ObjectDecodingOptions,
	): Promise<ObjectListResult<K>>;
}
