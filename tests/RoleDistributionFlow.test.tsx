// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GamePreparationService } from "../src/application/gamePreparationService";
import { RoleDistributionFlow } from "../src/gui/RoleDistributionFlow";
import { createFixedDomainServices } from "./fixedClock";
import { createTestGame } from "./fixtures";

afterEach(cleanup);

describe("Gemeinsame Rollenverteilungsoberfläche", () => {
	it("belegt die aktuelle Teamverteilung vor und bestätigt das Überschreiben", () => {
		const game = createTestGame(3);
		game.playersById.p_player1?.assignActualRole("r_seer");
		game.playersById.p_player2?.assignActualRole("r_villager");
		game.playersById.p_player3?.assignActualRole("r_wolf");
		const onDistribute = vi.fn();
		render(
			<RoleDistributionFlow
				game={game}
				onBack={vi.fn()}
				onDistribute={onDistribute}
				initializeFromAssignments
				confirmOverwrite
			/>,
		);

		expect(
			screen.queryByRole("button", { name: /Rollen manuell verteilen/ }),
		).toBeNull();
		fireEvent.click(
			screen.getByRole("button", {
				name: /Zufällige Rollen zufällig verteilen/,
			}),
		);
		expect(screen.getByLabelText("Anzahl Good").textContent).toBe("2");
		expect(screen.getByLabelText("Anzahl Evil").textContent).toBe("1");
		expect(screen.getByText(/Freie Spieler:/).textContent).toContain("0");

		fireEvent.click(screen.getByRole("button", { name: "Rollen verteilen" }));
		const warning = screen.getByRole("alertdialog");
		expect(warning.textContent).toContain(
			"Bereits vergebene Rollen werden überschrieben.",
		);
		expect(onDistribute).not.toHaveBeenCalled();
		fireEvent.click(
			within(warning).getByRole("button", { name: "Rollen neu verteilen" }),
		);

		expect(onDistribute).toHaveBeenCalledWith("teams", {
			t_good: 2,
			t_evil: 1,
		});
	});

	it("zählt p_empty nicht als freien Spieler", () => {
		const game = createTestGame(3);
		game.seatOrder.splice(1, 0, "p_empty", "p_empty");
		render(
			<RoleDistributionFlow
				game={game}
				onBack={vi.fn()}
				onDistribute={vi.fn()}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", {
				name: /Zufällige Rollen zufällig verteilen/,
			}),
		);

		expect(screen.getByText(/Freie Spieler:/).textContent).toContain("3");
	});

	it("zeigt während eines laufenden Spiels die verstärkte Warnung", () => {
		const game = createTestGame(1);
		game.playersById.p_player1?.assignActualRole("r_seer");
		game.time = { currentNight: 2, phase: "night" };
		render(
			<RoleDistributionFlow
				game={game}
				onBack={vi.fn()}
				onDistribute={vi.fn()}
				initializeFromAssignments
				confirmOverwrite
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", {
				name: /Ausgewählte Rollen zufällig verteilen/,
			}),
		);
		fireEvent.click(screen.getByRole("button", { name: "Rollen verteilen" }));

		expect(screen.getByRole("alertdialog").textContent).toContain(
			"Das Spiel läuft bereits.",
		);
	});

	it("zeigt in der Auswahl immer das Unicode-Symbol der Rolle mit Fallback", () => {
		const game = createTestGame(3);
		const seer = game.ruleSetSnapshot.roles.find(({ id }) => id === "r_seer");
		const wolf = game.ruleSetSnapshot.roles.find(({ id }) => id === "r_wolf");
		if (!seer || !wolf) throw new Error("Testrollen fehlen.");
		seer.unicodeSymbol = "👁";
		wolf.unicodeSymbol = undefined;
		render(
			<RoleDistributionFlow
				game={game}
				onBack={vi.fn()}
				onDistribute={vi.fn()}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", {
				name: /Ausgewählte Rollen zufällig verteilen/,
			}),
		);

		expect(screen.getByText("👁 Seer")).toBeDefined();
		expect(screen.getByText("◆ Wolf")).toBeDefined();
	});

	it("zeigt die Rollenverteilung auf Englisch an", () => {
		const game = createTestGame(3);
		render(
			<RoleDistributionFlow
				game={game}
				language="en"
				onBack={vi.fn()}
				onDistribute={vi.fn()}
			/>,
		);

		expect(
			screen.getByRole("heading", { name: "Assign roles randomly" }),
		).toBeDefined();
		fireEvent.click(
			screen.getByRole("button", {
				name: /Distribute random roles randomly/,
			}),
		);
		expect(screen.getByText(/Unassigned players:/).textContent).toContain("3");
		expect(
			screen.getByRole("button", { name: "Distribute roles" }),
		).toBeDefined();
	});

	it("zeigt ein Team ohne Rollen als lokalisierten Eingabefehler", () => {
		const game = createTestGame(1);
		const unknownTeam = game.ruleSetSnapshot.teams.find(
			(team) => team.id === "t_unknown",
		);
		if (!unknownTeam) throw new Error("Testteam fehlt.");
		unknownTeam.name = "Unbekannt";
		const service = new GamePreparationService(createFixedDomainServices());
		render(
			<RoleDistributionFlow
				game={game}
				onBack={vi.fn()}
				onDistribute={(mode, counts) => {
					service.distributeRoles(game, mode, counts, "de");
				}}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", {
				name: /Zufällige Rollen zufällig verteilen/,
			}),
		);
		fireEvent.click(screen.getByRole("button", { name: "Unbekannt erhöhen" }));
		fireEvent.click(screen.getByRole("button", { name: "Rollen verteilen" }));

		const error = screen.getByText(
			"Rollenverteilung fehlgeschlagen: Für Team „Unbekannt“ wurde 1 Spieler angefordert, aber das Team hat keine Rollen.",
		);
		expect(error.classList).toContain("load-error");
		expect(error.textContent).not.toContain("Unerwarteter Anwendungsfehler");
		expect(error.textContent).not.toContain("t_unknown");
	});

	it("zeigt zu wenige verschiedene Rollen auf Englisch als Eingabefehler", () => {
		const game = createTestGame(2);
		const service = new GamePreparationService(createFixedDomainServices());
		render(
			<RoleDistributionFlow
				game={game}
				language="en"
				onBack={vi.fn()}
				onDistribute={(mode, counts) => {
					service.distributeRoles(game, mode, counts, "en");
				}}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", {
				name: /Distribute random roles randomly/,
			}),
		);
		const increaseEvil = screen.getByRole("button", { name: "Increase Evil" });
		fireEvent.click(increaseEvil);
		fireEvent.click(increaseEvil);
		fireEvent.click(screen.getByRole("button", { name: "Distribute roles" }));

		expect(
			screen.getByText(
				"Role distribution failed: 2 players were requested for team “Evil”, but there is only 1 distinct role and no repeatable role.",
			),
		).toBeDefined();
	});
});
