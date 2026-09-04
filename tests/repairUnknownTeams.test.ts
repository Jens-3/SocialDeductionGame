import { describe, expect, it } from "vitest";

import { Player, Role, Team } from "../src/domain/models";
import { repairInconsistentUnknownTeams } from "../src/domain/unknownTeam";
import { createTestGame } from "./fixtures";

describe("repairInconsistentUnknownTeams", () => {
	it("legt ein fehlendes unknown-Team an", () => {
		const game = createTestGame();
		game.ruleSetSnapshot.teams = game.ruleSetSnapshot.teams.filter(
			(team) => team.id !== "t_unknown",
		);

		expect(repairInconsistentUnknownTeams(game)).toBe(1);
		expect(game.ruleSetSnapshot.teams.at(-1)).toMatchObject({
			id: "t_unknown",
			name: "Unbekannt",
			teamOrder: 99,
			isSystem: true,
		});
	});

	it("ändert ein einzelnes korrektes System-Team nicht", () => {
		const game = createTestGame();
		expect(repairInconsistentUnknownTeams(game)).toBe(0);
	});

	it("markiert ein einzelnes nichtsystemisches unknown-Team als System-Team", () => {
		const game = createTestGame();
		const unknown = game.ruleSetSnapshot.teams.find(
			(team) => team.id === "t_unknown",
		);
		expect(unknown).toBeDefined();
		if (!unknown) return;
		setSystemForTest(unknown, false);

		expect(repairInconsistentUnknownTeams(game)).toBe(1);
		expect(unknown).toMatchObject({ id: "t_unknown", isSystem: true });
	});

	it("ergänzt bei einem einzelnen unknown-Team ein fehlendes isSystem", () => {
		const game = createTestGame();
		const unknown = game.ruleSetSnapshot.teams.find(
			(team) => team.id === "t_unknown",
		);
		expect(unknown).toBeDefined();
		if (!unknown) return;
		delete (unknown as unknown as { isSystem?: boolean }).isSystem;

		expect(repairInconsistentUnknownTeams(game)).toBe(1);
		expect(unknown).toMatchObject({ id: "t_unknown", isSystem: true });
	});

	it("behält bei genau einem System-Team dieses als unknown", () => {
		const game = createTestGame();
		const keeper = game.ruleSetSnapshot.teams.find(
			(team) => team.id === "t_unknown",
		);
		expect(keeper).toBeDefined();
		const duplicateA = new Team({
			id: "t_unknown",
			name: "Duplicate A",
			teamOrder: 200,
		});
		const duplicateB = new Team({
			id: "t_unknown",
			name: "Duplicate B",
			teamOrder: 300,
		});
		game.ruleSetSnapshot.teams.push(duplicateA, duplicateB);

		expect(repairInconsistentUnknownTeams(game)).toBe(2);
		expect(keeper?.id).toBe("t_unknown");
		expect(duplicateA.id).toBe("t_unknown_1");
		expect(duplicateB.id).toBe("t_unknown_2");
	});

	it("wählt bei mehreren System-Teams die höchste teamOrder", () => {
		const game = createTestGame();
		const original = game.ruleSetSnapshot.teams.find(
			(team) => team.id === "t_unknown",
		);
		expect(original).toBeDefined();
		const highest = new Team({
			id: "t_unknown",
			name: "Highest",
			teamOrder: 1_200,
			isSystem: true,
		});
		game.ruleSetSnapshot.teams.push(highest);

		expect(repairInconsistentUnknownTeams(game)).toBe(1);
		expect(highest).toMatchObject({ id: "t_unknown", isSystem: true });
		expect(original).toMatchObject({ id: "t_unknown_1", isSystem: false });
	});

	it("wählt bei gleicher höchster teamOrder das erste Team", () => {
		const game = createTestGame();
		const original = game.ruleSetSnapshot.teams.find(
			(team) => team.id === "t_unknown",
		);
		expect(original).toBeDefined();
		if (!original) return;
		original.setTeamOrder(200);
		const second = new Team({
			id: "t_unknown",
			name: "Second",
			teamOrder: 200,
			isSystem: true,
		});
		game.ruleSetSnapshot.teams.push(second);

		repairInconsistentUnknownTeams(game);
		expect(original).toMatchObject({ id: "t_unknown", isSystem: true });
		expect(second).toMatchObject({ id: "t_unknown_1", isSystem: false });
	});

	it("wählt bei unbekannter teamOrder das erste Team", () => {
		const game = createTestGame();
		const first = game.ruleSetSnapshot.teams.find(
			(team) => team.id === "t_unknown",
		);
		expect(first).toBeDefined();
		if (!first) return;
		setSystemForTest(first, false);
		setTeamOrderForTest(first, undefined);
		const second = new Team({
			id: "t_unknown",
			name: "Second",
			teamOrder: 100,
		});
		setTeamOrderForTest(second, undefined);
		game.ruleSetSnapshot.teams.push(second);

		expect(repairInconsistentUnknownTeams(game)).toBe(2);
		expect(first).toMatchObject({ id: "t_unknown", isSystem: true });
		expect(second).toMatchObject({ id: "t_unknown_1", isSystem: false });
	});

	it("wählt ohne System-Team die höchste teamOrder und markiert sie", () => {
		const game = createTestGame();
		const first = game.ruleSetSnapshot.teams.find(
			(team) => team.id === "t_unknown",
		);
		expect(first).toBeDefined();
		if (!first) return;
		setSystemForTest(first, false);
		const highest = new Team({
			id: "t_unknown",
			name: "Highest",
			teamOrder: 1_200,
		});
		game.ruleSetSnapshot.teams.push(highest);

		expect(repairInconsistentUnknownTeams(game)).toBe(2);
		expect(highest).toMatchObject({ id: "t_unknown", isSystem: true });
		expect(first).toMatchObject({ id: "t_unknown_1", isSystem: false });
	});

	it("reicht beim fehlenden Team Konfliktmeldungen unverändert durch", () => {
		const game = createTestGame();
		game.ruleSetSnapshot.teams = game.ruleSetSnapshot.teams.filter(
			(team) => team.id !== "t_unknown",
		);
		game.playersById.t_unknown = new Player({
			id: "t_unknown",
			name: "Conflict",
		});

		expect(repairInconsistentUnknownTeams(game)).toMatch(/Spieler "Conflict"/);
	});

	it("lässt Rollenreferenzen beim ausgewählten System-Team unknown", () => {
		const game = createTestGame();
		game.ruleSetSnapshot.roles.push(
			new Role({ id: "legacy_role", name: "Legacy", teamId: "t_unknown" }),
		);
		game.ruleSetSnapshot.teams.push(
			new Team({ id: "t_unknown", name: "Duplicate", teamOrder: 10 }),
		);

		repairInconsistentUnknownTeams(game);
		expect(game.ruleSetSnapshot.roles.at(-1)?.teamId).toBe("t_unknown");
	});
});

function setSystemForTest(team: Team, isSystem: boolean): void {
	(team as unknown as { isSystem: boolean }).isSystem = isSystem;
}

function setTeamOrderForTest(team: Team, teamOrder: number | undefined): void {
	(team as unknown as { teamOrder?: number }).teamOrder = teamOrder;
}
