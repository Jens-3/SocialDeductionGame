import type { RuleSet } from "../domain/ruleSet";
import type { ObjectTransferPort } from "../persistence/ports/objectTransferPort";
import type { ApplicationExportResult, ExportDecision } from "./exportTypes";
import { executeApplicationOperation } from "./internal/applicationErrorMapping";
import {
	exportOptionsFromDecision,
	toApplicationExportResult,
} from "./internal/exportResultMapping";

export class RuleSetExportService {
	readonly #persistence: Pick<ObjectTransferPort, "exportObject">;

	constructor(persistence: Pick<ObjectTransferPort, "exportObject">) {
		this.#persistence = persistence;
	}

	async exportRuleSet(
		ruleSet: RuleSet,
		decision?: Exclude<ExportDecision, "cancel">,
	): Promise<ApplicationExportResult> {
		return toApplicationExportResult(
			await executeApplicationOperation(
				() =>
					this.#persistence.exportObject(
						ruleSet,
						exportOptionsFromDecision(decision),
					),
				"export",
			),
			"ruleSet",
		);
	}

	async shareRuleSet(ruleSet: RuleSet): Promise<ApplicationExportResult> {
		return toApplicationExportResult(
			await executeApplicationOperation(
				() =>
					this.#persistence.exportObject(ruleSet, {
						delivery: "share",
					}),
				"export",
			),
			"ruleSet",
		);
	}
}
