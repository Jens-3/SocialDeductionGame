import { describe, expect, it } from "vitest";

import {
	parseRepairableJsonBytes,
	parseRepairableJsonText,
} from "../src/serialization/jsonRepair";

describe("JSON-Reparatur", () => {
	it("sanitisiert dekodierten Text und ergänzt ein fehlendes Anführungszeichen", () => {
		const result = parseRepairableJsonText(
			'{\u202e"name":"Library","notice":"Unvollständig}',
		);

		expect(result).toMatchObject({
			status: "successful",
			value: {
				name: "Library",
				notice: "Unvollständig",
			},
			operations: [{ type: "insertedMissingQuote", position: 41 }],
		});
	});

	it("ergänzt fehlende schließende und öffnende geschweifte Klammern", () => {
		expect(parseRepairableJsonText('{"outer":{"value":1}')).toMatchObject({
			value: { outer: { value: 1 } },
			status: "successful",
			operations: [{ type: "addedClosingBraces", count: 1 }],
		});
		expect(parseRepairableJsonText('"outer":{"value":1}}')).toMatchObject({
			value: { outer: { value: 1 } },
			status: "successful",
			operations: [{ type: "addedOpeningBraces", count: 1 }],
		});
	});

	it("ignoriert maskierte Anführungszeichen und Klammern in Strings", () => {
		const text = '{"notice":"Er sagte: \\"Hallo\\" und zeigte {x}."}';
		expect(parseRepairableJsonText(text)).toEqual({
			status: "successful",
			value: { notice: 'Er sagte: "Hallo" und zeigte {x}.' },
			text,
			operations: [],
		});
	});

	it("erkennt die Kodierung auch im Reparaturpfad", () => {
		const text = '{"name":"Grün"';
		const bytes = Uint8Array.from([
			0xff,
			0xfe,
			...Buffer.from(text, "utf16le"),
		]);
		expect(parseRepairableJsonBytes(bytes, "de")).toMatchObject({
			value: { name: "Grün" },
			status: "successful",
			operations: [{ type: "addedClosingBraces", count: 1 }],
		});
	});

	it("lehnt weiterhin nicht reparierbares JSON ab", () => {
		const result = parseRepairableJsonText("kein JSON");
		expect(result.status).toBe("failed");
		if (result.status !== "failed")
			throw new Error("Reparatur unerwartet erfolgreich");
		expect(result.operations).toEqual([]);
		expect(typeof result.jsonParseReport.message).toBe("string");
	});
});
