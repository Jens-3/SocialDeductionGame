import { Device } from "@capacitor/device";

export async function getSystemLanguage(): Promise<string | null> {
	try {
		return (await Device.getLanguageTag()).value.trim();
	} catch {
		return null;
	}
}
