import { describe, expect, it } from "vitest";

import { Role, Team } from "../src/domain/models";
import { createStatusDefinition } from "../src/domain/statusDefinitions";
import {
	createIdCandidateFromName,
	createIdFromText,
	createNameFromId,
	createNameFromNameAndId,
	createUniqueId,
	createUniqueIdFromName,
	createUniqueNameAndId,
	findAvailableId,
	normalizeId,
} from "../src/domain/stringSanitizer";
import { sanitizeText } from "../src/shared/textSanitizer";
import { createTestGame } from "./fixtures";

function createBaseId(input: string): string {
	return createIdFromText(input).slice(2);
}

describe("createIdFromText", () => {
	it.each([
		["Alpha Wolf", "alpha_wolf"],
		["  Alpha\tWolf\r\n", "alpha_wolf"],
		["Rot-Gelb & Blau", "rot_gelb_blau"],
		["mehr___Abstand", "mehr_abstand"],
		["123 Start", "x123_start"],
		["🔥", "x"],
		[
			"Ä á à â É è ê ı İ í ì î Ö ó ò ô Ü ú ù û",
			"a_a_a_a_e_e_e_i_i_i_i_i_o_o_o_o_u_u_u_u",
		],
	])("wandelt %j in %j um", (input, expected) => {
		expect(createBaseId(input)).toBe(expected);
	});

	it("liefert immer eine grundsätzlich gültige ID", () => {
		for (const input of ["", "___", "中文", "9", "Name mit Leerzeichen"]) {
			expect(createBaseId(input)).toMatch(/^[a-z][a-z0-9_]*$/);
		}
	});

	it.each([
		["U+0009 CHARACTER TABULATION", "\u0009"],
		["U+000A LINE FEED", "\u000A"],
		["U+000B LINE TABULATION", "\u000B"],
		["U+000C FORM FEED", "\u000C"],
		["U+000D CARRIAGE RETURN", "\u000D"],
		["U+0020 SPACE", "\u0020"],
		["U+00A0 NO-BREAK SPACE", "\u00A0"],
		["U+1680 OGHAM SPACE MARK", "\u1680"],
		["U+2000 EN QUAD", "\u2000"],
		["U+2001 EM QUAD", "\u2001"],
		["U+2002 EN SPACE", "\u2002"],
		["U+2003 EM SPACE", "\u2003"],
		["U+2004 THREE-PER-EM SPACE", "\u2004"],
		["U+2005 FOUR-PER-EM SPACE", "\u2005"],
		["U+2006 SIX-PER-EM SPACE", "\u2006"],
		["U+2007 FIGURE SPACE", "\u2007"],
		["U+2008 PUNCTUATION SPACE", "\u2008"],
		["U+2009 THIN SPACE", "\u2009"],
		["U+200A HAIR SPACE", "\u200A"],
		["U+2028 LINE SEPARATOR", "\u2028"],
		["U+2029 PARAGRAPH SEPARATOR", "\u2029"],
		["U+202F NARROW NO-BREAK SPACE", "\u202F"],
		["U+205F MEDIUM MATHEMATICAL SPACE", "\u205F"],
		["U+3000 IDEOGRAPHIC SPACE", "\u3000"],
		["U+FEFF ZERO WIDTH NO-BREAK SPACE", "\uFEFF"],
	])("behandelt %s als Worttrenner", (_name, character) => {
		expect(createBaseId(`links${character}rechts`)).toBe("links_rechts");
	});

	it.each([
		["U+002D", "\u002D"],
		["U+2010", "\u2010"],
		["U+2011", "\u2011"],
		["U+2012", "\u2012"],
		["U+2013", "\u2013"],
		["U+2014", "\u2014"],
		["U+2043", "\u2043"],
		["U+058A", "\u058A"],
		["U+05BE", "\u05BE"],
		["U+1806", "\u1806"],
	])("behandelt %s als Worttrenner", (_codePoint, character) => {
		expect(createBaseId(`links${character}rechts`)).toBe("links_rechts");
	});

	it.each([
		["äáàâÄÁÀÂ", "aaaaaaaa"],
		["éèêÉÈÊ", "eeeeee"],
		["ıíìîİÍÌÎ", "iiiiiiii"],
		["öóòôÖÓÒÔ", "oooooooo"],
		["üúùûÜÚÙÛ", "uuuuuuuu"],
	])("normalisiert die Akzentgruppe %j", (input, expected) => {
		expect(createBaseId(input)).toBe(expected);
	});

	it("löscht sonstige Nicht-ASCII-Zeichen, ohne neue Worttrenner zu erzeugen", () => {
		expect(createBaseId("links🔥rechts")).toBe("linksrechts");
		expect(createBaseId("a+b/c&d.e'f")).toBe("abcdef");
	});

	it.each([
		["", "x"],
		["___", "x"],
		["42", "x42"],
		["42 Antworten", "x42_antworten"],
	])("verwendet für %j das erwartete x-Präfix", (input, expected) => {
		expect(createBaseId(input)).toBe(expected);
	});

	it("ist idempotent", () => {
		for (const input of ["Alpha Wolf", "Böser—Wolf", "42 Antworten", "🔥"]) {
			const id = createBaseId(input);
			expect(createBaseId(id)).toBe(id);
		}
	});

	it("führt bewusst keine Kollisionsbehandlung durch", () => {
		expect(createBaseId("Alpha Wolf")).toBe(createBaseId("Alpha\tWolf"));
		expect(createBaseId("Alpha Wolf")).toBe("alpha_wolf");
	});

	it("wird einheitlich für Teams, Rollen und Statusdefinitionen verwendet", () => {
		expect(Team.create({ name: "Gute Leute" }).id).toBe("t_gute_leute");
		expect(Role.createIdFromName("Böser-Wolf")).toBe("r_boser_wolf");

		const statusResult = createStatusDefinition(createTestGame(), {
			name: "Sehr Müde",
		});
		expect(statusResult.statusDefinition.id).toBe("d_sehr_mude");
	});

	it("setzt das Präfix passend zum optionalen Bereich", () => {
		expect(createIdFromText("Name", "team")).toBe("t_name");
		expect(createIdFromText("Name", "role")).toBe("r_name");
		expect(createIdFromText("Name", "player")).toBe("p_name");
		expect(createIdFromText("Name", "statusDefinition")).toBe("d_name");
		expect(createIdFromText("Name", "statusInstance")).toBe("s_name");
		expect(createIdFromText("Name", "game")).toBe("game_name");
		expect(createIdFromText("Name", "template")).toBe("template_name");
		expect(createIdFromText("Name", "log")).toBe("log_name");
		expect(createIdFromText("Name", "ruleSet")).toBe("ruleset_name");
		expect(createIdFromText("Name")).toBe("x_name");
	});
});

