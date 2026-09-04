import { describe, expect, it } from "vitest";
import {
	ApplicationInvariantError,
	ApplicationOperationError,
} from "../src/application/applicationError";
import {
	createDefaultApplicationOperationError,
	executeApplicationOperation,
} from "../src/application/internal/applicationErrorMapping";
import { applicationFailureReasonText } from "../src/gui/applicationFailurePresentation";
import { createGuiTranslator } from "../src/gui/i18n/translate";
import {
	ObjectSerializationError,
	ObjectStorageError,
} from "../src/persistence/objectPersistenceError";
import type {
	DataFileReference,
	DataFileStorage,
} from "../src/persistence/ports/dataFileStorage";
import type {
	StorageFailure,
	StorageFailureReason,
} from "../src/persistence/ports/storageFailure";
import { isStorageDiskFullError } from "../src/persistence/ports/storageFailure";
import { PlatformOperationError } from "../src/platform/platformOperationError";
import type { SerializationFailureReason } from "../src/serialization/serializationFailure";
import { createTestObjectPersistence } from "./createTestObjectPersistence";
import { fixedDomainServices } from "./fixedClock";
import { createTestGame } from "./fixtures";

const encoder = new TextEncoder();
const decoding = { ansiFallbackLocale: "de" } as const;
const t = createGuiTranslator("de");

type GeneratedFaultFile = {
	file: DataFileReference;
	bytes: Uint8Array;
};

const storageExpectations = {
	notFound: "Die gespeicherten Daten wurden nicht gefunden.",
	permissionDenied: "Die gespeicherten Daten können nicht gelesen werden.",
	unreadable: "Die gespeicherten Daten können nicht gelesen werden.",
	storageUnavailable: "Der Speicher ist momentan nicht erreichbar.",
	diskFull:
		"Der Speicherplatz ist voll. Bitte geben Sie Speicherplatz frei und versuchen Sie es erneut.",
	writeFailure: "Die Daten konnten nicht sicher gespeichert werden.",
	unsupported: "Der Speicher ist momentan nicht erreichbar.",
} satisfies Record<StorageFailureReason, string>;

const serializationFaultFiles = {
	invalidJson: generatedFile(
		"game_invalid_json.json",
		encoder.encode('{"id":'),
	),
	invalidDocument: generatedFile(
		"game_invalid_document.json",
		encoder.encode("{}"),
	),
	unsupportedVersion: generatedFile(
		"game_unsupported_version.json",
		encoder.encode(
			JSON.stringify({
				fileType: "social-deduction-game",
				schemaVersion: 999,
			}),
		),
	),
	encodingFailure: generatedFile(
		"game_invalid_encoding.json",
		Uint8Array.from([0xff, 0xfe, 0x00]),
	),
} satisfies Record<SerializationFailureReason, GeneratedFaultFile>;

const serializationExpectations = {
	invalidJson: "Die Datei enthält kein gültiges JSON.",
	invalidDocument: "Die Datei hat keine gültige Struktur.",
	unsupportedVersion: "Die Dateiversion wird nicht unterstützt.",
	encodingFailure:
		"Die Zeichenkodierung der Datei konnte nicht gelesen werden.",
} satisfies Record<SerializationFailureReason, string>;

