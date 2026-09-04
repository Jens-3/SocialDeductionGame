import { describe, expect, it } from "vitest";
import { Player, Role, Team } from "../src/domain/models";
import { decodeGameDocument } from "../src/serialization/gameDocument";
import { createGameExportDocument } from "../src/serialization/gameExport";
import { createTestGame } from "./fixtures";

describe("Game-Dokumentdecoder", () => {
	it("dekodiert das vollständige Dokument rekursiv zu klassenfreien Daten", () => {
		const source = createCompleteDocument();

		const decoded = decodeGameDocument(source);

		expect(decoded).toEqual(source);
		expect(decoded.ruleSetSnapshot.teams[0]).not.toBeInstanceOf(Team);
		expect(decoded.ruleSetSnapshot.roles[0]).not.toBeInstanceOf(Role);
		expect(decoded.players[0]).not.toBeInstanceOf(Player);
		expect(decoded).not.toBe(source);
		expect(decoded.players).not.toBe(source.players);
	});

	it("wandelt die einzelne gezeigte Rolle alter Spielstände in eine Liste um", () => {
		const source = createCompleteDocument() as unknown as {
			players: Array<{ roles: Record<string, unknown> }>;
		};
		delete source.players[0].roles.shownRoleIds;
		source.players[0].roles.shownRoleId = "r_seer";

		const decoded = decodeGameDocument(source);

		expect(decoded.players[0].roles.shownRoleIds).toEqual(["r_seer"]);
		expect(decoded.players[0].roles).not.toHaveProperty("shownRoleId");
	});

	it.each([
		["names.de", ["names", "de"], 42, "names.de muss ein String sein"],
		[
			"ruleSetSnapshot.roles",
			["ruleSetSnapshot", "roles"],
			{},
			"roles muss ein Array sein",
		],
		[
			"ruleSetSnapshot.statuses[0].defaultDuration",
			["ruleSetSnapshot", "statuses", 0, "defaultDuration"],
			"0",
			"defaultDuration muss eine Zahl sein",
		],
		[
			"players[0].id",
			["players", 0, "id"],
			1,
			"players[0].id muss ein String sein",
		],
		[
			"players[0].roles.actualRoleId",
			["players", 0, "roles", "actualRoleId"],
			false,
			"actualRoleId muss ein String sein",
		],
		[
			"players[0].statuses[0].untilNight",
			["players", 0, "statuses", 0, "untilNight"],
			"unendlich",
			"untilNight muss eine Zahl sein",
		],
		[
			"players[0].statuses[0].source.playerId",
			["players", 0, "statuses", 0, "source", "playerId"],
			7,
			"source.playerId muss ein String sein",
		],
		[
			"players[0].removed.night",
			["players", 0, "removed", "night"],
			"2",
			"removed.night muss eine Zahl sein",
		],
		["seatOrder[0]", ["seatOrder", 0], 9, "seatOrder[0] muss ein String sein"],
		["time.phase", ["time", "phase"], 1, "time.phase muss ein String sein"],
		[
			"log[0].payload",
			["log", 0, "payload"],
			[],
			"payload muss ein Objekt sein",
		],
		[
			"rolesForShowing.roles[0]",
			["rolesForShowing", "roles", 0],
			true,
			"rolesForShowing.roles[0] muss ein String sein",
		],
	] as const)(
		"lehnt den falschen Feldtyp in %s ab",
		(_label, path, value, message) => {
			const document = createCompleteDocument();
			replaceAtPath(document, path, value);

			expect(() => decodeGameDocument(document)).toThrow(message);
		},
	);

	it("lehnt fehlende Pflichtfelder und unbekannte Felder ab", () => {
		const missing = createCompleteDocument();
		Reflect.deleteProperty(missing.players[0].roles, "nightRoleId");
		expect(() => decodeGameDocument(missing)).toThrow(
			"nightRoleId muss ein String sein",
		);

		const extended = createCompleteDocument();
		Object.assign(extended.players[0], { legacyValue: true });
		expect(() => decodeGameDocument(extended)).toThrow(
			'players[0] enthält ein unbekanntes Feld: "legacyValue"',
		);

		expect(() =>
			decodeGameDocument({
				...createCompleteDocument(),
				statusDefinitionsById: {},
			}),
		).toThrow('Dokument enthält ein unbekanntes Feld: "statusDefinitionsById"');
	});

	it.each([
		["createdAt", ["createdAt"], "createdAt muss ein String sein"],
		["names", ["names"], "names muss ein Objekt sein"],
		["isTemplate", ["isTemplate"], "isTemplate muss boolean sein"],
		[
			"defaultDuration",
			["ruleSetSnapshot", "statuses", 0, "defaultDuration"],
			"defaultDuration muss eine Zahl sein",
		],
		[
			"player.note",
			["players", 0, "note"],
			"players[0].note muss ein String sein",
		],
		[
			"player.removed",
			["players", 0, "removed"],
			"players[0].removed muss ein Objekt sein",
		],
		[
			"rolesForShowing",
			["rolesForShowing"],
			"rolesForShowing muss ein Objekt sein",
		],
	] as const)(
		"lehnt null für das optionale Feld %s ab",
		(_label, path, message) => {
			const document = createCompleteDocument();
			replaceAtPath(document, path, null);

			expect(() => decodeGameDocument(document)).toThrow(message);
		},
	);

	it("akzeptiert playersById nicht als JSON-Ersatz für players", () => {
		const current = createCompleteDocument();
		const previous: Record<string, unknown> = {
			...current,
			playersById: Object.fromEntries(
				current.players.map((player) => [String(player.id), player]),
			),
		};
		Reflect.deleteProperty(previous, "players");

		expect(() => decodeGameDocument(previous)).toThrow(
			'Dokument enthält ein unbekanntes Feld: "playersById"',
		);
	});

	it("dekodiert Feldtypen unabhängig von späteren fachlichen Wertprüfungen", () => {
		const document = createCompleteDocument();
		replaceAtPath(document, ["schemaVersion"], 999);
		document.time = { currentNight: -4, phase: "irgendwann" };
		document.players[0].lifeState = "schlafend";

		const decoded = decodeGameDocument(document);

		expect(decoded.schemaVersion).toBe(999);
		expect(decoded.time).toEqual({ currentNight: -4, phase: "irgendwann" });
		expect(decoded.players[0].lifeState).toBe("schlafend");
	});
});

