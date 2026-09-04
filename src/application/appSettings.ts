export type ThemePreference = "system" | "light" | "dark";
export type TextSize = "small" | "standard" | "large";

export const systemLanguagePreference = "system";

export type LocaleIdentifier = Readonly<{
	languageCode: string;
	languageTag: string;
}>;

export type AppSettings = {
	language: string;
	theme: ThemePreference;
	textSize: TextSize;
	reduceMotion: boolean;
	hideExpiredStatuses: boolean;
	unlockSeatOrderByDefault: boolean;
	seatCircleFirstSeatAtTop: boolean;
	seatCircleClockwise: boolean;
	showRoleSymbols: boolean;
	keepScreenAwake: boolean;
	hapticFeedback: boolean;
	autoRotate: boolean;
};

export const defaultAppSettings: AppSettings = {
	language: "system",
	theme: "system",
	textSize: "standard",
	reduceMotion: false,
	hideExpiredStatuses: true,
	unlockSeatOrderByDefault: true,
	seatCircleFirstSeatAtTop: true,
	seatCircleClockwise: true,
	showRoleSymbols: true,
	keepScreenAwake: false,
	hapticFeedback: true,
	autoRotate: true,
};

export function normalizeAppSettings(value: unknown): AppSettings {
	if (!isRecord(value)) return { ...defaultAppSettings };

	const languagePreference =
		typeof value.language === "string" && value.language.trim()
			? value.language.trim()
			: defaultAppSettings.language;
	const normalizedLanguage = normalizeLanguagePreference(languagePreference);

	return {
		language: normalizedLanguage,
		theme: isThemePreference(value.theme)
			? value.theme
			: defaultAppSettings.theme,
		textSize: isTextSize(value.textSize)
			? value.textSize
			: defaultAppSettings.textSize,
		reduceMotion:
			typeof value.reduceMotion === "boolean"
				? value.reduceMotion
				: defaultAppSettings.reduceMotion,
		hideExpiredStatuses:
			typeof value.hideExpiredStatuses === "boolean"
				? value.hideExpiredStatuses
				: defaultAppSettings.hideExpiredStatuses,
		unlockSeatOrderByDefault:
			typeof value.unlockSeatOrderByDefault === "boolean"
				? value.unlockSeatOrderByDefault
				: defaultAppSettings.unlockSeatOrderByDefault,
		seatCircleFirstSeatAtTop:
			typeof value.seatCircleFirstSeatAtTop === "boolean"
				? value.seatCircleFirstSeatAtTop
				: defaultAppSettings.seatCircleFirstSeatAtTop,
		seatCircleClockwise:
			typeof value.seatCircleClockwise === "boolean"
				? value.seatCircleClockwise
				: defaultAppSettings.seatCircleClockwise,
		showRoleSymbols:
			typeof value.showRoleSymbols === "boolean"
				? value.showRoleSymbols
				: defaultAppSettings.showRoleSymbols,
		keepScreenAwake:
			typeof value.keepScreenAwake === "boolean"
				? value.keepScreenAwake
				: defaultAppSettings.keepScreenAwake,
		hapticFeedback:
			typeof value.hapticFeedback === "boolean"
				? value.hapticFeedback
				: defaultAppSettings.hapticFeedback,
		autoRotate:
			typeof value.autoRotate === "boolean"
				? value.autoRotate
				: defaultAppSettings.autoRotate,
	};
}

function normalizeLanguagePreference(value: string): string {
	if (value.toLowerCase() === systemLanguagePreference) {
		return systemLanguagePreference;
	}
	return resolveLocaleIdentifier(value).languageTag;
}

export function resolveLocaleIdentifier(
	language: string | null | undefined,
): LocaleIdentifier {
	const languageTag =
		canonicalizeLanguageTag(language) ?? defaultAppSettings.language;
	return {
		languageCode: new Intl.Locale(languageTag).language,
		languageTag,
	};
}

function canonicalizeLanguageTag(
	language: string | null | undefined,
): string | undefined {
	if (typeof language !== "string") return undefined;
	const candidate = language.trim().replaceAll("_", "-");
	if (!candidate) return undefined;
	try {
		return Intl.getCanonicalLocales(candidate)[0];
	} catch {
		return undefined;
	}
}

function isThemePreference(value: unknown): value is ThemePreference {
	return value === "system" || value === "light" || value === "dark";
}

function isTextSize(value: unknown): value is TextSize {
	return value === "small" || value === "standard" || value === "large";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