describe("ID-Erzeugungspipeline", () => {
	it("trennt Namenskandidat, gültige Bereichs-ID und Kollisionsauflösung", () => {
		const candidate = createIdCandidateFromName("Böser Wolf");
		const validId = normalizeId(candidate, "role");
		const unavailableIds = new Set(["r_boser_wolf", "r_boser_wolf_1"]);

		expect(candidate).toBe("Boser_Wolf");
		expect(validId).toBe("r_boser_wolf");
		expect(findAvailableId(validId, unavailableIds)).toEqual({
			id: "r_boser_wolf_2",
			collisionSuffix: 2,
		});
		expect(unavailableIds).toEqual(new Set(["r_boser_wolf", "r_boser_wolf_1"]));
	});

	it("orchestriert die drei ID-Basisschritte", () => {
		expect(
			createUniqueIdFromName(
				"Meine Runde",
				"game",
				new Set(["game_meine_runde"]),
			),
		).toEqual({
			id: "game_meine_runde_1",
			collisionSuffix: 1,
		});
	});

	it("normalisiert vorhandene IDs ohne den Namensschritt", () => {
		expect(
			createUniqueId("R_Meine_Rolle", "role", new Set(["r_meine_rolle"])),
		).toEqual({
			id: "r_meine_rolle_1",
			collisionSuffix: 1,
		});
	});

	it("unterstützt eine ignorierte alte ID und einen erzwungenen Suffix", () => {
		const baseId = normalizeId("Spiel", "game");
		const unavailableIds = new Set([baseId]);

		expect(
			findAvailableId(baseId, unavailableIds, { ignoredId: baseId }),
		).toEqual({ id: baseId });
		expect(
			findAvailableId(baseId, unavailableIds, { forceSuffix: true }),
		).toEqual({ id: "game_spiel_1", collisionSuffix: 1 });
	});

	it("hält Namen und kollisionsfreie ID synchron", () => {
		const identity = createUniqueNameAndId(
			"Meine Runde",
			"game",
			new Set(["game_meine_runde", "game_meine_runde_1"]),
			{ forceSuffix: true },
		);

		expect(identity).toEqual({
			name: "Meine Runde (2)",
			id: "game_meine_runde_2",
		});
	});

	it("ersetzt einen unpassenden alten Namenssuffix und besitzt einen Fallback", () => {
		expect(
			createNameFromNameAndId(
				"Meine Runde (8)",
				{ id: normalizeId("Meine Runde 2", "game"), collisionSuffix: 2 },
				"game",
			),
		).toBe("Meine Runde (2)");
		expect(createNameFromId(normalizeId("Andere ID 2", "game"), "game")).toBe(
			"andere id 2",
		);
	});
});

describe("sanitizeText", () => {
	it.each([
		["U+FEFF", "\uFEFF"],
		["U+FFFE", "\uFFFE"],
		["U+202A bis U+202E", "\u202A\u202B\u202C\u202D\u202E"],
		["U+2061 bis U+2064", "\u2061\u2062\u2063\u2064"],
		["U+206A bis U+206D", "\u206A\u206B\u206C\u206D"],
		["U+17A3 und U+17D3", "\u17A3\u17D3"],
		["U+E0000 bis U+E007F", "\u{E0000}\u{E0001}\u{E0041}\u{E007F}"],
	])("löscht %s", (_label, characters) => {
		expect(sanitizeText(`links${characters}rechts`)).toBe("linksrechts");
	});

	it("behält die bisherige Ersetzung von Tabs und Zeilenumbrüchen bei", () => {
		expect(sanitizeText("a\tb\r\nc")).toBe("a b c");
	});
});
