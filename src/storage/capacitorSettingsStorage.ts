import { Preferences } from "@capacitor/preferences";
import type { AppSettings } from "../application/appSettings";
import type { SettingsStorage } from "../application/ports/settingsStorage";
import { sanitizeParsedText, sanitizeText } from "../shared/textSanitizer";

const SETTINGS_STORAGE_KEY = "social-deduction-game.settings";

export interface NativePreferences {
	get(options: { key: string }): Promise<{ value: string | null }>;
	set(options: { key: string; value: string }): Promise<void>;
}

export class CapacitorSettingsStorage implements SettingsStorage {
	constructor(private readonly preferences: NativePreferences = Preferences) {}

	async load(): Promise<unknown> {
		const { value } = await this.preferences.get({ key: SETTINGS_STORAGE_KEY });
		if (!value) return undefined;
		try {
			const text = sanitizeText(value, { preserveLineBreaks: true });
			return sanitizeParsedText(JSON.parse(text) as unknown);
		} catch {
			return undefined;
		}
	}

	async save(settings: AppSettings): Promise<void> {
		await this.preferences.set({
			key: SETTINGS_STORAGE_KEY,
			value: JSON.stringify(settings),
		});
	}
}
