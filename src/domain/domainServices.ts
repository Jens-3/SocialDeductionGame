import type { Clock } from "./clock";
import type { IdGenerator } from "./idGenerator";

/** Technische Verträge, welche Domain-Operationen bei Bedarf aktiv aufrufen. */
export type DomainServices = {
	clock: Clock;
	idGenerator: IdGenerator;
};
