// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { defaultAppSettings } from "../src/application/appSettings";
import { createLibraryUseCases } from "../src/application/libraryUseCases";
import { supportedGuiLanguageTags } from "../src/gui/i18n/registry";
import {
	SettingsScreen as ProductionSettingsScreen,
	type SettingsScreenProps,
} from "../src/gui/SettingsScreen";
import type { DataFileStorage } from "../src/persistence/ports/dataFileStorage";
import { createTestObjectPersistence } from "./createTestObjectPersistence";
import { fixedClock } from "./fixedClock";

afterEach(cleanup);

function SettingsScreen({
	translationLanguage = "de",
	...props
}: SettingsScreenProps) {
	return (
		<ProductionSettingsScreen
			{...props}
			translationLanguage={translationLanguage}
		/>
	);
}

it("zeigt Version, Rechteinhaber sowie lokale Software- und Drittanbieterlizenzen", () => {
	render(
		<SettingsScreen
			onBack={() => undefined}
			settings={defaultAppSettings}
			onSettingsChange={() => undefined}
		/>,
	);

	expect(screen.getByText("0.9.0")).toBeDefined();
	expect(screen.getByText("GNU AGPL v3.0 only")).toBeDefined();
	expect(screen.getByText("Jens Aßmus")).toBeDefined();
	expect(
		screen.getByText(
			"Es besteht keine Gewährleistung. Sie dürfen diese Software unter den Bedingungen der AGPL-3.0-only verwenden, verändern und weitergeben.",
		),
	).toBeDefined();
	expect(screen.queryByText("Alle Daten löschen")).toBeNull();

	fireEvent.click(screen.getByRole("button", { name: /Lizenz anzeigen/u }));
	const dialog = screen.getByRole("dialog", { name: "Lizenz anzeigen" });
	expect(within(dialog).getByText("Copyright © 2026 Jens Aßmus")).toBeDefined();
	expect(dialog.textContent).toContain("GNU AFFERO GENERAL PUBLIC LICENSE");
	expect(dialog.textContent).toContain("END OF TERMS AND CONDITIONS");

	fireEvent.click(within(dialog).getByRole("button", { name: "Schließen" }));
	fireEvent.click(
		screen.getByRole("button", { name: /Open-Source-Lizenzen/u }),
	);
	const thirdPartyDialog = screen.getByRole("dialog", {
		name: "Open-Source-Lizenzen",
	});
	expect(thirdPartyDialog.textContent).toContain(
		"THIRD-PARTY SOFTWARE NOTICES",
	);
	expect(thirdPartyDialog.textContent).toContain("react@19.2.8 — MIT");
	expect(thirdPartyDialog.textContent).toContain(
		"ANDROID RELEASE-RUNTIME ARTIFACT INDEX",
	);
	expect(thirdPartyDialog.textContent).toContain("Apache License");
});

it("bietet die Systemsprache als Sprachoption an", async () => {
	render(
		<SettingsScreen
			onBack={() => undefined}
			settings={defaultAppSettings}
			onSettingsChange={() => undefined}
		/>,
	);

	fireEvent.keyDown(screen.getByRole("combobox", { name: "Sprache" }), {
		key: "ArrowDown",
	});
	expect(
		await screen.findByRole("option", { name: "Systemsprache" }),
	).toBeDefined();
});

it("bietet alle registrierten Lokalisierungen als Sprachoptionen an", async () => {
	render(
		<SettingsScreen
			onBack={() => undefined}
			settings={defaultAppSettings}
			onSettingsChange={() => undefined}
		/>,
	);

	const languageSelect = screen.getByRole<HTMLInputElement>("combobox", {
		name: "Sprache",
	});
	fireEvent.keyDown(languageSelect, { key: "ArrowDown" });
	const languageList = await screen.findByRole("listbox");
	expect(within(languageList).getAllByRole("option")).toHaveLength(
		supportedGuiLanguageTags.length + 1,
	);
	expect(within(languageList).getByText("en-GB")).toBeDefined();
	expect(within(languageList).getByText("de-AT")).toBeDefined();
	expect(within(languageList).getByText("es-419")).toBeDefined();
	expect(within(languageList).getByText("iu-Cans")).toBeDefined();
	expect(within(languageList).getByText("pt-BR")).toBeDefined();
});

