import { describe, expect, it } from "vitest";

import {
	createUniqueGameEntityIdFromId,
	createUniqueGameEntityIdFromName,
} from "../src/domain/gameEntityIds";
import { Player, Role, Team } from "../src/domain/models";
import { createTestGame } from "./fixtures";
import {
	createPlayer,
	createRole,
	createTeam,
	editPlayer,
	editRole,
	editTeam,
} from "./sessionEditingTestAdapter";

it("behandelt p_empty als reservierte Player-ID", () => {
	const game = createTestGame();

	expect(createUniqueGameEntityIdFromName("empty", game, "player")).toBe(
		"p_empty_1",
	);
	expect(
		createUniqueGameEntityIdFromName("empty", game, "player", "p_empty"),
	).toBe("p_empty_1");
});

describe("createUniqueGameEntityId", () => {
	it("gibt eine normalisierte freie ID unverändert zurück", () => {
		const game = createTestGame();
		expect(
			createUniqueGameEntityIdFromName("Neue Person", game, "player"),
		).toBe("p_neue_person");
	});

	it.each([
		["Good", "team", "t_good_1"],
		["Seer", "role", "r_seer_1"],
		["p_player1", "player", "p_player1_1"],
	] as const)(
		"erkennt Kollisionen innerhalb eines Bereichs für %j",
		(input, area, expected) => {
			const game = createTestGame();
			expect(createUniqueGameEntityIdFromName(input, game, area)).toBe(
				expected,
			);
		},
	);

	it("behandelt unknown unabhängig vom Spielstand als reserviert", () => {
		const game = createTestGame();
		expect(createUniqueGameEntityIdFromId("t_unknown", game, "team")).toBe(
			"t_unknown_1",
		);
	});

	it("normalisiert oldId und erlaubt die unveränderte eigene ID", () => {
		const game = createTestGame();
		expect(
			createUniqueGameEntityIdFromName("Seer", game, "role", "  R_SEER  "),
		).toBe("r_seer");
		expect(
			createUniqueGameEntityIdFromId("t_unknown", game, "team", "T_UNKNOWN"),
		).toBe("t_unknown");
	});

	it("nimmt die normalisierte oldId vollständig aus der Kollisionsprüfung", () => {
		const game = createTestGame();
		game.ruleSetSnapshot.roles.push(
			new Role({ id: "r_seer_1", name: "Other Seer", teamId: "t_good" }),
		);

		expect(
			createUniqueGameEntityIdFromName("Seer", game, "role", "R_Seer 1"),
		).toBe("r_seer_1");
	});

	it("nummeriert über Kollisionen in verschiedenen Entitätstypen hinweg hoch", () => {
		const game = createTestGame();
		game.ruleSetSnapshot.teams.push(
			new Team({ id: "t_name", name: "Name", teamOrder: 30 }),
		);
		game.ruleSetSnapshot.roles.push(
			new Role({ id: "r_name", name: "Name 1", teamId: "t_good" }),
		);
		game.playersById.p_name = game.playersById.p_player1;

		expect(createUniqueGameEntityIdFromName("Name", game, "team")).toBe(
			"t_name_1",
		);
	});

	it("berücksichtigt auch Player.id bei abweichendem Record-Key", () => {
		const game = createTestGame();
		game.playersById.legacy_key = new Player({
			id: "p_hidden_id",
			name: "Legacy",
		});
		expect(createUniqueGameEntityIdFromName("hidden id", game, "player")).toBe(
			"p_hidden_id_1",
		);
	});

	it("berücksichtigt Statusdefinitionen und Statusinstanzen", () => {
		const game = createTestGame();
		game.statusDefinitionsById.d_poisoned = {
			id: "d_poisoned",
			name: "Poisoned",
		};
		const player = game.playersById.p_player1;
		expect(player).toBeDefined();
		if (!player) return;
		player.statuses.push({
			id: "s_poisoned_1",
			statusId: "d_poisoned",
			fromNight: 1,
			untilNight: 1,
		});

		expect(
			createUniqueGameEntityIdFromId("d_poisoned", game, "statusDefinition"),
		).toBe("d_poisoned_1");
		expect(
			createUniqueGameEntityIdFromId(
				"d_poisoned",
				game,
				"statusInstance",
				undefined,
				true,
			),
		).toBe("s_poisoned_2");
	});

	it("erzwingt optional einen nummerierten Suffix", () => {
		const game = createTestGame();
		expect(
			createUniqueGameEntityIdFromName("fresh", game, "role", undefined, true),
		).toBe("r_fresh_1");
	});

	it("mutiert den Spielstand nicht", () => {
		const game = createTestGame();
		const teamsBefore = game.ruleSetSnapshot.teams.map((team) => team.id);
		const rolesBefore = game.ruleSetSnapshot.roles.map((role) => role.id);
		const playersBefore = Object.keys(game.playersById);

		createUniqueGameEntityIdFromName("Seer", game, "role");

		expect(game.ruleSetSnapshot.teams.map((team) => team.id)).toEqual(
			teamsBefore,
		);
		expect(game.ruleSetSnapshot.roles.map((role) => role.id)).toEqual(
			rolesBefore,
		);
		expect(Object.keys(game.playersById)).toEqual(playersBefore);
	});

	it("wird bei neuen Teams, Rollen und Spielern typübergreifend verwendet", () => {
		const game = createTestGame();
		const teamResult = createTeam(game, { name: "Good" });
		const roleResult = createRole(game, { name: "Seer", teamId: "t_good" });
		const playerResult = createPlayer(game, { name: "player1" });

		expect(teamResult.game.ruleSetSnapshot.teams.at(-1)?.id).toBe("t_good_2");
		expect(roleResult.game.ruleSetSnapshot.roles.at(-1)?.id).toBe("r_seer_2");
		expect(playerResult.game.playersById).toHaveProperty("p_player1_1");
		expect(playerResult.warnings).toContainEqual(
			expect.objectContaining({ code: "DUPLICATE_ID_RENUMBERED" }),
		);
	});

	it("leitet bei Bearbeitungen die ID aus dem endgültigen Namen ab", () => {
		const game = createTestGame();

		expect(
			editTeam(game, { teamId: "t_good", name: "Townsfolk" }).game
				.ruleSetSnapshot.teams[0]?.id,
		).toBe("t_townsfolk");
		expect(
			editRole(game, {
				roleId: "r_seer",
				name: "Oracle",
			}).game.ruleSetSnapshot.roles.find((role) => role.name === "Seer")?.id,
		).toBeUndefined();
		expect(
			editRole(game, {
				roleId: "r_seer",
				name: "Oracle",
			}).game.ruleSetSnapshot.roles.find((role) => role.name === "Oracle")?.id,
		).toBe("r_oracle");
		expect(
			editPlayer(game, { playerId: "p_player1", name: "Alice" }).game
				.playersById,
		).toHaveProperty("p_alice");
	});

	it("ändert bei reiner Rollenumbenennung ID und Referenzen", () => {
		const game = createTestGame();
		const player = game.playersById.p_player1;
		if (!player) throw new Error("Testspieler fehlt.");
		player.roles.actualRoleId = "r_seer";
		game.rolesForShowing = {
			roles: ["r_seer", "r_seer"],
			showRoleSymbols: false,
		};

		const result = editRole(game, { roleId: "r_seer", name: "Oracle" });

		expect(
			result.game.ruleSetSnapshot.roles.find(({ name }) => name === "Oracle")
				?.id,
		).toBe("r_oracle");
		expect(result.game.playersById.p_player1?.roles.actualRoleId).toBe(
			"r_oracle",
		);
		expect(result.game.rolesForShowing?.roles).toEqual([
			"r_oracle",
			"r_oracle",
		]);
	});

	it("führt eine namensbasiert geänderte Rollen-ID kollisionsfrei in Referenzen mit", () => {
		const game = createTestGame();
		game.ruleSetSnapshot.roles.push(
			new Role({ id: "r_oracle", name: "Guardian", teamId: "t_good" }),
		);
		const player = game.playersById.p_player1;
		expect(player).toBeDefined();
		if (!player) return;
		player.roles = {
			actualRoleId: "r_seer",
			shownRoleIds: ["r_seer"],
			nightRoleId: "r_seer",
			claimedRoleId: "r_seer",
		};
		game.rolesForShowing = {
			roles: ["r_seer", "r_wolf", "r_seer"],
			showRoleSymbols: false,
		};

		const result = editRole(game, {
			roleId: "r_seer",
			name: "Oracle",
		});
		const renamedRole = result.game.ruleSetSnapshot.roles.find(
			(role) => role.name === "Oracle",
		);

		expect(renamedRole?.id).toBe("r_oracle_1");
		expect(result.game.playersById.p_player1?.roles).toEqual({
			actualRoleId: "r_oracle_1",
			shownRoleIds: ["r_oracle_1"],
			nightRoleId: "r_oracle_1",
			claimedRoleId: "r_oracle_1",
		});
		expect(result.game.rolesForShowing?.roles).toEqual([
			"r_oracle_1",
			"r_wolf",
			"r_oracle_1",
		]);
		expect(result.warnings).toContainEqual(
			expect.objectContaining({ code: "DUPLICATE_ID_RENUMBERED" }),
		);
	});
});
