import { describe, expect, it, vi } from "vitest";
import { defaultAppSettings } from "../src/application/appSettings";
import {
	CapacitorSettingsStorage,
	type NativePreferences,
} from "../src/storage/capacitorSettingsStorage";

describe("CapacitorSettingsStorage", () => {
	it("liest und schreibt Einstellungen über Capacitor Preferences", async () => {
		let value: string | null = null;
		const set = vi.fn((options: { key: string; value: string }) => {
			value = options.value;
			return Promise.resolve();
		});
		const preferences: NativePreferences = {
			get: vi.fn(() => Promise.resolve({ value })),
			set,
		};
		const storage = new CapacitorSettingsStorage(preferences);

		await expect(storage.load()).resolves.toBeUndefined();
		await storage.save(defaultAppSettings);
		await expect(storage.load()).resolves.toEqual(defaultAppSettings);
		expect(set).toHaveBeenCalledWith({
			key: "social-deduction-game.settings",
			value: JSON.stringify(defaultAppSettings),
		});
	});

	it("ignoriert ungültige gespeicherte JSON-Daten", async () => {
		const storage = new CapacitorSettingsStorage({
			get: () => Promise.resolve({ value: "{" }),
			set: () => Promise.resolve(),
		});

		await expect(storage.load()).resolves.toBeUndefined();
	});
});