it("hält die Sprachauswahl nach einem kurzen Touch auf den Pfeil offen", async () => {
	const user = userEvent.setup();
	const { container } = render(
		<SettingsScreen
			onBack={() => undefined}
			settings={defaultAppSettings}
			onSettingsChange={() => undefined}
		/>,
	);
	const openButton = container.querySelector<HTMLButtonElement>(
		".language-select__trigger",
	);
	if (!openButton) throw new Error("Pfeil der Sprachauswahl fehlt.");

	await user.pointer([
		{ keys: "[TouchA>]", target: openButton },
		{ keys: "[/TouchA]", target: openButton },
	]);

	const languageList = await screen.findByRole("listbox");
	expect(languageList.isConnected).toBe(true);
});

it("zeigt manuelle Langbezeichnungen für nicht von Intl unterstützte Sprachen", async () => {
	render(
		<SettingsScreen
			onBack={() => undefined}
			settings={defaultAppSettings}
			onSettingsChange={() => undefined}
		/>,
	);

	fireEvent.keyDown(screen.getByRole("combobox", { name: "Sprache" }), {
		key: "ArrowDown",
	});
	const languageList = await screen.findByRole("listbox");
	for (const languageName of [
		"Tibetan",
		"Coptic",
		"Inuktitut (Syllabics)",
		"Khmer",
		"Nafusi",
		"Sintitikes / Sinte Romani",
		"Tahaggart-Tamahaq",
		"Twi",
		"Standard Moroccan Tamazight",
	]) {
		expect(within(languageList).getByText(languageName)).toBeDefined();
	}
	expect(within(languageList).queryByText("Akan")).toBeNull();
});

it("sortiert die App-Sprachen stabil nach ihrem Kürzel", async () => {
	render(
		<SettingsScreen
			onBack={() => undefined}
			settings={defaultAppSettings}
			onSettingsChange={() => undefined}
		/>,
	);

	fireEvent.keyDown(screen.getByRole("combobox", { name: "Sprache" }), {
		key: "ArrowDown",
	});
	const languageList = await screen.findByRole("listbox");
	const options = within(languageList).getAllByRole("option");
	const displayedLanguageTags = options.slice(1).map((option) => {
		const languageTag = option.querySelector("small")?.textContent;
		if (!languageTag) throw new Error("Sprachkürzel fehlt.");
		return languageTag;
	});
	const expectedLanguageTags = [...supportedGuiLanguageTags].sort(
		(left, right) => (left === right ? 0 : left < right ? -1 : 1),
	);

	expect(options[0].textContent).toContain("Systemsprache");
	expect(displayedLanguageTags).toEqual(expectedLanguageTags);
});

it("verwendet bei Systemsprache die bereits aufgelöste GUI-Sprache", () => {
	render(
		<SettingsScreen
			onBack={() => undefined}
			settings={{ ...defaultAppSettings, language: "system" }}
			translationLanguage="en"
			onSettingsChange={() => undefined}
		/>,
	);

	expect(screen.getByRole("heading", { name: "Settings" })).toBeDefined();
	expect(
		screen.getByRole("combobox", { name: "Language" }).textContent,
	).toContain("System language");
});

it("filtert Sprachen nach Sprachcode und übernimmt nur die Auswahl", async () => {
	const user = userEvent.setup();
	const onSettingsChange = vi.fn();
	render(
		<SettingsScreen
			onBack={() => undefined}
			settings={defaultAppSettings}
			onSettingsChange={onSettingsChange}
		/>,
	);

	const languageSelect = screen.getByRole("combobox", {
		name: "Sprache",
	});
	await user.click(languageSelect);
	const languageInput = screen.getByRole<HTMLInputElement>("searchbox", {
		name: "Sprache",
	});
	await user.type(languageInput, "en-GB");

	const languageList = await screen.findByRole("listbox");
	const options = within(languageList).getAllByRole("option");
	expect(options).toHaveLength(1);
	expect(within(options[0]).getByText("en-GB")).toBeDefined();
	expect(onSettingsChange).not.toHaveBeenCalled();

	await user.click(options[0]);
	expect(onSettingsChange).toHaveBeenCalledWith({
		...defaultAppSettings,
		language: "en-GB",
	});
});

