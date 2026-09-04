import { describe, expect, it } from "vitest";

import {
	getDisplayName,
	normalizeLocalizedNameLanguageTag,
} from "../src/domain/localizedNames";

describe("getDisplayName", () => {
	it("zeigt den Namen der ausgewählten Sprache an", () => {
		const role = {
			name: "Empath",
			names: { de: "Empath", fr: "  Empathe  ", ja: "エンパス" },
		};

		expect(getDisplayName(role, "fr")).toBe("Empathe");
		expect(getDisplayName(role, "ja")).toBe("エンパス");
	});

	it("fällt bei einer fehlenden oder leeren Übersetzung auf name zurück", () => {
		const role = {
			name: "Empath",
			names: { de: "Empath", fr: "   " },
		};

		expect(getDisplayName(role, "he")).toBe("Empath");
		expect(getDisplayName(role, "fr")).toBe("Empath");
	});

	it("verwendet zuerst den vollständigen Sprach-Tag und dann den Sprachcode", () => {
		const role = {
			name: "Empath",
			names: {
				en: "Empath base",
				"en-GB": "Empath British",
			},
		};

		expect(getDisplayName(role, "en-GB")).toBe("Empath British");
		expect(getDisplayName(role, "en-US")).toBe("Empath base");
		expect(getDisplayName(role, "fr-FR")).toBe("Empath");
	});

	it("normalisiert Regions- und Schrift-Endungen unterschiedlich", () => {
		expect(normalizeLocalizedNameLanguageTag("EN-us")).toBe("en-US");
		expect(normalizeLocalizedNameLanguageTag("de_at")).toBe("de-AT");
		expect(normalizeLocalizedNameLanguageTag("IU-cans")).toBe("iu-Cans");
		expect(normalizeLocalizedNameLanguageTag("IU-LATN")).toBe("iu-Latn");
		expect(normalizeLocalizedNameLanguageTag("FR")).toBe("fr");
	});
});

describe("unveränderliche gespeicherte Namen", () => {
	it("ändert weder name noch names des übergebenen Objekts", () => {
		const role = {
			name: "Empath",
			names: { fr: "  Empathe  " },
		};
		const originalNames = role.names;

		expect(getDisplayName(role, "fr")).toBe("Empathe");
		expect(role.name).toBe("Empath");
		expect(role.names).toBe(originalNames);
		expect(role.names.fr).toBe("  Empathe  ");
	});
});
