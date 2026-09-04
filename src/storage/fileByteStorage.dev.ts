import { readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageRecoveryResolution } from "../persistence/ports/storageRecovery";
import { InternalStorageError } from "./storageError";

export type StoredByteFile = {
	fileName: string;
	bytes: Uint8Array;
};

export type ReadBytesDevOptions =
	| { mode: "single"; filePath: string }
	| {
			mode: "all";
			directoryPath: string;
			acceptFile?: (fileName: string) => boolean;
	  };

export type WriteBytesDevOptions = {
	targetPath: string;
	backupPath?: string;
	recoveryPath?: string;
	createOnly?: boolean;
	overwriteExisting?: boolean;
	retryIncompleteNewFile?: boolean;
};

export class FileWriteRecoveryError extends Error {
	readonly kind: "newFile" | "overwrite";

	constructor(cause: unknown, kind: "newFile" | "overwrite") {
		super(
			kind === "overwrite"
				? "Die neue Datei konnte nicht sicher geschrieben werden. Die alte Datei wurde zur Wiederherstellung aufbewahrt."
				: "Die neue Datei konnte nicht sicher geschrieben und gegengelesen werden.",
			{ cause },
		);
		this.name = "FileWriteRecoveryError";
		this.kind = kind;
	}
}

export class FileTargetExistsError extends Error {
	constructor(targetPath: string) {
		super(`Datei "${path.basename(targetPath)}" existiert bereits.`);
		this.name = "FileTargetExistsError";
	}
}

export function readBytesDev(options: {
	mode: "single";
	filePath: string;
}): Promise<Uint8Array>;
export function readBytesDev(options: {
	mode: "all";
	directoryPath: string;
	acceptFile?: (fileName: string) => boolean;
}): Promise<StoredByteFile[]>;
export async function readBytesDev(
	options: ReadBytesDevOptions,
): Promise<Uint8Array | StoredByteFile[]> {
	if (options.mode === "single") return await readFile(options.filePath);

	const fileNames = await readdir(options.directoryPath);
	const acceptedNames = options.acceptFile
		? fileNames.filter(options.acceptFile)
		: fileNames;
	return await Promise.all(
		acceptedNames.map(async (fileName) => ({
			fileName,
			bytes: await readFile(path.join(options.directoryPath, fileName)),
		})),
	);
}

/**
 * Gemeinsame Schreibmechanik der dateibasierten Dev-Adapter.
 *
 * Beim Überschreiben wird die alte Datei zuerst dauerhaft unter recoveryPath
 * gesichert. Erst nach erfolgreichem Schreiben und Gegenlesen wird sie gelöscht
 * oder zum regulären Backup. Ein Fehler lässt beide Dateien für eine bewusste
 * Entscheidung durch Domain und GUI liegen.
 */
export async function writeBytesDev(
	bytes: Uint8Array,
	options: WriteBytesDevOptions,
): Promise<void> {
	const targetExists = await pathExists(options.targetPath);
	if (
		targetExists &&
		options.createOnly &&
		!options.overwriteExisting &&
		!options.retryIncompleteNewFile
	)
		throw new FileTargetExistsError(options.targetPath);

	if (
		targetExists &&
		!options.retryIncompleteNewFile &&
		(!options.createOnly || options.overwriteExisting)
	) {
		if (!options.recoveryPath)
			throw new Error(
				"Beim Überschreiben muss ein Recovery-Pfad angegeben werden.",
			);
		await overwriteWithRecovery(bytes, {
			targetPath: options.targetPath,
			recoveryPath: options.recoveryPath,
			backupPath: options.backupPath,
		});
		return;
	}

	try {
		await writeFile(options.targetPath, bytes);
		const verified = await readFile(options.targetPath);
		if (!verified.equals(bytes))
			throw new InternalStorageError(
				"Geschriebene Datei konnte nicht verifiziert werden.",
			);
	} catch (error) {
		throw new FileWriteRecoveryError(error, "newFile");
	}
}

async function overwriteWithRecovery(
	bytes: Uint8Array,
	options: {
		targetPath: string;
		recoveryPath: string;
		backupPath?: string;
	},
): Promise<void> {
	let hasRecoverableOldFile = await pathExists(options.recoveryPath);
	if (!hasRecoverableOldFile && (await pathExists(options.targetPath))) {
		await rename(options.targetPath, options.recoveryPath);
		hasRecoverableOldFile = true;
	}
	try {
		await writeFile(options.targetPath, bytes);
		const verified = await readFile(options.targetPath);
		if (!verified.equals(bytes))
			throw new InternalStorageError(
				"Geschriebene Datei konnte nicht verifiziert werden.",
			);
	} catch (error) {
		if (hasRecoverableOldFile)
			throw new FileWriteRecoveryError(error, "overwrite");
		throw new FileWriteRecoveryError(error, "newFile");
	}

	if (!hasRecoverableOldFile) return;
	if (options.backupPath) {
		await rm(options.backupPath, { force: true });
		await rename(options.recoveryPath, options.backupPath);
	} else {
		await rm(options.recoveryPath, { force: true });
	}
}

export async function resolveRecoveryBytesDev(options: {
	targetPath: string;
	recoveryPath: string;
	resolution: StorageRecoveryResolution;
	restoredPath?: string;
}): Promise<void> {
	if (!(await pathExists(options.recoveryPath)))
		throw new Error("Die alte Wiederherstellungsdatei existiert nicht mehr.");
	if (options.resolution === "keepOld") {
		await rm(options.targetPath, { force: true });
		await rename(options.recoveryPath, options.targetPath);
		return;
	}
	if (!(await pathExists(options.targetPath)))
		throw new Error("Die neue Datei existiert nicht.");
	if (options.resolution === "keepNew") {
		await rm(options.recoveryPath, { force: true });
		return;
	}
	if (!options.restoredPath)
		throw new Error("Für beide Dateien fehlt ein Wiederherstellungsname.");
	await rename(options.recoveryPath, options.restoredPath);
}

export async function pathExists(filePath: string): Promise<boolean> {
	try {
		await readFile(filePath);
		return true;
	} catch (error) {
		if (hasCode(error, "ENOENT")) return false;
		throw error;
	}
}

function hasCode(error: unknown, code: string): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === code
	);
}
