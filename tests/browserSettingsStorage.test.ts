// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { defaultAppSettings } from "../src/application/appSettings";
import { BrowserSettingsStorage } from "../src/storage/browserSettingsStorage";

const SETTINGS_STORAGE_KEY = "social-deduction-game.settings";

afterEach(() => localStorage.clear());

describe("BrowserSettingsStorage", () => {
	it("liefert ohne gespeicherte Einstellungen undefined", async () => {
		await expect(new BrowserSettingsStorage().load()).resolves.toBeUndefined();
	});

	it("schreibt und liest Einstellungen unter dem stabilen Storage-Key", async () => {
		const storage = new BrowserSettingsStorage();

		await storage.save(defaultAppSettings);

		expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBe(
			JSON.stringify(defaultAppSettings),
		);
		await expect(storage.load()).resolves.toEqual(defaultAppSettings);
	});

	it.each(["{", "[", '"unvollständig'])(
		"behandelt ungültige gespeicherte Daten defensiv",
		async (value) => {
			localStorage.setItem(SETTINGS_STORAGE_KEY, value);

			await expect(
				new BrowserSettingsStorage().load(),
			).resolves.toBeUndefined();
		},
	);
});
