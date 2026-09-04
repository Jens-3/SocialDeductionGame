import { describe, expect, it } from "vitest";
import { parseJsonWithDetails } from "../src/serialization/jsonSyntaxError";
import { sanitizeParsedText, sanitizeText } from "../src/shared/textSanitizer";

describe("sanitizeText", () => {
	it("behält Zeilenumbrüche im Dokumentmodus und bereinigt übrige Zeichen", () => {
		expect(
			sanitizeText("erste\r\nzweite\ndritte\tvierte\u202E", {
				preserveLineBreaks: true,
			}),
		).toBe("erste\r\nzweite\ndritte vierte");
	});

	it("ersetzt Zeilenumbrüche im normalen Textmodus", () => {
		expect(sanitizeText("erste\r\nzweite\ndritte\tvierte")).toBe(
			"erste zweite dritte vierte",
		);
	});

	it("bereinigt geparste Schlüssel und Stringwerte rekursiv", () => {
		expect(
			sanitizeParsedText({
				"na\u2061me": "A\u202EB\nC",
				values: ["D\u202EE"],
			}),
		).toEqual({ name: "AB C", values: ["DE"] });
	});

	it("lehnt kollidierende bereinigte Feldnamen ab", () => {
		expect(() =>
			parseJsonWithDetails('{"na\\u2061me":"A","name":"B"}'),
		).toThrow('doppelte Feldnamen: "name"');
	});

	it("bewahrt Parserdetails ohne eine Fehlerposition zu erzwingen", () => {
		try {
			parseJsonWithDetails('{\n  "name": "A\u202E",\n  "roles": }');
			expect.unreachable("Ein Syntaxfehler wurde erwartet.");
		} catch (error) {
			if (!(error instanceof Error) || !("details" in error)) throw error;
			expect(String(error.details)).toContain("Ungültiges JSON");
		}
	});
});
