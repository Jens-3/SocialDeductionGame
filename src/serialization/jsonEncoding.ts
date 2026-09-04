// src/serialization/jsonEncoding.ts

import { sanitizeText } from "../shared/textSanitizer";
import {
	isSerializationOperationError,
	serializationFailure,
} from "./serializationFailure";

export type AnsiJsonEncoding =
	| "windows-1250"
	| "windows-1251"
	| "windows-1252"
	| "windows-1253"
	| "windows-1254"
	| "windows-1255"
	| "windows-1256"
	| "windows-1257"
	| "windows-1258";

export type JsonEncoding =
	| "utf-8"
	| "utf-16le"
	| "utf-16be"
	| "utf-32le"
	| "utf-32be"
	| AnsiJsonEncoding;

export type DecodedJsonBytes = {
	text: string;
	encoding: JsonEncoding;
	hadBom: boolean;
};

/** Kodiert Text als UTF-8 ohne BOM. */
export function encodeUtf8(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

/**
 * Erkennt die Unicode-Kodierung eines JSON-Bytearrays, entfernt ein
 * vorhandenes BOM und dekodiert den Inhalt. Ohne BOM oder eindeutiges
 * Nullbyte-Muster wird UTF-8 angenommen.
 */
export function decodeJsonBytes(
	bytes: Uint8Array,
	locale = "de",
): DecodedJsonBytes {
	try {
		const detection = detectJsonEncoding(bytes, locale);
		const content = bytes.subarray(detection.bomLength);
		const text = detection.encoding.startsWith("utf-32")
			? decodeUtf32(content, detection.encoding === "utf-32le")
			: new TextDecoder(detection.encoding, { fatal: true }).decode(content);

		return {
			text: sanitizeText(text, { preserveLineBreaks: true }),
			encoding: detection.encoding,
			hadBom: detection.bomLength > 0,
		};
	} catch (error) {
		if (isSerializationOperationError(error)) throw error;
		throw serializationFailure(
			"decode",
			"encodingFailure",
			false,
			error instanceof Error ? error.message : undefined,
		);
	}
}

const LANGUAGE_ENCODINGS: Readonly<Partial<Record<string, AnsiJsonEncoding>>> =
	{
		pl: "windows-1250",
		cs: "windows-1250",
		sk: "windows-1250",
		hu: "windows-1250",
		sl: "windows-1250",
		hr: "windows-1250",
		ro: "windows-1250",
		sq: "windows-1250",
		bs: "windows-1250",
		ru: "windows-1251",
		uk: "windows-1251",
		bg: "windows-1251",
		be: "windows-1251",
		mk: "windows-1251",
		sr: "windows-1251",
		kk: "windows-1251",
		ky: "windows-1251",
		mn: "windows-1251",
		tg: "windows-1251",
		tt: "windows-1251",
		ba: "windows-1251",
		el: "windows-1253",
		tr: "windows-1254",
		az: "windows-1254",
		crh: "windows-1254",
		he: "windows-1255",
		iw: "windows-1255",
		ar: "windows-1256",
		fa: "windows-1256",
		ur: "windows-1256",
		ps: "windows-1256",
		sd: "windows-1256",
		et: "windows-1257",
		lv: "windows-1257",
		lt: "windows-1257",
		vi: "windows-1258",
	};

const SCRIPT_ENCODINGS: Readonly<Partial<Record<string, AnsiJsonEncoding>>> = {
	cyrl: "windows-1251",
	grek: "windows-1253",
	hebr: "windows-1255",
	arab: "windows-1256",
};

const LANGUAGE_SCRIPT_ENCODINGS: Readonly<
	Partial<Record<string, AnsiJsonEncoding>>
> = {
	"sr-latn": "windows-1250",
	"az-latn": "windows-1254",
	"crh-latn": "windows-1254",
};

/** Schätzt die ANSI-Kodierung anhand der Spracheinstellung. */
export function getAnsiEncodingForLocale(locale: string): AnsiJsonEncoding {
	const subtags = locale.trim().toLowerCase().replaceAll("_", "-").split("-");
	const language = subtags[0] ?? "";
	const script = subtags.slice(1).find((subtag) => /^[a-z]{4}$/u.test(subtag));

	if (script) {
		const specialEncoding = LANGUAGE_SCRIPT_ENCODINGS[`${language}-${script}`];
		if (specialEncoding) return specialEncoding;

		const scriptEncoding = SCRIPT_ENCODINGS[script];
		if (scriptEncoding) return scriptEncoding;
	}

	return LANGUAGE_ENCODINGS[language] ?? "windows-1252";
}

function detectJsonEncoding(
	bytes: Uint8Array,
	locale: string,
): {
	encoding: JsonEncoding;
	bomLength: number;
} {
	if (startsWith(bytes, [0x00, 0x00, 0xfe, 0xff])) {
		return { encoding: "utf-32be", bomLength: 4 };
	}
	if (startsWith(bytes, [0xff, 0xfe, 0x00, 0x00])) {
		return { encoding: "utf-32le", bomLength: 4 };
	}
	if (startsWith(bytes, [0xef, 0xbb, 0xbf])) {
		return { encoding: "utf-8", bomLength: 3 };
	}
	if (startsWith(bytes, [0xfe, 0xff])) {
		return { encoding: "utf-16be", bomLength: 2 };
	}
	if (startsWith(bytes, [0xff, 0xfe])) {
		return { encoding: "utf-16le", bomLength: 2 };
	}

	if (bytes.length >= 4) {
		const [byte0, byte1, byte2, byte3] = bytes;
		if (byte0 === 0 && byte1 === 0 && byte2 === 0 && byte3 !== 0) {
			return { encoding: "utf-32be", bomLength: 0 };
		}
		if (byte0 !== 0 && byte1 === 0 && byte2 === 0 && byte3 === 0) {
			return { encoding: "utf-32le", bomLength: 0 };
		}
		if (byte0 === 0 && byte1 !== 0 && byte2 === 0 && byte3 !== 0) {
			return { encoding: "utf-16be", bomLength: 0 };
		}
		if (byte0 !== 0 && byte1 === 0 && byte2 !== 0 && byte3 === 0) {
			return { encoding: "utf-16le", bomLength: 0 };
		}
	}

	try {
		new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		return { encoding: "utf-8", bomLength: 0 };
	} catch {
		return { encoding: getAnsiEncodingForLocale(locale), bomLength: 0 };
	}
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
	return (
		bytes.length >= prefix.length &&
		prefix.every((byte, index) => bytes[index] === byte)
	);
}

function decodeUtf32(bytes: Uint8Array, littleEndian: boolean): string {
	if (bytes.length % 4 !== 0) {
		throw serializationFailure(
			"decode",
			"encodingFailure",
			false,
			undefined,
			"UTF-32-JSON enthält keine vollständige Anzahl von 4-Byte-Zeichen.",
		);
	}

	let result = "";
	for (let index = 0; index < bytes.length; index += 4) {
		const codePoint = littleEndian
			? (bytes[index] ?? 0) |
				((bytes[index + 1] ?? 0) << 8) |
				((bytes[index + 2] ?? 0) << 16) |
				((bytes[index + 3] ?? 0) << 24)
			: ((bytes[index] ?? 0) << 24) |
				((bytes[index + 1] ?? 0) << 16) |
				((bytes[index + 2] ?? 0) << 8) |
				(bytes[index + 3] ?? 0);

		if (
			codePoint < 0 ||
			codePoint > 0x10ffff ||
			(codePoint >= 0xd800 && codePoint <= 0xdfff)
		) {
			throw serializationFailure(
				"decode",
				"encodingFailure",
				false,
				undefined,
				"UTF-32-JSON enthält einen ungültigen Unicode-Codepunkt.",
			);
		}
		result += String.fromCodePoint(codePoint);
	}

	return result;
}
