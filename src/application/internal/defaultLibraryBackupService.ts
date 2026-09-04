import { language } from "../../config";
import type { ObjectStoreImportResolution } from "../../persistence/objectPersistenceTypes";
import type { ObjectTransferPort } from "../../persistence/ports/objectTransferPort";
import { expectedApplicationError } from "../applicationError";
import type { ApplicationExportResult, ExportDecision } from "../exportTypes";
import type {
	LibraryBackupService,
	LibraryRestorePreview,
	LibraryRestoreSuccess,
} from "../libraryUseCaseContracts";
import { executeApplicationOperation } from "./applicationErrorMapping";
import {
	exportOptionsFromDecision,
	toApplicationExportResult,
} from "./exportResultMapping";

export class DefaultLibraryBackupService implements LibraryBackupService {
	readonly #pendingRestores = new Map<string, LibraryRestorePreview>();

	constructor(private readonly transfer: ObjectTransferPort) {}

	async exportLibraryBackup(
		decision?: Exclude<ExportDecision, "cancel">,
	): Promise<ApplicationExportResult> {
		return toApplicationExportResult(
			await executeApplicationOperation(
				() =>
					this.transfer.exportObjectStore(
						"ruleSet",
						{ ansiFallbackLocale: language },
						exportOptionsFromDecision(decision),
					),
				"export",
			),
			"library",
		);
	}

	async shareLibraryBackup(): Promise<ApplicationExportResult> {
		return toApplicationExportResult(
			await executeApplicationOperation(
				() =>
					this.transfer.exportObjectStore(
						"ruleSet",
						{ ansiFallbackLocale: language },
						{ delivery: "share" },
					),
				"export",
			),
			"library",
		);
	}

	async restoreLibraryBackup(
		selection: unknown,
	): Promise<LibraryRestoreSuccess> {
		const preview = await this.prepareLibraryBackupRestore(selection);
		if (
			!preview.availableDecisions.some(
				(decision: string) => decision === "replace",
			)
		) {
			await this.resolveLibraryBackupRestore(preview.commandId, "cancel");
			throw expectedApplicationError("import", "library", "decisionRequired");
		}
		const result = await this.resolveLibraryBackupRestore(
			preview.commandId,
			"replace",
		);
		if (!result)
			throw expectedApplicationError("resolve", "library", "decisionExpired");
		return result;
	}

	async prepareLibraryBackupRestore(
		selection: unknown,
	): Promise<LibraryRestorePreview> {
		const preview = await executeApplicationOperation(
			() =>
				this.transfer.prepareObjectStoreRestore("ruleSet", selection, {
					ansiFallbackLocale: language,
				}),
			"import",
		);
		this.#pendingRestores.set(preview.commandId, preview);
		return preview;
	}

	async resolveLibraryBackupRestore(
		commandId: string,
		resolution: ObjectStoreImportResolution,
	): Promise<LibraryRestoreSuccess | undefined> {
		const preview = this.#pendingRestores.get(commandId);
		if (!preview)
			throw expectedApplicationError("resolve", "library", "decisionExpired");
		await executeApplicationOperation(
			() =>
				this.transfer.resolveObjectStoreRestore(
					"ruleSet",
					commandId,
					resolution,
				),
			"recover",
		);
		this.#pendingRestores.delete(commandId);
		if (resolution === "cancel") return undefined;
		return {
			status: "restored",
			kind: "library",
			source: "backup",
			preview,
		};
	}
}
