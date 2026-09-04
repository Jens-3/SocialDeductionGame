import type { ApplicationObjectReadProblem } from "./objectList";
import type { ObjectRepairSuccess } from "./objectSuccess";

export type ObjectReadProblemRepairAction =
	| "repair"
	| "repairFileName"
	| "keepBoth";

/**
 * Application-facing Behandlung eines einzelnen gespeicherten Objekts.
 * Welche technische Speicherform dahinterliegt, entscheidet Persistence.
 */
export interface ObjectReadProblemService {
	delete(problem: ApplicationObjectReadProblem): Promise<void>;
	export(problem: ApplicationObjectReadProblem): Promise<void>;
	repair(
		problem: ApplicationObjectReadProblem,
		action: ObjectReadProblemRepairAction,
	): Promise<ObjectRepairSuccess>;
}
