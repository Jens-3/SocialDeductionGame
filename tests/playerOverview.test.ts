import { describe, expect, it } from "vitest";
import { createPlayerOverview } from "../src/application/playerOverview";
import type { GameState } from "../src/domain/gameFactory";
import { createTestGame } from "./fixtures";

function createOverviewGame(): GameState {
	const game = createTestGame(4);
	const [seer, villager, wolf] = game.ruleSetSnapshot.roles;
	const first = game.playersById.p_player1;
	const second = game.playersById.p_player2;
	const third = game.playersById.p_player3;
	const fourth = game.playersById.p_player4;
	if (!seer || !villager || !wolf || !first || !second || !third || !fourth) {
		throw new Error("Unvollständige Übersichts-Testdaten.");
	}

	seer.setFirstNightAction(2);
	seer.setOtherNightAction(5);
	wolf.setFirstNightAction(1);
	wolf.setOtherNightAction(3);
	first.name = "Player 10";
	first.roles = {
		actualRoleId: seer.id,
		shownRoleIds: [villager.id, wolf.id],
		nightRoleId: wolf.id,
	};
	second.name = "Player 2";
	second.roles = {
		actualRoleId: wolf.id,
		shownRoleIds: [wolf.id],
		nightRoleId: wolf.id,
	};
	second.lifeState = "dead_vote_available";
	third.name = "Alice";
	third.roles = {
		actualRoleId: villager.id,
		shownRoleIds: [villager.id],
		nightRoleId: villager.id,
	};
	fourth.name = "Zed";
	fourth.roles = {
		actualRoleId: wolf.id,
		shownRoleIds: [wolf.id],
		nightRoleId: wolf.id,
	};
	fourth.removed = { night: 1, phase: "day" };
	game.seatOrder = [first.id, second.id, third.id];

	game.statusDefinitionsById = {
		d_marked: { id: "d_marked", name: "Marked", names: { de: "Markiert" } },
	};
	first.statuses = [
		{
			id: "s_active",
			statusId: "d_marked",
			fromNight: 1,
			untilNight: null,
		},
	];
	second.statuses = [
		{
			id: "s_expired",
			statusId: "d_unknown",
			fromNight: 0,
			untilNight: 1,
			note: "legacy",
		},
	];
	game.time = { currentNight: 2, phase: "day" };
	return game;
}

function ids(game: GameState, options = {}) {
	return createPlayerOverview(game, options).map((entry) => entry.playerId);
}