it("ändert die Einstellung zum Ausblenden abgelaufener Zustände", () => {
	const onSettingsChange = vi.fn();
	render(
		<SettingsScreen
			onBack={() => undefined}
			settings={defaultAppSettings}
			onSettingsChange={onSettingsChange}
		/>,
	);

	const toggle = screen.getByLabelText<HTMLInputElement>(
		"Abgelaufene Zustände ausblenden",
	);
	expect(toggle.checked).toBe(defaultAppSettings.hideExpiredStatuses);
	fireEvent.click(toggle);

	expect(onSettingsChange).toHaveBeenCalledWith({
		...defaultAppSettings,
		hideExpiredStatuses: !defaultAppSettings.hideExpiredStatuses,
	});
});

it("ändert den Standard für eine entsperrte Sitzordnung", () => {
	const onSettingsChange = vi.fn();
	render(
		<SettingsScreen
			onBack={() => undefined}
			settings={defaultAppSettings}
			onSettingsChange={onSettingsChange}
		/>,
	);

	const toggle = screen.getByLabelText<HTMLInputElement>(
		"Sitzordnung entsperren",
	);
	expect(toggle.checked).toBe(defaultAppSettings.unlockSeatOrderByDefault);
	fireEvent.click(toggle);

	expect(onSettingsChange).toHaveBeenCalledWith({
		...defaultAppSettings,
		unlockSeatOrderByDefault: !defaultAppSettings.unlockSeatOrderByDefault,
	});
});

it("ändert Einnordung und Laufrichtung des Sitzkreises", () => {
	const onSettingsChange = vi.fn();
	const { rerender } = render(
		<SettingsScreen
			onBack={() => undefined}
			settings={defaultAppSettings}
			onSettingsChange={onSettingsChange}
		/>,
	);

	const northToggle = screen.getByLabelText<HTMLInputElement>(
		"1. Sitzplatz einnorden.",
	);
	expect(northToggle.checked).toBe(true);
	fireEvent.click(northToggle);
	expect(onSettingsChange).toHaveBeenLastCalledWith({
		...defaultAppSettings,
		seatCircleFirstSeatAtTop: false,
	});

	rerender(
		<SettingsScreen
			onBack={() => undefined}
			settings={{ ...defaultAppSettings, seatCircleFirstSeatAtTop: false }}
			onSettingsChange={onSettingsChange}
		/>,
	);
	expect(
		screen.getByLabelText<HTMLInputElement>("Letzten Sitzplatz einnorden.")
			.checked,
	).toBe(false);

	const directionToggle =
		screen.getByLabelText<HTMLInputElement>("Im Uhrzeigersinn");
	fireEvent.click(directionToggle);
	expect(onSettingsChange).toHaveBeenLastCalledWith({
		...defaultAppSettings,
		seatCircleFirstSeatAtTop: false,
		seatCircleClockwise: false,
	});

	rerender(
		<SettingsScreen
			onBack={() => undefined}
			settings={{
				...defaultAppSettings,
				seatCircleFirstSeatAtTop: false,
				seatCircleClockwise: false,
			}}
			onSettingsChange={onSettingsChange}
		/>,
	);
	expect(
		screen.getByLabelText<HTMLInputElement>("Gegen den Uhrzeigersinn").checked,
	).toBe(false);
});

