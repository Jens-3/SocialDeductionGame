import type { DomainServices } from "../src/domain/domainServices";
import {
	createObjectPersistence,
	type ObjectPersistenceComponents,
} from "../src/persistence/objectPersistence";
import type { DataFileStorage } from "../src/persistence/ports/dataFileStorage";

export function createTestObjectPersistence(
	storage: DataFileStorage,
	domainServices: DomainServices,
): ObjectPersistenceComponents {
	return createObjectPersistence(storage, domainServices);
}