describe("createPlayerOverview", () => {
	it("löst tatsächliche, gezeigte und nächtliche Rollen sowie Zustände auf", () => {
		const game = createOverviewGame();

		const first = createPlayerOverview(game).find(
			(entry) => entry.playerId === "p_player1",
		);

		expect(first).toMatchObject({
			playerName: "Player 10",
			seatNumber: 1,
			isDeleted: false,
			actualRole: {
				roleId: "r_seer",
				roleName: "Seer",
				teamId: "t_good",
				teamOrder: 10,
				missingDefinition: false,
			},
			shownRole: { roleId: "r_villager" },
			nightRole: { roleId: "r_wolf" },
			isNightActive: true,
			nightOrder: 3,
			activeStatuses: [
				{
					id: "s_active",
					statusId: "d_marked",
					name: "Markiert",
				},
			],
		});
	});

	it("kennzeichnet unbekannte Rollen- und Teamdefinitionen", () => {
		const game = createOverviewGame();
		const third = game.playersById.p_player3;
		if (!third) throw new Error("Testspieler fehlt.");
		third.roles.actualRoleId = "r_missing";
		third.roles.shownRoleIds = ["r_missing"];
		third.roles.nightRoleId = "r_missing";

		const entry = createPlayerOverview(game).find(
			(candidate) => candidate.playerId === third.id,
		);

		expect(entry?.actualRole).toEqual({
			roleId: "r_missing",
			roleName: "r_missing",
			teamId: null,
			teamName: null,
			teamOrder: null,
			missingDefinition: true,
		});
		expect(entry?.isNightActive).toBe(false);
	});

	it("stellt ein fehlendes Team dar, ohne die vorhandene Rolle als fehlend zu markieren", () => {
		const game = createOverviewGame();
		const seer = game.ruleSetSnapshot.roles.find(({ id }) => id === "r_seer");
		if (!seer) throw new Error("Testrolle fehlt.");
		seer.teamId = "t_missing";

		const entry = createPlayerOverview(game).find(
			(candidate) => candidate.playerId === "p_player1",
		);

		expect(entry?.actualRole).toMatchObject({
			roleId: "r_seer",
			teamId: "t_missing",
			teamName: "t_missing",
			teamOrder: null,
			missingDefinition: false,
		});
	});

	it("lokalisiert Spieler, Rollen, Teams und Statusdefinitionen gemeinsam", () => {
		const game = createOverviewGame();
		const first = game.playersById.p_player1;
		const seer = game.ruleSetSnapshot.roles.find(({ id }) => id === "r_seer");
		const good = game.ruleSetSnapshot.teams.find(({ id }) => id === "t_good");
		if (!first || !seer || !good) throw new Error("Testdaten fehlen.");
		first.names = { en: "First player" };
		seer.names = { en: "Oracle" };
		good.names = { en: "Village" };
		game.statusDefinitionsById.d_marked = {
			...game.statusDefinitionsById.d_marked,
			names: { en: "Tagged" },
		};

		const entry = createPlayerOverview(game, { language: "en" }).find(
			(candidate) => candidate.playerId === first.id,
		);

		expect(entry).toMatchObject({
			playerName: "First player",
			actualRole: { roleName: "Oracle", teamName: "Village" },
			activeStatuses: [{ name: "Tagged" }],
		});
	});

	it("verwendet bei einer fehlenden Statusdefinition deren ID als Anzeigenamen", () => {
		const game = createOverviewGame();
		const entry = createPlayerOverview(game, {
			deletionFilter: "beides",
		}).find((candidate) => candidate.playerId === "p_player2");

		expect(entry?.activeStatuses).toEqual([
			expect.objectContaining({ statusId: "d_unknown", name: "d_unknown" }),
		]);
	});

	it.each([
		["deletionFilter", "nur_geloeschte_personen", ["p_player4"]],
		["lifeStateFilter", "nur_tot", ["p_player2"]],
		[
			"nightActivityFilter",
			"nur_nachtaktiv",
			["p_player1", "p_player2", "p_player4"],
		],
		["teamFilter", "t_good", ["p_player1", "p_player3"]],
		["statusFilter", "nur_mit_zustaenden", ["p_player1", "p_player2"]],
	] as const)("wendet den Filter %s an", (field, value, expectedIds) => {
		const game = createOverviewGame();

		expect(
			ids(game, {
				deletionFilter: "beides",
				[field]: value,
			}),
		).toEqual(expectedIds);
	});

	it("blendet abgelaufene Zustände aus, bevor der Statusfilter greift", () => {
		const game = createOverviewGame();

		expect(
			ids(game, {
				deletionFilter: "beides",
				hideExpiredStatuses: true,
				statusFilter: "nur_mit_zustaenden",
			}),
		).toEqual(["p_player1"]);
	});

	it("kombiniert Filter als Schnittmenge", () => {
		const game = createOverviewGame();

		expect(
			ids(game, {
				deletionFilter: "beides",
				lifeStateFilter: "nur_tot",
				nightActivityFilter: "nur_nachtaktiv",
				teamFilter: "t_evil",
				statusFilter: "nur_mit_zustaenden",
			}),
		).toEqual(["p_player2"]);
	});

	it("behandelt sowohl entfernte als auch nicht sitzende Spieler als gelöscht", () => {
		const game = createOverviewGame();
		const third = game.playersById.p_player3;
		if (!third) throw new Error("Testspieler fehlt.");
		game.seatOrder = ["p_player1", "p_player2"];

		const deleted = createPlayerOverview(game, {
			deletionFilter: "nur_geloeschte_personen",
		});

		expect(deleted.map(({ playerId }) => playerId)).toEqual([
			"p_player3",
			"p_player4",
		]);
		expect(deleted.map(({ seatNumber }) => seatNumber)).toEqual([null, null]);
	});

	it.each([
		["Sitzplatz", ["p_player1", "p_player2", "p_player3", "p_player4"]],
		["Name/Sitzplatz", ["p_player3", "p_player2", "p_player1", "p_player4"]],
		["Rolle/Sitzplatz", ["p_player1", "p_player3", "p_player2", "p_player4"]],
		[
			"Team/Rolle/Sitzplatz",
			["p_player1", "p_player3", "p_player2", "p_player4"],
		],
		[
			"Nachtreihenfolge/Sitzplatz",
			["p_player1", "p_player2", "p_player4", "p_player3"],
		],
	] as const)("sortiert nach %s", (sortOrder, expectedIds) => {
		expect(
			ids(createOverviewGame(), { deletionFilter: "beides", sortOrder }),
		).toEqual(expectedIds);
	});

	it("unterscheidet erste und spätere Nachtaktionen", () => {
		const game = createOverviewGame();
		game.time.currentNight = 1;

		const firstNight = createPlayerOverview(game, {
			deletionFilter: "beides",
			sortOrder: "Nachtreihenfolge/Sitzplatz",
		});

		expect(
			firstNight.map((entry) => [entry.playerId, entry.nightOrder]),
		).toEqual([
			["p_player1", 1],
			["p_player2", 1],
			["p_player4", 1],
			["p_player3", null],
		]);
	});

	it.each([
		["playersById", undefined],
		["seatOrder", undefined],
		["ruleSetSnapshot", undefined],
		["statusDefinitionsById", undefined],
	] as const)("lehnt ein ungültiges Feld %s ab", (field, value) => {
		const game = { ...createOverviewGame(), [field]: value };

		expect(() => createPlayerOverview(game)).toThrow();
	});
});
