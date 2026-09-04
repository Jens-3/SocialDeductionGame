import type { AppSettings } from "../appSettings";

export interface SettingsStorage {
	load(): Promise<unknown>;
	save(settings: AppSettings): Promise<void>;
}
