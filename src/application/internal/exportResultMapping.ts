import type {
	ObjectExportOptions,
	ObjectExportResult,
} from "../../persistence/objectPersistenceTypes";
import type { ApplicationErrorSubject } from "../applicationError";
import type { ApplicationExportResult, ExportDecision } from "../exportTypes";

export function toApplicationExportResult(
	result: ObjectExportResult,
	subject: ApplicationErrorSubject,
): ApplicationExportResult {
	if (result.status === "exported") return result;
	return {
		status: "expectedFailure",
		continuation: "restart",
		problem: {
			problemId: `export:${subject}:${result.reason}`,
			source: "storage",
			operation: "export",
			subject,
			reason: result.reason,
			availableActions: ["overwrite", "chooseAnotherTarget", "cancel"],
			...(result.diagnostic ? { diagnostic: result.diagnostic } : {}),
		},
	};
}

export function exportOptionsFromDecision(
	decision?: Exclude<ExportDecision, "cancel">,
): ObjectExportOptions {
	return decision === "overwrite"
		? { conflictPolicy: "overwrite" }
		: decision === "chooseAnotherTarget"
			? { conflictPolicy: "reject", targetPolicy: "choose" }
			: { conflictPolicy: "reject", targetPolicy: "suggested" };
}
