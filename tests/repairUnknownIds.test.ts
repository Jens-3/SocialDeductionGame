import { describe, expect, it } from "vitest";

import { Player, Role, Team } from "../src/domain/models";
import { repairUnknownRoleAndPlayerIds } from "../src/domain/unknownTeam";
import { createTestGame } from "./fixtures";

describe("repairUnknownRoleAndPlayerIds", () => {
	it("ändert nichts an einem konsistenten Spielstand", () => {
		const game = createTestGame();
		expect(repairUnknownRoleAndPlayerIds(game)).toBe(0);
	});

	it("nummeriert Rollen und Spieler mit unknown fortlaufend und zieht Referenzen mit", () => {
		const game = createTestGame();
		game.ruleSetSnapshot.teams.push(
			new Team({ id: "t_unknown_1", name: "Reserved", teamOrder: 98 }),
		);
		game.ruleSetSnapshot.roles.push(
			new Role({ id: "t_unknown", name: "Unbekannte Rolle", teamId: "t_good" }),
		);
		game.playersById.t_unknown = new Player({
			id: "t_unknown",
			name: "Unbekannter Spieler",
			roles: {
				actualRoleId: "t_unknown",
				shownRoleIds: [],
				nightRoleId: null,
			},
			statuses: [
				{
					id: "s_status_1",
					statusId: "d_marked",
					fromNight: 0,
					untilNight: null,
					source: { playerId: "t_unknown" },
				},
			],
		});
		game.seatOrder.push("t_unknown");

		expect(repairUnknownRoleAndPlayerIds(game)).toBe(2);
		expect(game.ruleSetSnapshot.roles.at(-1)?.id).toBe("r_unknown");
		expect(game.playersById.t_unknown).toBeUndefined();
		expect(game.playersById.p_unknown?.id).toBe("p_unknown");
		expect(game.playersById.p_unknown?.roles.actualRoleId).toBe("r_unknown");
		expect(game.playersById.p_unknown?.statuses[0]?.source?.playerId).toBe(
			"p_unknown",
		);
		expect(game.seatOrder).toContain("p_unknown");
		expect(game.seatOrder).not.toContain("t_unknown");
	});

	it("repariert auch eine abweichende Record-ID eines Players", () => {
		const game = createTestGame();
		game.playersById.legacy_key = new Player({
			id: "t_unknown",
			name: "Legacy Player",
		});
		game.seatOrder.push("legacy_key");

		expect(repairUnknownRoleAndPlayerIds(game)).toBe(1);
		expect(game.playersById.legacy_key).toBeUndefined();
		expect(game.playersById.p_unknown?.id).toBe("p_unknown");
		expect(game.seatOrder).toContain("p_unknown");
	});
});
