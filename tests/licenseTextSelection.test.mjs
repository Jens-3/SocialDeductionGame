import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	convertToAndroidLineEndings,
	ensureTrailingLineBreak,
	isCompleteApache20License,
	normalizeLegalTextForComparison,
	renderNormalizedLegalText,
	selectApache20LicenseFiles,
} from "../scripts/license_text_selection.mjs";

const canonicalText = readFileSync(
	path.join(process.cwd(), "scripts", "license-texts", "Apache-2.0.txt"),
	"utf8",
);
const canonicalFile = {
	name: "Apache-2.0.txt",
	kind: "license",
	text: canonicalText,
};

describe("Apache-2.0-Lizenztextauswahl", () => {
	it("ergänzt ausschließlich einen fehlenden abschließenden Zeilenumbruch", () => {
		expect(ensureTrailingLineBreak("license text")).toBe("license text\n");
		expect(ensureTrailingLineBreak("license text\n")).toBe("license text\n");
		expect(ensureTrailingLineBreak("license text\r\n")).toBe(
			"license text\r\n",
		);
	});

	it("gibt für alle Repräsentanten einer Klasse denselben normalisierten Text aus", () => {
		expect(renderNormalizedLegalText("Lizenz A")).toBe("Lizenz A\n");
		expect(renderNormalizedLegalText("\n\tLizenz A \r\n")).toBe("Lizenz A\n");
	});

	it("konvertiert das fertige Dokument auf Android-/Unix-Zeilenumbrüche", () => {
		expect(convertToAndroidLineEndings("A\r\nB\rC\u2028D\u2029E\n")).toBe(
			"A\nB\nC\nD\nE\n",
		);
	});

	it("vereinheitlicht Zeilenumbrüche und entfernt ausschließlich Rand-Whitespace", () => {
		expect(
			normalizeLegalTextForComparison("\r\n\t\r\nA  B\r\n C \r\n\r\n"),
		).toBe("A  B\n C");
	});

	it("verwendet bei einem inhaltlich identischen Offline-Text die kanonische Datei", () => {
		const offlineFile = {
			name: "LICENSE",
			kind: "license",
			text: `\r\n${canonicalText.replaceAll("\n", "\r\n")}\r\n`,
		};

		expect(selectApache20LicenseFiles([offlineFile], canonicalFile)).toEqual([
			canonicalFile,
		]);
	});

	it("behält einen abweichenden vollständigen Offline-Text bei", () => {
		const individualFile = {
			name: "META-INF/LICENSE.txt",
			kind: "license",
			text: canonicalText.replace(
				"Copyright [yyyy] [name of copyright owner]",
				"Copyright 2026 Example Project",
			),
		};

		expect(isCompleteApache20License(individualFile.text)).toBe(true);
		expect(selectApache20LicenseFiles([individualFile], canonicalFile)).toEqual(
			[individualFile],
		);
	});

	it("verwendet bei einem bloßen Kurz-Header den kanonischen Volltext", () => {
		const headerFile = {
			name: "LICENSE",
			kind: "license",
			text: "Copyright 2026 Example\nSPDX-License-Identifier: Apache-2.0",
		};

		expect(isCompleteApache20License(headerFile.text)).toBe(false);
		expect(selectApache20LicenseFiles([headerFile], canonicalFile)).toEqual([
			canonicalFile,
		]);
	});
});