describe("Persistence- und Application-Ausgabe für technische Reasons", () => {
	it("erkennt einen vollen Datenträger auch in einer verschachtelten Ursache", () => {
		const systemError = Object.assign(new Error("write failed"), {
			code: "ENOSPC",
		});
		const wrapped = new Error("Sicheres Schreiben fehlgeschlagen.", {
			cause: systemError,
		});

		expect(isStorageDiskFullError(wrapped)).toBe(true);
	});

	for (const reason of Object.keys(
		storageExpectations,
	) as StorageFailureReason[]) {
		it(`erhält den Storage-Grund ${reason} bis zur Application`, async () => {
			const faultFile = generatedFile(
				`${storageKey(reason)}.json`,
				encoder.encode(`storage failure: ${reason}`),
			);
			const failure: StorageFailure = {
				source: "storage",
				operation: storageOperation(reason),
				reason,
				retryable: reason !== "notFound" && reason !== "unsupported",
				repairable: reason === "unreadable",
				category: faultFile.file.category,
				file: faultFile.file,
				targetFile: {
					category: faultFile.file.category,
					fileName: `${storageKey(reason)}_target.json`,
				},
				diagnostic: `Technische Diagnose: ${reason}.`,
			};
			const error = await triggerStorageFailure(reason, failure);

			expect(error).toBeInstanceOf(ObjectStorageError);
			expect(error).toMatchObject({
				kind: "storage",
				reason,
				diagnostic: failure.diagnostic,
				storageFailure: failure,
				retryable: failure.retryable,
				repairable: failure.repairable,
				context: {
					kind: "game",
					id: storageKey(reason),
					storageKey: storageKey(reason),
				},
			});

			const applicationError = createDefaultApplicationOperationError(error);
			expect(applicationError).toBeInstanceOf(ApplicationOperationError);
			expect(applicationError).toMatchObject({
				code: "APPLICATION_EXPECTED_ERROR",
				source: "storage",
				expectation: "expected",
				severity: "error",
				reason,
				diagnostic: failure.diagnostic,
				category: failure.category,
				file: failure.file,
				targetFile: failure.targetFile,
				retryable: failure.retryable,
				repairable: failure.repairable,
				cause: error,
			});
			expect(
				applicationFailureReasonText(
					(applicationError as ApplicationOperationError).reason,
					t,
				),
			).toBe(storageExpectations[reason]);
		});
	}

	it("behandelt einen Abbruch als nicht kategorisiertes Operationsergebnis", async () => {
		const storage: DataFileStorage = {
			readInternal: () => Promise.resolve(missingReadResult()),
			readExternal: () => Promise.resolve({ status: "cancelled" }),
		};
		const persistence = createTestObjectPersistence(
			storage,
			fixedDomainServices,
		);
		const error = await persistence.transfer
			.importObject({}, decoding)
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(Error);
		expect(error).toMatchObject({ name: "AbortError" });
		expect(error).not.toBeInstanceOf(ObjectStorageError);
		expect(createDefaultApplicationOperationError(error)).toBe(error);
	});

	it("übersetzt einen Zielkonflikt getrennt von StorageFailure", async () => {
		const storage: DataFileStorage = {
			readInternal: () => Promise.resolve(missingReadResult()),
			writeInternal: (_file) =>
				Promise.resolve({
					status: "conflict",
					reason: "targetExists",
					file: _file,
					diagnostic: "Technische Diagnose: targetExists.",
				}),
		};
		const persistence = createTestObjectPersistence(
			storage,
			fixedDomainServices,
		);
		const error = await persistence.write
			.saveObject(createTestGame(), decoding)
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(ObjectStorageError);
		expect(error).toMatchObject({
			reason: "targetExists",
			storageFailure: undefined,
		});
		expect(
			applicationFailureReasonText(
				(
					createDefaultApplicationOperationError(
						error,
					) as ApplicationOperationError
				).reason,
				t,
			),
		).toBe("Am Speicherziel existieren bereits Daten.");
	});

	it.each([
		[
			"generischen Storagefehler",
			"persistence",
			new ObjectStorageError(
				"Unbekannter Fehler im Storage-Adapter.",
				"load",
				false,
			),
		],
		[
			"generischen Serialisierungsfehler",
			"serialization",
			new ObjectSerializationError(
				"Unbekannter Fehler im Serializer.",
				"decode",
				false,
			),
		],
	] as const)(
		"markiert einen %s als unerwartet",
		(_label, expectedSource, cause) => {
			expect(createDefaultApplicationOperationError(cause)).toMatchObject({
				name: "ApplicationOperationError",
				code: "APPLICATION_UNEXPECTED_ERROR",
				source: expectedSource,
				expectation: "unexpected",
				severity: "critical",
				reason:
					cause instanceof ObjectStorageError
						? "storageFailure"
						: "serializationFailure",
				diagnostic: cause.message,
				cause,
			});
		},
	);

	it.each([
		[
			"Application",
			"application",
			new ApplicationInvariantError("Application-Invariante verletzt."),
		],
		[
			"Platform",
			"platform",
			new PlatformOperationError("Plattformzugriff fehlgeschlagen."),
		],
	] as const)(
		"erhält die Quelle %s für unerwartete Fehler",
		(_label, expectedSource, cause) => {
			expect(createDefaultApplicationOperationError(cause)).toMatchObject({
				code: "APPLICATION_UNEXPECTED_ERROR",
				source: expectedSource,
				expectation: "unexpected",
				severity: "critical",
				cause,
			});
		},
	);

	it.each([
		["invalidReference", new TypeError("Ungültige interne Dateireferenz.")],
		[
			"unsupportedOperation",
			new Error("Storage-Adapter unterstützt die Operation nicht."),
		],
	] as const)(
		"begrenzt den unbekannten Adapterfehler %s",
		async (_reason, bug) => {
			const storage: DataFileStorage = {
				readInternal: () => Promise.resolve(missingReadResult()),
				writeExternal: () => Promise.reject(bug),
			};
			const persistence = createTestObjectPersistence(
				storage,
				fixedDomainServices,
			);
			const error = await persistence.transfer
				.exportObject(createTestGame())
				.catch((caught: unknown) => caught);

			expect(error).toBe(bug);
			expect(error).not.toBeInstanceOf(ObjectStorageError);
			expect(createDefaultApplicationOperationError(error)).toMatchObject({
				name: "ApplicationOperationError",
				code: "APPLICATION_UNEXPECTED_ERROR",
				source: "unknown",
				expectation: "unexpected",
				severity: "critical",
				reason: "unexpectedFailure",
				diagnostic: bug.message,
				cause: bug,
			});
		},
	);

	for (const reason of Object.keys(
		serializationFaultFiles,
	) as SerializationFailureReason[]) {
		it(`erhält den Serialization-Grund ${reason} bis zur Application`, async () => {
			const faultFile = serializationFaultFiles[reason];
			const persistence = createTestObjectPersistence(
				externalFileStorage(faultFile),
				fixedDomainServices,
			);

			const error = await persistence.transfer
				.importObject(faultFile, decoding)
				.catch((caught: unknown) => caught);

			expect(error).toBeInstanceOf(ObjectSerializationError);
			expect(error).toMatchObject({
				kind: "serialization",
				operation: "decode",
				reason,
			});

			const applicationError = createDefaultApplicationOperationError(error);
			expect(applicationError).toBeInstanceOf(ApplicationOperationError);
			expect(applicationError).toMatchObject({
				code: "APPLICATION_EXPECTED_ERROR",
				source: "serialization",
				expectation: "expected",
				severity: "error",
				reason,
				repairable: (error as ObjectSerializationError).repairable,
				cause: error,
			});
			expect(
				applicationFailureReasonText(
					(applicationError as ApplicationOperationError).reason,
					t,
				),
			).toBe(serializationExpectations[reason]);
		});
	}

	it("trennt bei einer ausgeführten Operation GUI-Text und Diagnose", async () => {
		const cause = new Error("Adapter-Stack mit technischem Detail");

		const error = await executeApplicationOperation(
			() => Promise.reject(cause),
			"export",
		).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(ApplicationOperationError);
		expect(error).toMatchObject({
			code: "APPLICATION_UNEXPECTED_ERROR",
			source: "unknown",
			expectation: "unexpected",
			severity: "critical",
			reason: "unexpectedFailure",
			operation: "export",
			diagnostic: cause.message,
			cause,
		});
		expect((error as Error).message).toBe("unexpectedFailure");
	});
});

