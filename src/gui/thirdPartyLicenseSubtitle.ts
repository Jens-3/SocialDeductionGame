import { resolveGuiLocale } from "./i18n/translate";

// Other languages retain the format hint until their wording is translated.
const subtitles: Readonly<Record<string, string>> = {
	de: "Lizenzen der verwendeten Bibliotheken",
	"de-AT": "Lizenzen der verwendeten Bibliotheken",
	"de-CH": "Lizenzen der verwendeten Bibliotheken",
	en: "Licenses of the libraries used",
	"en-US": "Licenses of the libraries used",
	"en-GB": "Licences of the libraries used",
	"en-IN": "Licences of the libraries used",
};

export function thirdPartyLicenseSubtitle(language: string): string {
	return subtitles[resolveGuiLocale(language).translationTag] ?? "HTML / TXT";
}
