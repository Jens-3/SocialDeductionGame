// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppearanceService } from "../src/application/appearanceService";
import { defaultAppSettings } from "../src/application/appSettings";
import { GamePreparationService } from "../src/application/gamePreparationService";
import type { GameUseCases } from "../src/application/gameUseCases";
import { ImageResourceService } from "../src/application/imageResourceService";
import {
	createLibraryUseCases,
	type LibraryBrowseService,
	type LibraryUseCases,
	type ScenarioImportService,
	type ScenarioManagementService,
} from "../src/application/libraryUseCases";
import { PersistenceActivityService } from "../src/application/persistenceActivityService";
import type { ImageResourceStorage } from "../src/application/ports/imageResourceStorage";
import type { SettingsStorage } from "../src/application/ports/settingsStorage";
import type { RuleSetExportService } from "../src/application/ruleSetExportService";
import { ScenarioEditorFactory } from "../src/application/scenarioEditor";
import { SettingsService } from "../src/application/settingsService";
import { Player } from "../src/domain/models";
import type { RuleSet } from "../src/domain/ruleSet";
import { type AppProps, App as ProductionApp } from "../src/gui/App";
import {
	ScenarioLibrary as ScenarioLibraryComponent,
	type ScenarioLibraryProps,
} from "../src/gui/ScenarioLibrary";
import type {
	DataFileCategory,
	DataFileReadResult,
	DataFileReference,
	DataFileStorage,
} from "../src/persistence/ports/dataFileStorage";
import { createGameExportDocument } from "../src/serialization/gameExport";
import { createTestObjectPersistence } from "./createTestObjectPersistence";
import { fixedClock, fixedDomainServices } from "./fixedClock";
import { createTestGame, createTestRuleSet } from "./fixtures";
import { GameTestFacade } from "./gameTestFacade";
import { missingRead } from "./storageReadResult";

const originalElementFromPointDescriptor = Object.getOwnPropertyDescriptor(
	document,
	"elementFromPoint",
);

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	localStorage.clear();
	if (originalElementFromPointDescriptor) {
		Object.defineProperty(
			document,
			"elementFromPoint",
			originalElementFromPointDescriptor,
		);
	} else {
		Reflect.deleteProperty(document, "elementFromPoint");
	}
});

function asGameUseCases(service: GameReadService): GameUseCases {
	return {
		editor: new ScenarioEditorFactory(),
		objectProblems: service.objectProblems,
		preparation: new GamePreparationService(fixedDomainServices),
		session: service,
		persistence: service,
	};
}

function ScenarioLibrary(props: ScenarioLibraryProps) {
	return (
		<ScenarioLibraryComponent
			{...props}
			editorFactory={new ScenarioEditorFactory()}
		/>
	);
}

class GameReadService extends GameTestFacade {}

const germanTestSettings = { ...defaultAppSettings, language: "de" };

function App({ initialSettings = germanTestSettings, ...props }: AppProps) {
	return <ProductionApp {...props} initialSettings={initialSettings} />;
}

function createTestLibraryUseCases(storage: DataFileStorage) {
	return createLibraryUseCases(
		createTestObjectPersistence(storage, fixedClock),
		fixedClock,
	);
}

