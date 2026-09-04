import { BrowserMotionPreferenceAdapter } from "./browserMotionPreferenceAdapter";
import { BrowserSystemThemeAdapter } from "./browserSystemThemeAdapter";

export type BrowserPreferenceAdapters = {
	systemThemeAdapter?: BrowserSystemThemeAdapter;
	motionPreferenceAdapter?: BrowserMotionPreferenceAdapter;
	errors: string[];
};

export function createBrowserPreferenceAdapters(
	browserWindow: Window = window,
): BrowserPreferenceAdapters {
	const errors: string[] = [];
	let systemThemeAdapter: BrowserSystemThemeAdapter | undefined;
	let motionPreferenceAdapter: BrowserMotionPreferenceAdapter | undefined;
	try {
		systemThemeAdapter = new BrowserSystemThemeAdapter(browserWindow);
	} catch (error) {
		errors.push(
			`Das System-Theme konnte nicht ermittelt werden. ${toErrorMessage(error)}`,
		);
	}
	try {
		motionPreferenceAdapter = new BrowserMotionPreferenceAdapter(browserWindow);
	} catch (error) {
		errors.push(
			`Die Systempräferenz für reduzierte Animationen konnte nicht ermittelt werden. ${toErrorMessage(error)}`,
		);
	}
	return { systemThemeAdapter, motionPreferenceAdapter, errors };
}

function toErrorMessage(error: unknown): string {
	return error instanceof Error
		? error.message
		: "Unbekannter Plattformfehler.";
}
