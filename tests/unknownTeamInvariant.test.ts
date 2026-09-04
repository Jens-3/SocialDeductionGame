import { describe, expect, it } from "vitest";

import { Player, Role } from "../src/domain/models";
import { ensureUnknownTeam } from "../src/domain/unknownTeam";
import { createTestGame } from "./fixtures";

describe("ensureUnknownTeam", () => {
	it("ändert nichts, wenn unknown bereits ein Team ist", () => {
		const game = createTestGame();
		const teamCount = game.ruleSetSnapshot.teams.length;

		expect(ensureUnknownTeam(game)).toBe(false);
		expect(game.ruleSetSnapshot.teams).toHaveLength(teamCount);
	});

	it("legt ein fehlendes System-Team unknown an", () => {
		const game = createTestGame();
		game.ruleSetSnapshot.teams = game.ruleSetSnapshot.teams.filter(
			(team) => team.id !== "t_unknown",
		);

		expect(ensureUnknownTeam(game)).toBe(true);
		expect(game.ruleSetSnapshot.teams.at(-1)).toMatchObject({
			id: "t_unknown",
			name: "Unbekannt",
			teamOrder: 99,
			isSystem: true,
		});
	});

	it("gibt bei einer Rolle mit ID unknown eine Fehlermeldung zurück", () => {
		const game = createTestGame();
		game.ruleSetSnapshot.teams = game.ruleSetSnapshot.teams.filter(
			(team) => team.id !== "t_unknown",
		);
		game.ruleSetSnapshot.roles.push(
			new Role({ id: "t_unknown", name: "Falsche Rolle", teamId: "t_good" }),
		);
		const teamCount = game.ruleSetSnapshot.teams.length;

		const result = ensureUnknownTeam(game);
		expect(result).toMatch(/Rolle "Falsche Rolle"/);
		expect(game.ruleSetSnapshot.teams).toHaveLength(teamCount);
	});

	it("gibt bei einem Spieler mit ID unknown eine Fehlermeldung zurück", () => {
		const game = createTestGame();
		game.ruleSetSnapshot.teams = game.ruleSetSnapshot.teams.filter(
			(team) => team.id !== "t_unknown",
		);
		game.playersById.t_unknown = new Player({
			id: "t_unknown",
			name: "Falscher Spieler",
		});
		const teamCount = game.ruleSetSnapshot.teams.length;

		const result = ensureUnknownTeam(game);
		expect(result).toMatch(/Spieler "Falscher Spieler"/);
		expect(game.ruleSetSnapshot.teams).toHaveLength(teamCount);
	});

	it("meldet auch dann einen Konflikt, wenn zusätzlich ein unknown-Team existiert", () => {
		const game = createTestGame();
		game.playersById.t_unknown = new Player({
			id: "t_unknown",
			name: "Konflikt",
		});

		expect(ensureUnknownTeam(game)).toMatch(/Spieler "Konflikt"/);
	});
});
