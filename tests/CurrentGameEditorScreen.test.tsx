// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScenarioEditorFactory } from "../src/application/scenarioEditor";
import type { GameState } from "../src/domain/gameFactory";
import { CurrentGameEditorScreen as CurrentGameEditorScreenComponent } from "../src/gui/ScenarioLibrary";
import { createTestGame, createTestLoadedGameDocument } from "./fixtures";

function CurrentGameEditorScreen(
	props: Omit<
		ComponentProps<typeof CurrentGameEditorScreenComponent>,
		"editorFactory"
	>,
) {
	return (
		<CurrentGameEditorScreenComponent
			{...props}
			editorFactory={new ScenarioEditorFactory()}
		/>
	);
}

afterEach(cleanup);

describe("Editor des aktuellen Spiels", () => {
	it("zeigt alle Bereiche und übernimmt die Arbeitskopie auch ohne Änderung", async () => {
		const original = createTestGame();
		const onSave = vi.fn<(document: GameState) => void>();
		const onCancel = vi.fn();
		render(
			<CurrentGameEditorScreen
				game={createTestLoadedGameDocument(original, {
					id: original.id,
					name: original.name,
				})}
				onSave={onSave}
				onCancel={onCancel}
			/>,
		);

		for (const tab of ["Teams", "Rollen", "Spieler", "Zustände"]) {
			expect(
				screen.getByRole("button", { name: tab }).hasAttribute("disabled"),
			).toBe(false);
		}
		const saveButton = screen.getByRole("button", {
			name: "Änderung speichern",
		});
		const cancelButton = screen.getByRole("button", { name: "Abbrechen" });
		expect((saveButton as HTMLButtonElement).disabled).toBe(false);
		expect((cancelButton as HTMLButtonElement).disabled).toBe(false);

		fireEvent.click(saveButton);

		await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
		const saved = onSave.mock.calls[0]?.[0];
		expect(saved).not.toBe(original);
		expect(saved?.isTemplate).toBe(false);
		await waitFor(() => expect(onCancel).toHaveBeenCalledOnce());
	});

	it("schützt den Zurückweg nach Änderungen und verwirft über Abbrechen direkt", () => {
		const game = createTestGame();
		const onSave = vi.fn<(document: GameState) => void>();
		const onCancel = vi.fn();
		render(
			<CurrentGameEditorScreen
				game={createTestLoadedGameDocument(game, {
					id: game.id,
					name: game.name,
				})}
				onSave={onSave}
				onCancel={onCancel}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /^Good/ }));
		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Helden" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
		fireEvent.click(screen.getByRole("button", { name: "Zurück" }));

		expect(screen.getByRole("alertdialog").textContent).toContain(
			"Änderungen noch nicht gespeichert.",
		);
		fireEvent.click(
			within(screen.getByRole("alertdialog")).getByRole("button", {
				name: "Abbrechen",
			}),
		);
		expect(screen.queryByRole("alertdialog")).toBeNull();
		expect(onCancel).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
		fireEvent.click(
			screen.getByRole("button", { name: "Beenden ohne Speichern" }),
		);
		expect(onCancel).toHaveBeenCalledOnce();
		expect(onSave).not.toHaveBeenCalled();
	});

	it("verwendet beim Objektwechsel und Abbrechen dasselbe Verhalten wie die Szenarioverwaltung", () => {
		const game = createTestGame();
		render(
			<CurrentGameEditorScreen
				game={createTestLoadedGameDocument(game, {
					id: game.id,
					name: game.name,
				})}
				onSave={() => {}}
				onCancel={() => {}}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /^Good/ }));
		const objectForm = screen
			.getByRole("heading", { name: "Details bearbeiten" })
			.closest("form");
		if (!objectForm) throw new Error("Objektformular nicht gefunden");
		const objectActions = objectForm.querySelector<HTMLElement>(
			".scenario-object-form__actions",
		);
		if (!objectActions) throw new Error("Objektaktionen nicht gefunden");
		expect(
			within(objectActions)
				.getAllByRole("button")
				.map(({ textContent }) => textContent?.trim()),
		).toEqual(["Übernehmen", "Abbrechen", "Löschen"]);

		fireEvent.change(screen.getByLabelText("DisplayName (de)"), {
			target: { value: "Aktuelle gute Spieler" },
		});
		fireEvent.click(screen.getByRole("button", { name: /^Evil/ }));
		expect(screen.getByText("Aktuelle gute Spieler")).toBeDefined();

		fireEvent.change(screen.getByLabelText("DisplayName (de)"), {
			target: { value: "Nicht behalten" },
		});
		const currentObjectForm = screen
			.getByRole("heading", { name: "Details bearbeiten" })
			.closest("form");
		if (!currentObjectForm)
			throw new Error("Aktuelles Objektformular nicht gefunden");
		fireEvent.click(
			within(currentObjectForm).getByRole("button", { name: "Abbrechen" }),
		);
		expect(screen.getByText("Evil")).toBeDefined();
		expect(screen.queryByText("Nicht behalten")).toBeNull();
	});

	it("verlässt eine unveränderte Arbeitskopie ohne Rückfrage", () => {
		const game = createTestGame();
		const onCancel = vi.fn();
		render(
			<CurrentGameEditorScreen
				game={createTestLoadedGameDocument(game, {
					id: game.id,
					name: game.name,
				})}
				onSave={() => {}}
				onCancel={onCancel}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Zurück" }));

		expect(onCancel).toHaveBeenCalledOnce();
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});
});
