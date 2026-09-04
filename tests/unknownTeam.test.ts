import { describe, expect, it } from "vitest";

import { Team } from "../src/domain/models";
import { deleteTeam as deleteTeamInDomain } from "../src/domain/sessionEditing";
import { createTestGame } from "./fixtures";
import { editTeam } from "./sessionEditingTestAdapter";

const deleteTeam = (
	game: Parameters<typeof deleteTeamInDomain>[0],
	teamId: string,
	language = "de",
) => deleteTeamInDomain(game, teamId, language);

describe("System-Team unknown", () => {
	it("darf umbenannt werden, ohne seine ID oder Systemrolle zu verlieren", () => {
		const game = createTestGame();
		const result = editTeam(game, {
			teamId: "t_unknown",
			name: "Nicht zugeordnet",
		});
		const unknownTeam = result.game.ruleSetSnapshot.teams.find(
			(team) => team.id === "t_unknown",
		);

		expect(unknownTeam).toMatchObject({
			id: "t_unknown",
			name: "Nicht zugeordnet",
			isSystem: true,
		});
		expect(result.warnings).toEqual([]);
	});

	it("behält als reserviertes System-Team auch bei einer weiteren Umbenennung seine ID", () => {
		const game = createTestGame();
		const result = editTeam(game, {
			teamId: "t_unknown",
			name: "Sonstige",
		});

		expect(
			result.game.ruleSetSnapshot.teams.find((team) => team.id === "t_unknown"),
		).toMatchObject({ name: "Sonstige", isSystem: true });
		expect(result.warnings).toEqual([]);
	});

	it("behält auch beim Modell-Rename die ID unknown", () => {
		const renamed = Team.createUnknown().withRenamedTeam("Nicht zugeordnet");
		expect(renamed).toMatchObject({
			id: "t_unknown",
			name: "Nicht zugeordnet",
			isSystem: true,
		});
	});

	it("darf weiterhin nicht gelöscht werden", () => {
		expect(() => deleteTeam(createTestGame(), "t_unknown")).toThrow(
			/nicht gelöscht/,
		);
	});
});
