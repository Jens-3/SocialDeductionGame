import { describe, expect, it } from "vitest";
import {
	classifyStorageFailureReason,
	externalErrorDiagnostic,
	InternalStorageError,
	sanitizeExternalDiagnostic,
} from "../src/storage/storageError";

describe("Storage-Fehlerklassifikation", () => {
	it("bevorzugt strukturierte technische Marker vor Meldungstext", () => {
		const error = Object.assign(new Error("Unbekannter Fehler"), {
			code: "EACCES",
		});

		expect(classifyStorageFailureReason(error, "storageUnavailable")).toBe(
			"permissionDenied",
		);
	});

	it("verwendet externe Meldungen nur als Klassifikations-Fallback", () => {
		expect(
			classifyStorageFailureReason(
				new Error("Quota exceeded while writing"),
				"writeFailure",
			),
		).toBe("diskFull");
	});

	it("übernimmt aus Wrappern die tiefste externe Ursache und bereinigt sie", () => {
		const external = new Error("Access\tdenied\u202e");
		const wrapper = new Error("Intern erzeugter Wrappertext", {
			cause: external,
		});

		expect(externalErrorDiagnostic(wrapper)).toBe("Access denied");
	});

	it("erzeugt ohne externen Text keine Diagnostic", () => {
		expect(sanitizeExternalDiagnostic(undefined)).toBeUndefined();
		expect(sanitizeExternalDiagnostic("\u202e")).toBeUndefined();
		expect(
			externalErrorDiagnostic(
				new InternalStorageError("Intern erzeugter Prüftext"),
			),
		).toBeUndefined();
	});
});
