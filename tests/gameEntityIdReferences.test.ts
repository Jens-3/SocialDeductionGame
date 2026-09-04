import { describe, expect, it } from "vitest";
import {
	replaceGameEntityIdReferences,
	replaceStatusDefinitionIdReferences,
} from "../src/domain/gameEntityIdReferences";
import { editStatusDefinition } from "../src/domain/statusDefinitions";
import { createTestGame } from "./fixtures";

describe("replaceGameEntityIdReferences", () => {
	it("aktualisiert Teamreferenzen und strukturierte Logdaten", () => {
		const game = createTestGame();
		game.log.push({
			id: "l_team",
			night: 0,
			phase: "setup",
			createdAt: "2026-01-02T03:04:05.000Z",
			type: "test",
			text: "t_good bleibt als historischer Text erhalten",
			payload: { teamId: "t_good", counts: { t_good: 2 } },
		});

		const updated = replaceGameEntityIdReferences(
			game,
			"team",
			"t_good",
			"t_townsfolk",
		);

		expect(
			updated.ruleSetSnapshot.roles
				.filter((role) => role.id === "r_seer" || role.id === "r_villager")
				.map((role) => role.teamId),
		).toEqual(["t_townsfolk", "t_townsfolk"]);
		expect(updated.log[0]?.payload).toEqual({
			teamId: "t_townsfolk",
			counts: { t_townsfolk: 2 },
		});
		expect(updated.log[0]?.text).toContain("t_good");
	});

	it("aktualisiert sämtliche Rollenreferenzen einschließlich Statusquellen", () => {
		const game = createTestGame();
		const player = game.playersById.p_player1;
		if (!player) throw new Error("Testspieler fehlt.");
		player.roles = {
			actualRoleId: "r_seer",
			shownRoleIds: ["r_seer", "r_wolf"],
			nightRoleId: "r_seer",
			claimedRoleId: "r_seer",
		};
		player.statuses = [
			{
				id: "s_poison_1",
				statusId: "d_poison",
				fromNight: 1,
				untilNight: 2,
				source: { playerId: "p_player1", roleIdAtTime: "r_seer" },
			},
		];
		game.rolesForShowing = {
			roles: ["r_seer", "r_wolf", "r_seer"],
			showRoleSymbols: false,
		};

		const updated = replaceGameEntityIdReferences(
			game,
			"role",
			"r_seer",
			"r_oracle",
		);

		expect(updated.playersById.p_player1?.roles).toEqual({
			actualRoleId: "r_oracle",
			shownRoleIds: ["r_oracle", "r_wolf"],
			nightRoleId: "r_oracle",
			claimedRoleId: "r_oracle",
		});
		expect(
			updated.playersById.p_player1?.statuses[0]?.source?.roleIdAtTime,
		).toBe("r_oracle");
		expect(updated.rolesForShowing?.roles).toEqual([
			"r_oracle",
			"r_wolf",
			"r_oracle",
		]);
	});

	it("aktualisiert Sitzordnung, Statusquellen und Logdaten eines Spielers", () => {
		const game = createTestGame();
		const player = game.playersById.p_player2;
		if (!player) throw new Error("Testspieler fehlt.");
		player.statuses = [
			{
				id: "s_marked_1",
				statusId: "d_marked",
				fromNight: 0,
				untilNight: null,
				source: { playerId: "p_player1" },
			},
		];
		game.log.push({
			id: "l_player",
			night: 0,
			phase: "setup",
			createdAt: "2026-01-02T03:04:05.000Z",
			type: "test",
			text: "Spieler geändert",
			payload: { playerId: "p_player1", players: ["p_player1"] },
		});

		const updated = replaceGameEntityIdReferences(
			game,
			"player",
			"p_player1",
			"p_alice",
		);

		expect(updated.seatOrder).toContain("p_alice");
		expect(updated.seatOrder).not.toContain("p_player1");
		expect(updated.playersById.p_player2?.statuses[0]?.source?.playerId).toBe(
			"p_alice",
		);
		expect(updated.log[0]?.payload).toEqual({
			playerId: "p_alice",
			players: ["p_alice"],
		});
	});

	it("aktualisiert Rollen und Spieler bei einer geänderten Status-ID", () => {
		const game = withPoisonStatus();

		const updated = replaceStatusDefinitionIdReferences(
			game,
			"d_poison",
			"d_drunk",
		);

		expect(
			updated.ruleSetSnapshot.roles.find(({ id }) => id === "r_seer")
				?.apply_status_effect,
		).toEqual(["d_drunk"]);
		expect(updated.playersById.p_player1?.statuses[0]?.statusId).toBe(
			"d_drunk",
		);
	});
});

it("ändert eine Statusdefinitions-ID kollisionsfrei samt Record und Referenzen", () => {
	const game = withPoisonStatus();
	game.log.push({
		id: "l_status",
		night: 0,
		phase: "setup",
		createdAt: "2026-01-02T03:04:05.000Z",
		type: "test",
		text: "Status geändert",
		payload: { statusId: "d_poison" },
	});

	const result = editStatusDefinition(game, {
		statusId: "d_poison",
		name: "Drunk",
	});

	expect(result.statusDefinition.id).toBe("d_drunk");
	expect(result.game.statusDefinitionsById.d_poison).toBeUndefined();
	expect(result.game.statusDefinitionsById.d_drunk?.id).toBe("d_drunk");
	expect(result.game.ruleSetSnapshot.statuses?.[0]?.id).toBe("d_drunk");
	expect(
		result.game.ruleSetSnapshot.roles.find(({ id }) => id === "r_seer")
			?.apply_status_effect,
	).toEqual(["d_drunk"]);
	expect(result.game.playersById.p_player1?.statuses[0]?.statusId).toBe(
		"d_drunk",
	);
	expect(result.game.log[0]?.payload?.statusId).toBe("d_drunk");
	expect(result.warnings).toContainEqual(
		expect.objectContaining({ code: "STATUS_ID_REFERENCES_UPDATED" }),
	);
});

function withPoisonStatus() {
	const game = createTestGame();
	const definition = {
		id: "d_poison",
		name: "Poison",
		defaultDuration: 1,
	};
	game.ruleSetSnapshot.statuses = [definition];
	game.statusDefinitionsById = { d_poison: definition };
	const role = game.ruleSetSnapshot.roles.find(({ id }) => id === "r_seer");
	if (!role) throw new Error("Testrolle fehlt.");
	role.apply_status_effect = ["d_poison"];
	const player = game.playersById.p_player1;
	if (!player) throw new Error("Testspieler fehlt.");
	player.statuses = [
		{
			id: "s_poison_1",
			statusId: "d_poison",
			fromNight: 1,
			untilNight: 2,
		},
	];
	return game;
}
