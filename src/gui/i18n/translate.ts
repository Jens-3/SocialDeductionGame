import type { GuiTranslationKey } from "./de";
import type { GuiTranslationMessage } from "./messages";
import { selectGuiPluralCategory } from "./pluralRules";
import {
	guiMessagesByLanguageTag,
	isGuiLanguageLoaded,
	loadGuiMessages,
	type SupportedGuiLanguageTag,
	supportedGuiLanguageTags,
} from "./registry";

export type GuiTranslationParameters = Readonly<
	Record<string, string | number>
>;

export type GuiTranslator = (
	key: GuiTranslationKey,
	parameters?: GuiTranslationParameters,
) => string;

export type ResolvedGuiLocale = Readonly<{
	languageCode: string;
	languageTag: string;
	translationTag: SupportedGuiLanguageTag;
}>;

const defaultLanguageTag = "en" satisfies SupportedGuiLanguageTag;
const supportedTagByLowerCase = new Map(
	supportedGuiLanguageTags.map((tag) => [tag.toLowerCase(), tag]),
);

export function createGuiTranslator(language: string): GuiTranslator {
	const locale = resolveGuiLocale(language);
	const messages =
		guiMessagesByLanguageTag[locale.translationTag] ??
		guiMessagesByLanguageTag[defaultLanguageTag];
	if (!messages) throw new Error("Default GUI language is not loaded");
	return (key, parameters) =>
		formatGuiMessage(
			messages[key],
			locale.languageTag,
			parameters,
			locale.translationTag,
		);
}

export async function loadGuiLanguage(language: string): Promise<void> {
	await loadGuiMessages(resolveGuiLocale(language).translationTag);
}

export function isGuiLanguageAvailable(language: string): boolean {
	return isGuiLanguageLoaded(resolveGuiLocale(language).translationTag);
}

export function normalizeGuiLanguage(
	language: string,
): SupportedGuiLanguageTag {
	return resolveGuiLocale(language).translationTag;
}

export function resolveGuiLocale(
	language: string | null | undefined,
): ResolvedGuiLocale {
	const localeIdentifier = resolveGuiLocaleIdentifier(language);
	const locale = new Intl.Locale(localeIdentifier.languageTag);
	let candidate = locale.baseName;

	while (candidate) {
		const translationTag = supportedTagByLowerCase.get(candidate.toLowerCase());
		if (translationTag) {
			return {
				...localeIdentifier,
				translationTag,
			};
		}
		const separator = candidate.lastIndexOf("-");
		if (separator < 0) break;
		candidate = candidate.slice(0, separator);
	}

	return {
		...localeIdentifier,
		translationTag: defaultLanguageTag,
	};
}

function resolveGuiLocaleIdentifier(
	language: string | null | undefined,
): Pick<ResolvedGuiLocale, "languageCode" | "languageTag"> {
	const languageTag = canonicalizeLanguageTag(language) ?? defaultLanguageTag;
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

export function formatGuiMessage(
	message: GuiTranslationMessage,
	language: string,
	parameters?: GuiTranslationParameters,
	pluralLanguage = language,
): string {
	const template =
		typeof message === "string"
			? message
			: selectPluralTemplate(message, pluralLanguage, parameters);
	return interpolate(template, language, parameters);
}

function selectPluralTemplate(
	message: Exclude<GuiTranslationMessage, string>,
	language: string,
	parameters: GuiTranslationParameters | undefined,
): string {
	const count = parameters?.count;
	if (typeof count !== "number" || !Number.isFinite(count)) {
		return message.plural.other;
	}
	const category = selectGuiPluralCategory(language, count);
	return message.plural[category] ?? message.plural.other;
}

function interpolate(
	message: string,
	language: string,
	parameters: GuiTranslationParameters | undefined,
): string {
	if (!parameters) return message;
	const numberFormat = new Intl.NumberFormat(language);
	return message.replace(/\{([^{}]+)\}/gu, (placeholder, key: string) => {
		if (!Object.hasOwn(parameters, key)) return placeholder;
		const value = parameters[key];
		return typeof value === "number" ? numberFormat.format(value) : value;
	});
}
