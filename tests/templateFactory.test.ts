import { describe, expect, it } from "vitest";
import { toHexColor } from "../src/domain/color";
import {
	convertTemplateToGame,
	hydrateGameState,
} from "../src/domain/gameValidation";
import { Role, Team } from "../src/domain/models";
import { createTemplateFromGame } from "../src/domain/templateFactory";
import { decodeCurrentGameDocument } from "../src/serialization/gameDocumentFormat";
import { createGameExportDocument } from "../src/serialization/gameExport";
import { createFixedDomainServices, fixedDomainServices } from "./fixedClock";
import { createTestGame } from "./fixtures";

describe("Vorlagen mit freien Sitzplätzen", () => {
	it("anonymisiert ein Savegame zum fachlich neutralen Template", () => {
		const game = createTestGame(2);
		const firstPlayer = game.playersById.p_player1;
		const secondPlayer = game.playersById.p_player2;
		if (!firstPlayer || !secondPlayer) throw new Error("Testspieler fehlen.");

		game.ruleSetSnapshot.teams[0] = new Team({
			id: "t_good",
			name: "Good",
			names: { de: "Gut" },
			color: "123456",
			teamOrder: 7,
		});
		game.ruleSetSnapshot.roles[0] = new Role({
			id: "r_seer",
			name: "Seer",
			names: { de: "Seherin" },
			teamId: "t_good",
			night: { first: { order: 2 }, other: { order: 4 } },
			isUnique: true,
		});
		const statusDefinition = {
			id: "d_marked",
			name: "Marked",
			names: { de: "Markiert" },
			defaultDuration: 2,
		};
		game.ruleSetSnapshot.statuses = [statusDefinition];
		game.statusDefinitionsById = { d_marked: statusDefinition };

		firstPlayer.name = "Alice Example";
		firstPlayer.names = { de: "Alice Beispiel" };
		firstPlayer.color = toHexColor("AABBCC");
		firstPlayer.lifeState = "dead_vote_spent";
		firstPlayer.removed = { night: 2, phase: "day" };
		firstPlayer.roles = {
			actualRoleId: "r_seer",
			shownRoleIds: ["r_villager"],
			nightRoleId: "r_seer",
			claimedRoleId: "r_villager",
		};
		firstPlayer.statuses = [
			{
				id: "status_1",
				statusId: "d_marked",
				fromNight: 1,
				untilNight: 3,
			},
		];
		secondPlayer.name = "Bob Example";
		secondPlayer.names = { de: "Bob Beispiel" };
		secondPlayer.color = toHexColor("112233");
		secondPlayer.lifeState = "doubledead_vote_available";
		secondPlayer.roles = {
			actualRoleId: "r_villager",
			shownRoleIds: ["r_villager"],
			nightRoleId: "r_villager",
		};
		secondPlayer.statuses = [
			{
				id: "status_2",
				statusId: "d_marked",
				fromNight: 0,
				untilNight: null,
			},
		];
		game.time = { currentNight: 3, phase: "night" };
		game.log = [
			{
				id: "log_1",
				night: 3,
				phase: "night",
				createdAt: "2026-07-14T11:00:00.000Z",
				type: "test",
				text: "Darf nicht im Template bleiben",
			},
		];

		const originalRoles = game.ruleSetSnapshot.roles.map((role) => ({
			id: role.id,
			name: role.name,
			teamId: role.teamId,
			night: structuredClone(role.night),
		}));
		const originalTeams = game.ruleSetSnapshot.teams.map((team) => ({
			id: team.id,
			name: team.name,
			teamOrder: team.teamOrder,
			color: team.color,
		}));
		const originalDefinitions = Object.values(game.statusDefinitionsById).map(
			(definition) => ({ id: definition.id, name: definition.name }),
		);
		const originalPlayerRoles = {
			"Alice Example": structuredClone(firstPlayer.roles),
			"Bob Example": structuredClone(secondPlayer.roles),
		};
		const aliceId = "p_player1";
		const bobId = "p_player2";

		const { template } = createTemplateFromGame({
			services: fixedDomainServices,
			game,
		});

		expect(template.isTemplate).toBe(true);
		expect(template.time).toEqual({ currentNight: 0, phase: "setup" });
		expect(template.log).toEqual([]);
		expect(
			template.ruleSetSnapshot.roles.map((role) => ({
				id: role.id,
				name: role.name,
				teamId: role.teamId,
				night: role.night,
			})),
		).toEqual(originalRoles);
		expect(
			template.ruleSetSnapshot.teams.map((team) => ({
				id: team.id,
				name: team.name,
				teamOrder: team.teamOrder,
				color: team.color,
			})),
		).toEqual(originalTeams);
		expect(
			Object.values(template.statusDefinitionsById).map((definition) => ({
				id: definition.id,
				name: definition.name,
			})),
		).toEqual(originalDefinitions);
		expect(template.seatOrder).toEqual([aliceId, bobId]);
		expect(Object.keys(template.playersById)).toEqual([aliceId, bobId]);

		const alice = template.playersById[aliceId];
		const bob = template.playersById[bobId];
		expect(alice).toEqual(
			expect.objectContaining({
				id: aliceId,
				name: "Player 1",
				color: "AABBCC",
				lifeState: "alive",
				roles: originalPlayerRoles["Alice Example"],
			}),
		);
		expect(bob).toEqual(
			expect.objectContaining({
				id: bobId,
				name: "Player 2",
				color: "112233",
				lifeState: "alive",
				roles: originalPlayerRoles["Bob Example"],
			}),
		);
		expect(alice?.names).toBeUndefined();
		expect(bob?.names).toBeUndefined();
		expect(alice?.removed).toBeUndefined();
		expect(bob?.removed).toBeUndefined();
	});

	it("ordnet archivierte und nicht sitzende Spieler deterministisch hinter den Sitzplätzen ein", () => {
		const game = createTestGame(5);
		game.seatOrder = ["p_player1", "p_empty", "p_player2"];
		const third = game.playersById.p_player3;
		const fourth = game.playersById.p_player4;
		const fifth = game.playersById.p_player5;
		if (!third || !fourth || !fifth) throw new Error("Testspieler fehlen.");
		third.removed = { night: 2, phase: "day" };
		fifth.removed = { night: 1, phase: "night" };

		const result = createTemplateFromGame({
			services: fixedDomainServices,
			game,
		});

		expect(result.template.seatOrder).toEqual([
			"p_player1",
			"p_empty",
			"p_player3",
			"p_player4",
			"p_player5",
			"p_player6",
		]);
		expect(
			result.template.seatOrder.map(
				(id) => result.template.playersById[id]?.name ?? id,
			),
		).toEqual([
			"Player 1",
			"p_empty",
			"Player 3",
			"Player 4",
			"Player 5",
			"Player 6",
		]);
		expect(result.warnings.map(({ code }) => code)).toEqual([
			"ARCHIVED_PLAYER_REINSERTED",
			"ARCHIVED_PLAYER_REINSERTED",
			"UNSEATED_PLAYER_REINSERTED",
		]);
	});

	it("ändert den Basisnamen und bewahrt lokalisierte Namen ohne Rename-Sprache", () => {
		const game = createTestGame(1);
		game.name = "Abendrunde";
		game.names = { en: "Evening game" };

		const result = createTemplateFromGame({
			services: createFixedDomainServices("2026-08-09T10:11:12.000Z"),
			game,
			language: "en",
			name: "Reusable setup",
		});

		expect(result.template).toMatchObject({
			id: "template_reusable_setup",
			name: "Reusable setup",
			names: { en: "Evening game" },
			createdAt: "2026-08-09T10:11:12.000Z",
			isTemplate: true,
		});
		expect(result.message).toBe(
			"Vorlage Evening game aus Spielstand Evening game erstellt.",
		);
	});

	it("erstellt und repariert die Vorlage ohne das Quellspiel zu verändern", () => {
		const game = createTestGame(2);
		(game.ruleSetSnapshot.teams[0] as { id: string }).id = "Ungültiges Team";
		const role = game.ruleSetSnapshot.roles[0];
		if (!role) throw new Error("Testrolle fehlt.");
		role.teamId = "Ungültiges Team";
		const sourceSnapshot = structuredClone(game);

		const result = createTemplateFromGame({
			services: fixedDomainServices,
			game,
		});

		expect(game).toEqual(sourceSnapshot);
		expect(result.template.ruleSetSnapshot).not.toBe(game.ruleSetSnapshot);
		expect(result.template.playersById).not.toBe(game.playersById);
		expect(result.template.ruleSetSnapshot.teams[0]?.id).toBe(
			"t_ungultiges_team",
		);
		expect(result.warnings).toContainEqual(
			expect.objectContaining({ code: "IDS_REPAIRED" }),
		);
	});

	it("bewahrt mehrfaches p_empty beim Erstellen einer Vorlage", () => {
		const game = createTestGame(2);
		game.seatOrder = ["p_player1", "p_empty", "p_empty", "p_player2"];

		const { template } = createTemplateFromGame({
			services: createFixedDomainServices("2026-07-14T12:00:00.000Z"),
			game,
		});

		expect(template.seatOrder).toEqual([
			"p_player1",
			"p_empty",
			"p_empty",
			"p_player4",
		]);
		expect(template.playersById.p_empty).toBeUndefined();
		expect(template).not.toHaveProperty("fileType");
		expect(template).not.toHaveProperty("schemaVersion");
		expect(Object.keys(template.playersById)).toEqual([
			"p_player1",
			"p_player4",
		]);
	});

	it("stellt freie Sitzplätze beim Laden einer Vorlage wieder her", () => {
		const game = createTestGame(2);
		game.seatOrder = ["p_player1", "p_empty", "p_empty", "p_player2"];
		const template = createTemplateFromGame({
			services: fixedDomainServices,
			game,
		}).template;

		const loaded = convertTemplateToGame(
			hydrateGameState(
				decodeCurrentGameDocument(
					JSON.parse(JSON.stringify(createGameExportDocument(template))),
				),
			),
		);

		expect(loaded.seatOrder).toEqual(template.seatOrder);
		expect(loaded.playersById.p_empty).toBeUndefined();
		expect(Object.keys(loaded.playersById)).toEqual(["p_player1", "p_player4"]);
	});
});