async function triggerStorageFailure(
	reason: StorageFailureReason,
	failure: StorageFailure,
): Promise<unknown> {
	const errorResult = { status: "error" as const, error: failure };
	const storage: DataFileStorage = {
		readInternal: () => Promise.resolve(errorResult),
		...(reason === "writeFailure" || reason === "diskFull"
			? { writeInternal: () => Promise.resolve(errorResult) }
			: {}),
	};
	const persistence = createTestObjectPersistence(storage, fixedDomainServices);
	switch (reason) {
		case "notFound":
		case "permissionDenied":
		case "unreadable":
		case "storageUnavailable":
		case "unsupported":
			return persistence.read
				.loadObject("game", storageKey(reason), decoding)
				.catch((caught: unknown) => caught);
		case "writeFailure":
		case "diskFull":
			return persistence.write
				.saveObject(createTestGame(), decoding)
				.catch((caught: unknown) => caught);
	}
}

function storageOperation(
	reason: StorageFailureReason,
): StorageFailure["operation"] {
	switch (reason) {
		case "notFound":
		case "permissionDenied":
		case "unreadable":
		case "storageUnavailable":
		case "unsupported":
			return "read";
		case "writeFailure":
		case "diskFull":
			return "write";
	}
}

function missingReadResult() {
	return {
		status: "error" as const,
		error: {
			source: "storage" as const,
			operation: "read" as const,
			reason: "notFound" as const,
			retryable: false,
			repairable: false,
		},
	};
}

function generatedFile(
	fileName: string,
	bytes: Uint8Array,
): GeneratedFaultFile {
	return {
		file: { category: "game", fileName },
		bytes,
	};
}

function storageKey(reason: StorageFailureReason): string {
	return `game_storage_${reason.toLowerCase()}`;
}

function externalFileStorage(file: GeneratedFaultFile): DataFileStorage {
	return {
		readInternal: () =>
			Promise.resolve({
				status: "error",
				error: {
					source: "storage",
					operation: "read",
					reason: "notFound",
					retryable: false,
					repairable: false,
					category: file.file.category,
					file: file.file,
				},
			}),
		readExternal: (selection) => {
			expect(selection).toBe(file);
			return Promise.resolve(file.bytes);
		},
	};
}
