declare const hexColorBrand: unique symbol;

/** Kanonische RGB-Farbe ohne fuehrendes `#`, zum Beispiel `3A7BD5`. */
export type HexColor = string & { readonly [hexColorBrand]: true };

const HEX_COLOR_PATTERN = /^[0-9A-F]{6}$/;

export function isHexColor(value: string): value is HexColor {
	return HEX_COLOR_PATTERN.test(value);
}

export function toHexColor(
	value: string | undefined,
	label = "color",
): HexColor | undefined {
	if (value === undefined) return undefined;
	if (!isHexColor(value))
		throw new Error(
			`${label} must contain exactly six uppercase hexadecimal characters (0-9, A-F). Received: "${value}"`,
		);
	return value;
}

/** Entfernt erlaubte Trenner und normalisiert anschliessend die Schreibweise. */
export function repairHexColor(value: unknown): HexColor | undefined {
	if (typeof value !== "string") return undefined;
	const upperCase = value
		.replace(/[\s_-]/gu, "")
		.replace(/^#/u, "")
		.toUpperCase();
	return isHexColor(upperCase) ? upperCase : undefined;
}
