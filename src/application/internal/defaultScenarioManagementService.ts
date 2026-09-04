import { language } from "../../config";
import type { GameState } from "../../domain/gameFactory";
import { hydrateGameState } from "../../domain/gameValidation";
import type { RuleSet } from "../../domain/ruleSet";
import { renameRuleSet, renameTemplate } from "../../domain/scenarioRenaming";
import { normalizeId } from "../../domain/stringSanitizer";
import type { ObjectTransferPort } from "../../persistence/ports/objectTransferPort";
import type { ObjectWritePort } from "../../persistence/ports/objectWritePort";
import { expectedApplicationError } from "../applicationError";
import type { ApplicationExportResult, ExportDecision } from "../exportTypes";
import type {
	RenameScenarioRequest,
	ScenarioManagementService,
} from "../libraryUseCaseContracts";
import type { RenameObjectSuccess } from "../objectSuccess";
import { executeApplicationOperation } from "./applicationErrorMapping";
import type { ApplicationObjectWriter } from "./applicationObjectWriter";
import {
	exportOptionsFromDecision,
	toApplicationExportResult,
} from "./exportResultMapping";

export class DefaultScenarioManagementService
	implements ScenarioManagementService
{
	constructor(
		private readonly write: ObjectWritePort,
		private readonly transfer: ObjectTransferPort,
		private readonly objectWriter: ApplicationObjectWriter,
	) {}

	async saveRuleSet(ruleSet: RuleSet): Promise<void> {
		await this.objectWriter.saveObject(ruleSet);
	}

	async saveTemplate(document: GameState): Promise<void> {
		const template = hydrateGameState(document);
		if (!template.isTemplate)
			throw expectedApplicationError("save", "template", "invalidDocument");
		await this.objectWriter.saveObject(template);
	}

	async exportTemplate(
		document: GameState,
		decision?: Exclude<ExportDecision, "cancel">,
	): Promise<ApplicationExportResult> {
		const template = hydrateGameState(document);
		if (!template.isTemplate)
			throw expectedApplicationError("export", "template", "wrongObjectKind");
		return toApplicationExportResult(
			await executeApplicationOperation(
				() =>
					this.transfer.exportObject(
						template,
						exportOptionsFromDecision(decision),
					),
				"export",
			),
			"template",
		);
	}

	async shareTemplate(document: GameState): Promise<ApplicationExportResult> {
		const template = hydrateGameState(document);
		if (!template.isTemplate)
			throw expectedApplicationError("export", "template", "wrongObjectKind");
		return toApplicationExportResult(
			await executeApplicationOperation(
				() => this.transfer.exportObject(template, { delivery: "share" }),
				"export",
			),
			"template",
		);
	}

	async renameScenario(
		request: RenameScenarioRequest,
	): Promise<RenameObjectSuccess> {
		if (request.type === "ruleSet") {
			const renamed = renameRuleSet(request.document, request.newName, {
				language,
			});
			const result = await executeApplicationOperation(
				() =>
					this.write.replaceObject(
						normalizeId(request.oldId, "ruleSet"),
						renamed,
						{
							ansiFallbackLocale: language,
						},
					),
				"rename",
			);
			return {
				id: result.document.id,
				storageKey: result.reference.storageKey,
				name: result.document.name,
			};
		}

		const source = hydrateGameState(request.document);
		const renamed = renameTemplate(source, request.newName, { language });
		if (renamed.id === request.oldId) {
			const saved = await this.objectWriter.saveObject(renamed);
			return {
				id: saved.document.id,
				storageKey: saved.storageKey,
				name: saved.document.name,
			};
		}
		const result = await executeApplicationOperation(
			() =>
				this.write.replaceObject(
					normalizeId(request.oldId, "template"),
					renamed,
					{
						ansiFallbackLocale: language,
					},
				),
			"rename",
		);
		return {
			id: result.document.id,
			storageKey: result.reference.storageKey,
			name: result.document.name,
		};
	}

	async deleteScenario(
		type: "ruleSet" | "template",
		id: string,
	): Promise<void> {
		await executeApplicationOperation(
			() =>
				this.write.deleteObject(
					{ kind: type, id },
					{ ansiFallbackLocale: language },
				),
			"delete",
		);
	}
}
