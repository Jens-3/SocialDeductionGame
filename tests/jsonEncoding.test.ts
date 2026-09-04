import { describe, expect, it } from "vitest";

import {
	decodeJsonBytes,
	getAnsiEncodingForLocale,
	type JsonEncoding,
} from "../src/serialization/jsonEncoding";

const jsonText = '{"text":"毒🍺"}';

describe("decodeJsonBytes", () => {
	it.each<{
		name: string;
		bytes: Uint8Array;
		encoding: JsonEncoding;
		hadBom: boolean;
	}>([
		{
			name: "UTF-8 ohne BOM",
			bytes: new TextEncoder().encode(jsonText),
			encoding: "utf-8",
			hadBom: false,
		},
		{
			name: "UTF-8 mit BOM",
			bytes: prepend([0xef, 0xbb, 0xbf], new TextEncoder().encode(jsonText)),
			encoding: "utf-8",
			hadBom: true,
		},
		{
			name: "UTF-16 LE mit BOM",
			bytes: prepend([0xff, 0xfe], encodeUtf16Le(jsonText)),
			encoding: "utf-16le",
			hadBom: true,
		},
		{
			name: "UTF-16 LE ohne BOM",
			bytes: encodeUtf16Le(jsonText),
			encoding: "utf-16le",
			hadBom: false,
		},
		{
			name: "UTF-16 BE mit BOM",
			bytes: prepend([0xfe, 0xff], encodeUtf16Be(jsonText)),
			encoding: "utf-16be",
			hadBom: true,
		},
		{
			name: "UTF-16 BE ohne BOM",
			bytes: encodeUtf16Be(jsonText),
			encoding: "utf-16be",
			hadBom: false,
		},
		{
			name: "UTF-32 LE mit BOM",
			bytes: prepend([0xff, 0xfe, 0x00, 0x00], encodeUtf32(jsonText, true)),
			encoding: "utf-32le",
			hadBom: true,
		},
		{
			name: "UTF-32 LE ohne BOM",
			bytes: encodeUtf32(jsonText, true),
			encoding: "utf-32le",
			hadBom: false,
		},
		{
			name: "UTF-32 BE mit BOM",
			bytes: prepend([0x00, 0x00, 0xfe, 0xff], encodeUtf32(jsonText, false)),
			encoding: "utf-32be",
			hadBom: true,
		},
		{
			name: "UTF-32 BE ohne BOM",
			bytes: encodeUtf32(jsonText, false),
			encoding: "utf-32be",
			hadBom: false,
		},
	])("dekodiert $name", ({ bytes, encoding, hadBom }) => {
		expect(decodeJsonBytes(bytes)).toEqual({
			text: jsonText,
			encoding,
			hadBom,
		});
	});

	it("nimmt ohne Kennzeichnung standardmäßig UTF-8 an", () => {
		const result = decodeJsonBytes(new TextEncoder().encode("[]"));
		expect(result.encoding).toBe("utf-8");
	});

	it("dekodiert ungültiges UTF-8 anhand einer deutschen Locale als Windows-1252", () => {
		const bytes = Uint8Array.from([
			0x7b, 0x22, 0x74, 0x65, 0x78, 0x74, 0x22, 0x3a, 0x22, 0x47, 0x72, 0xfc,
			0x6e, 0x22, 0x7d,
		]);

		expect(decodeJsonBytes(bytes, "de-DE")).toEqual({
			text: '{"text":"Grün"}',
			encoding: "windows-1252",
			hadBom: false,
		});
	});

	it("dekodiert ungültiges UTF-8 anhand einer russischen Locale als Windows-1251", () => {
		const bytes = Uint8Array.from([
			0x7b, 0x22, 0x74, 0x65, 0x78, 0x74, 0x22, 0x3a, 0x22, 0xcf, 0xf0, 0xe8,
			0xe2, 0xe5, 0xf2, 0x22, 0x7d,
		]);

		expect(decodeJsonBytes(bytes, "ru_RU")).toEqual({
			text: '{"text":"Привет"}',
			encoding: "windows-1251",
			hadBom: false,
		});
	});

	it("bevorzugt gültiges UTF-8 unabhängig von der Locale", () => {
		expect(
			decodeJsonBytes(new TextEncoder().encode(jsonText), "ru").encoding,
		).toBe("utf-8");
	});

	it("lässt ein BOM die Locale überstimmen", () => {
		const result = decodeJsonBytes(
			prepend([0xff, 0xfe], encodeUtf16Le(jsonText)),
			"ru",
		);
		expect(result.encoding).toBe("utf-16le");
	});

	it("verwendet bei einer unbekannten Locale Windows-1252", () => {
		expect(getAnsiEncodingForLocale("xx-YY")).toBe("windows-1252");
	});

	it.each([
		["sq", "windows-1250"],
		["sr-Latn", "windows-1250"],
		["sr-Latn-RS", "windows-1250"],
		["SR_latn_RS", "windows-1250"],
		["mk", "windows-1251"],
		["sr", "windows-1251"],
		["sr-RS", "windows-1251"],
		["sr-Cyrl", "windows-1251"],
		["sr-Cyrl-RS", "windows-1251"],
		["az-Cyrl", "windows-1251"],
		["az_Cyrl_AZ", "windows-1251"],
		["kk", "windows-1251"],
		["ky", "windows-1251"],
		["mn-Mong-MN", "windows-1251"],
		["tg", "windows-1251"],
		["tt", "windows-1251"],
		["ba", "windows-1251"],
		["sv-SE", "windows-1252"],
		["xx-Mong", "windows-1252"],
		["az", "windows-1254"],
		["az-Latn", "windows-1254"],
		["az-Latn-AZ", "windows-1254"],
		["crh", "windows-1254"],
		["crh-Latn-UA", "windows-1254"],
		["he", "windows-1255"],
		["iw", "windows-1255"],
		["ar", "windows-1256"],
		["fa", "windows-1256"],
		["ur", "windows-1256"],
		["ps", "windows-1256"],
		["sd", "windows-1256"],
		["et", "windows-1257"],
		["lv-LV", "windows-1257"],
		["lt_LT", "windows-1257"],
		["vi-VN", "windows-1258"],
	] as const)("ordnet %s eindeutig %s zu", (locale, encoding) => {
		expect(getAnsiEncodingForLocale(locale)).toBe(encoding);
	});

	it("lehnt unvollständiges UTF-32 ab", () => {
		expect(() =>
			decodeJsonBytes(
				Uint8Array.from([0xff, 0xfe, 0x00, 0x00, 0x7b, 0x00, 0x00]),
			),
		).toThrow(/4-Byte-Zeichen/);
	});
});

function prepend(prefix: number[], bytes: Uint8Array): Uint8Array {
	return Uint8Array.from([...prefix, ...bytes]);
}

function encodeUtf16Le(text: string): Uint8Array {
	return Uint8Array.from(Buffer.from(text, "utf16le"));
}

function encodeUtf16Be(text: string): Uint8Array {
	const littleEndian = encodeUtf16Le(text);
	const bigEndian = new Uint8Array(littleEndian.length);
	for (let index = 0; index < littleEndian.length; index += 2) {
		bigEndian[index] = littleEndian[index + 1] ?? 0;
		bigEndian[index + 1] = littleEndian[index] ?? 0;
	}
	return bigEndian;
}

function encodeUtf32(text: string, littleEndian: boolean): Uint8Array {
	const bytes: number[] = [];
	for (const character of text) {
		const codePoint = character.codePointAt(0) ?? 0;
		const encoded = [
			codePoint & 0xff,
			(codePoint >>> 8) & 0xff,
			(codePoint >>> 16) & 0xff,
			(codePoint >>> 24) & 0xff,
		];
		bytes.push(...(littleEndian ? encoded : encoded.reverse()));
	}
	return Uint8Array.from(bytes);
}
