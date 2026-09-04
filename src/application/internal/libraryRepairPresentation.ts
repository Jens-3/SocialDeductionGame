import type { LibraryRepairChange } from "../../domain/libraryContainerRepair";
import type { DocumentSyntaxRepair } from "../../persistence/objectPersistenceTypes";
import { ApplicationInvariantError } from "../applicationError";

export function describeDocumentSyntaxRepairs(
	repairs: readonly DocumentSyntaxRepair[],
): LibraryRepairChange[] {
	return repairs.map((repair) => {
		switch (repair.kind) {
			case "insertedMissingQuote":
				return { kind: repair.kind, position: repair.position };
			case "addedClosingBraces":
			case "addedOpeningBraces":
				return { kind: repair.kind, count: repair.count };
			default:
				return assertNever(repair);
		}
	});
}

function assertNever(value: never): never {
	throw new ApplicationInvariantError(
		`Unbekannte Syntaxreparatur: ${String(value)}`,
	);
}
