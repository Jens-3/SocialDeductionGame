import type { GameState } from "../../domain/gameFactory";
import type { RuleSet } from "../../domain/ruleSet";
import type {
	ImportedObject,
	ImportTargetMetadata,
	ObjectDecodingOptions,
	ObjectExportOptions,
	ObjectExportResult,
	ObjectImportPreparation,
	ObjectStoreImportResolution,
	PersistedGameObjectKind,
	PersistedObjectKind,
	PreparedObjectStoreRestore,
} from "../objectPersistenceTypes";

/** Import und Export über die Grenze des intern verwalteten Speichers. */
export interface ObjectTransferPort {
	importObject(
		selection: unknown,
		options: ObjectDecodingOptions,
	): Promise<ObjectImportPreparation>;
	resolveObjectImport(
		commandId: string,
		resolution: "repair" | "cancel",
	): Promise<ImportedObject | undefined>;
	exportObject(
		object: GameState | RuleSet,
		options?: ObjectExportOptions,
	): Promise<ObjectExportResult>;
	inspectImportTarget(
		kind: PersistedGameObjectKind,
		id: string,
		options: ObjectDecodingOptions,
	): Promise<ImportTargetMetadata>;
	prepareObjectStoreRestore(
		kind: PersistedObjectKind,
		selection: unknown,
		options: ObjectDecodingOptions,
	): Promise<PreparedObjectStoreRestore>;
	resolveObjectStoreRestore(
		kind: PersistedObjectKind,
		commandId: string,
		resolution: ObjectStoreImportResolution,
	): Promise<void>;
	exportObjectStore(
		kind: PersistedObjectKind,
		decoding: ObjectDecodingOptions,
		options?: ObjectExportOptions,
	): Promise<ObjectExportResult>;
}
