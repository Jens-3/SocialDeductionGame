import type { AppSettings } from "../application/appSettings";
import type { SettingsStorage } from "../application/ports/settingsStorage";
import { sanitizeParsedText, sanitizeText } from "../shared/textSanitizer";

const SETTINGS_STORAGE_KEY = "social-deduction-game.settings";

export class BrowserSettingsStorage implements SettingsStorage {
	load(): Promise<unknown> {
		const storedValue = localStorage.getItem(SETTINGS_STORAGE_KEY);
		if (!storedValue) return Promise.resolve(undefined);

		try {
			const text = sanitizeText(storedValue, { preserveLineBreaks: true });
			return Promise.resolve(sanitizeParsedText(JSON.parse(text) as unknown));
		} catch {
			return Promise.resolve(undefined);
		}
	}

	save(settings: AppSettings): Promise<void> {
		localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
		return Promise.resolve();
	}
}
