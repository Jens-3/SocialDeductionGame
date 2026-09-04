import type { DomainServices } from "../domain/domainServices";
import { GameObjectPersistence } from "./gameObjectPersistence";
import type { InternalFileNameRepairResult } from "./objectPersistenceInternalTypes";
import { ObjectReadPersistence } from "./objectReadPersistence";
import { ObjectRecoveryPersistence } from "./objectRecoveryPersistence";
import { PendingGameSaveRegistry } from "./objectSaveWorkflow";
import { ObjectTransferPersistence } from "./objectTransferPersistence";
import { ObjectWritePersistence } from "./objectWritePersistence";
import type { DataFileStorage } from "./ports/dataFileStorage";
import type { ObjectPersistenceCapabilities } from "./ports/objectPersistenceCapabilities";
import { RuleSetObjectPersistence } from "./ruleSetObjectPersistence";

export type ObjectPersistenceMaintenance = {
	repairInternalDataFileNames(): Promise<InternalFileNameRepairResult>;
};

export type ObjectPersistenceComponents = ObjectPersistenceCapabilities & {
	maintenance: ObjectPersistenceMaintenance;
};

/**
 * Erzeugt die getrennten Persistence-Capabilities mit gemeinsamem Cache- und
 * Workflowzustand.
 */
export function createObjectPersistence(
	storage: DataFileStorage,
	domainServices: DomainServices,
): ObjectPersistenceComponents {
	const games = new GameObjectPersistence(storage, domainServices);
	const ruleSets = new RuleSetObjectPersistence(storage);
	const pendingGameSaves = new PendingGameSaveRegistry();
	const write = new ObjectWritePersistence(
		storage,
		games,
		ruleSets,
		pendingGameSaves,
	);

	return {
		read: new ObjectReadPersistence(games, ruleSets),
		write,
		transfer: new ObjectTransferPersistence(
			storage,
			games,
			ruleSets,
			domainServices,
		),
		recovery: new ObjectRecoveryPersistence(
			storage,
			games,
			ruleSets,
			pendingGameSaves,
		),
		maintenance: {
			repairInternalDataFileNames: () => write.repairInternalDataFileNames(),
		},
	};
}
