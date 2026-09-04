import { language } from "../../config";
import type { ObjectRecoveryPort } from "../../persistence/ports/objectRecoveryPort";
import type { ApplicationObjectReadProblem } from "../objectList";
import type {
	ObjectReadProblemRepairAction,
	ObjectReadProblemService,
} from "../objectReadProblemService";
import type { ObjectRepairSuccess } from "../objectSuccess";
import { executeApplicationOperation } from "./applicationErrorMapping";
import { describeDocumentSyntaxRepairs } from "./libraryRepairPresentation";

/** Interne Implementierung der Behandlung beschädigter gespeicherter Objekte. */
export class DefaultObjectReadProblemService
	implements ObjectReadProblemService
{
	constructor(private readonly persistence: ObjectRecoveryPort) {}

	delete(problem: ApplicationObjectReadProblem): Promise<void> {
		return executeApplicationOperation(
			() =>
				this.persistence.deleteObjectReadProblem(problem, {
					ansiFallbackLocale: language,
				}),
			"delete",
		);
	}

	export(problem: ApplicationObjectReadProblem): Promise<void> {
		return executeApplicationOperation(
			() => this.persistence.exportObjectReadProblem(problem),
			"export",
		);
	}

	async repair(
		problem: ApplicationObjectReadProblem,
		action: ObjectReadProblemRepairAction,
	): Promise<ObjectRepairSuccess> {
		const repaired = await executeApplicationOperation(
			() =>
				this.persistence.repairObjectReadProblem(
					problem,
					{ ansiFallbackLocale: language },
					action === "keepBoth",
				),
			"repair",
		);
		if (!repaired)
			return {
				status: "repaired",
				kind: problem.kind,
				id: problem.id,
			};
		repaired.report.changes = [
			...describeDocumentSyntaxRepairs(repaired.syntaxRepairs),
			...repaired.report.changes,
		];
		return {
			status: "repaired",
			kind: problem.kind,
			id: problem.id,
			report: repaired.report,
		};
	}
}
