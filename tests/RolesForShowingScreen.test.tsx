// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createRolesForShowingEditorModel,
	createRolesForShowingPresentation,
} from "../src/application/rolesForShowing";
import { RolesForShowingScreen } from "../src/gui/RolesForShowingScreen";
import { createTestGame } from "./fixtures";

afterEach(cleanup);

describe("Editor für Rollen zum Zeigen", () => {
	it("ergänzt Rollen mehrfach, entfernt einzelne Vorkommen und zeigt den Entwurf", () => {
		const game = createTestGame();
		const onSave = vi.fn();
		render(
			<RolesForShowingScreen
				model={createRolesForShowingEditorModel(game)}
				onSave={onSave}
				onCancel={vi.fn()}
				onCreatePresentation={(draft) =>
					createRolesForShowingPresentation(game, draft)
				}
			/>,
		);

		fireEvent.change(screen.getByLabelText("Freitext"), {
			target: { value: "Auswahl" },
		});
		const symbolToggle = screen.getByLabelText<HTMLInputElement>(
			"Rollensymbol anzeigen",
		);
		expect(symbolToggle.checked).toBe(false);
		fireEvent.click(symbolToggle);
		expect(screen.getByText("Ja")).toBeDefined();
		for (let index = 0; index < 2; index++) {
			fireEvent.click(screen.getByRole("button", { name: /Rolle$/ }));
			const dialog = screen.getByRole("dialog", { name: "Rolle hinzufügen" });
			fireEvent.click(within(dialog).getByRole("button", { name: "◆ Seer" }));
		}
		const removeButtons = screen.getAllByRole("button", {
			name: "◆ Seer entfernen",
		});
		expect(removeButtons).toHaveLength(2);
		const firstRemoveButton = removeButtons[0];
		if (!firstRemoveButton) throw new Error("Entfernen-Button fehlt.");
		fireEvent.click(firstRemoveButton);
		expect(
			screen.getAllByRole("button", { name: "◆ Seer entfernen" }),
		).toHaveLength(1);

		fireEvent.click(screen.getByRole("button", { name: "Anzeigen" }));
		const preview = screen.getByRole("button", { name: "Anzeige schließen" });
		expect(preview.textContent).toBe("Auswahl:\n◆ Seer");
		fireEvent.click(preview);
		fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

		expect(onSave).toHaveBeenCalledWith({
			notice: "Auswahl",
			roles: ["r_seer"],
			showRoleSymbols: true,
		});
	});

	it("verwirft den Entwurf über Abbrechen", () => {
		const game = createTestGame();
		const onCancel = vi.fn();
		render(
			<RolesForShowingScreen
				model={createRolesForShowingEditorModel(game)}
				onSave={vi.fn()}
				onCancel={onCancel}
				onCreatePresentation={(draft) =>
					createRolesForShowingPresentation(game, draft)
				}
			/>,
		);

		fireEvent.change(screen.getByLabelText("Freitext"), {
			target: { value: "Nicht speichern" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("zeigt die Oberfläche auf Englisch an", () => {
		const game = createTestGame();
		render(
			<RolesForShowingScreen
				model={createRolesForShowingEditorModel(game)}
				language="en"
				onSave={vi.fn()}
				onCancel={vi.fn()}
				onCreatePresentation={(draft) =>
					createRolesForShowingPresentation(game, draft)
				}
			/>,
		);

		expect(
			screen.getByRole("heading", { name: "Roles to be shown" }),
		).toBeDefined();
		expect(screen.getByLabelText("Free text")).toBeDefined();
		expect(screen.getByText("No roles selected yet.")).toBeDefined();
		expect(screen.getByLabelText("Show role symbol")).toBeDefined();
	});
});
