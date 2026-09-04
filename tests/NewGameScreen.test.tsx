// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { GamePersistenceService } from "../src/application/gameUseCases";
import type { LibraryBrowseService } from "../src/application/libraryUseCases";
import { NewGameScreen } from "../src/gui/NewGameScreen";

afterEach(cleanup);

it("bereinigt freien GUI-Text unmittelbar bei der Eingabe", async () => {
	const gameReadService = {
		listObjects: () => loadedList([]),
	} as unknown as GamePersistenceService;
	const libraryReadService = {
		listObjects: () =>
			loadedList([{ id: "ruleset_one", name: "Regelwerk 1", version: 1 }]),
	} as unknown as LibraryBrowseService;

	render(
		<NewGameScreen
			onBack={vi.fn()}
			gamePersistenceService={gameReadService}
			libraryBrowseService={libraryReadService}
		/>,
	);

	await screen.findByText("Regelwerk verwenden (1)");
	const input = screen.getByRole<HTMLInputElement>("textbox", {
		name: "Spielname",
	});
	fireEvent.change(input, { target: { value: "A\u202EB\tC" } });
	expect(input.value).toBe("AB C");
});

it("ersetzt eine nicht mehr vorhandene Vorauswahl durch die sichtbare Vorlage", async () => {
	const createGameFromTemplate = vi.fn(() =>
		Promise.reject(new Error("Test nach dem Aufruf beenden.")),
	);
	const gameReadService = {
		listObjects: () =>
			loadedList([
				{
					storageKey: "template_available.json",
					id: "template_available",
					name: "Verfügbare Vorlage",
					storedAt: "2026-07-17T00:00:00.000Z",
					playerCount: 12,
					ruleSetName: "Testregelwerk",
					currentNight: 0,
					phase: "setup" as const,
				},
			]),
		createGameFromTemplate,
	} as unknown as GamePersistenceService;
	const libraryReadService = {
		listObjects: () => loadedList([]),
	} as unknown as LibraryBrowseService;

	render(
		<NewGameScreen
			onBack={vi.fn()}
			gamePersistenceService={gameReadService}
			libraryBrowseService={libraryReadService}
			initialSelection={{ type: "template", id: "template_missing.json" }}
		/>,
	);

	await waitFor(() =>
		expect(screen.getByRole<HTMLSelectElement>("combobox").value).toBe(
			"template_available.json",
		),
	);
	fireEvent.click(screen.getByRole("button", { name: "Spiel vorbereiten" }));
	await waitFor(() =>
		expect(createGameFromTemplate).toHaveBeenCalledWith(
			"template_available.json",
			undefined,
		),
	);
});

it("wählt Regelwerke bevorzugt und zeigt Anzahlen sowie leere Kategorien", async () => {
	const gameReadService = {
		listObjects: () => loadedList([]),
	} as unknown as GamePersistenceService;
	const libraryReadService = {
		listObjects: () =>
			loadedList([
				{ id: "ruleset_one", name: "Regelwerk 1", version: 1 },
				{ id: "ruleset_two", name: "Regelwerk 2", version: 1 },
			]),
	} as unknown as LibraryBrowseService;

	render(
		<NewGameScreen
			onBack={vi.fn()}
			gamePersistenceService={gameReadService}
			libraryBrowseService={libraryReadService}
		/>,
	);

	await screen.findByText("Regelwerk verwenden (2)");
	expect(screen.getByRole<HTMLSelectElement>("combobox").value).toBe(
		"ruleset_one",
	);
	expect(screen.getByRole<HTMLSelectElement>("combobox").disabled).toBe(false);
	expect(screen.getByText("Vorlage verwenden (0)")).toBeDefined();
	fireEvent.click(screen.getByText("Vorlage verwenden (0)"));
	expect(screen.getByText("Es sind keine Vorlagen vorhanden.")).toBeDefined();
	expect(screen.getByRole<HTMLSelectElement>("combobox").disabled).toBe(true);
	expect(
		screen.getByRole<HTMLButtonElement>("button", {
			name: "Spiel vorbereiten",
		}).disabled,
	).toBe(true);
});

it("verwendet die erste Vorlage als Fallback und erklärt fehlende Regelwerke", async () => {
	const gameReadService = {
		listObjects: () =>
			loadedList([
				{
					storageKey: "template_one.json",
					id: "template_one",
					name: "Vorlage 1",
					storedAt: "2026-07-17T00:00:00.000Z",
					playerCount: 12,
					ruleSetName: "Testregelwerk",
					currentNight: 0,
					phase: "setup" as const,
				},
			]),
	} as unknown as GamePersistenceService;
	const libraryReadService = {
		listObjects: () => loadedList([]),
	} as unknown as LibraryBrowseService;

	render(
		<NewGameScreen
			onBack={vi.fn()}
			gamePersistenceService={gameReadService}
			libraryBrowseService={libraryReadService}
		/>,
	);

	await screen.findByText("Vorlage verwenden (1)");
	expect(screen.getByRole<HTMLSelectElement>("combobox").value).toBe(
		"template_one.json",
	);
	expect(screen.getByRole<HTMLSelectElement>("combobox").disabled).toBe(false);
	fireEvent.click(screen.getByText("Regelwerk verwenden (0)"));
	expect(screen.getByText("Es sind keine Regelwerke vorhanden.")).toBeDefined();
	expect(screen.getByRole<HTMLSelectElement>("combobox").disabled).toBe(true);
});

function loadedList<T extends { id: string }>(metadata: T[]) {
	return Promise.resolve({
		status: "loaded" as const,
		metadata,
		problems: [],
		ids: metadata.map(({ id }) => id),
	});
}
