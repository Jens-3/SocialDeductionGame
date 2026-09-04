// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApplicationErrorBoundary } from "../src/gui/ApplicationErrorBoundary";

afterEach(cleanup);

it("ersetzt einen abgestürzten React-Teilbaum durch eine bedienbare Fehlerseite", () => {
	const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

	render(
		<ApplicationErrorBoundary>
			<BrokenScreen />
		</ApplicationErrorBoundary>,
	);

	expect(screen.getByRole("alert").textContent).toContain(
		"Die Oberfläche konnte nicht angezeigt werden.",
	);
	expect(screen.getByText("Unbekannter Fehler.")).toBeDefined();
	const technicalDetails = screen
		.getByText("Technische Details")
		.closest("details");
	expect(technicalDetails?.textContent).toContain("Unerwartete Testdatei.");
	expect(
		screen.getByRole("button", { name: "Details kopieren" }),
	).toBeDefined();
	expect(
		screen.getByRole("button", { name: "Erneut versuchen" }),
	).toBeDefined();

	consoleError.mockRestore();
});

function BrokenScreen(): never {
	throw new Error("Unerwartete Testdatei.");
}
