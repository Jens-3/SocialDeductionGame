import type {
	DataFileCategory,
	DataFileReference,
	StandaloneDataFileCategory,
} from "./dataFileTypes";
import type {
	StorageCommandContinuation,
	StorageCommandDecision,
} from "./storageCommand";
import type { StorageFailure, StorageOperationResult } from "./storageFailure";
import type { StorageRecoveryPort } from "./storageRecovery";

export type {
	DataFileCategory,
	DataFileReference,
	StandaloneDataFileCategory,
} from "./dataFileTypes";

export type StoredByteDocument = DataFileReference & {
	bytes: Uint8Array;
};

export type StoredFileMetadata = DataFileReference & {
	modifiedAt?: number;
};

export type DataFileWriteOptions = {
	backup?: boolean;
	createOnly?: boolean;
	/**
	 * Bereits zugeordnete Datei, wenn sich der kanonische Dateiname beim
	 * Speichern geändert hat. Storage behandelt sie erst nach erfolgreichem
	 * Schreiben des neuen Ziels als Backup oder löscht sie.
	 */
	previousFile?: DataFileReference;
};

export type DataFileVersion = "primary" | "backup";

export type DataFileReadResult =
	| { status: "success"; bytes: Uint8Array }
	| { status: "error"; error: StorageFailure };

export class RecoverableStorageWriteError extends Error {
	readonly code = "FILE_WRITE_RECOVERY_REQUIRED";
	readonly commandId?: string;
	readonly reason: "diskFull" | "writeFailure" | "targetExists";
	readonly file?: DataFileReference;
	readonly diagnostic?: string;

	constructor(
		message = "Die neue Datei konnte nicht sicher geschrieben werden. Die alte Datei wurde zur Wiederherstellung aufbewahrt.",
		commandId?: string,
		reason: "diskFull" | "writeFailure" | "targetExists" = "writeFailure",
		file?: DataFileReference,
		diagnostic?: string,
	) {
		super(message);
		this.name = "RecoverableStorageWriteError";
		this.commandId = commandId;
		this.reason = reason;
		this.file = file;
		this.diagnostic = diagnostic;
	}
}

export function isRecoverableStorageWriteError(
	error: unknown,
): error is RecoverableStorageWriteError {
	return (
		error instanceof RecoverableStorageWriteError ||
		(typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "FILE_WRITE_RECOVERY_REQUIRED")
	);
}

export interface InternalDataFileReadPort {
	listInternalFileNames(
		category: StandaloneDataFileCategory,
	): Promise<string[]>;
	listInternalFiles(category: DataFileCategory): Promise<StoredFileMetadata[]>;
	readAllInternal(category: DataFileCategory): Promise<StoredByteDocument[]>;
	readInternal(
		file: DataFileReference,
		version?: DataFileVersion,
	): Promise<DataFileReadResult>;
}

export interface InternalDataFileWritePort {
	writeInternal(
		file: DataFileReference,
		bytes: Uint8Array,
		options: DataFileWriteOptions,
	): Promise<void | StorageOperationResult<void>>;
	deleteInternal(
		file: DataFileReference,
		options?: { includeBackup?: boolean; includeRecovery?: boolean },
	): Promise<void | StorageOperationResult<void>>;
	renameInternal(
		oldFile: DataFileReference,
		newFile: DataFileReference,
	): Promise<void | StorageOperationResult<void>>;
}

export interface InternalStorageCommandPort {
	continueInternalCommand(
		commandId: string,
		decision: StorageCommandDecision,
		continuation?: StorageCommandContinuation,
	): Promise<"completed" | "discarded">;
}

export interface ExternalDataFileReadPort {
	readExternal(
		selection: unknown,
	): Promise<Uint8Array | StorageOperationResult<Uint8Array>>;
}

export interface ExternalDataFileWritePort {
	writeExternal(
		bytes: Uint8Array,
		options: {
			suggestedFileName: string;
			description?: string;
			conflictPolicy?: "reject" | "overwrite";
			targetPolicy?: "suggested" | "choose";
			delivery?: "save" | "share";
		},
	): Promise<void | StorageOperationResult<void>>;
}

type DataFileStorageCapabilities = InternalDataFileReadPort &
	InternalDataFileWritePort &
	ExternalDataFileReadPort &
	ExternalDataFileWritePort &
	StorageRecoveryPort &
	InternalStorageCommandPort;

/** Minimale gemeinsame Fähigkeit aller DataFileStorage-Adapter. */
export type DataFileStorage = Pick<InternalDataFileReadPort, "readInternal"> &
	Partial<DataFileStorageCapabilities>;

export function hasDataFileCapability<
	Capability extends keyof DataFileStorageCapabilities,
>(
	storage: DataFileStorage,
	capability: Capability,
): storage is DataFileStorage & Pick<DataFileStorageCapabilities, Capability> {
	return typeof storage[capability] === "function";
}

export function unsupportedDataFileCapability(
	capability: keyof DataFileStorageCapabilities,
): Error & { source: "persistence" } {
	return Object.assign(
		new Error(
			`Der konfigurierte Storage-Adapter unterstützt "${capability}" nicht.`,
		),
		{ source: "persistence" as const },
	);
}
