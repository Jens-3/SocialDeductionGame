// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultAppSettings } from "../src/application/appSettings";
import {
	type BootstrapApplicationServices,
	bootstrapApplication,
} from "../src/bootstrapApplication";

afterEach(() => {
	document.documentElement.removeAttribute("lang");
	vi.restoreAllMocks();
});

describe("bootstrapApplication", () => {
	it("meldet einen lokalisierten Startfehler, wenn das Root-Element fehlt", async () => {
		const loadGuiLanguage = vi.fn(() => Promise.resolve());

		await expect(
			bootstrapApplication({
				rootElement: null,
				getSystemLanguage: () => Promise.resolve("de-CH"),
				loadGuiLanguage,
				createGuiTranslator: (language) => (key) => `${language}:${key}`,
			}),
		).rejects.toThrow("de-CH:startup.rootMissing");
		expect(loadGuiLanguage).toHaveBeenCalledWith("de-CH");
	});

	it("führt die Startschritte aus und rendert den aufgelösten Zustand", async () => {
		const calls: string[] = [];
		const settings = {
			...defaultAppSettings,
			language: "fr",
			reduceMotion: true,
		};
		const render = vi.fn<BootstrapApplicationServices["render"]>();
		const services: BootstrapApplicationServices = {
			platformErrors: [],
			initializeDataFiles: () => {
				calls.push("initialize");
				return Promise.resolve();
			},
			repairInternalDataFileNames: () => {
				calls.push("repair");
				return Promise.resolve();
			},
			settingsService: {
				load: () => {
					calls.push("settings");
					return Promise.resolve(settings);
				},
				getEffectiveLocale: () => ({
					languageCode: "fr",
					languageTag: "fr-FR",
				}),
			},
			motionPreferenceService: {
				setAppReduceMotion: (reduceMotion) => {
					calls.push(`motion:${reduceMotion}`);
				},
			},
			render,
		};
		const loadGuiLanguage = vi.fn((language: string) => {
			calls.push(`language:${language}`);
			return Promise.resolve();
		});
		const rootElement = document.createElement("div");

		await bootstrapApplication({
			rootElement,
			services,
			loadGuiLanguage,
		});

		expect(calls).toEqual([
			"initialize",
			"repair",
			"settings",
			"language:fr-FR",
			"motion:true",
		]);
		expect(document.documentElement.lang).toBe("fr-FR");
		expect(render).toHaveBeenCalledWith(rootElement, {
			effectiveLanguage: "fr-FR",
			initialError: undefined,
			initialSettings: settings,
		});
	});

	it("sammelt Startfehler und startet mit sicheren Einstellungen weiter", async () => {
		const render = vi.fn<BootstrapApplicationServices["render"]>();
		const setAppReduceMotion = vi.fn();
		const repairInternalDataFileNames = vi
			.fn<BootstrapApplicationServices["repairInternalDataFileNames"]>()
			.mockRejectedValue("Reparatur");
		const services: BootstrapApplicationServices = {
			platformErrors: ["Plattformfehler."],
			initializeDataFiles: () => Promise.reject(new Error("Initialisierung")),
			repairInternalDataFileNames,
			settingsService: {
				load: () => Promise.reject(new Error("Einstellungen")),
				getEffectiveLocale: () => ({
					languageCode: "en",
					languageTag: "en-US",
				}),
			},
			motionPreferenceService: { setAppReduceMotion },
			render,
		};
		const rootElement = document.createElement("div");

		await bootstrapApplication({
			rootElement,
			services,
			loadGuiLanguage: () => Promise.resolve(),
			createGuiTranslator: () => (key) => key,
		});

		expect(setAppReduceMotion).toHaveBeenCalledWith(false);
		expect(render).toHaveBeenCalledWith(rootElement, {
			effectiveLanguage: "en-US",
			initialError:
				"Plattformfehler. startup.initializeFiles Initialisierung startup.repairFileNames error.unknown startup.loadSettings Einstellungen",
			initialSettings: defaultAppSettings,
		});
	});
});
