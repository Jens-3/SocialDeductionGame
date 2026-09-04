import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decodeCurrentLibraryDocument } from "../src/serialization/libraryDocument";

const expectedLanguageTags = [
	"ar",
	"de",
	"en",
	"eo",
	"es",
	"es-419",
	"fr",
	"ha",
	"he",
	"hi",
	"it",
	"ja",
	"ko",
	"pl",
	"pt",
	"ru",
	"sw",
	"tr",
	"uk",
	"zh",
] as const;

describe("lokalisierte Startbibliothek", () => {
	it("enthält für jedes benannte Objekt alle vorgesehenen Sprachen", async () => {
		const source: unknown = JSON.parse(
			await readFile(path.resolve("app-seed/library.json"), "utf8"),
		);
		const library = decodeCurrentLibraryDocument(source);
		const namedObjects = Object.values(library.ruleSetsById).flatMap(
			(ruleSet) => [
				ruleSet,
				...ruleSet.teams,
				...ruleSet.roles,
				...(ruleSet.statuses ?? []),
			],
		);

		expect(namedObjects).toHaveLength(14);
		for (const object of namedObjects) {
			expect(Object.keys(object.names ?? {}), object.id).toEqual(
				expectedLanguageTags,
			);
			for (const languageTag of expectedLanguageTags) {
				const value = object.names?.[languageTag]?.trim();
				expect(value, `${object.id}.${languageTag}`).toBeTruthy();
				expect(value, `${object.id}.${languageTag}`).not.toMatch(
					/[\r\n]|ZXQ(?:SEG|BEGIN|END)|Saukewa:/u,
				);
			}
		}
	});
});
