import { afterEach, describe, expect, it } from "vitest";
import { AppearanceService } from "../src/application/appearanceService";
import {
	type AppSettings,
	defaultAppSettings,
	normalizeAppSettings,
} from "../src/application/appSettings";
import type { SettingsStorage } from "../src/application/ports/settingsStorage";
import { SettingsService } from "../src/application/settingsService";
import { language, setLanguage } from "../src/config";

afterEach(() => setLanguage("de"));

describe("App-Einstellungen", () => {
	it("initialisiert die Einstellungen beim ersten Startmenübesuch", async () => {
		const storedSettings = { ...defaultAppSettings, theme: "dark" as const };
		const storage = new MemorySettingsStorage(storedSettings);
		const service = new SettingsService(storage);

		await expect(service.synchronizeOnHome()).resolves.toEqual(storedSettings);
		await service.synchronizeOnHome();

		expect(storage.loadCallCount).toBe(1);
		expect(storage.saveCallCount).toBe(0);
	});

	it("normalisiert unvollständige und ungültige gespeicherte Werte", () => {
		expect(
			normalizeAppSettings({
				language: " en ",
				theme: "unbekannt",
				textSize: "large",
				reduceMotion: "ja",
				hideExpiredStatuses: "ja",
				unlockSeatOrderByDefault: "ja",
				seatCircleFirstSeatAtTop: "ja",
				seatCircleClockwise: "ja",
				showRoleSymbols: "ja",
				keepScreenAwake: "ja",
				hapticFeedback: "ja",
				autoRotate: "ja",
			}),
		).toEqual({
			...defaultAppSettings,
			language: "en",
			textSize: "large",
		});
		expect(normalizeAppSettings(undefined)).toEqual(defaultAppSettings);
		expect(
			normalizeAppSettings({
				...defaultAppSettings,
				seatCircleFirstSeatAtTop: false,
				seatCircleClockwise: false,
			}),
		).toMatchObject({
			seatCircleFirstSeatAtTop: false,
			seatCircleClockwise: false,
		});
		expect(
			normalizeAppSettings({ ...defaultAppSettings, language: " en_gb " })
				.language,
		).toBe("en-GB");
	});

	it("leitet Laden und Speichern über den Domain-Service", async () => {
		const storage = new MemorySettingsStorage({
			language: "en",
			theme: "dark",
			textSize: "standard",
			reduceMotion: false,
		});
		const appearanceService = new AppearanceService();
		const service = new SettingsService(storage, appearanceService);

		const loaded = await service.load();
		expect(loaded.language).toBe("en");
		expect(language).toBe("en");
		expect(appearanceService.getResolvedTheme()).toBe("dark");

		await service.save({ ...loaded, theme: "light" });
		expect(storage.savedSettings?.theme).toBe("light");
		expect(appearanceService.getResolvedTheme()).toBe("light");
	});

	it("speichert eine alleinige Änderung der Rollensymbol-Einstellung", async () => {
		const storage = new MemorySettingsStorage(defaultAppSettings);
		const service = new SettingsService(storage);
		const changedShowRoleSymbols = !defaultAppSettings.showRoleSymbols;
		await service.load();

		service.beginEditing();
		service.updateEditing({
			...defaultAppSettings,
			showRoleSymbols: changedShowRoleSymbols,
		});
		service.finishEditing();
		expect(storage.savedSettings).toBeUndefined();
		await service.synchronizeOnHome();

		expect(storage.savedSettings).toEqual({
			...defaultAppSettings,
			showRoleSymbols: changedShowRoleSymbols,
		});
	});

	it("speichert Änderungen der Sitzkreisdarstellung", async () => {
		const storage = new MemorySettingsStorage(defaultAppSettings);
		const service = new SettingsService(storage);
		await service.load();

		service.beginEditing();
		service.updateEditing({
			...defaultAppSettings,
			seatCircleFirstSeatAtTop: false,
			seatCircleClockwise: false,
		});
		service.finishEditing();
		await service.synchronizeOnHome();

		expect(storage.savedSettings).toEqual({
			...defaultAppSettings,
			seatCircleFirstSeatAtTop: false,
			seatCircleClockwise: false,
		});
	});

	it("löst die Systemsprache auf eine unterstützte App-Sprache auf", async () => {
		const storage = new MemorySettingsStorage({
			...defaultAppSettings,
			language: "system",
		});
		const service = new SettingsService(storage, undefined, {
			getSystemLanguage: () => Promise.resolve("EN-us"),
		});

		const loaded = await service.load();

		expect(loaded.language).toBe("system");
		expect(language).toBe("en-US");
		expect(service.getEffectiveLanguage(loaded.language)).toBe("en-US");
		expect(service.getEffectiveLocale(loaded.language)).toEqual({
			languageCode: "en",
			languageTag: "en-US",
		});
	});

	it("verwendet bei unbekannter Systemsprache Deutsch", async () => {
		const storage = new MemorySettingsStorage({
			...defaultAppSettings,
			language: "system",
		});
		const service = new SettingsService(storage, undefined, {
			getSystemLanguage: () => Promise.resolve("zz-ZZ"),
		});

		await service.load();

		expect(language).toBe("zz-ZZ");
		expect(service.getEffectiveLocale("system")).toEqual({
			languageCode: "zz",
			languageTag: "zz-ZZ",
		});
	});

	it("schreibt beim Wechsel ins Startmenü ohne Änderung nichts", async () => {
		const storage = new MemorySettingsStorage(defaultAppSettings);
		const service = new SettingsService(storage);
		await service.load();

		service.beginEditing();
		service.finishEditing();
		await service.synchronizeOnHome();

		expect(storage.saveCallCount).toBe(0);
		expect(storage.savedSettings).toBeUndefined();
	});

	it("schreibt nach einer rückgängig gemachten Änderung nichts", async () => {
		const storage = new MemorySettingsStorage(defaultAppSettings);
		const service = new SettingsService(storage);
		await service.load();

		const original = service.beginEditing();
		service.updateEditing({ ...original, theme: "light" });
		service.updateEditing({ ...original });
		service.finishEditing();
		await service.synchronizeOnHome();

		expect(storage.saveCallCount).toBe(0);
		expect(storage.savedSettings).toBeUndefined();
	});

	it("schreibt mehrere Änderungen erst im Startmenü genau einmal", async () => {
		const storage = new MemorySettingsStorage(defaultAppSettings);
		const service = new SettingsService(storage);
		await service.load();

		const draft = service.beginEditing();
		service.updateEditing({ ...draft, theme: "dark" });
		service.updateEditing({
			...draft,
			theme: "dark",
			textSize: "large",
			reduceMotion: true,
			hideExpiredStatuses: true,
			unlockSeatOrderByDefault: true,
			keepScreenAwake: true,
			hapticFeedback: true,
			autoRotate: false,
		});
		expect(storage.saveCallCount).toBe(0);
		service.finishEditing();
		expect(storage.saveCallCount).toBe(0);
		await service.synchronizeOnHome();
		expect(storage.saveCallCount).toBe(1);
		expect(storage.savedSettings).toMatchObject({
			theme: "dark",
			textSize: "large",
			reduceMotion: true,
			hideExpiredStatuses: true,
			unlockSeatOrderByDefault: true,
			keepScreenAwake: true,
			hapticFeedback: true,
			autoRotate: false,
		});
	});

	it("fasst mehrere Einstellungsbesuche vor dem Startmenü zusammen", async () => {
		const storage = new MemorySettingsStorage(defaultAppSettings);
		const service = new SettingsService(storage);
		await service.load();

		const original = service.beginEditing();
		service.updateEditing({ ...original, theme: "dark" });
		service.finishEditing();
		const secondDraft = service.beginEditing();
		service.updateEditing({ ...secondDraft, textSize: "large" });
		service.finishEditing();

		expect(storage.saveCallCount).toBe(0);
		await service.synchronizeOnHome();
		await service.synchronizeOnHome();

		expect(storage.saveCallCount).toBe(1);
		expect(storage.savedSettings).toMatchObject({
			theme: "dark",
			textSize: "large",
		});
	});

	it("behält nach einem Fehler den Speicherwunsch für einen erneuten Versuch", async () => {
		let shouldFail = true;
		const storage = new MemorySettingsStorage(defaultAppSettings, () => {
			if (shouldFail) return Promise.reject(new Error("write failed"));
			return Promise.resolve();
		});
		const service = new SettingsService(storage);
		await service.load();
		const original = service.beginEditing();
		const changed = service.updateEditing({ ...original, theme: "dark" });

		service.finishEditing();
		await expect(service.synchronizeOnHome()).rejects.toBeDefined();
		shouldFail = false;
		await expect(service.retrySaving()).resolves.toEqual(changed);

		expect(storage.saveCallCount).toBe(2);
		expect(storage.saveAttempts).toEqual([changed, changed]);
	});

	it("behält bei Abbruch den RAM-Stand und wiederholt denselben Auftrag nicht", async () => {
		let shouldFail = true;
		const storage = new MemorySettingsStorage(defaultAppSettings, () =>
			shouldFail
				? Promise.reject(new Error("write failed"))
				: Promise.resolve(),
		);
		const service = new SettingsService(storage);
		await service.load();
		const original = service.beginEditing();
		const changed = service.updateEditing({ ...original, textSize: "large" });

		service.finishEditing();
		await expect(service.synchronizeOnHome()).rejects.toBeDefined();
		expect(service.cancelSaving()).toEqual(changed);
		expect(service.beginEditing()).toEqual(changed);

		shouldFail = false;
		service.finishEditing();
		await service.synchronizeOnHome();
		expect(storage.saveCallCount).toBe(1);
	});

	it("sendet einen bereits beauftragten Stand während des Speicherns nicht erneut", async () => {
		let completeSave: (() => void) | undefined;
		const storage = new MemorySettingsStorage(
			defaultAppSettings,
			() =>
				new Promise<void>((resolve) => {
					completeSave = resolve;
				}),
		);
		const service = new SettingsService(storage);
		await service.load();
		const original = service.beginEditing();
		service.updateEditing({ ...original, theme: "dark" });

		service.finishEditing();
		const firstSave = service.synchronizeOnHome();
		const secondSave = service.synchronizeOnHome();

		expect(storage.saveCallCount).toBe(1);
		await expect(secondSave).resolves.toEqual({
			...defaultAppSettings,
			theme: "dark",
		});
		completeSave?.();
		await firstSave;
	});
});

class MemorySettingsStorage implements SettingsStorage {
	readonly #loadedValue: unknown;
	readonly #saveImplementation: () => Promise<void>;
	savedSettings?: AppSettings;
	readonly saveAttempts: AppSettings[] = [];
	saveCallCount = 0;
	loadCallCount = 0;

	constructor(
		loadedValue: unknown,
		saveImplementation: () => Promise<void> = () => Promise.resolve(),
	) {
		this.#loadedValue = loadedValue;
		this.#saveImplementation = saveImplementation;
	}

	load(): Promise<unknown> {
		this.loadCallCount++;
		return Promise.resolve(this.#loadedValue);
	}

	save(settings: AppSettings): Promise<void> {
		this.savedSettings = { ...settings };
		this.saveAttempts.push({ ...settings });
		this.saveCallCount++;
		return this.#saveImplementation();
	}
}
