export type SanitizeTextOptions = {
	preserveLineBreaks?: boolean;
};

/** Bereinigt externen Text deterministisch und ohne fachliche Interpretation. */
export function sanitizeText(
	input: string,
	options: SanitizeTextOptions = {},
): string {
	if (typeof input !== "string")
		throw new Error("sanitizeText erwartet einen String.");
	const preserveLineBreaks = options.preserveLineBreaks === true;
	const normalizedWhitespace = preserveLineBreaks
		? input.replace(/\t/g, " ")
		: input.replace(/\r\n|\r|\n|\t/g, " ");

	return normalizedWhitespace
		.replace(/\p{Cc}/gu, (character) =>
			preserveLineBreaks && (character === "\r" || character === "\n")
				? character
				: "",
		)
		.replace(
			/[\u17A3\u17D3\u202A-\u202E\u2061-\u2064\u206A-\u206D\uFEFF\uFFFE\u{E0000}-\u{E007F}]/gu,
			"",
		);
}

/** Bereinigt nach JSON.parse rekursiv alle Schlüssel und Stringwerte. */
export function sanitizeParsedText(value: unknown): unknown {
	if (typeof value === "string") return sanitizeText(value);
	if (Array.isArray(value)) return value.map(sanitizeParsedText);
	if (typeof value !== "object" || value === null) return value;

	const entries: Array<[string, unknown]> = [];
	const keys = new Set<string>();
	for (const [rawKey, rawValue] of Object.entries(value)) {
		const key = sanitizeText(rawKey);
		if (keys.has(key))
			throw new Error(
				`Durch die Textbereinigung entstehen doppelte Feldnamen: "${key}".`,
			);
		keys.add(key);
		entries.push([key, sanitizeParsedText(rawValue)]);
	}
	return Object.fromEntries(entries);
}
