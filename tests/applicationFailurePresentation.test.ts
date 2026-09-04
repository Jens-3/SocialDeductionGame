import { describe, expect, it } from "vitest";
import { ApplicationOperationError } from "../src/application/applicationError";
import {
	createGuiErrorPresentation,
	guiErrorText,
} from "../src/gui/applicationFailurePresentation";
import { createGuiTranslator } from "../src/gui/i18n/translate";

const t = createGuiTranslator("de");

describe("GUI-Fehlerdarstellung", () => {
	it("zeigt Diagnosen unerwarteter Application-Fehler getrennt vom Haupttext", () => {
		const cause = new Error("Cannot read properties of undefined");
		const error = new ApplicationOperationError(
			"application",
			"unexpected",
			"save",
			"game",
			"unexpectedFailure",
			cause.message,
			cause,
		);

		const presentation = createGuiErrorPresentation(error, t);

		expect(presentation.message).toBe(
			"Unerwarteter Anwendungsfehler. Bitte melden Sie diesen Fehler.",
		);
		expect(presentation.technicalDetails).toContain("Quelle: application");
		expect(presentation.technicalDetails).toContain("Vorgang: save");
		expect(presentation.technicalDetails).toContain(cause.message);
	});

	it("blendet technische Details bei erwartbaren Fehlern aus", () => {
		const error = new ApplicationOperationError(
			"storage",
			"expected",
			"load",
			"game",
			"notFound",
			"game_1.json fehlt",
			undefined,
		);

		expect(createGuiErrorPresentation(error, t)).toEqual({
			message: "Die gespeicherten Daten wurden nicht gefunden.",
		});
	});

	it("unterdrückt die Meldung eines unbekannten Programmierfehlers nicht", () => {
		expect(guiErrorText(new Error("Index außerhalb des Bereichs"), t)).toBe(
			"Unbekannter Fehler. Technische Details: Index außerhalb des Bereichs",
		);
	});

	it("lokalisiert erwartbare Rollenverteilungsfehler aus Parametern", () => {
		const error = new ApplicationOperationError(
			"domain",
			"expected",
			"resolve",
			"unknown",
			"roleDistributionInsufficientDistinctRoles",
			undefined,
			undefined,
			{},
			undefined,
			undefined,
			{ teamName: "Dämonen", requestedCount: 2, availableRoleCount: 1 },
		);

		expect(guiErrorText(error, t)).toBe(
			"Rollenverteilung fehlgeschlagen: Für Team „Dämonen“ wurden 2 Spieler angefordert, aber es gibt nur 1 verschiedene Rolle und keine mehrfach erlaubte Rolle.",
		);
	});
});
