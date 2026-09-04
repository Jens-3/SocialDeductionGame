// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ModalDialog } from "../src/gui/ModalDialog";

afterEach(cleanup);

function DialogHarness() {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				Dialog öffnen
			</button>
			{open ? (
				<ModalDialog
					open
					onClose={() => setOpen(false)}
					labelledBy="test-dialog-title"
				>
					<h2 id="test-dialog-title">Testdialog</h2>
					<button
						type="button"
						data-modal-initial-focus
						onClick={() => setOpen(false)}
					>
						Abbrechen
					</button>
					<button type="button">Speichern</button>
				</ModalDialog>
			) : null}
		</>
	);
}

describe("ModalDialog", () => {
	it("verwendet das native Dialogelement und stellt den Fokus wieder her", async () => {
		render(<DialogHarness />);
		const opener = screen.getByRole("button", { name: "Dialog öffnen" });
		opener.focus();
		fireEvent.click(opener);

		const dialog = screen.getByRole("dialog", { name: "Testdialog" });
		expect(dialog.tagName).toBe("DIALOG");
		expect(dialog.getAttribute("aria-modal")).toBe("true");
		await waitFor(() =>
			expect(document.activeElement).toBe(
				screen.getByRole("button", { name: "Abbrechen" }),
			),
		);

		fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(document.activeElement).toBe(opener);
	});

	it("schließt über das native Cancel-Ereignis, aber nicht per Hintergrundklick", async () => {
		render(<DialogHarness />);
		const opener = screen.getByRole("button", { name: "Dialog öffnen" });
		fireEvent.click(opener);
		fireEvent(
			screen.getByRole("dialog", { name: "Testdialog" }),
			new Event("cancel", { bubbles: false, cancelable: true }),
		);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

		fireEvent.click(opener);
		fireEvent.click(screen.getByRole("dialog", { name: "Testdialog" }));
		expect(screen.getByRole("dialog", { name: "Testdialog" })).toBeTruthy();
	});
});