function createCompleteDocument() {
	const game = createTestGame(1);
	game.id = "game_decoder_contract";
	game.names = { de: "Decoder-Vertrag" };
	game.ruleSetSnapshot.statuses = [
		{
			id: "d_poisoned",
			name: "Poisoned",
			defaultDuration: 0,
		},
	];
	const player = game.playersById.p_player1;
	if (!player) throw new Error("Testfixture ist unvollständig.");
	player.roles = {
		actualRoleId: "r_seer",
		shownRoleIds: ["r_seer"],
		nightRoleId: "r_seer",
		claimedRoleId: "r_seer",
	};
	player.statuses = [
		{
			id: "s_poisoned_1",
			statusId: "d_poisoned",
			fromNight: 1,
			untilNight: null,
			source: { playerId: "p_player1", roleSourceType: "actual" },
			note: "Teststatus",
		},
	];
	player.removed = { night: 2, phase: "day" };
	game.log = [
		{
			id: "log_decoder_contract",
			night: 1,
			phase: "night",
			createdAt: "2026-01-02T04:05:06.000Z",
			type: "contract",
			actor: "storyteller",
			text: "Decoder",
			payload: { playerId: "p_player1" },
		},
	];
	game.rolesForShowing = {
		roles: ["r_seer"],
		notice: "Zeigen",
		showRoleSymbols: true,
	};
	return JSON.parse(
		JSON.stringify(createGameExportDocument(game)),
	) as ReturnType<typeof createGameExportDocument> & {
		players: Array<{
			id: unknown;
			lifeState: unknown;
			roles: Record<string, unknown>;
			statuses: Array<Record<string, unknown>>;
			removed: Record<string, unknown>;
		}>;
		time: { currentNight: number; phase: string };
	};
}

function replaceAtPath(
	root: unknown,
	path: readonly (string | number)[],
	value: unknown,
): void {
	let current = root;
	for (const part of path.slice(0, -1)) {
		if (typeof part === "number") {
			if (!Array.isArray(current)) throw new Error("Array im Testpfad fehlt.");
			current = current[part];
			continue;
		}
		if (typeof current !== "object" || current === null)
			throw new Error("Objekt im Testpfad fehlt.");
		current = (current as Record<string, unknown>)[part];
	}
	const last = path.at(-1);
	if (typeof last === "number") {
		if (!Array.isArray(current))
			throw new Error("Arrayziel im Testpfad fehlt.");
		current[last] = value;
		return;
	}
	if (
		typeof last !== "string" ||
		typeof current !== "object" ||
		current === null
	)
		throw new Error("Objektziel im Testpfad fehlt.");
	(current as Record<string, unknown>)[last] = value;
}
