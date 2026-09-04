declare const instantBrand: unique symbol;

/** Kanonischer UTC-Zeitpunkt im Format YYYY-MM-DDTHH:mm:ss.sssZ. */
export type Instant = string & { readonly [instantBrand]: true };

const canonicalInstantPattern =
	/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/u;

export function createInstant(value: string): Instant {
	const milliseconds = Date.parse(value);
	if (
		!canonicalInstantPattern.test(value) ||
		Number.isNaN(milliseconds) ||
		new Date(milliseconds).toISOString() !== value
	) {
		throw new Error(
			'Instant muss das UTC-Format "YYYY-MM-DDTHH:mm:ss.sssZ" verwenden.',
		);
	}
	return value as Instant;
}