describe("mobile Startseite", () => {
	it("fragt vor dem Beenden nach und zeigt im Testbrowser den beendeten Zustand", () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: "App beenden" }));
		const dialog = screen.getByRole("alertdialog", { name: "App beenden?" });
		fireEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));
		expect(
			screen.queryByRole("alertdialog", { name: "App beenden?" }),
		).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "App beenden" }));
		fireEvent.click(
			within(
				screen.getByRole("alertdialog", { name: "App beenden?" }),
			).getByRole("button", { name: "Beenden" }),
		);
		expect(
			screen.getByRole("heading", { name: "App wurde beendet." }),
		).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "App neu starten" }));
		expect(screen.getByRole("button", { name: "App beenden" })).toBeDefined();
	});

	it("aktiviert Beenden vorzeitig, sobald alle Speichervorgänge abgeschlossen sind", async () => {
		const activity = new PersistenceActivityService();
		const pendingWrite = deferred<void>();
		const write = activity.trackWrite(() => pendingWrite.promise);
		render(<App persistenceActivity={activity} />);

		fireEvent.click(screen.getByRole("button", { name: "App beenden" }));
		const dialog = screen.getByRole("alertdialog", { name: "App beenden?" });
		expect(
			within(dialog).getByText("Noch 1 Speichervorgang aktiv."),
		).toBeDefined();
		expect(
			within(dialog).getByRole<HTMLButtonElement>("button", { name: "Beenden" })
				.disabled,
		).toBe(true);

		pendingWrite.resolve();
		await write;
		await waitFor(() =>
			expect(
				within(dialog).getByRole<HTMLButtonElement>("button", {
					name: "Beenden",
				}).disabled,
			).toBe(false),
		);
		expect(within(dialog).queryByText(/Speichervorgang/)).toBeNull();
	});

	it("erlaubt nach zwei Sekunden das Beenden trotz aktiver Speichervorgänge", async () => {
		vi.useFakeTimers();
		try {
			const activity = new PersistenceActivityService();
			const pendingWrite = deferred<void>();
			const write = activity.trackWrite(() => pendingWrite.promise);
			render(<App persistenceActivity={activity} />);
			fireEvent.click(screen.getByRole("button", { name: "App beenden" }));

			act(() => {
				vi.advanceTimersByTime(2_000);
			});
			const button = screen.getByRole<HTMLButtonElement>("button", {
				name: "Trotzdem beenden",
			});
			expect(button.disabled).toBe(false);

			pendingWrite.resolve();
			await act(async () => {
				await write;
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it("findet den letzten Spielstand beim Start ohne JSON-Dateien einzulesen", async () => {
		const game = createTestGame();
		game.id = "game_latest";
		game.name = "Letztes Spiel";
		const bytes = new TextEncoder().encode(
			JSON.stringify(createGameExportDocument(game)),
		);
		const readAllInternal = vi.fn(() => Promise.resolve([]));
		const storage: DataFileStorage = {
			listInternalFiles: () =>
				Promise.resolve([
					{
						category: "game",
						fileName: `${game.id}.json`,
						modifiedAt: 1,
					},
				]),
			readAllInternal,
			readInternal: () => Promise.resolve(success(bytes)),
		};
		render(<App gameUseCases={asGameUseCases(new GameReadService(storage))} />);

		const continueButton = await screen.findByRole("button", {
			name: /Spiel fortsetzen/,
		});
		await waitFor(
			() => expect(continueButton.hasAttribute("disabled")).toBe(false),
			{ timeout: 5_000 },
		);
		expect(readAllInternal).not.toHaveBeenCalled();
	});

	it("bietet bei unlesbarer Library die verfügbaren Wiederherstellungswege an", async () => {
		const original = new TextEncoder().encode("kein JSON");
		const libraryUseCases = createTestLibraryUseCases({
			readInternal: (file, version) =>
				Promise.resolve(
					version === "backup" ? missingRead(file) : success(original),
				),
		});
		render(<App libraryUseCases={libraryUseCases} />);
		fireEvent.click(
			screen.getByRole("button", { name: "Szenarien verwalten" }),
		);

		const dialog = await screen.findByRole("alertdialog", {
			name: "Bibliothek kann nicht gelesen werden",
		});
		expect(
			within(dialog)
				.getByRole("button", { name: "Backup wiederherstellen" })
				.hasAttribute("disabled"),
		).toBe(true);
		expect(
			within(dialog)
				.getByRole("button", { name: "Library reparieren" })
				.hasAttribute("disabled"),
		).toBe(true);
		expect(
			within(dialog)
				.getByRole("button", { name: "Library exportieren" })
				.hasAttribute("disabled"),
		).toBe(false);
		fireEvent.click(
			within(dialog).getByRole("button", { name: "Später entscheiden" }),
		);
		await waitFor(() =>
			expect(
				screen.queryByRole("alertdialog", {
					name: "Bibliothek kann nicht gelesen werden",
				}),
			).toBeNull(),
		);
		await expect(
			libraryUseCases.browse.listObjects("ruleSet"),
		).resolves.toMatchObject({ status: "loaded", metadata: [] });
	});

	it("bietet die Aktionen eines einzelnen fehlerhaften Regelwerks an", async () => {
		const problem = {
			scope: "object" as const,
			category: "serialization" as const,
			kind: "ruleSet" as const,
			id: "ruleset_broken",
			reason: "invalidDocument" as const,
			message: "Das gespeicherte Regelwerk hat keine gültige Struktur.",
			availableActions: ["repair", "delete", "later"] as const,
		};
		let problems = [problem];
		const deleteScenario = vi.fn((_kind: "ruleSet", _id: string) => {
			void _kind;
			void _id;
			problems = [];
			return Promise.resolve();
		});
		const libraryUseCases = {
			editor: new ScenarioEditorFactory(),
			objectProblems: {
				delete: (readProblem: typeof problem) =>
					deleteScenario(readProblem.kind, readProblem.id),
				repair: () => Promise.reject(new Error("Nicht benutzt.")),
			},
			browse: {
				listObjects: () =>
					Promise.resolve({
						status: "loaded" as const,
						metadata: [],
						problems,
						ids: ["ruleset_broken"],
					}),
			},
			management: { deleteScenario },
			recovery: {
				listWriteRecoveries: () => Promise.resolve([]),
				repairInternalLibrary: () =>
					Promise.reject(new Error("Nicht benutzt.")),
			},
		} as unknown as LibraryUseCases;
		render(<App libraryUseCases={libraryUseCases} />);
		fireEvent.click(
			screen.getByRole("button", { name: "Szenarien verwalten" }),
		);

		const dialog = await screen.findByRole("alertdialog", {
			name: "Fehlerhaftes gespeichertes Objekt erkannt",
		});
		expect(
			within(dialog).getByRole("button", { name: "Objekt reparieren" }),
		).toBeDefined();
		expect(
			within(dialog).getByRole("button", { name: "Später entscheiden" }),
		).toBeDefined();
		fireEvent.click(
			within(dialog).getByRole("button", { name: "Objekt löschen" }),
		);

		await waitFor(() =>
			expect(deleteScenario).toHaveBeenCalledWith("ruleSet", "ruleset_broken"),
		);
		await waitFor(() =>
			expect(
				screen.queryByRole("alertdialog", {
					name: "Fehlerhaftes gespeichertes Objekt erkannt",
				}),
			).toBeNull(),
		);
	});

	it("fragt beim Öffnen der Spielstände nach offenen Recovery-Dateien", async () => {
		const game = createTestGame();
		game.id = "game_interrupted";
		const bytes = new TextEncoder().encode(
			JSON.stringify(createGameExportDocument(game)),
		);
		const resolutions: unknown[] = [];
		let finishRecovery: (() => void) | undefined;
		const recoveryFinished = new Promise<void>((resolve) => {
			finishRecovery = resolve;
		});
		const storage: DataFileStorage = {
			readAllInternal: () => Promise.resolve([]),
			readInternal: () => Promise.reject(new Error("Nicht benötigt.")),
			listRecoveries: () =>
				Promise.resolve([
					{
						category: "game",
						recoveryKey: game.id,
						fileName: `${game.id}.json`,
						oldBytes: bytes,
						newBytes: bytes,
					},
				]),
			requestRecovery: (recoveryKey) =>
				Promise.resolve({
					status: "decisionRequired",
					commandId: `command:${recoveryKey}`,
					candidate: {
						category: "game",
						recoveryKey,
						fileName: `${game.id}.json`,
						oldBytes: bytes,
						newBytes: bytes,
					},
				}),
			continueInternalCommand: (commandId, resolution) => {
				resolutions.push({ commandId, resolution });
				return recoveryFinished.then(() => "completed" as const);
			},
		};
		render(<App gameUseCases={asGameUseCases(new GameReadService(storage))} />);
		fireEvent.click(screen.getByRole("button", { name: "Spielstand laden" }));

		const dialog = await screen.findByRole("alertdialog", {
			name: "Unvollständiger Speichervorgang",
		});
		expect(
			within(dialog)
				.getByRole("button", { name: "Neue Datei behalten" })
				.hasAttribute("disabled"),
		).toBe(false);
		fireEvent.click(
			within(dialog).getByRole("button", { name: "Beide Dateien behalten" }),
		);
		expect(
			screen.queryByRole("alertdialog", {
				name: "Unvollständiger Speichervorgang",
			}),
		).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
		expect(
			screen.getByRole("button", { name: "Spielstand laden" }),
		).toBeDefined();
		await waitFor(() =>
			expect(resolutions).toEqual([
				{ commandId: `command:${game.id}`, resolution: "keepBoth" },
			]),
		);
		finishRecovery?.();
		await recoveryFinished;
	});

	it("meldet einen späteren Recovery-Fehler global und fragt erneut nach", async () => {
		const game = createTestGame();
		game.id = "game_failed_recovery";
		const bytes = new TextEncoder().encode(
			JSON.stringify(createGameExportDocument(game)),
		);
		let failRecovery: ((error: Error) => void) | undefined;
		const recoveryFinished = new Promise<"completed">((_resolve, reject) => {
			failRecovery = reject;
		});
		const storage: DataFileStorage = {
			readAllInternal: () => Promise.resolve([]),
			readInternal: () => Promise.reject(new Error("Nicht benötigt.")),
			listRecoveries: () =>
				Promise.resolve([
					{
						category: "game",
						recoveryKey: game.id,
						fileName: `${game.id}.json`,
						oldBytes: bytes,
						newBytes: bytes,
					},
				]),
			requestRecovery: (recoveryKey) =>
				Promise.resolve({
					status: "decisionRequired",
					commandId: `command:${recoveryKey}`,
					candidate: {
						category: "game",
						recoveryKey,
						fileName: `${game.id}.json`,
						oldBytes: bytes,
						newBytes: bytes,
					},
				}),
			continueInternalCommand: () => recoveryFinished,
		};
		render(<App gameUseCases={asGameUseCases(new GameReadService(storage))} />);
		fireEvent.click(screen.getByRole("button", { name: "Spielstand laden" }));

		const dialog = await screen.findByRole("alertdialog", {
			name: "Unvollständiger Speichervorgang",
		});
		fireEvent.click(
			within(dialog).getByRole("button", { name: "Alte Datei behalten" }),
		);
		expect(screen.queryByRole("alertdialog")).toBeNull();

		failRecovery?.(new Error("background recovery failed"));
		const error = await screen.findByRole("alert");
		expect(error.textContent).toContain(
			"Der Speicherbefehl kann nicht fortgesetzt werden.",
		);
		expect(error.textContent).toContain("background recovery failed");
		expect(
			await screen.findByRole("alertdialog", {
				name: "Unvollständiger Speichervorgang",
			}),
		).toBeDefined();
	});

	it("meldet eine defekte Datei erst beim Öffnen der zugehörigen Auswahl", async () => {
		const bytes = new TextEncoder().encode('{"id":"game_broken"');
		const storage: DataFileStorage = {
			readAllInternal: (category) =>
				Promise.resolve(
					category === "game"
						? [
								{
									category,
									fileName: "game_broken.json",
									bytes,
								},
							]
						: [],
				),
			readInternal: () => Promise.resolve(success(bytes)),
		};
		render(<App gameUseCases={asGameUseCases(new GameReadService(storage))} />);

		expect(
			screen.queryByRole("alertdialog", {
				name: "Fehlerhaftes gespeichertes Objekt erkannt",
			}),
		).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Spielstand laden" }));

		const dialog = await screen.findByRole("alertdialog", {
			name: "Fehlerhaftes gespeichertes Objekt erkannt",
		});
		expect(dialog.textContent).toContain("game_broken");
		expect(dialog.textContent).toContain(
			"Die Datei enthält kein gültiges JSON.",
		);
		fireEvent.click(
			within(dialog).getByRole("button", { name: "Später entscheiden" }),
		);
		await waitFor(() =>
			expect(
				screen.queryByRole("alertdialog", {
					name: "Fehlerhaftes gespeichertes Objekt erkannt",
				}),
			).toBeNull(),
		);
	});

	it("wendet eine gemerkte Entscheidung auf alle gleichartigen Ladefehler an", async () => {
		const bytes = new TextEncoder().encode('{"id":"game_broken"');
		const storage: DataFileStorage = {
			readAllInternal: (category) =>
				Promise.resolve(
					category === "game"
						? ["Kaputt 1", "Kaputt 2", "Kaputt 3"].map((fileName) => ({
								category,
								fileName: `${fileName}.json`,
								bytes,
							}))
						: [],
				),
			readInternal: () => Promise.resolve(success(bytes)),
		};
		render(<App gameUseCases={asGameUseCases(new GameReadService(storage))} />);
		fireEvent.click(screen.getByRole("button", { name: "Spielstand laden" }));

		const dialog = await screen.findByRole("alertdialog", {
			name: "Fehlerhaftes gespeichertes Objekt erkannt (3 offen)",
		});
		const remember = within(dialog).getByRole("checkbox", {
			name: /Entscheidung merken/,
		});
		expect((remember as HTMLInputElement).checked).toBe(false);
		fireEvent.click(remember);
		expect((remember as HTMLInputElement).checked).toBe(true);
		fireEvent.click(
			within(dialog).getByRole("button", { name: "Später entscheiden" }),
		);

		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
	});

	it("bietet für eine gültige Datei mit falschem Namen die Reparatur an", async () => {
		const game = createTestGame();
		game.id = "game_richtiger_name";
		const writeInternal = vi.fn(() => Promise.resolve());
		const deleteInternal = vi.fn(() => Promise.resolve());
		const storage: DataFileStorage = {
			readAllInternal: (category) =>
				Promise.resolve(
					category === "game"
						? [
								{
									category,
									fileName: "Falsch benannt.json",
									bytes: new TextEncoder().encode(
										JSON.stringify(createGameExportDocument(game)),
									),
								},
							]
						: [],
				),
			readInternal: (file) => Promise.resolve(missingRead(file)),
			writeInternal,
			deleteInternal,
		};
		render(<App gameUseCases={asGameUseCases(new GameReadService(storage))} />);
		fireEvent.click(screen.getByRole("button", { name: "Spielstand laden" }));

		const dialog = await screen.findByRole("alertdialog", {
			name: "Fehlerhaftes gespeichertes Objekt erkannt",
		});
		expect(dialog.textContent).toContain("Falsch benannt.json");
		expect(dialog.textContent).toContain("game_falsch_benannt.json");
		fireEvent.click(
			within(dialog).getByRole("button", { name: "Dateinamen reparieren" }),
		);

		await waitFor(() =>
			expect(deleteInternal).toHaveBeenCalledWith(
				{
					category: "game",
					fileName: "Falsch benannt.json",
				},
				{ includeBackup: true, includeRecovery: true },
			),
		);
		expect(writeInternal).toHaveBeenCalled();
	});

	it("zeigt Spiel fortsetzen ohne aktuelles Spiel deaktiviert an", () => {
		render(<App />);

		const continueButton = screen.getByRole("button", {
			name: /Spiel fortsetzen/,
		});

		expect((continueButton as HTMLButtonElement).disabled).toBe(true);
		expect(continueButton.classList.contains("button-disabled")).toBe(true);
		expect(continueButton.textContent).toContain(
			"Kein aktuelles Spiel vorhanden",
		);
		expect(
			screen.getByRole("button", { name: "Neues Spiel" }).className,
		).toContain("menu-button--primary");
	});

	it("wechselt Einstellungen und Startmenü unmittelbar auf Englisch", async () => {
		const user = userEvent.setup();
		render(<App />);
		expect(document.documentElement.lang).toBe("de");

		fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
		const languageSelect = screen.getByRole("combobox", {
			name: "Sprache",
		});
		await user.click(languageSelect);
		const languageInput = screen.getByRole<HTMLInputElement>("searchbox", {
			name: "Sprache",
		});
		await user.type(languageInput, "English en");
		const englishOption = (await screen.findByText("English")).closest(
			'[role="option"]',
		);
		if (!englishOption) throw new Error("Englische Sprachoption fehlt.");
		await user.click(englishOption);

		expect(document.documentElement.lang).toBe("en");
		expect(screen.getByRole("heading", { name: "Settings" })).toBeDefined();
		expect(screen.getByLabelText("Hide expired statuses")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Back" }));

		expect(screen.getByRole("navigation", { name: "Main menu" })).toBeDefined();
		expect(screen.getByRole("button", { name: "New game" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Settings" })).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: "New game" }));
		expect(screen.getByRole("heading", { name: "New game" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Prepare game" })).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Back" }));

		fireEvent.click(screen.getByRole("button", { name: "Load game" }));
		expect(screen.getByRole("heading", { name: "Load game" })).toBeDefined();
		expect(screen.getByPlaceholderText("Search saved games")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Back" }));

		fireEvent.click(screen.getByRole("button", { name: "Manage scenarios" }));
		expect(
			screen.getByRole("heading", { name: "Manage scenarios" }),
		).toBeDefined();
		expect(screen.getByRole("button", { name: /Create/ })).toBeDefined();
	});

	it("lädt den Hauptmenü-Hintergrund über Domain und Storage", async () => {
		const appearanceService = new AppearanceService();
		const imageResourceService = new ImageResourceService(
			{
				resolveImage: ({ category, imageId }) =>
					Promise.resolve({
						source: `/api/dev/assets/${category}/${imageId}`,
						mimeType: "image/png",
					}),
			},
			appearanceService,
		);
		render(
			<App
				appearanceService={appearanceService}
				imageResourceService={imageResourceService}
			/>,
		);

		await waitFor(() => {
			const main = screen.getByRole("main");
			expect(main.style.getPropertyValue("--home-background-image")).toContain(
				"/api/dev/assets/backgrounds/bg_main_menu_dark",
			);
			expect(main.style.backgroundImage).toBe("");
		});
		expect(screen.getByRole("main").className).toContain(
			"home-shell--with-background",
		);
	});

	it("verwendet im hellen Theme den hellen Hauptmenü-Hintergrund", async () => {
		const appearanceService = new AppearanceService(undefined, "light");
		const imageResourceService = new ImageResourceService(
			{
				resolveImage: ({ category, imageId }) =>
					Promise.resolve({
						source: `/api/dev/assets/${category}/${imageId}`,
						mimeType: "image/png",
					}),
			},
			appearanceService,
		);
		render(
			<App
				appearanceService={appearanceService}
				imageResourceService={imageResourceService}
				initialSettings={{ ...germanTestSettings, theme: "light" }}
			/>,
		);

		await waitFor(() => {
			const main = screen.getByRole("main");
			expect(main.style.getPropertyValue("--home-background-image")).toContain(
				"/api/dev/assets/backgrounds/bg_main_menu_light",
			);
			expect(main.style.backgroundImage).toBe("");
		});
	});

	it.each([
		["dark", "mainMenu", "bg_main_menu_dark"],
		["light", "mainMenu", "bg_main_menu_light"],
		["dark", "gameBoard", "bg_game_dark"],
		["light", "gameBoard", "bg_game_light"],
	] as const)(
		"liest die echte Hintergrundgrafik %s/%s und reicht sie bis in die GUI durch",
		async (theme, placement, expectedImageId) => {
			const appearanceService = new AppearanceService(undefined, theme);
			const resolveImage = vi.fn<ImageResourceStorage["resolveImage"]>(
				({ category, imageId }) => {
					const bytes = readFileSync(
						path.resolve("app-seed", "assets", category, `${imageId}.png`),
					);
					expect([...bytes.subarray(0, 8)]).toEqual([
						0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
					]);
					return Promise.resolve({
						source: `/verified-assets/${category}/${imageId}.png`,
						mimeType: "image/png" as const,
					});
				},
			);
			const imageResourceService = new ImageResourceService(
				{ resolveImage },
				appearanceService,
			);
			const gameReadService = new GameReadService(new MemoryGameReadStorage());
			render(
				<App
					appearanceService={appearanceService}
					imageResourceService={imageResourceService}
					initialSettings={{ ...germanTestSettings, theme }}
					{...(placement === "gameBoard"
						? {
								gameUseCases: asGameUseCases(gameReadService),
								currentGameId: "game_saturday",
								currentGameName: "Standard Rule Set · Samstag",
							}
						: {})}
				/>,
			);

			if (placement === "gameBoard") {
				fireEvent.click(
					await screen.findByRole("button", { name: /Spiel fortsetzen/ }),
				);
				await waitFor(() => {
					const seatBoard = screen.getByRole("group", { name: "Sitzordnung" });
					const zoomContent = seatBoard.querySelector<HTMLElement>(
						".seat-circle-content--with-background",
					);
					expect(zoomContent?.style.backgroundImage).toContain(expectedImageId);
					expect(seatBoard.style.backgroundImage).toBe("");
				});
			} else {
				await waitFor(() => {
					const main = screen.getByRole("main");
					expect(
						main.style.getPropertyValue("--home-background-image"),
					).toContain(expectedImageId);
					expect(main.className).toContain("home-shell--with-background");
				});
			}

			expect(resolveImage).toHaveBeenCalledWith({
				category: "backgrounds",
				imageId: expectedImageId,
				isExternal: false,
			});
		},
	);

	it("hebt Spiel fortsetzen mit aktuellem Spiel hervor und öffnet es", () => {
		const onContinueGame = vi.fn();
		render(
			<App
				currentGameName="Standard Rule Set"
				onContinueGame={onContinueGame}
			/>,
		);

		const continueButton = screen.getByRole("button", {
			name: /Spiel fortsetzen/,
		});
		fireEvent.click(continueButton);

		expect((continueButton as HTMLButtonElement).disabled).toBe(false);
		expect(continueButton.className).toContain("menu-button--continue");
		expect(
			screen.getByRole("button", { name: "Neues Spiel" }).className,
		).not.toContain("menu-button--primary");
		expect(onContinueGame).toHaveBeenCalledOnce();
	});

	it("übersetzt den Verweis auf den letzten Spielstand", async () => {
		render(
			<App
				initialSettings={{ ...germanTestSettings, language: "en" }}
				gameUseCases={asGameUseCases(
					new GameReadService(new MemoryGameReadStorage()),
				)}
			/>,
		);

		await screen.findByText("Latest saved game");
		const continueButton = screen.getByRole("button", {
			name: /Continue game/,
		});
		expect(continueButton.textContent).toContain("Latest saved game");
	});

	it("zeigt die vereinbarte Reihenfolge des Hauptmenüs", () => {
		render(<App />);

		const labels = screen
			.getAllByRole("button")
			.map((button) => button.textContent?.trim());

		expect(labels).toEqual([
			"Spiel fortsetzenKein aktuelles Spiel vorhanden",
			"Neues Spiel",
			"Spielstand laden",
			"Szenarien verwalten",
			"Einstellungen",
			"App beenden",
		]);
	});

	it("öffnet die Szenarioverwaltung und kehrt zur Startseite zurück", () => {
		render(<App />);

		fireEvent.click(
			screen.getByRole("button", { name: "Szenarien verwalten" }),
		);
		expect(
			screen.getByRole("heading", { name: "Szenarien verwalten" }),
		).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
		expect(
			screen.getByRole("heading", { name: "Social Deduction" }),
		).toBeDefined();
	});

	it("filtert die real gelesene Szenarioliste nach Regelwerken und Vorlagen", async () => {
		render(
			<App
				gameUseCases={asGameUseCases(
					new GameReadService(new MemoryGameReadStorage()),
				)}
				libraryUseCases={createTestLibraryUseCases(
					new MemoryLibraryReadStorage(),
				)}
			/>,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Szenarien verwalten" }),
		);

		expect(await screen.findByText("Test Rules")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Vorlagen" }));
		expect(screen.getByText("Testvorlage")).toBeDefined();
		expect(screen.queryByText("Version 1 · 3 Teams · 3 Rollen")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Regelwerke" }));
		expect(screen.getByText("Version 1 · 3 Teams · 3 Rollen")).toBeDefined();
		expect(screen.queryByText("Testvorlage")).toBeNull();
	});

	it("öffnet und schließt das Drei-Punkte-Menü für das gewählte Szenario", async () => {
		render(
			<App
				gameUseCases={asGameUseCases(
					new GameReadService(new MemoryGameReadStorage()),
				)}
				libraryUseCases={createTestLibraryUseCases(
					new MemoryLibraryReadStorage(),
				)}
			/>,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Szenarien verwalten" }),
		);
		fireEvent.click(
			await screen.findByRole("button", {
				name: "Weitere Aktionen für Test Rules",
			}),
		);

		const dialog = screen.getByRole("dialog", { name: "Test Rules" });
		expect(dialog).toBeDefined();
		expect(screen.getByRole("button", { name: "Umbenennen" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Duplizieren" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Exportieren" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Löschen" })).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("öffnet eine mobile Regelwerk-Detailansicht und übernimmt die Auswahl", async () => {
		render(
			<App
				gameUseCases={asGameUseCases(
					new GameReadService(new MemoryGameReadStorage()),
				)}
				libraryUseCases={createTestLibraryUseCases(
					new MemoryLibraryReadStorage(),
				)}
			/>,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Szenarien verwalten" }),
		);
		fireEvent.click(
			await screen.findByRole("button", { name: /Test Rules.*Version 1/ }),
		);
		expect(
			await screen.findByRole("heading", { name: "Test Rules" }),
		).toBeDefined();
		expect(screen.getByText("Good")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "GoodReihenfolge 10" }));
		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Nicht übernommen" },
		});
		fireEvent.click(
			screen.getByRole("button", { name: "Detailansicht schließen" }),
		);
		expect(
			screen.queryByRole("heading", { name: "Details bearbeiten" }),
		).toBeNull();
		fireEvent.click(
			screen.getByRole("button", { name: "Nicht übernommenReihenfolge 10" }),
		);
		expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
			"Nicht übernommen",
		);
		expect(
			screen.getByLabelText<HTMLInputElement>("DisplayName (de)").value,
		).toBe("");
		fireEvent.change(screen.getByLabelText("DisplayName (de)"), {
			target: { value: "Gute Leute" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
		expect(screen.getByText("Gute Leute")).toBeDefined();
		fireEvent.click(
			screen.getByRole<HTMLButtonElement>("button", {
				name: "Neues Spiel mit diesem Regelwerk",
			}),
		);
		expect(
			screen.getByRole("alertdialog", {
				name: "Regelwerk noch nicht gesichert.",
			}),
		).toBeDefined();
		fireEvent.click(
			within(
				screen.getByRole("alertdialog", {
					name: "Regelwerk noch nicht gesichert.",
				}),
			).getByRole("button", { name: "Abbrechen" }),
		);
		expect(screen.getByRole("heading", { name: "Test Rules" })).toBeDefined();
		fireEvent.click(
			screen.getByRole("button", {
				name: "Neues Spiel mit diesem Regelwerk",
			}),
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Fortfahren ohne Speichern" }),
		);
		expect(
			await screen.findByRole("heading", { name: "Neues Spiel" }),
		).toBeDefined();
		await screen.findByRole("option", { name: "Test Rules" });
		expect(
			screen.getByRole<HTMLSelectElement>("combobox", { name: "Regelwerk" })
				.value,
		).toBe("ruleset_test_rules");

		fireEvent.click(screen.getByRole("button", { name: /Zur.ck/ }));
		expect(screen.getByRole("heading", { name: "Test Rules" })).toBeDefined();
		expect(screen.getByText("Gute Leute")).toBeDefined();
	});

	it("zeigt nach dem Übernehmen eines kollidierenden Teamnamens sofort den Domainnamen", async () => {
		render(
			<App
				gameUseCases={asGameUseCases(
					new GameReadService(new MemoryGameReadStorage()),
				)}
				libraryUseCases={createTestLibraryUseCases(
					new MemoryLibraryReadStorage(),
				)}
			/>,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Szenarien verwalten" }),
		);
		fireEvent.click(
			await screen.findByRole("button", { name: /Test Rules.*Version 1/ }),
		);
		fireEvent.click(
			await screen.findByRole("button", { name: /GoodReihenfolge 10/ }),
		);

		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Evil" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));

		expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
			"Evil 2",
		);
	});

	it("übernimmt Objektänderungen beim Wechsel und verwirft sie mit Abbrechen", async () => {
		render(
			<App
				gameUseCases={asGameUseCases(
					new GameReadService(new MemoryGameReadStorage()),
				)}
				libraryUseCases={createTestLibraryUseCases(
					new MemoryLibraryReadStorage(),
				)}
			/>,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Szenarien verwalten" }),
		);
		fireEvent.click(
			await screen.findByRole("button", { name: /Test Rules.*Version 1/ }),
		);
		fireEvent.click(
			await screen.findByRole("button", { name: /Good.*Reihenfolge 10/ }),
		);

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
			target: { value: "Automatisch übernommen" },
		});
		fireEvent.click(
			screen.getByRole("button", { name: /Evil.*Reihenfolge 20/ }),
		);
		expect(screen.getByText("Automatisch übernommen")).toBeDefined();

		fireEvent.change(screen.getByLabelText("DisplayName (de)"), {
			target: { value: "Nicht behalten" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
		expect(screen.getByText("Evil")).toBeDefined();
		expect(screen.queryByText("Nicht behalten")).toBeNull();

		fireEvent.click(
			screen.getByRole("button", {
				name: /Automatisch.*Reihenfolge 10/,
			}),
		);
		fireEvent.change(screen.getByLabelText("DisplayName (de)"), {
			target: { value: "Per X übernommen" },
		});
		fireEvent.click(
			screen.getByRole("button", { name: /Detailansicht.*schlie/ }),
		);
		expect(screen.getByText("Per X übernommen")).toBeDefined();

		fireEvent.click(
			screen.getByRole("button", { name: /Per X.*Reihenfolge 10/ }),
		);
		fireEvent.change(screen.getByLabelText("DisplayName (de)"), {
			target: { value: "Beim Reiterwechsel übernommen" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Rollen" }));
		fireEvent.click(screen.getByRole("button", { name: "Teams" }));
		expect(screen.getByText("Beim Reiterwechsel übernommen")).toBeDefined();
	});

	it("zeigt nach dem Übernehmen eines kollidierenden Rollennamens sofort den Domainnamen", async () => {
		render(
			<App
				gameUseCases={asGameUseCases(
					new GameReadService(new MemoryGameReadStorage()),
				)}
				libraryUseCases={createTestLibraryUseCases(
					new MemoryLibraryReadStorage(),
				)}
			/>,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Szenarien verwalten" }),
		);
		fireEvent.click(
			await screen.findByRole("button", { name: /Test Rules.*Version 1/ }),
		);
		fireEvent.click(await screen.findByRole("button", { name: "Rollen" }));
		fireEvent.click(await screen.findByRole("button", { name: /Seer/ }));

		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Villager" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));

		expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
			"Villager 2",
		);
	});

	it("öffnet über Erstellen eine leere, ungespeicherte Regelwerk-Arbeitskopie", async () => {
		render(
			<App
				gameUseCases={asGameUseCases(
					new GameReadService(new MemoryGameReadStorage()),
				)}
				libraryUseCases={createTestLibraryUseCases(
					new MemoryLibraryReadStorage(),
				)}
			/>,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Szenarien verwalten" }),
		);
		await screen.findByText("Test Rules");

		fireEvent.click(screen.getByRole("button", { name: "Erstellen" }));

		expect(
			screen.getByRole("heading", { name: "Neues Regelwerk" }),
		).toBeDefined();
		expect(screen.queryByText("Good")).toBeNull();
		expect(
			screen.getByRole<HTMLButtonElement>("button", {
				name: "Änderung speichern",
			}).disabled,
		).toBe(false);
		expect(
			screen.getByRole<HTMLButtonElement>("button", {
				name: "Änderung im neuen Regelwerk speichern",
			}).disabled,
		).toBe(false);

		fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
		expect(
			screen.getByRole("alertdialog", {
				name: "Regelwerk noch nicht gesichert.",
			}),
		).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
		expect(
			screen.getByRole("heading", { name: "Neues Regelwerk" }),
		).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
		fireEvent.click(
			screen.getByRole("button", { name: "Beenden ohne Speichern" }),
		);
		expect(screen.queryByText("Neues Regelwerk")).toBeNull();
	});

	it("öffnet die Einstellungen und wendet einfache Anzeigeoptionen an", () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));

		fireEvent.change(screen.getByLabelText("Erscheinungsbild"), {
			target: { value: "light" },
		});
		fireEvent.change(screen.getByLabelText("Textgröße"), {
			target: { value: "large" },
		});
		fireEvent.click(screen.getByLabelText("Animationen reduzieren"));
		fireEvent.click(screen.getByLabelText("Abgelaufene Zustände ausblenden"));
		fireEvent.click(screen.getByLabelText("Bildschirm eingeschaltet lassen"));
		fireEvent.click(screen.getByLabelText("Haptisches Feedback"));
		fireEvent.click(screen.getByLabelText("Automatisch drehen"));

		expect(document.documentElement.dataset.theme).toBe("light");
		expect(document.documentElement.dataset.textSize).toBe("large");
		expect(document.documentElement.dataset.reduceMotion).toBe("true");
		expect(
			screen.getByLabelText<HTMLInputElement>("Abgelaufene Zustände ausblenden")
				.checked,
		).toBe(!germanTestSettings.hideExpiredStatuses);
		expect(
			screen.getByLabelText<HTMLInputElement>("Bildschirm eingeschaltet lassen")
				.checked,
		).toBe(!germanTestSettings.keepScreenAwake);
		expect(
			screen.getByLabelText<HTMLInputElement>("Haptisches Feedback").checked,
		).toBe(!germanTestSettings.hapticFeedback);
		expect(
			screen.getByLabelText<HTMLInputElement>("Automatisch drehen").checked,
		).toBe(!germanTestSettings.autoRotate);
	});

	it("behält Einstellungen nach Verlassen und erneutem Öffnen", () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
		fireEvent.change(screen.getByLabelText("Erscheinungsbild"), {
			target: { value: "light" },
		});
		fireEvent.change(screen.getByLabelText("Textgröße"), {
			target: { value: "large" },
		});
		fireEvent.click(screen.getByLabelText("Abgelaufene Zustände ausblenden"));

		fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
		fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));

		expect(
			screen.getByRole<HTMLSelectElement>("combobox", {
				name: "Erscheinungsbild",
			}).value,
		).toBe("light");
		expect(
			screen.getByRole<HTMLSelectElement>("combobox", { name: "Textgröße" })
				.value,
		).toBe("large");
		expect(
			screen.getByLabelText<HTMLInputElement>("Abgelaufene Zustände ausblenden")
				.checked,
		).toBe(!germanTestSettings.hideExpiredStatuses);
	});

	it("gibt beim Aktivieren der Haptik eine Vorschau", async () => {
		const hapticFeedback = {
			trigger: vi.fn(() => Promise.resolve()),
		};
		render(
			<App
				initialSettings={{ ...germanTestSettings, hapticFeedback: false }}
				hapticFeedback={hapticFeedback}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));

		fireEvent.click(screen.getByLabelText("Haptisches Feedback"));

		await waitFor(() =>
			expect(hapticFeedback.trigger).toHaveBeenCalledWith("selection"),
		);
	});

	it("wendet die Einstellung zur automatischen Drehung unmittelbar an", async () => {
		const screenOrientation = {
			setAutoRotate: vi.fn(() => Promise.resolve()),
		};
		render(<App screenOrientation={screenOrientation} />);
		await waitFor(() =>
			expect(screenOrientation.setAutoRotate).toHaveBeenLastCalledWith(true),
		);
		fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));

		fireEvent.click(screen.getByLabelText("Automatisch drehen"));

		await waitFor(() =>
			expect(screenOrientation.setAutoRotate).toHaveBeenLastCalledWith(false),
		);
	});

	it("zeigt bei einem Speicherfehler einen Dialog und erlaubt einen neuen Versuch", async () => {
		const storage = new RetrySettingsStorage();
		const settingsService = new SettingsService(storage);
		await settingsService.load();
		render(<App settingsService={settingsService} />);
		fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
		fireEvent.change(screen.getByLabelText("Erscheinungsbild"), {
			target: { value: "light" },
		});

		fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
		expect(
			await screen.findByRole("heading", {
				name: "Einstellungen konnten nicht gespeichert werden.",
			}),
		).toBeDefined();
		const settingsError = (await screen.findByRole("alert")).textContent;
		expect(settingsError).toContain(
			"Unerwarteter Anwendungsfehler. Bitte melden Sie diesen Fehler.",
		);
		expect(settingsError).toContain(
			"Einstellungen konnten nicht gespeichert werden.",
		);
		expect(
			screen.getByRole("heading", { name: "Social Deduction" }),
		).toBeDefined();
		expect(storage.saveCalls).toBe(1);

		storage.shouldFail = false;
		fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
		expect(
			await screen.findByRole("heading", { name: "Social Deduction" }),
		).toBeDefined();
		expect(storage.saveCalls).toBe(2);
	});

	it("behält geänderte Einstellungen nach Abbruch des fehlgeschlagenen Speicherns im RAM", async () => {
		const storage = new RetrySettingsStorage();
		const settingsService = new SettingsService(storage);
		await settingsService.load();
		render(<App settingsService={settingsService} />);
		fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
		fireEvent.change(screen.getByLabelText("Erscheinungsbild"), {
			target: { value: "light" },
		});

		fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
		await screen.findByRole("heading", {
			name: "Einstellungen konnten nicht gespeichert werden.",
		});
		fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

		fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
		expect(
			screen.getByRole<HTMLSelectElement>("combobox", {
				name: "Erscheinungsbild",
			}).value,
		).toBe("light");
		expect(storage.saveCalls).toBe(1);
	});

	it("liest Regelwerke und Vorlagen und öffnet die Vorbereitung", async () => {
		const gameReadService = new GameReadService(new MemoryGameReadStorage());
		const libraryUseCases = createTestLibraryUseCases(
			new MemoryLibraryReadStorage(),
		);
		render(
			<App
				gameUseCases={asGameUseCases(gameReadService)}
				libraryUseCases={libraryUseCases}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Neues Spiel" }));

		expect(screen.getByRole("heading", { name: "Neues Spiel" })).toBeDefined();
		expect(screen.getByLabelText("Spielerzahl")).toBeDefined();
		expect(
			await screen.findByRole("option", { name: "Test Rules" }),
		).toBeDefined();
		fireEvent.click(screen.getByLabelText(/Vorlage verwenden/));
		expect(screen.getByLabelText("Vorlage")).toBeDefined();
		expect(screen.getByRole("option", { name: "Testvorlage" })).toBeDefined();
		expect(screen.queryByLabelText("Spielerzahl")).toBeNull();
		fireEvent.change(screen.getByLabelText("Spielname"), {
			target: { value: "Mein vorbereitetes Spiel" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Spiel vorbereiten" }));
		expect(
			await screen.findByRole("group", { name: "Sitzordnung" }),
		).toBeDefined();
		expect(
			screen.queryByRole("button", { name: /Rollen manuell verteilen/ }),
		).toBeNull();

		fireEvent.click(screen.getAllByRole("button", { name: "Zurück" })[0]);
		fireEvent.click(
			screen.getByRole("button", { name: "Spiel ohne speichern beenden" }),
		);
		fireEvent.click(screen.getByRole("button", { name: "Neues Spiel" }));
		await screen.findByRole("option", { name: "Testvorlage" });
		expect(
			screen.getByLabelText<HTMLInputElement>(/Vorlage verwenden/).checked,
		).toBe(true);
		expect(
			screen.getByRole<HTMLSelectElement>("combobox", { name: "Vorlage" })
				.value,
		).toBe("template_test");
		fireEvent.click(screen.getByLabelText(/Regelwerk verwenden/));
		fireEvent.change(screen.getByLabelText("Spielerzahl"), {
			target: { value: "2" },
		});
		fireEvent.change(screen.getByLabelText("Spielname"), {
			target: { value: "Mein vorbereitetes Spiel" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Spiel vorbereiten" }));
		expect(
			await screen.findByRole("heading", { name: "Spiel vorbereiten" }),
		).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: /Zur.ck/ }));
		expect(screen.getByRole("heading", { name: "Neues Spiel" })).toBeDefined();
		expect(screen.getByLabelText<HTMLInputElement>("Spielname").value).toBe(
			"Mein vorbereitetes Spiel",
		);
		expect(
			screen.getByLabelText<HTMLInputElement>(/Regelwerk verwenden/).checked,
		).toBe(true);
		expect(
			screen.getByRole<HTMLSelectElement>("combobox", { name: "Regelwerk" })
				.value,
		).toBe("ruleset_test_rules");
		fireEvent.click(screen.getByRole("button", { name: "Spiel vorbereiten" }));
		await screen.findByRole("heading", { name: "Spiel vorbereiten" });
		expect(
			screen.getByRole("button", {
				name: /Zufällige Rollen zufällig verteilen/,
			}),
		).toBeDefined();
		expect(
			screen.getByRole("button", {
				name: /Ausgewählte Rollen zufällig verteilen/,
			}),
		).toBeDefined();
		expect(
			screen.getByRole("button", { name: /Rollen manuell verteilen/ }),
		).toBeDefined();
		fireEvent.click(
			screen.getByRole("button", {
				name: /Zufällige Rollen zufällig verteilen/,
			}),
		);
		expect(
			screen.getByRole("heading", { name: "Teamverteilung" }),
		).toBeDefined();
		expect(
			screen.getByText(
				(_, element) =>
					element?.classList.contains("free-player-count") ?? false,
			).textContent,
		).toContain("Freie Spieler: 2");
		const distributeButton = screen.getByRole("button", {
			name: "Rollen verteilen",
		});
		expect((distributeButton as HTMLButtonElement).disabled).toBe(true);
		expect(distributeButton.classList.contains("button-disabled")).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
		fireEvent.click(
			screen.getByRole("button", {
				name: /Ausgewählte Rollen zufällig verteilen/,
			}),
		);
		expect(
			screen.getByRole("heading", { name: "Rollenauswahl" }),
		).toBeDefined();
		const firstIncrease = screen.getAllByRole("button", { name: /erhöhen/ })[0];
		fireEvent.click(firstIncrease);
		fireEvent.click(firstIncrease);
		expect(
			screen.getByRole("img", {
				name: "Einzigartige Rolle mehrfach ausgewählt",
			}),
		).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
		fireEvent.click(
			screen.getByRole("button", { name: /Rollen manuell verteilen/ }),
		);
		expect(screen.getByRole("group", { name: "Sitzordnung" })).toBeDefined();
		fireEvent.click(screen.getAllByRole("button", { name: "Zurück" })[0]);
		fireEvent.click(
			screen.getByRole("button", { name: "Spiel ohne speichern beenden" }),
		);
		fireEvent.click(screen.getByRole("button", { name: "Neues Spiel" }));
		fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
		expect(
			screen.getByRole("heading", { name: "Social Deduction" }),
		).toBeDefined();
	});

	it("aktiviert Spiel fortsetzen nach dem ersten Speichern und Beenden", async () => {
		const storage = new EmptyWritableGameStorage();
		const gameReadService = new GameReadService(storage);
		const libraryUseCases = createTestLibraryUseCases(
			new MemoryLibraryReadStorage(),
		);
		render(
			<App
				gameUseCases={asGameUseCases(gameReadService)}
				libraryUseCases={libraryUseCases}
			/>,
		);

		const continueButton = screen.getByRole<HTMLButtonElement>("button", {
			name: /Spiel fortsetzen/,
		});
		await waitFor(() => expect(continueButton.disabled).toBe(true));

		fireEvent.click(screen.getByRole("button", { name: "Neues Spiel" }));
		await screen.findByRole("option", { name: "Test Rules" });
		fireEvent.change(screen.getByLabelText("Spielerzahl"), {
			target: { value: "2" },
		});
		fireEvent.change(screen.getByLabelText("Spielname"), {
			target: { value: "Erster Spielstand" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Spiel vorbereiten" }));
		await screen.findByRole("heading", { name: "Spiel vorbereiten" });
		fireEvent.click(
			screen.getByRole("button", { name: /Rollen manuell verteilen/ }),
		);
		await screen.findByRole("group", { name: "Sitzordnung" });

		fireEvent.click(screen.getAllByRole("button", { name: "Zurück" })[0]);
		fireEvent.click(
			screen.getByRole("button", { name: "Spiel speichern & beenden" }),
		);

		const enabledContinueButton = await screen.findByRole<HTMLButtonElement>(
			"button",
			{ name: /Spiel fortsetzen/ },
		);
		await waitFor(() => expect(enabledContinueButton.disabled).toBe(false));
		fireEvent.click(enabledContinueButton);

		expect(
			await screen.findByRole("heading", { name: "Erster Spielstand" }),
		).toBeDefined();
		expect(storage.readGameIds).toContain("game_erster_spielstand");
	});

	it("liest beim Klick einen Spielstand über Domain und Storage", async () => {
		const storage = new MemoryGameReadStorage();
		const gameReadService = new GameReadService(storage);
		render(<App gameUseCases={asGameUseCases(gameReadService)} />);
		fireEvent.click(screen.getByRole("button", { name: "Spielstand laden" }));

		expect(
			screen.getByRole("heading", { name: "Spielstand laden" }),
		).toBeDefined();
		expect(
			await screen.findByText("Standard Rule Set · Freitag"),
		).toBeDefined();
		fireEvent.change(screen.getByLabelText("Spielstände durchsuchen"), {
			target: { value: "Freitag" },
		});
		expect(screen.getByText("Standard Rule Set · Freitag")).toBeDefined();
		expect(screen.queryByText("Standard Rule Set · Samstag")).toBeNull();
		expect(
			screen.getByRole("button", { name: /^Standard Rule Set · Freitag/ })
				.className,
		).toContain("interactive-surface");

		fireEvent.click(
			screen.getByRole("button", { name: /^Standard Rule Set · Freitag/ }),
		);
		expect(
			await screen.findByRole("heading", {
				name: "Standard Rule Set · Freitag",
			}),
		).toBeDefined();
		expect(screen.getByRole("group", { name: "Sitzordnung" })).toBeDefined();
		expect(storage.readGameIds).toEqual([]);
		expect(gameReadService.getLoadedGame()?.id).toBe("game_friday");
	});

	it("bietet für jeden Spielstand die vier Verwaltungsaktionen an", async () => {
		render(
			<App
				gameUseCases={asGameUseCases(
					new GameReadService(new MemoryGameReadStorage()),
				)}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Spielstand laden" }));
		fireEvent.click(
			await screen.findByRole("button", {
				name: "Weitere Aktionen für Standard Rule Set · Freitag",
			}),
		);

		const dialog = screen.getByRole("dialog", {
			name: "Standard Rule Set · Freitag",
		});
		for (const action of [
			"Umbenennen",
			"Duplizieren",
			"Exportieren",
			"Löschen",
		]) {
			expect(
				within(dialog)
					.getByRole("button", { name: action })
					.hasAttribute("disabled"),
			).toBe(false);
		}
	});

	it("lädt Spiel fortsetzen über dieselbe Domain-Funktion", async () => {
		const storage = new MemoryGameReadStorage();
		const gameReadService = new GameReadService(storage);
		render(
			<App
				gameUseCases={asGameUseCases(gameReadService)}
				currentGameId="game_saturday"
				currentGameName="Standard Rule Set · Samstag"
				initialSettings={{
					...germanTestSettings,
					unlockSeatOrderByDefault: false,
				}}
			/>,
		);

		const continueButton = await screen.findByRole("button", {
			name: /Spiel fortsetzen/,
		});
		expect(continueButton.textContent).toContain("Standard Rule Set · Samstag");
		fireEvent.click(continueButton);

		await waitFor(() => {
			expect(gameReadService.getLoadedGame()?.id).toBe("game_saturday");
		});
		expect(
			screen.getByRole("heading", { name: "Standard Rule Set · Samstag" }),
		).toBeDefined();
		const firstSeat = screen.getByRole("button", { name: "Sitzplatz 1" });
		expect(firstSeat.classList.contains("seat-button--draggable")).toBe(false);
		fireEvent.click(
			screen.getByRole("button", { name: "Sitzordnung entsperren" }),
		);
		expect(firstSeat.classList.contains("seat-button--draggable")).toBe(true);
		const thirdSeat = screen.getByRole("button", { name: "Sitzplatz 3" });
		Object.defineProperty(firstSeat, "setPointerCapture", {
			configurable: true,
			value: vi.fn(),
		});
		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: vi.fn(() => thirdSeat),
		});
		fireEvent.pointerDown(firstSeat, {
			pointerId: 1,
			pointerType: "mouse",
			clientX: 10,
			clientY: 10,
		});
		fireEvent.pointerMove(firstSeat, {
			pointerId: 1,
			pointerType: "mouse",
			clientX: 30,
			clientY: 30,
		});
		fireEvent.pointerUp(firstSeat, {
			pointerId: 1,
			pointerType: "mouse",
			clientX: 30,
			clientY: 30,
		});
		expect(gameReadService.getLoadedGame()?.document).toMatchObject({
			seatOrder: [
				"p_1",
				"p_2",
				"p_0",
				"p_3",
				"p_4",
				"p_5",
				"p_6",
				"p_7",
				"p_8",
				"p_9",
				"p_10",
				"p_11",
			],
		});
		fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
		expect(screen.getByRole("dialog", { name: "Spielmenü" })).toBeDefined();
		expect(
			screen.getByRole("button", { name: "Spiel speichern" }),
		).toBeDefined();
		expect(
			screen.getByRole("button", { name: "Spiel speichern unter" }),
		).toBeDefined();
		expect(
			screen.getByRole("button", { name: "Spiel als Vorlage speichern unter" }),
		).toBeDefined();
		expect(
			screen.getByRole("button", { name: "Teams, Rollen, Zustände verwalten" }),
		).toBeDefined();
		expect(
			screen.getByRole("button", { name: "Rollen zufällig vergeben" }),
		).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
		const gameScreenLayer = firstSeat.closest(".game-screen-layer");
		expect(gameScreenLayer).not.toBeNull();
		expect(gameScreenLayer?.hasAttribute("inert")).toBe(true);
		expect(screen.queryByRole("dialog", { name: "Spielmenü" })).toBeNull();
		expect(
			screen.getByRole("heading", { name: "Einstellungen" }),
		).toBeDefined();
		const settingsOverlay = document.querySelector(".settings-over-game");
		expect(settingsOverlay).not.toBeNull();
		fireEvent.click(
			within(settingsOverlay as HTMLElement).getByRole("button", {
				name: "Zurück",
			}),
		);
		expect(document.querySelector(".game-screen-layer")).toBe(gameScreenLayer);
		expect(gameScreenLayer?.hasAttribute("inert")).toBe(false);
		expect(
			gameScreenLayer?.querySelector(".seat-button--draggable"),
		).not.toBeNull();
		expect(
			screen.getByRole("heading", { name: "Standard Rule Set · Samstag" }),
		).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
		fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
		expect(screen.queryByRole("dialog", { name: "Spielmenü" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
		fireEvent.click(screen.getByRole("button", { name: "Spiel beenden" }));
		expect(screen.getByRole("alertdialog").textContent).toContain(
			"Spiel noch nicht gespeichert.",
		);
		fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
		expect(screen.queryByRole("alertdialog")).toBeNull();
		const readsBeforeContinue = storage.readGameIds.length;
		fireEvent.click(screen.getAllByRole("button", { name: "Zurück" })[0]);
		fireEvent.click(
			screen.getByRole("button", { name: "Spiel ohne speichern beenden" }),
		);
		fireEvent.click(screen.getByRole("button", { name: /Spiel fortsetzen/ }));
		expect(
			await screen.findByRole("heading", {
				name: "Standard Rule Set · Samstag",
			}),
		).toBeDefined();
		expect(storage.readGameIds).toHaveLength(readsBeforeContinue);
		const continuedDocument = gameReadService.getLoadedGame()?.document as {
			seatOrder: string[];
		};
		expect(continuedDocument.seatOrder.slice(0, 3)).toEqual([
			"p_0",
			"p_1",
			"p_2",
		]);
		expect(storage.readGameIds).toEqual(["game_saturday"]);
	});

	it("öffnet Spiele gemäß dem Standard für die Sitzordnung", async () => {
		const gameReadService = new GameReadService(new MemoryGameReadStorage());
		render(
			<App
				gameUseCases={asGameUseCases(gameReadService)}
				currentGameId="game_saturday"
				currentGameName="Standard Rule Set · Samstag"
				initialSettings={{
					...germanTestSettings,
					unlockSeatOrderByDefault: true,
				}}
			/>,
		);

		fireEvent.click(
			await screen.findByRole("button", { name: /Spiel fortsetzen/ }),
		);

		expect(
			await screen.findByRole("button", { name: "Sitzordnung sperren" }),
		).toBeDefined();
	});

	it("bearbeitet die Objekte des aktuellen Spiels über eine isolierte Arbeitskopie", async () => {
		const game = createTestGame();
		game.id = "game_editor";
		game.name = "Editorspiel";
		const bytes = new TextEncoder().encode(
			JSON.stringify(createGameExportDocument(game)),
		);
		const storage: DataFileStorage = {
			readAllInternal: (category) =>
				Promise.resolve(
					category === "game"
						? [{ category, fileName: `${game.id}.json`, bytes }]
						: [],
				),
			readInternal: () => Promise.resolve(success(bytes)),
		};
		const gameReadService = new GameReadService(storage);
		render(
			<App
				gameUseCases={asGameUseCases(gameReadService)}
				currentGameId="game_editor"
				currentGameName="Editorspiel"
			/>,
		);

		fireEvent.click(
			await screen.findByRole("button", { name: /Spiel fortsetzen/ }),
		);
		const gameHeading = await screen.findByRole("heading", {
			name: "Editorspiel",
		});
		const gameScreenLayer = gameHeading.closest(".game-screen-layer");
		expect(gameScreenLayer).not.toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
		fireEvent.click(
			screen.getByRole("button", {
				name: "Teams, Rollen, Zustände verwalten",
			}),
		);

		expect(gameScreenLayer?.hasAttribute("inert")).toBe(true);
		const editorOverlay =
			document.querySelector<HTMLElement>(".editor-over-game");
		if (!editorOverlay) throw new Error("Editor-Overlay fehlt.");
		const editor = within(editorOverlay);
		expect(editor.getByText("Aktuelles Spiel")).toBeDefined();
		expect(
			editor.getByRole("button", { name: "Spieler" }).hasAttribute("disabled"),
		).toBe(false);
		fireEvent.click(editor.getByRole("button", { name: /^Good/ }));
		fireEvent.change(editor.getByLabelText("Name"), {
			target: { value: "Helden" },
		});
		fireEvent.click(editor.getByRole("button", { name: "Übernehmen" }));
		fireEvent.click(editor.getByRole("button", { name: "Änderung speichern" }));

		expect(
			await screen.findByRole("heading", { name: "Editorspiel" }),
		).toBeDefined();
		expect(document.querySelector(".game-screen-layer")).toBe(gameScreenLayer);
		expect(gameScreenLayer?.hasAttribute("inert")).toBe(false);
		expect(document.querySelector(".editor-over-game")).toBeNull();
		const editedGame = gameReadService.getLoadedGame();
		if (!editedGame) throw new Error("Bearbeitetes Spiel fehlt.");
		expect(editedGame.document.ruleSetSnapshot.teams[0]?.name).toBe("Helden");
		expect(gameReadService.isLoadedGameDirty()).toBe(true);

		fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
		fireEvent.click(
			screen.getByRole("button", { name: "Rollen zufällig vergeben" }),
		);
		expect(gameScreenLayer?.hasAttribute("inert")).toBe(true);
		const distributionOverlay = document.querySelector<HTMLElement>(
			".role-distribution-over-game",
		);
		if (!distributionOverlay)
			throw new Error("Rollenverteilungs-Overlay fehlt.");
		const distribution = within(distributionOverlay);
		expect(
			distribution.getByRole("heading", { name: "Rollen zufällig vergeben" }),
		).toBeDefined();
		expect(
			distribution.getByRole("button", {
				name: /Ausgewählte Rollen zufällig verteilen/,
			}),
		).toBeDefined();
		fireEvent.click(distribution.getByRole("button", { name: "Zurück" }));
		expect(screen.getByRole("heading", { name: "Editorspiel" })).toBeDefined();
		expect(document.querySelector(".game-screen-layer")).toBe(gameScreenLayer);
		expect(gameScreenLayer?.hasAttribute("inert")).toBe(false);
		expect(document.querySelector(".role-distribution-over-game")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
		fireEvent.click(
			screen.getByRole("button", { name: "Rollen, die gezeigt werden" }),
		);
		expect(gameScreenLayer?.hasAttribute("inert")).toBe(true);
		const showingRolesOverlay = document.querySelector<HTMLElement>(
			".roles-for-showing-over-game",
		);
		if (!showingRolesOverlay) throw new Error("Rollenanzeige-Overlay fehlt.");
		const showingRoles = within(showingRolesOverlay);
		expect(
			showingRoles.getByRole("heading", { name: "Rollen, die gezeigt werden" }),
		).toBeDefined();
		fireEvent.change(showingRoles.getByLabelText("Freitext"), {
			target: { value: "Mögliche Rollen" },
		});
		fireEvent.click(showingRoles.getByLabelText("Rollensymbol anzeigen"));
		fireEvent.click(showingRoles.getByRole("button", { name: /Rolle$/ }));
		fireEvent.click(
			within(
				showingRoles.getByRole("dialog", { name: "Rolle hinzufügen" }),
			).getByRole("button", { name: "◆ Seer" }),
		);
		fireEvent.click(showingRoles.getByRole("button", { name: "Speichern" }));
		expect(screen.getByRole("heading", { name: "Editorspiel" })).toBeDefined();
		expect(document.querySelector(".game-screen-layer")).toBe(gameScreenLayer);
		expect(gameScreenLayer?.hasAttribute("inert")).toBe(false);
		expect(document.querySelector(".roles-for-showing-over-game")).toBeNull();
		const gameWithShowingRoles = gameReadService.getLoadedGame();
		if (!gameWithShowingRoles) throw new Error("Aktuelles Spiel fehlt.");
		expect(gameWithShowingRoles.document.rolesForShowing).toEqual({
			roles: ["r_seer"],
			notice: "Mögliche Rollen",
			showRoleSymbols: true,
		});
	});

	it("zeigt einen Fehler an, wenn Spiel fortsetzen fehlschlägt", async () => {
		const gameReadService = {
			listObjects: () =>
				loadedList([
					{
						id: "game_broken",
						name: "Defekter Spielstand",
						ruleSetName: "Test",
						playerCount: 0,
						storedAt: "2026-07-13T12:00:00.000Z",
						currentNight: 0,
						phase: "setup" as const,
					},
				]),
			loadGame: () => Promise.reject(new Error("JSON ist inkonsistent.")),
			clearBrowseCache: vi.fn(),
		} as unknown as GameReadService;
		render(
			<App
				gameUseCases={asGameUseCases(gameReadService)}
				currentGameId="game_broken"
				currentGameName="Defekter Spielstand"
			/>,
		);

		fireEvent.click(
			await screen.findByRole("button", { name: /Spiel fortsetzen/ }),
		);

		const loadError = (await screen.findByRole("alert")).textContent;
		expect(loadError).toContain(
			"Das letzte Spiel konnte nicht fortgesetzt werden. Unbekannter Fehler.",
		);
		expect(loadError).toContain("Technische Details");
		expect(loadError).toContain("JSON ist inkonsistent.");
		expect(
			screen.getByRole("heading", { name: "Social Deduction" }),
		).toBeDefined();
	});

	it("fängt synchrone Domain-Fehler ab, ohne den Spielbildschirm zu verlieren", async () => {
		const gameReadService = new GameReadService(new MemoryGameReadStorage());
		render(
			<App
				gameUseCases={asGameUseCases(gameReadService)}
				currentGameId="game_saturday"
				currentGameName="Standard Rule Set · Samstag"
			/>,
		);
		fireEvent.click(
			await screen.findByRole("button", { name: /Spiel fortsetzen/ }),
		);
		expect(
			await screen.findByRole("heading", {
				name: "Standard Rule Set · Samstag",
			}),
		).toBeDefined();
		vi.spyOn(gameReadService, "advanceLoadedGameTime").mockImplementation(
			() => {
				throw new Error("Zeitangabe ist ungültig.");
			},
		);

		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		const advanceError = screen.getByRole("alert").textContent;
		expect(advanceError).toContain(
			"Die Spielzeit konnte nicht vorgestellt werden. Unbekannter Fehler.",
		);
		expect(advanceError).toContain("Technische Details");
		expect(advanceError).toContain("Zeitangabe ist ungültig.");
		expect(
			screen.getByRole("heading", { name: "Standard Rule Set · Samstag" }),
		).toBeDefined();
	});

	it("hält den Bildschirm nur während einer laufenden Spielsitzung aktiv", async () => {
		const gameReadService = new GameReadService(new MemoryGameReadStorage());
		const screenWakeLock = {
			setKeepAwake: vi.fn(() => Promise.resolve()),
		};
		const { unmount } = render(
			<App
				gameUseCases={asGameUseCases(gameReadService)}
				currentGameId="game_saturday"
				currentGameName="Standard Rule Set · Samstag"
				initialSettings={{ ...germanTestSettings, keepScreenAwake: true }}
				screenWakeLock={screenWakeLock}
			/>,
		);
		await waitFor(() =>
			expect(screenWakeLock.setKeepAwake).toHaveBeenLastCalledWith(false),
		);

		fireEvent.click(
			await screen.findByRole("button", { name: /Spiel fortsetzen/ }),
		);
		await screen.findByRole("heading", {
			name: "Standard Rule Set · Samstag",
		});
		await waitFor(() =>
			expect(screenWakeLock.setKeepAwake).toHaveBeenLastCalledWith(true),
		);

		unmount();
		expect(screenWakeLock.setKeepAwake).toHaveBeenLastCalledWith(false);
	});

	it("erzeugt bei einem erfolgreichen Zeitwechsel haptisches Feedback", async () => {
		const gameReadService = new GameReadService(new MemoryGameReadStorage());
		const hapticFeedback = {
			trigger: vi.fn(() => Promise.resolve()),
		};
		render(
			<App
				gameUseCases={asGameUseCases(gameReadService)}
				currentGameId="game_saturday"
				currentGameName="Standard Rule Set · Samstag"
				initialSettings={{ ...germanTestSettings, hapticFeedback: true }}
				hapticFeedback={hapticFeedback}
			/>,
		);
		fireEvent.click(
			await screen.findByRole("button", { name: /Spiel fortsetzen/ }),
		);
		await screen.findByRole("heading", {
			name: "Standard Rule Set · Samstag",
		});

		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		expect(hapticFeedback.trigger).toHaveBeenCalledWith("selection");
	});
});

describe("Szenarioverwaltung", () => {
	it("sichert ein geändertes Regelwerk auf Wunsch vor dem Spielstart", async () => {
		const ruleSet = createTestRuleSet();
		const saveRuleSet = vi.fn<(document: RuleSet) => Promise<void>>(() =>
			Promise.resolve(),
		);
		const onStartScenario = vi.fn();
		const libraryService = {
			listObjects: () => loadedList([toRuleSetSummary(ruleSet)]),
			loadRuleSet: () => Promise.resolve(ruleSet),
			saveRuleSet,
		};

		render(
			<ScenarioLibrary
				onBack={vi.fn()}
				onStartScenario={onStartScenario}
				libraryBrowseService={libraryService as unknown as LibraryBrowseService}
				scenarioManagementService={
					libraryService as unknown as ScenarioManagementService
				}
			/>,
		);
		fireEvent.click(
			await screen.findByRole("button", { name: /Test Rules.*Version 1/ }),
		);
		fireEvent.click(
			await screen.findByRole("button", { name: /Good.*Reihenfolge 10/ }),
		);
		fireEvent.change(screen.getByLabelText("DisplayName (de)"), {
			target: { value: "Gute Leute" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));

		fireEvent.click(
			screen.getByRole("button", {
				name: "Neues Spiel mit diesem Regelwerk",
			}),
		);
		fireEvent.click(
			within(
				screen.getByRole("alertdialog", {
					name: "Regelwerk noch nicht gesichert.",
				}),
			).getByRole("button", { name: "Abbrechen" }),
		);
		expect(onStartScenario).not.toHaveBeenCalled();

		fireEvent.click(
			screen.getByRole("button", {
				name: "Neues Spiel mit diesem Regelwerk",
			}),
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Speichern & Fortfahren" }),
		);

		await waitFor(() => expect(saveRuleSet).toHaveBeenCalledOnce());
		expect(
			saveRuleSet.mock.calls[0]?.[0].teams.find(({ id }) => id === "t_good")
				?.names?.de,
		).toBe("Gute Leute");
		await waitFor(() =>
			expect(onStartScenario).toHaveBeenCalledWith("ruleSet", ruleSet.id),
		);
	});

	it("verwendet nach dem Umbenennen einer Vorlage den von Application gelieferten Storage-Schlüssel", async () => {
		const oldTemplate = {
			...createTestGame(),
			id: "template_alt",
			name: "Alte Vorlage",
			isTemplate: true,
		};
		const loadTemplateDocument = vi.fn(() => Promise.resolve(oldTemplate));
		const gamePersistenceService = {
			listObjects: () =>
				loadedList([
					{
						id: oldTemplate.id,
						storageKey: oldTemplate.id,
						name: oldTemplate.name,
						storedAt: "2026-08-01T00:00:00.000Z",
						playerCount: oldTemplate.seatOrder.length,
						ruleSetName: oldTemplate.ruleSetSnapshot.name,
						currentNight: oldTemplate.time.currentNight,
						phase: oldTemplate.time.phase,
					},
				]),
			loadTemplateDocument,
			clearBrowseCache: vi.fn(),
		};
		const scenarioManagementService = {
			renameScenario: vi.fn(() =>
				Promise.resolve({
					id: "template_neu",
					storageKey: "opaque-template-storage-key",
					name: "Neue Vorlage",
				}),
			),
		};

		render(
			<ScenarioLibrary
				onBack={vi.fn()}
				gamePersistenceService={
					gamePersistenceService as unknown as GameUseCases["persistence"]
				}
				scenarioManagementService={
					scenarioManagementService as unknown as ScenarioManagementService
				}
			/>,
		);
		await screen.findByText("Alte Vorlage");
		fireEvent.click(
			screen.getByRole("button", {
				name: "Weitere Aktionen für Alte Vorlage",
			}),
		);
		fireEvent.click(screen.getByRole("button", { name: "Umbenennen" }));
		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Neue Vorlage" },
		});
		const submitRename = screen.getByRole("button", { name: "Umbenennen" });
		fireEvent.click(submitRename);
		fireEvent.click(submitRename);
		await waitFor(() =>
			expect(scenarioManagementService.renameScenario).toHaveBeenCalledOnce(),
		);

		fireEvent.click(
			await screen.findByRole("button", { name: /Neue Vorlage.*Plätze/ }),
		);
		await waitFor(() =>
			expect(loadTemplateDocument).toHaveBeenLastCalledWith(
				"opaque-template-storage-key",
			),
		);
	});

	it("erstellt ein neues Regelwerk mit gekoppeltem kollisionsfreiem Namen und ID", async () => {
		const existing = createNamedRuleSet(
			"ruleset_neues_regelwerk",
			"Neues Regelwerk",
			"Good",
		);
		const saveRuleSet = vi.fn<(ruleSet: RuleSet) => Promise<void>>(() =>
			Promise.resolve(),
		);
		const libraryService = {
			listObjects: () => loadedList([toRuleSetSummary(existing)]),
			loadRuleSet: () => Promise.resolve(existing),
			saveRuleSet,
		};

		render(
			<ScenarioLibrary
				onBack={vi.fn()}
				libraryBrowseService={libraryService as unknown as LibraryBrowseService}
				scenarioManagementService={
					libraryService as unknown as ScenarioManagementService
				}
			/>,
		);
		await screen.findByText("Neues Regelwerk");

		fireEvent.click(screen.getByRole("button", { name: "Erstellen" }));

		expect(
			screen.getByRole("heading", { name: "Neues Regelwerk (1)" }),
		).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Änderung speichern" }));
		await waitFor(() => expect(saveRuleSet).toHaveBeenCalledTimes(1));
		expect(saveRuleSet.mock.calls[0]?.[0]).toMatchObject({
			id: "ruleset_neues_regelwerk_1",
			name: "Neues Regelwerk (1)",
		});
	});

	it("exportiert Regelwerke über den eigenständigen Application-Use-Case", async () => {
		const ruleSet = createTestRuleSet();
		const exportRuleSet = vi.fn(() => Promise.resolve());
		const exportTemplate = vi.fn(() => Promise.resolve());
		const libraryReadService = {
			listObjects: () => loadedList([toRuleSetSummary(ruleSet)]),
			loadRuleSet: () => Promise.resolve(ruleSet),
			exportTemplate,
		};
		const ruleSetExportService = {
			exportRuleSet,
		} as unknown as RuleSetExportService;

		render(
			<ScenarioLibrary
				onBack={vi.fn()}
				libraryBrowseService={
					libraryReadService as unknown as LibraryBrowseService
				}
				scenarioManagementService={
					libraryReadService as unknown as ScenarioManagementService
				}
				ruleSetExportService={ruleSetExportService}
			/>,
		);
		fireEvent.click(
			await screen.findByRole("button", { name: /Test Rules.*Version 1/ }),
		);
		fireEvent.click(await screen.findByRole("button", { name: "Exportieren" }));

		await waitFor(() => expect(exportRuleSet).toHaveBeenCalledTimes(1));
		expect(exportRuleSet).toHaveBeenCalledWith(
			expect.objectContaining(ruleSet),
		);
		expect(exportTemplate).not.toHaveBeenCalled();
	});

	it("liest die vollständige Liste nach einem ersetzenden Import neu ein", async () => {
		let summary = toRuleSetSummary(
			createNamedRuleSet("ruleset_import", "Alter Name", "Team"),
		);
		const listObjects = vi.fn(() => loadedList([summary]));
		const libraryReadService = {
			listObjects,
			importScenario: () => {
				summary = {
					...summary,
					name: "Neuer Name",
					version: 2,
					teamCount: 4,
				};
				return Promise.resolve({
					status: "imported" as const,
					kind: "ruleSet" as const,
					id: summary.id,
					name: summary.name,
				});
			},
		};
		const view = render(
			<ScenarioLibrary
				onBack={vi.fn()}
				libraryBrowseService={
					libraryReadService as unknown as LibraryBrowseService
				}
				scenarioImportService={
					libraryReadService as unknown as ScenarioImportService
				}
			/>,
		);
		expect(await screen.findByText("Alter Name")).toBeDefined();

		const fileInput =
			view.container.querySelector<HTMLInputElement>('input[type="file"]');
		expect(fileInput).not.toBeNull();
		fireEvent.change(fileInput as HTMLInputElement, {
			target: {
				files: [
					new File(["{}"], "replacement.json", { type: "application/json" }),
				],
			},
		});

		expect(await screen.findByText("Neuer Name")).toBeDefined();
		expect(screen.getByText("Version 2 · 4 Teams · 3 Rollen")).toBeDefined();
		expect(screen.queryByText("Alter Name")).toBeNull();
		expect(listObjects).toHaveBeenCalledTimes(2);
	});

	it("ignoriert ein verspätetes Detailergebnis nach einem Szenariowechsel", async () => {
		const firstRuleSet = createNamedRuleSet(
			"ruleset_first",
			"Erstes Regelwerk",
			"Erstes Team",
		);
		const secondRuleSet = createNamedRuleSet(
			"ruleset_second",
			"Zweites Regelwerk",
			"Zweites Team",
		);
		const firstLoad = deferred<RuleSet>();
		const secondLoad = deferred<RuleSet>();
		const libraryReadService = {
			listObjects: () =>
				loadedList([
					toRuleSetSummary(firstRuleSet),
					toRuleSetSummary(secondRuleSet),
				]),
			loadRuleSet: (id: string) =>
				id === firstRuleSet.id ? firstLoad.promise : secondLoad.promise,
		};

		render(
			<ScenarioLibrary
				onBack={vi.fn()}
				libraryBrowseService={
					libraryReadService as unknown as LibraryBrowseService
				}
			/>,
		);

		fireEvent.click(
			await screen.findByRole("button", {
				name: /Erstes Regelwerk.*Version 1/,
			}),
		);
		fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
		fireEvent.click(
			screen.getByRole("button", {
				name: /Zweites Regelwerk.*Version 1/,
			}),
		);

		firstLoad.resolve(firstRuleSet);
		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "Zweites Regelwerk" }),
			).toBeDefined();
			expect(screen.queryByText("Erstes Team")).toBeNull();
		});

		secondLoad.resolve(secondRuleSet);
		expect(await screen.findByText("Zweites Team")).toBeDefined();
		expect(screen.queryByText("Erstes Team")).toBeNull();
	});

	it("arbeitet nach Speichern als Kopie auf der neuen Kopie weiter", async () => {
		const original = createTestRuleSet();
		const savedRuleSets: RuleSet[] = [];
		const libraryReadService = {
			listObjects: () => loadedList([toRuleSetSummary(original)]),
			loadRuleSet: () => Promise.resolve(original),
			saveRuleSet: (ruleSet: RuleSet) => {
				savedRuleSets.push(structuredClone(ruleSet));
				return Promise.resolve();
			},
		};

		render(
			<ScenarioLibrary
				onBack={vi.fn()}
				libraryBrowseService={
					libraryReadService as unknown as LibraryBrowseService
				}
				scenarioManagementService={
					libraryReadService as unknown as ScenarioManagementService
				}
			/>,
		);
		fireEvent.click(
			await screen.findByRole("button", { name: /Test Rules.*Version 1/ }),
		);
		fireEvent.click(
			await screen.findByRole("button", { name: /GoodReihenfolge/ }),
		);
		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Kopiertes Team" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
		fireEvent.click(
			screen.getByRole("button", {
				name: "Änderung im neuen Regelwerk speichern",
			}),
		);

		const copyForm = screen
			.getByRole("heading", { name: "Als Kopie speichern" })
			.closest("form");
		expect(copyForm).not.toBeNull();
		fireEvent.submit(copyForm as HTMLFormElement);

		expect(
			await screen.findByRole("heading", { name: "Test Rules (1)" }),
		).toBeDefined();
		expect(savedRuleSets).toHaveLength(1);
		expect(savedRuleSets[0]?.id).not.toBe(original.id);

		fireEvent.click(screen.getByRole("button", { name: /Kopiertes Team/ }));
		const detailForm = screen
			.getByRole("heading", { name: "Details bearbeiten" })
			.closest("form");
		expect(detailForm).not.toBeNull();
		fireEvent.change(
			within(detailForm as HTMLFormElement).getByLabelText("Name"),
			{ target: { value: "Weiterbearbeitete Kopie" } },
		);
		fireEvent.click(
			within(detailForm as HTMLFormElement).getByRole("button", {
				name: "Übernehmen",
			}),
		);
		fireEvent.click(screen.getByRole("button", { name: "Änderung speichern" }));

		await waitFor(() => expect(savedRuleSets).toHaveLength(2));
		expect(savedRuleSets[1]?.id).toBe(savedRuleSets[0]?.id);
		expect(savedRuleSets[1]?.name).toBe("Test Rules (1)");
		expect(
			savedRuleSets[1]?.teams.some(
				(team) => team.name === "Weiterbearbeitete Kopie",
			),
		).toBe(true);
	});
});

function deferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
} {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((nextResolve) => {
		resolve = nextResolve;
	});
	return { promise, resolve };
}

function createNamedRuleSet(
	id: string,
	name: string,
	teamName: string,
): RuleSet {
	const ruleSet = createTestRuleSet();
	return {
		...ruleSet,
		id,
		name,
		teams: ruleSet.teams.map((team, index) =>
			index === 0 ? Object.assign(team, { name: teamName }) : team,
		),
	};
}

function toRuleSetSummary(ruleSet: RuleSet) {
	return {
		id: ruleSet.id,
		name: ruleSet.name,
		version: ruleSet.version,
		teamCount: ruleSet.teams.length,
		roleCount: ruleSet.roles.length,
	};
}

class RetrySettingsStorage implements SettingsStorage {
	shouldFail = true;
	saveCalls = 0;

	load(): Promise<unknown> {
		return Promise.resolve(germanTestSettings);
	}

	save(): Promise<void> {
		this.saveCalls++;
		return this.shouldFail
			? Promise.reject(
					new Error("Einstellungen konnten nicht gespeichert werden."),
				)
			: Promise.resolve();
	}
}

class MemoryGameReadStorage implements DataFileStorage {
	readGameIds: string[] = [];

	listInternalFiles(category: "library" | "template" | "game") {
		const modifiedAtById: Record<string, number> = {
			game_saturday: Date.parse("2026-07-11T21:14:00.000Z"),
			game_friday: Date.parse("2026-07-10T23:08:00.000Z"),
			template_test: Date.parse("2026-07-01T00:00:00.000Z"),
		};
		return Promise.resolve(
			Object.entries(modifiedAtById)
				.filter(
					([id]) =>
						(id.startsWith("template_") ? "template" : "game") === category,
				)
				.map(([id, modifiedAt]) => ({
					category,
					fileName: `${id}.json`,
					modifiedAt,
				})),
		);
	}

	readAllInternal(category: "library" | "template" | "game") {
		return Promise.resolve(
			["game_saturday", "game_friday", "template_test"]
				.filter(
					(id) =>
						(id.startsWith("template_") ? "template" : "game") === category,
				)
				.map((id) => ({
					category,
					fileName: `${id}.json`,
					bytes: this.#documentBytes(id),
				})),
		);
	}

	readInternal(file: { fileName: string }): Promise<DataFileReadResult> {
		const id = file.fileName.replace(/\.json$/, "").split(".", 1)[0] ?? "";
		this.readGameIds.push(id);
		return Promise.resolve(success(this.#documentBytes(id)));
	}

	#documentBytes(gameId: string): Uint8Array {
		const documents: Record<string, unknown> = {
			game_saturday: createMemoryGame(
				"game_saturday",
				"Standard Rule Set · Samstag",
				12,
				{ currentNight: 2, phase: "day" },
			),
			game_friday: createMemoryGame(
				"game_friday",
				"Standard Rule Set · Freitag",
				10,
				{ currentNight: 1, phase: "night" },
			),
			template_test: {
				fileType: "social-deduction-template",
				schemaVersion: 1,
				id: "template_test",
				name: "Testvorlage",
				isTemplate: true,
				createdAt: "2026-07-01T00:00:00.000Z",
				ruleSetSnapshot: createTestRuleSet(),
				seatOrder: ["p_one", "p_two"],
				players: [
					Player.create({ id: "p_one", name: "Player 1" }),
					Player.create({ id: "p_two", name: "Player 2" }),
				],
				time: { currentNight: 0, phase: "setup" },
				log: [],
			},
		};
		return new TextEncoder().encode(JSON.stringify(documents[gameId]));
	}
}

class EmptyWritableGameStorage implements DataFileStorage {
	readonly readGameIds: string[] = [];
	readonly #files = new Map<
		string,
		{ file: DataFileReference; bytes: Uint8Array; modifiedAt: number }
	>();

	listInternalFiles(category: DataFileCategory) {
		return Promise.resolve(
			[...this.#files.values()]
				.filter(({ file }) => file.category === category)
				.map(({ file, modifiedAt }) => ({ ...file, modifiedAt })),
		);
	}

	readAllInternal(category: DataFileCategory) {
		return Promise.resolve(
			[...this.#files.values()]
				.filter(({ file }) => file.category === category)
				.map(({ file, bytes }) => ({ ...file, bytes })),
		);
	}

	readInternal(file: DataFileReference): Promise<DataFileReadResult> {
		const stored = this.#files.get(file.fileName);
		if (!stored) return Promise.resolve(missingRead(file));
		this.readGameIds.push(file.fileName.replace(/\.json$/, ""));
		return Promise.resolve(success(stored.bytes));
	}

	writeInternal(file: DataFileReference, bytes: Uint8Array): Promise<void> {
		this.#files.set(file.fileName, {
			file,
			bytes,
			modifiedAt: Date.parse("2026-09-02T12:00:00.000Z"),
		});
		return Promise.resolve();
	}
}

function createMemoryGame(
	id: string,
	name: string,
	playerCount: number,
	time: { currentNight: number; phase: "setup" | "night" | "day" },
) {
	const game = createTestGame(1);
	game.id = id;
	game.name = name;
	game.time = time;
	game.ruleSetSnapshot.name = "Standard Rule Set";
	game.playersById = Object.fromEntries(
		Array.from({ length: playerCount }, (_, index) => {
			const playerId = `p_${index}`;
			return [
				playerId,
				Player.create({ id: playerId, name: `Player ${index}` }),
			];
		}),
	);
	game.seatOrder = Object.keys(game.playersById);
	return createGameExportDocument(game);
}

class MemoryLibraryReadStorage implements DataFileStorage {
	readInternal(): Promise<DataFileReadResult> {
		const ruleSet = createTestRuleSet();
		return Promise.resolve(
			success(
				new TextEncoder().encode(
					JSON.stringify({
						storageType: "social-deduction-app-library",
						storageVersion: 1,
						ruleSetsById: { [ruleSet.id]: ruleSet },
					}),
				),
			),
		);
	}
}

function loadedList<T extends { id: string }>(metadata: T[]) {
	return Promise.resolve({
		status: "loaded" as const,
		metadata,
		problems: [],
		ids: metadata.map(({ id }) => id),
	});
}

function success(bytes: Uint8Array): DataFileReadResult {
	return { status: "success", bytes };
}
