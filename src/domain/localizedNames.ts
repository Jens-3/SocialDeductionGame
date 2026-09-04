/**
 * Liefert den Namen für die Anzeige, ohne das übergebene Objekt zu verändern.
 */
export function getDisplayName(
	object: { name: string; names?: Record<string, string> },
	language: string,
): string {
	const languageTag = normalizeLocalizedNameLanguageTag(language);
	const languageCode = languageTag.split("-", 1)[0] ?? languageTag;
	return (
		readLocalizedName(object.names, languageTag) ||
		readLocalizedName(object.names, languageCode) ||
		object.name
	);
}

export function normalizeLocalizedNameLanguageTag(language: string): string {
	const parts = language.trim().replaceAll("_", "-").split("-");
	if (parts.length === 1) return (parts[0] ?? "").toLowerCase();
	return parts
		.map((part, index) => {
			const lowerCasePart = part.toLowerCase();
			if (index < parts.length - 1) return lowerCasePart;
			if (lowerCasePart === "cans" || lowerCasePart === "latn") {
				return `${lowerCasePart[0]?.toUpperCase() ?? ""}${lowerCasePart.slice(1)}`;
			}
			return lowerCasePart.toUpperCase();
		})
		.join("-");
}

function readLocalizedName(
	names: Record<string, string> | undefined,
	language: string,
): string | undefined {
	const directMatch = names?.[language]?.trim();
	if (directMatch) return directMatch;
	const normalizedMatch = Object.entries(names ?? {}).find(
		([key, value]) =>
			normalizeLocalizedNameLanguageTag(key) === language &&
			Boolean(value.trim()),
	);
	return normalizedMatch?.[1].trim() || undefined;
}
