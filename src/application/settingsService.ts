import { setLanguage } from "../config";
import type { AppearanceService } from "./appearanceService";
import { expectedApplicationError } from "./applicationError";
import {
	type AppSettings,
	defaultAppSettings,
	type LocaleIdentifier,
	normalizeAppSettings,
	resolveLocaleIdentifier,
	systemLanguagePreference,
} from "./appSettings";
import { executeApplicationOperation } from "./internal/applicationErrorMapping";
import type { SettingsStorage } from "./ports/settingsStorage";
import type { SystemLanguagePort } from "./ports/systemLanguagePort";

export class SettingsService {
	readonly #storage: SettingsStorage;
	readonly #appearanceService?: AppearanceService;
	readonly #systemLanguage?: SystemLanguagePort;
	#resolvedSystemLocale = resolveLocaleIdentifier(defaultAppSettings.language);
	#currentSettings: AppSettings = { ...defaultAppSettings };
	#lastSaveRequest?: AppSettings;
	#saveRequest?: AppSettings;
	#activeLoad?: Promise<AppSettings>;
	#activeSave?: Promise<AppSettings>;
	#isInitialized = false;
	#isEditing = false;

	constructor(
		storage: SettingsStorage,
		appearanceService?: AppearanceService,
		systemLanguage?: SystemLanguagePort,
	) {
		this.#storage = storage;
		this.#appearanceService = appearanceService;
		this.#systemLanguage = systemLanguage;
	}

	load(): Promise<AppSettings> {
		if (this.#isInitialized)
			return Promise.resolve({ ...this.#currentSettings });
		if (this.#activeLoad) return this.#activeLoad;

		const load = executeApplicationOperation(async () => {
			const settings = normalizeAppSettings(await this.#storage.load());
			this.#resolvedSystemLocale = resolveLocaleIdentifier(
				await this.#systemLanguage?.getSystemLanguage(),
			);
			this.#currentSettings = settings;
			this.#lastSaveRequest = { ...settings };
			this.#saveRequest = undefined;
			this.#isInitialized = true;
			this.#applyLanguage(settings.language);
			this.#appearanceService?.setThemePreference(settings.theme);
			return { ...settings };
		}, "load");
		const trackedLoad = load.finally(() => {
			if (this.#activeLoad === trackedLoad) this.#activeLoad = undefined;
		});
		this.#activeLoad = trackedLoad;
		return trackedLoad;
	}

	async save(value: AppSettings): Promise<AppSettings> {
		return executeApplicationOperation(async () => {
			const settings = normalizeAppSettings(value);
			this.#applyLanguage(settings.language);
			this.#appearanceService?.setThemePreference(settings.theme);
			await this.#storage.save(settings);
			this.#currentSettings = settings;
			this.#lastSaveRequest = { ...settings };
			this.#saveRequest = undefined;
			this.#isInitialized = true;
			return { ...settings };
		}, "save");
	}

	beginEditing(): AppSettings {
		this.#isEditing = true;
		return { ...this.#currentSettings };
	}

	updateEditing(value: AppSettings): AppSettings {
		if (!this.#isEditing) {
			throw expectedApplicationError("save", "settings", "preconditionNotMet");
		}

		this.#currentSettings = normalizeAppSettings(value);
		this.#applyLanguage(this.#currentSettings.language);
		this.#appearanceService?.setThemePreference(this.#currentSettings.theme);
		return { ...this.#currentSettings };
	}

	getEffectiveLanguage(preference: string): string {
		return this.getEffectiveLocale(preference).languageTag;
	}

	getEffectiveLocale(preference: string): LocaleIdentifier {
		return preference === systemLanguagePreference
			? this.#resolvedSystemLocale
			: resolveLocaleIdentifier(preference);
	}

	finishEditing(): AppSettings {
		this.#isEditing = false;
		return { ...this.#currentSettings };
	}

	async synchronizeOnHome(): Promise<AppSettings> {
		if (!this.#isInitialized) await this.load();
		if (
			this.#lastSaveRequest &&
			settingsAreEqual(this.#currentSettings, this.#lastSaveRequest)
		)
			return { ...this.#currentSettings };

		const request = { ...this.#currentSettings };
		this.#lastSaveRequest = request;
		this.#saveRequest = request;
		return this.#saveRequestedSettings();
	}

	retrySaving(): Promise<AppSettings> {
		if (this.#activeSave) return this.#activeSave;
		return this.#saveRequestedSettings();
	}

	cancelSaving(): AppSettings {
		this.#isEditing = false;
		this.#saveRequest = undefined;
		return { ...this.#currentSettings };
	}

	#saveRequestedSettings(): Promise<AppSettings> {
		const save = this.#drainSaveRequests();
		const trackedSave = save.finally(() => {
			if (this.#activeSave === trackedSave) this.#activeSave = undefined;
		});
		this.#activeSave = trackedSave;
		return trackedSave;
	}

	async #drainSaveRequests(): Promise<AppSettings> {
		while (this.#saveRequest) {
			const request = this.#saveRequest;
			this.#saveRequest = undefined;
			try {
				await executeApplicationOperation(
					() => this.#storage.save(request),
					"save",
				);
			} catch (error) {
				if (!this.#saveRequest) this.#saveRequest = request;
				throw error;
			}
		}
		return { ...this.#currentSettings };
	}

	#applyLanguage(preference: string): void {
		setLanguage(this.getEffectiveLocale(preference).languageTag);
	}
}

function settingsAreEqual(left: AppSettings, right: AppSettings): boolean {
	return (
		left.language === right.language &&
		left.theme === right.theme &&
		left.textSize === right.textSize &&
		left.reduceMotion === right.reduceMotion &&
		left.hideExpiredStatuses === right.hideExpiredStatuses &&
		left.unlockSeatOrderByDefault === right.unlockSeatOrderByDefault &&
		left.seatCircleFirstSeatAtTop === right.seatCircleFirstSeatAtTop &&
		left.seatCircleClockwise === right.seatCircleClockwise &&
		left.showRoleSymbols === right.showRoleSymbols &&
		left.keepScreenAwake === right.keepScreenAwake &&
		left.hapticFeedback === right.hapticFeedback &&
		left.autoRotate === right.autoRotate
	);
}
