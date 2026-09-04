import { language } from "../../config";
import type { RuleSet } from "../../domain/ruleSet";
import type { ObjectReadPort } from "../../persistence/ports/objectReadPort";
import type { LibraryBrowseService } from "../libraryUseCaseContracts";
import type { ApplicationObjectListResult } from "../objectList";
import { executeApplicationOperation } from "./applicationErrorMapping";
import { createApplicationObjectListResult } from "./applicationObjectListMapper";

export class DefaultLibraryBrowseService implements LibraryBrowseService {
	constructor(private readonly read: ObjectReadPort) {}

	async listObjects(
		kind: "ruleSet",
	): Promise<ApplicationObjectListResult<"ruleSet">> {
		return createApplicationObjectListResult(
			await executeApplicationOperation(
				() =>
					this.read.readAllObjectsOfType(kind, {
						ansiFallbackLocale: language,
					}),
				"list",
			),
			language,
		);
	}

	loadRuleSet(ruleSetId: string): Promise<RuleSet> {
		return executeApplicationOperation(
			() =>
				this.read.loadObject("ruleSet", ruleSetId, {
					ansiFallbackLocale: language,
				}),
			"load",
		);
	}
}
