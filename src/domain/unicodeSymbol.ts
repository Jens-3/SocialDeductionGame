import { domainFailure } from "./domainFailure";

export type UnicodeRepresentation = {
	unicodeSymbol?: string;
	unicodeEscaped?: string;
};

export function decodeUnicodeEscaped(
	value: string | undefined,
): string | undefined {
	if (!value) return undefined;
	const decoded = value
		.replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_match, hex: string) =>
			String.fromCodePoint(Number.parseInt(hex, 16)),
		)
		.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) =>
			String.fromCharCode(Number.parseInt(hex, 16)),
		)
		.replace(/\\x([0-9a-fA-F]{2})/g, (_match, hex: string) =>
			String.fromCharCode(Number.parseInt(hex, 16)),
		)
		.trim();
	return decoded || undefined;
}

export function encodeUnicodeSymbol(
	value: string | undefined,
): string | undefined {
	const symbol = value?.trim();
	if (!symbol) return undefined;
	return [...symbol]
		.map(
			(character) =>
				`\\u{${(character.codePointAt(0) ?? 0).toString(16).toUpperCase()}}`,
		)
		.join("");
}

export function normalizeUnicodeRepresentation(
	value: UnicodeRepresentation,
	label: string,
): UnicodeRepresentation {
	const unicodeSymbol = value.unicodeSymbol?.trim() || undefined;
	const unicodeEscaped = value.unicodeEscaped?.trim() || undefined;
	if (unicodeEscaped)
		for (const character of unicodeEscaped)
			if (character.charCodeAt(0) > 127)
				throw domainFailure(
					"validate",
					"invalidObject",
					true,
					`${label}.unicodeEscaped darf nur ASCII-Zeichen enthalten.`,
				);

	let decoded: string | undefined;
	try {
		decoded = decodeUnicodeEscaped(unicodeEscaped);
	} catch (error) {
		if (!(error instanceof RangeError)) throw error;
		throw domainFailure(
			"validate",
			"invalidObject",
			true,
			`${label}.unicodeEscaped enthält kein gültiges Unicode-Escape.`,
		);
	}
	if (unicodeSymbol && decoded && unicodeSymbol !== decoded)
		throw domainFailure(
			"validate",
			"invalidObject",
			true,
			`${label}.unicodeSymbol und ${label}.unicodeEscaped beschreiben nicht dasselbe Unicode-Symbol.`,
		);
	const symbol = unicodeSymbol ?? decoded;
	return {
		unicodeSymbol: symbol,
		unicodeEscaped: unicodeEscaped ?? encodeUnicodeSymbol(symbol),
	};
}