it("ändert die Einstellung für Rollensymbole in der Rollenanzeige", () => {
	const onSettingsChange = vi.fn();
	render(
		<SettingsScreen
			onBack={() => undefined}
			settings={defaultAppSettings}
			onSettingsChange={onSettingsChange}
		/>,
	);

	const toggle = screen.getByLabelText<HTMLInputElement>(
		"Rollensymbol anzeigen",
	);
	expect(toggle.checked).toBe(defaultAppSettings.showRoleSymbols);
	fireEvent.click(toggle);

	expect(onSettingsChange).toHaveBeenCalledWith({
		...defaultAppSettings,
		showRoleSymbols: !defaultAppSettings.showRoleSymbols,
	});
});

it("ändert die nativen Spieleinstellungen", () => {
	const onSettingsChange = vi.fn();
	const { rerender } = render(
		<SettingsScreen
			onBack={() => undefined}
			settings={defaultAppSettings}
			onSettingsChange={onSettingsChange}
		/>,
	);

	fireEvent.click(screen.getByLabelText("Bildschirm eingeschaltet lassen"));
	expect(onSettingsChange).toHaveBeenLastCalledWith({
		...defaultAppSettings,
		keepScreenAwake: !defaultAppSettings.keepScreenAwake,
	});

	rerender(
		<SettingsScreen
			onBack={() => undefined}
			settings={{
				...defaultAppSettings,
				keepScreenAwake: !defaultAppSettings.keepScreenAwake,
			}}
			onSettingsChange={onSettingsChange}
		/>,
	);
	fireEvent.click(screen.getByLabelText("Haptisches Feedback"));
	expect(onSettingsChange).toHaveBeenLastCalledWith({
		...defaultAppSettings,
		keepScreenAwake: !defaultAppSettings.keepScreenAwake,
		hapticFeedback: !defaultAppSettings.hapticFeedback,
	});

	rerender(
		<SettingsScreen
			onBack={() => undefined}
			settings={{
				...defaultAppSettings,
				keepScreenAwake: !defaultAppSettings.keepScreenAwake,
				hapticFeedback: !defaultAppSettings.hapticFeedback,
			}}
			onSettingsChange={onSettingsChange}
		/>,
	);
	fireEvent.click(screen.getByLabelText("Automatisch drehen"));
	expect(onSettingsChange).toHaveBeenLastCalledWith({
		...defaultAppSettings,
		keepScreenAwake: !defaultAppSettings.keepScreenAwake,
		hapticFeedback: !defaultAppSettings.hapticFeedback,
		autoRotate: !defaultAppSettings.autoRotate,
	});
});

it("bestätigt das Ersetzen durch ein aktuelles Bibliotheks-Backup", async () => {
	const current = libraryDocument(1);
	const imported = libraryDocument(1);
	const storage: DataFileStorage = {
		readInternal: () =>
			Promise.resolve({
				status: "success",
				bytes: new TextEncoder().encode(JSON.stringify(current)),
			}),
		readExternal: () =>
			Promise.resolve(new TextEncoder().encode(JSON.stringify(imported))),
		writeInternal: () => Promise.resolve(),
	};
	const { container } = render(
		<SettingsScreen
			onBack={() => undefined}
			settings={defaultAppSettings}
			onSettingsChange={() => undefined}
			libraryBackupService={
				createLibraryUseCases(
					createTestObjectPersistence(storage, fixedClock),
					fixedClock,
				).backup
			}
		/>,
	);
	const input = container.querySelector<HTMLInputElement>('input[type="file"]');
	if (!input) throw new Error("Dateiauswahl fehlt.");
	fireEvent.change(input, {
		target: { files: [new File([JSON.stringify(imported)], "library.json")] },
	});

	const dialog = await screen.findByRole("alertdialog", {
		name: "Gesamte Bibliothek ersetzen?",
	});
	expect(within(dialog).getByText(/Importierte storageVersion:/)).toBeDefined();
	expect(
		within(dialog)
			.getByRole("button", { name: "Abbrechen" })
			.classList.contains("menu-button--primary"),
	).toBe(false);
});

function libraryDocument(storageVersion: number): Record<string, unknown> {
	return {
		storageType: "social-deduction-app-library",
		storageVersion,
		ruleSetsById: {},
	};
}
