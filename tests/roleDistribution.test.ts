import { describe, expect, it } from "vitest";
import { GamePreparationService } from "../src/application/gamePreparationService";
import type { GameState } from "../src/domain/gameFactory";
import {
	assignRandomRolesByRoleCounts as assignRolesByCounts,
	assignRandomRolesByTeamCounts as assignTeamsByCounts,
	type RoleDistributionOptions,
} from "../src/domain/roleDistribution";
import { createFixedDomainServices } from "./fixedClock";
import { createTestGame } from "./fixtures";

type TestOptions = RoleDistributionOptions & { now?: Date };

function splitOptions(options: TestOptions = {}) {
	const { now, ...domainOptions } = options;
	return {
		services: createFixedDomainServices(now?.toISOString()),
		options: domainOptions,
	};
}

function assignRandomRolesByTeamCounts(
	game: GameState,
	counts: Record<string, number>,
	options: TestOptions = {},
) {
	const test = splitOptions(options);
	return assignTeamsByCounts(game, counts, test.services, test.options);
}

function assignRandomRolesByRoleCounts(
	game: GameState,
	counts: Record<string, number>,
	options: TestOptions = {},
) {
	const test = splitOptions(options);
	return assignRolesByCounts(game, counts, test.services, test.options);
}

describe("Rollenverteilung", () => {
	it("verteilt die angeforderte Teamzusammensetzung deterministisch", () => {
		const game = createTestGame(3);
		const result = assignRandomRolesByTeamCounts(
			game,
			{ t_good: 2, t_evil: 1 },
			{ rng: () => 0, now: new Date("2026-02-03T04:05:06.000Z") },
		);

		expect(result.assignments).toHaveLength(3);
		expect(result.drawnRoleIdsByTeamId.t_good).toHaveLength(2);
		expect(result.drawnRoleIdsByTeamId.t_evil).toEqual(["r_wolf"]);
		expect(
			result.game.seatOrder.map(
				(playerId) => result.game.playersById[playerId]?.roles.actualRoleId,
			),
		).not.toContain(null);
	});

	it("verändert den ursprünglichen Spielstand nicht", () => {
		const game = createTestGame(3);
		assignRandomRolesByTeamCounts(
			game,
			{ t_good: 2, t_evil: 1 },
			{ rng: () => 0 },
		);

		for (const player of Object.values(game.playersById)) {
			expect(player.roles.actualRoleId).toBeNull();
		}
		expect(game.log).toHaveLength(0);
	});

	it("lehnt eine falsche Gesamtzahl angeforderter Rollen ab", () => {
		const game = createTestGame(3);
		expect(() =>
			assignRandomRolesByTeamCounts(game, { t_good: 1, t_evil: 1 }),
		).toThrow(/3 sitzende Spieler/);
	});

	it("verteilt explizit gewählte Rollen einschließlich mehrfacher unique-Rollen", () => {
		const game = createTestGame(3);
		const result = assignRandomRolesByRoleCounts(
			game,
			{ r_seer: 2, r_wolf: 1 },
			{ rng: () => 0, now: new Date("2026-02-03T04:05:06.000Z") },
		);

		expect(
			result.assignments.map((assignment) => assignment.roleId).sort(),
		).toEqual(["r_seer", "r_seer", "r_wolf"]);
		expect(result.game.log.at(-1)?.type).toBe(
			"selected_roles_randomly_distributed",
		);
	});

	it("lehnt unbekannte Rollen und eine falsche Auswahlzahl ab", () => {
		const game = createTestGame(3);
		expect(() => assignRandomRolesByRoleCounts(game, { r_missing: 3 })).toThrow(
			/Unbekannte Rolle/,
		);
		expect(() => assignRandomRolesByRoleCounts(game, { r_seer: 2 })).toThrow(
			/3 sitzende Spieler/,
		);
	});

	it("ignoriert mehrfach vorkommende leere Sitzplätze und bewahrt echte Platznummern", () => {
		const game = createTestGame(3);
		game.seatOrder = [
			game.seatOrder[0] ?? "",
			"p_empty",
			game.seatOrder[1] ?? "",
			"p_empty",
			game.seatOrder[2] ?? "",
		];

		const result = assignRandomRolesByTeamCounts(
			game,
			{ t_good: 2, t_evil: 1 },
			{ rng: () => 0 },
		);

		expect(result.assignments.map(({ seatNumber }) => seatNumber)).toEqual([
			1, 3, 5,
		]);
		expect(result.assignments.map(({ playerId }) => playerId)).not.toContain(
			"p_empty",
		);
		expect(result.game.seatOrder).toEqual(game.seatOrder);
	});

	it("lehnt ein tatsächliches Spielerobjekt mit der reservierten ID p_empty ab", () => {
		const game = createTestGame(3);
		game.playersById.p_empty = structuredClone(game.playersById.p_player1);

		expect(() =>
			assignRandomRolesByTeamCounts(game, { t_good: 2, t_evil: 1 }),
		).toThrow(/p_empty.*kein Spielerobjekt/);
	});

	it("klassifiziert ein Team ohne Rollen als erwartbaren Application-Fehler", () => {
		const game = createTestGame(1);
		const unknownTeam = game.ruleSetSnapshot.teams.find(
			(team) => team.id === "t_unknown",
		);
		if (!unknownTeam) throw new Error("Testteam fehlt.");
		unknownTeam.name = "Unbekannt";
		const service = new GamePreparationService(createFixedDomainServices());

		let caught: unknown;
		try {
			service.distributeRoles(game, "teams", { t_unknown: 1 }, "de");
		} catch (error) {
			caught = error;
		}

		expect(caught).toMatchObject({
			name: "ApplicationOperationError",
			source: "domain",
			expectation: "expected",
			operation: "resolve",
			reason: "roleDistributionTeamHasNoRoles",
			parameters: { teamName: "Unbekannt", requestedCount: 1 },
		});
	});

	it("klassifiziert zu wenige verschiedene Rollen als erwartbaren Application-Fehler", () => {
		const game = createTestGame(2);
		const service = new GamePreparationService(createFixedDomainServices());

		let caught: unknown;
		try {
			service.distributeRoles(game, "teams", { t_evil: 2 }, "de");
		} catch (error) {
			caught = error;
		}

		expect(caught).toMatchObject({
			name: "ApplicationOperationError",
			source: "domain",
			expectation: "expected",
			operation: "resolve",
			reason: "roleDistributionInsufficientDistinctRoles",
			parameters: {
				teamName: "Evil",
				requestedCount: 2,
				availableRoleCount: 1,
			},
		});
	});
});
