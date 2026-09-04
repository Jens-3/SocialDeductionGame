// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import type { SavePlayerCommand } from "../src/application/gameUseCases";
import { BackNavigationProvider } from "../src/gui/backNavigation";
import { GameScreen } from "../src/gui/GameScreen";
import { ObjectSaveInterruptedError } from "../src/persistence/objectSaveInterruptedError";
import { createTestLoadedGameDocument } from "./fixtures";

const originalElementFromPointDescriptor = Object.getOwnPropertyDescriptor(
	document,
	"elementFromPoint",
);

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
	if (originalElementFromPointDescriptor) {
		Object.defineProperty(
			document,
			"elementFromPoint",
			originalElementFromPointDescriptor,
		);
	} else {
		Reflect.deleteProperty(document, "elementFromPoint");
	}
});

const requiredGameScreenActions = {
	onMoveShownRole: vi.fn(() => true),
	onChangeShownRole: vi.fn(() => true),
	onSave: async () => {},
	onRestorePreviousFile: async () => {},
	onSavePlayer: vi.fn(),
	onDeleteEmptySeat: vi.fn(() => true),
	onDeletePlayer: vi.fn(() => true),
	onExit: vi.fn(),
	onManageGameEntities: vi.fn(),
	onRandomizeRoles: vi.fn(),
	onEditRolesForShowing: vi.fn(),
	onOpenSettings: vi.fn(),
};

it("schaltet den unteren Bereich in den Vollbildmodus und wieder zurück", () => {
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 1, phase: "night" },
					seatOrder: [],
					playersById: {},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_fullscreen", name: "Vollbildtest" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	const expand = screen.getByRole("button", {
		name: "Detailbereich im Vollbild anzeigen",
	});
	fireEvent.click(expand);
	expect(
		screen
			.getByRole("button", { name: "Geteilte Ansicht wiederherstellen" })
			.closest(".game-screen")
			?.classList.contains("game-screen--details-fullscreen"),
	).toBe(true);

	fireEvent.click(
		screen.getByRole("button", { name: "Geteilte Ansicht wiederherstellen" }),
	);
	expect(
		screen
			.getByRole("button", { name: "Detailbereich im Vollbild anzeigen" })
			.closest(".game-screen")
			?.classList.contains("game-screen--details-fullscreen"),
	).toBe(false);
});

it("schaltet über die Zeitanzeige zwischen Sitzkreis und Spielerübersicht um", () => {
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 0, phase: "setup" },
					seatOrder: ["p_anna"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							lifeState: "alive",
							roles: {
								actualRoleId: "r_empath",
								shownRoleIds: ["r_empath"],
								nightRoleId: "r_empath",
							},
							statuses: [],
						},
					},
					ruleSetSnapshot: {
						teams: [{ id: "t_good", name: "Gut", teamOrder: 1 }],
						roles: [{ id: "r_empath", name: "Empath", teamId: "t_good" }],
					},
					statusDefinitionsById: {},
				},
				{ id: "game_overview", name: "Übersichtstest" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(
		screen.getByRole("button", { name: /Spielerübersicht anzeigen/ }),
	);
	expect(screen.getByRole("table", { name: "Spielerübersicht" })).toBeDefined();
	expect(screen.queryByRole("button", { name: "Sitzplatz 1" })).toBeNull();
	expect(
		screen.queryByRole("button", { name: "Sitzordnung entsperren" }),
	).toBeNull();

	fireEvent.click(screen.getByRole("button", { name: "Anna, Sitzplatz 1" }));
	expect(screen.getByLabelText<HTMLInputElement>("Spielername").value).toBe(
		"Anna",
	);

	fireEvent.click(screen.getByRole("button", { name: /Sitzkreis anzeigen/ }));
	expect(screen.getByRole("button", { name: "Sitzplatz 1" })).toBeDefined();
	expect(
		screen.getByRole("button", { name: "Sitzordnung entsperren" }),
	).toBeDefined();
});

it("wendet das Ausblenden in Sitzkreis und Spielerübersicht einheitlich an", () => {
	const game = createTestLoadedGameDocument(
		{
			time: { currentNight: 3, phase: "day" },
			seatOrder: ["p_anna"],
			playersById: {
				p_anna: {
					id: "p_anna",
					name: "Anna",
					lifeState: "alive",
					roles: { actualRoleId: null, shownRoleIds: [] },
					statuses: [
						{
							id: "s_expired",
							statusId: "d_poisoned",
							fromNight: 1,
							untilNight: 2,
						},
						{
							id: "s_future",
							statusId: "d_cursed",
							fromNight: 4,
							untilNight: null,
						},
					],
				},
			},
			ruleSetSnapshot: {
				teams: [],
				roles: [],
				statuses: [
					{ id: "d_poisoned", name: "Vergiftet" },
					{ id: "d_cursed", name: "Verflucht" },
				],
			},
			statusDefinitionsById: {
				d_poisoned: { id: "d_poisoned", name: "Vergiftet" },
				d_cursed: { id: "d_cursed", name: "Verflucht" },
			},
		},
		{ id: "game_status_visibility", name: "Zustandssichtbarkeit" },
	);
	const screenElement = (hideExpiredStatuses: boolean) => (
		<GameScreen
			{...requiredGameScreenActions}
			game={game}
			hideExpiredStatuses={hideExpiredStatuses}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>
	);
	const view = render(screenElement(false));

	expect(document.querySelector(".seat-symbol")?.textContent).toContain("✦");
	fireEvent.click(
		screen.getByRole("button", { name: /Spielerübersicht anzeigen/ }),
	);
	expect(
		screen.getByRole("table", { name: "Spielerübersicht" }).textContent,
	).toContain("Vergiftet, Verflucht");

	view.rerender(screenElement(true));
	expect(
		screen.getByRole("table", { name: "Spielerübersicht" }).textContent,
	).not.toContain("Vergiftet");
	expect(
		screen.getByRole("table", { name: "Spielerübersicht" }).textContent,
	).not.toContain("Verflucht");
	fireEvent.click(screen.getByRole("button", { name: /Sitzkreis anzeigen/ }));
	expect(document.querySelector(".seat-symbol")?.textContent).not.toContain(
		"✦",
	);
});

it("übernimmt den Standard für eine entsperrte Sitzordnung nur beim Öffnen", () => {
	const game = createTestLoadedGameDocument(
		{
			time: { currentNight: 0, phase: "setup" },
			seatOrder: [],
			playersById: {},
			ruleSetSnapshot: { roles: [] },
			statusDefinitionsById: {},
		},
		{ id: "game_unlocked_default", name: "Entsperrter Standard" },
	);
	const props = {
		...requiredGameScreenActions,
		game,
		onBack: vi.fn(),
		onMoveSeat: vi.fn(),
		onAdvanceTime: vi.fn(),
		onRewindTime: vi.fn(),
	};
	const view = render(<GameScreen {...props} initialSeatOrderUnlocked />);

	expect(
		screen.getByRole("button", { name: "Sitzordnung sperren" }),
	).toBeDefined();
	fireEvent.click(screen.getByRole("button", { name: "Sitzordnung sperren" }));
	expect(
		screen.getByRole("button", { name: "Sitzordnung entsperren" }),
	).toBeDefined();

	view.rerender(<GameScreen {...props} initialSeatOrderUnlocked />);
	expect(
		screen.getByRole("button", { name: "Sitzordnung entsperren" }),
	).toBeDefined();
});

it("vergrößert den Sitzkreis schrittweise und kehrt zur Ausgangsgröße zurück", () => {
	let notifyResize: ResizeObserverCallback = () => {};
	vi.stubGlobal(
		"ResizeObserver",
		class {
			constructor(callback: ResizeObserverCallback) {
				notifyResize = callback;
			}
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 1, phase: "day" },
					seatOrder: ["p_anna"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							lifeState: "alive",
							roles: {},
							statuses: [],
						},
					},
					ruleSetSnapshot: { teams: [], roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_zoom", name: "Zoomtest" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	const zoomOut = screen.getByRole("button", {
		name: "Sitzkreis verkleinern",
	});
	const zoomIn = screen.getByRole("button", {
		name: "Sitzkreis vergrößern",
	});
	const circle = document.querySelector<HTMLElement>(".seat-circle-content");
	const viewport = document.querySelector<HTMLElement>(".seat-circle-viewport");
	expect(viewport).not.toBeNull();
	let viewportSize = 200;
	vi.spyOn(viewport as HTMLElement, "getBoundingClientRect").mockImplementation(
		() =>
			({
				width: viewportSize,
				height: viewportSize,
			}) as DOMRect,
	);
	expect(zoomOut.hasAttribute("disabled")).toBe(true);
	expect(screen.getByLabelText("Zoomstufe: 100 Prozent")).toBeDefined();
	expect(circle?.style.transform).toBe("translate(0px, 0px) scale(1)");
	expect(viewport?.style.touchAction).toBe("pan-y");
	const wheelBelowMinimum = new WheelEvent("wheel", {
		bubbles: true,
		cancelable: true,
		deltaY: 100,
	});
	if (viewport) fireEvent(viewport, wheelBelowMinimum);
	expect(wheelBelowMinimum.defaultPrevented).toBe(false);
	expect(screen.getByLabelText("Zoomstufe: 100 Prozent")).toBeDefined();

	for (let step = 0; step < 4; step += 1) fireEvent.click(zoomIn);
	expect(zoomIn.hasAttribute("disabled")).toBe(true);
	expect(screen.getByLabelText("Zoomstufe: 200 Prozent")).toBeDefined();
	expect(circle?.style.transform).toBe("translate(0px, 0px) scale(2)");
	expect(viewport?.style.touchAction).toBe("none");
	const wheelAboveMaximum = new WheelEvent("wheel", {
		bubbles: true,
		cancelable: true,
		deltaY: -100,
	});
	if (viewport) fireEvent(viewport, wheelAboveMaximum);
	expect(wheelAboveMaximum.defaultPrevented).toBe(false);
	expect(screen.getByLabelText("Zoomstufe: 200 Prozent")).toBeDefined();
	Object.defineProperty(viewport, "setPointerCapture", {
		configurable: true,
		value: vi.fn(),
	});
	if (viewport) {
		fireEvent.pointerDown(viewport, {
			pointerId: 1,
			clientX: 0,
			clientY: 0,
		});
		fireEvent.pointerMove(viewport, {
			pointerId: 1,
			clientX: 500,
			clientY: 500,
		});
	}
	expect(circle?.style.transform).toBe("translate(100px, 100px) scale(2)");
	viewportSize = 100;
	act(() => notifyResize([], {} as ResizeObserver));
	expect(circle?.style.transform).toBe("translate(50px, 50px) scale(2)");

	for (let step = 0; step < 4; step += 1) fireEvent.click(zoomOut);
	expect(zoomOut.hasAttribute("disabled")).toBe(true);
	expect(circle?.style.transform).toBe("translate(0px, 0px) scale(1)");
	expect(viewport?.style.touchAction).toBe("pan-y");

	const wheelWithinRange = new WheelEvent("wheel", {
		bubbles: true,
		cancelable: true,
		deltaY: -100,
	});
	if (viewport) fireEvent(viewport, wheelWithinRange);
	expect(wheelWithinRange.defaultPrevented).toBe(true);
	expect(screen.getByLabelText("Zoomstufe: 110 Prozent")).toBeDefined();
	expect(circle?.style.transform).toBe("translate(0px, 0px) scale(1.1)");
	expect(viewport?.style.touchAction).toBe("none");
});

it("schichtet Spieler-, Rollen- und Teamfarbe mit jeweils 40 Prozent Deckkraft", () => {
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 1, phase: "day" },
					seatOrder: ["p_anna"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							color: "112233",
							lifeState: "alive",
							roles: {
								actualRoleId: "r_actual",
								shownRoleIds: ["r_shown"],
								nightRoleId: "r_actual",
							},
							statuses: [],
						},
					},
					ruleSetSnapshot: {
						teams: [{ id: "t_good", name: "Gut", color: "AABBCC" }],
						roles: [
							{
								id: "r_actual",
								name: "Tatsächlich",
								teamId: "t_good",
								color: "445566",
							},
							{ id: "r_shown", name: "Gezeigt", color: "FFFFFF" },
						],
					},
					statusDefinitionsById: {},
				},
				{ id: "game_colors", name: "Farbtest" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	expect(
		screen.getByRole("button", { name: "Sitzplatz 1" }).style.backgroundImage,
	).toBe(
		"linear-gradient(rgba(17, 34, 51, 0.4), rgba(17, 34, 51, 0.4)), linear-gradient(rgba(68, 85, 102, 0.4), rgba(68, 85, 102, 0.4)), linear-gradient(rgba(170, 187, 204, 0.4), rgba(170, 187, 204, 0.4))",
	);
	expect(screen.getByRole("button", { name: "Sitzplatz 1" }).style.color).toBe(
		"var(--seat-text-light)",
	);
});

it("richtet den Sitzkreis am ersten oder letzten Platz in beiden Laufrichtungen aus", () => {
	const game = createTestLoadedGameDocument(
		{
			time: { currentNight: 0, phase: "setup" },
			seatOrder: ["p_anna", "p_ben", "p_cara"],
			playersById: {
				p_anna: {
					id: "p_anna",
					name: "Anna",
					lifeState: "alive",
					roles: {},
					statuses: [],
				},
				p_ben: {
					id: "p_ben",
					name: "Ben",
					lifeState: "alive",
					roles: {},
					statuses: [],
				},
				p_cara: {
					id: "p_cara",
					name: "Cara",
					lifeState: "alive",
					roles: {},
					statuses: [],
				},
			},
			ruleSetSnapshot: { teams: [], roles: [] },
			statusDefinitionsById: {},
		},
		{ id: "game_seat_orientation", name: "Ausrichtung" },
	);
	const renderGame = (
		seatCircleFirstSeatAtTop: boolean,
		seatCircleClockwise: boolean,
	) => (
		<GameScreen
			{...requiredGameScreenActions}
			game={game}
			seatCircleFirstSeatAtTop={seatCircleFirstSeatAtTop}
			seatCircleClockwise={seatCircleClockwise}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>
	);
	const { rerender } = render(renderGame(true, true));
	const seat = (number: number) =>
		document.querySelector<HTMLElement>(`[data-seat-number="${number}"]`);

	expect(seat(1)?.style.top).toBe("10%");
	expect(Number.parseFloat(seat(2)?.style.left ?? "0")).toBeGreaterThan(50);

	rerender(renderGame(false, true));
	expect(seat(3)?.style.top).toBe("10%");
	expect(Number.parseFloat(seat(1)?.style.left ?? "0")).toBeGreaterThan(50);

	rerender(renderGame(true, false));
	expect(seat(1)?.style.top).toBe("10%");
	expect(Number.parseFloat(seat(2)?.style.left ?? "100")).toBeLessThan(50);
});

it("dreht den Sitzkreis mit dem Nordpfeil nur bei entsperrter Sitzordnung", () => {
	const game = createTestLoadedGameDocument(
		{
			time: { currentNight: 0, phase: "setup" },
			seatOrder: ["p_anna"],
			playersById: {
				p_anna: {
					id: "p_anna",
					name: "Anna",
					lifeState: "alive",
					roles: {},
					statuses: [],
				},
			},
			ruleSetSnapshot: { teams: [], roles: [] },
			statusDefinitionsById: {},
		},
		{ id: "game_north_marker", name: "Nordpfeil" },
	);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={game}
			initialSeatOrderUnlocked
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	const content = document.querySelector<HTMLElement>(".seat-circle-content");
	const marker = screen.getByRole("button", {
		name: "1. Sitzplatz einnorden.",
	});
	const firstSeat = document.querySelector<HTMLElement>(
		'[data-seat-number="1"]',
	);
	expect(marker.hasAttribute("disabled")).toBe(false);
	expect(marker.style.top).toBe("3%");
	expect(firstSeat?.style.top).toBe("10%");
	vi.spyOn(content as HTMLElement, "getBoundingClientRect").mockReturnValue({
		left: 0,
		top: 0,
		width: 200,
		height: 200,
		right: 200,
		bottom: 200,
		x: 0,
		y: 0,
		toJSON: () => ({}),
	});
	Object.defineProperty(marker, "setPointerCapture", {
		configurable: true,
		value: vi.fn(),
	});

	fireEvent.pointerDown(marker, {
		pointerId: 17,
		clientX: 100,
		clientY: 6,
	});
	expect(document.querySelector(".seat-north-guide-line")).not.toBeNull();
	fireEvent.pointerMove(marker, {
		pointerId: 17,
		clientX: 194,
		clientY: 100,
	});
	expect(firstSeat?.style.left).toBe("90%");
	expect(firstSeat?.style.top).toBe("50%");
	expect(marker.style.left).toBe("97%");
	expect(marker.style.top).toBe("50%");
	expect(
		document.querySelector<HTMLElement>(".seat-north-guide-line")?.style
			.transform,
	).toBe("rotate(0rad)");

	fireEvent.pointerMove(marker, {
		pointerId: 17,
		clientX: 6,
		clientY: 100,
	});
	expect(firstSeat?.style.left).toBe("10%");
	expect(
		document.querySelector<HTMLElement>(".seat-north-guide-line")?.style
			.transform,
	).toBe(`rotate(${Math.PI}rad)`);
	fireEvent.pointerUp(marker, {
		pointerId: 17,
		clientX: 6,
		clientY: 100,
	});
	expect(document.querySelector(".seat-north-guide-line")).toBeNull();

	fireEvent.click(screen.getByRole("button", { name: "Sitzordnung sperren" }));
	expect(marker.hasAttribute("disabled")).toBe(true);
});

it("behält ohne Objektfarben die geerbte Schriftfarbe bei", () => {
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 1, phase: "day" },
					seatOrder: ["p_anna"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							lifeState: "alive",
							roles: {},
							statuses: [],
						},
					},
					ruleSetSnapshot: { teams: [], roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_without_colors", name: "Ohne Farben" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	expect(screen.getByRole("button", { name: "Sitzplatz 1" }).style.color).toBe(
		"",
	);
});

it.each([
	["dark", "FFFFFF", "var(--seat-text-dark)"],
	["light", "000000", "var(--seat-text-light)"],
] as const)(
	"wählt im %s-Modus für die Farbe %s die kontrastreichere Schrift",
	(theme, color, expectedTextColor) => {
		render(
			<GameScreen
				{...requiredGameScreenActions}
				theme={theme}
				game={createTestLoadedGameDocument(
					{
						time: { currentNight: 1, phase: "day" },
						seatOrder: ["p_anna"],
						playersById: {
							p_anna: {
								id: "p_anna",
								name: "Anna",
								color,
								lifeState: "alive",
								roles: { actualRoleId: "r_colored" },
								statuses: [],
							},
						},
						ruleSetSnapshot: {
							teams: [{ id: "t_colored", name: "Team", color }],
							roles: [
								{
									id: "r_colored",
									name: "Rolle",
									teamId: "t_colored",
									color,
								},
							],
						},
						statusDefinitionsById: {},
					},
					{ id: `game_contrast_${theme}`, name: "Kontrasttest" },
				)}
				onBack={vi.fn()}
				onMoveSeat={vi.fn()}
				onAdvanceTime={vi.fn()}
				onRewindTime={vi.fn()}
			/>,
		);

		expect(
			screen.getByRole("button", { name: "Sitzplatz 1" }).style.color,
		).toBe(expectedTextColor);
	},
);

it("löscht den ausgewählten Spieler nach einer Sicherheitsabfrage", () => {
	const onDeletePlayer = vi.fn(() => true);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 0, phase: "setup" },
					seatOrder: ["p_anna"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							lifeState: "alive",
							roles: {},
							statuses: [],
						},
					},
					ruleSetSnapshot: { teams: [], roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_delete_player", name: "Löschtest" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onDeletePlayer={onDeletePlayer}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Sitzplatz 1" }));
	fireEvent.click(screen.getByRole("button", { name: "Spieler löschen" }));
	const dialog = screen.getByRole("alertdialog", {
		name: /Sitzplatz 1\s*Spieler: Anna\s*löschen\?/,
	});
	expect(
		within(dialog)
			.getByRole("button", { name: "OK" })
			.closest(".exit-dialog-actions"),
	).not.toBeNull();
	expect(
		within(dialog)
			.getByRole("button", { name: "OK" })
			.classList.contains("danger-action"),
	).toBe(true);
	expect(onDeletePlayer).not.toHaveBeenCalled();
	fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));

	expect(onDeletePlayer).toHaveBeenCalledWith(1);
	expect(screen.getByText("Sitzplatz auswählen.")).toBeDefined();
});

it("meldet eine Spieleränderung als vollständigen SavePlayerCommand", () => {
	const onSavePlayer = vi.fn<(command: SavePlayerCommand) => boolean>(
		() => true,
	);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 0, phase: "setup" },
					seatOrder: ["p_anna"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							lifeState: "alive",
							roles: {
								actualRoleId: null,
								shownRoleIds: [],
								nightRoleId: null,
							},
							statuses: [],
						},
					},
					ruleSetSnapshot: { teams: [], roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_save_player", name: "Spielertest" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onSavePlayer={onSavePlayer}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Sitzplatz 1" }));
	const name = screen.getByLabelText("Spielername");
	fireEvent.change(name, { target: { value: "Bea" } });
	fireEvent.blur(name);

	expect(onSavePlayer.mock.calls[0]?.[0]).toMatchObject({
		originalPlayerId: "p_anna",
		player: {
			id: "p_anna",
			name: "Bea",
			lifeState: "alive",
			statuses: [],
		},
		seatNumber: 1,
	});
});

it("ändert den Lebensstatus über den bestehenden SavePlayerCommand", () => {
	const onSavePlayer = vi.fn<(command: SavePlayerCommand) => boolean>(
		() => true,
	);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 1, phase: "day" },
					seatOrder: ["p_anna"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							lifeState: "dead_vote_available",
							roles: {
								actualRoleId: null,
								shownRoleIds: [],
								nightRoleId: null,
							},
							statuses: [],
						},
					},
					ruleSetSnapshot: { teams: [], roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_change_life_state", name: "Lebensstatustest" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onSavePlayer={onSavePlayer}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Sitzplatz 1" }));
	const lifeState = screen.getByLabelText<HTMLSelectElement>("Lebensstatus");
	expect(lifeState.value).toBe("dead_vote_available");
	expect(
		within(lifeState).getByRole("option", { name: "Lebendig" }),
	).toBeDefined();
	expect(
		within(lifeState).getByRole("option", {
			name: "Doppelt tot – Stimme verbraucht",
		}),
	).toBeDefined();

	fireEvent.change(lifeState, {
		target: { value: "doubledead_vote_spent" },
	});

	expect(onSavePlayer.mock.calls[0]?.[0]).toMatchObject({
		originalPlayerId: "p_anna",
		player: {
			id: "p_anna",
			name: "Anna",
			lifeState: "doubledead_vote_spent",
		},
		seatNumber: 1,
	});
});

it("ergänzt und löscht mehrere gezeigte Rollen über den Spielereditor", async () => {
	const onSavePlayer = vi.fn<(command: SavePlayerCommand) => boolean>(
		() => true,
	);
	const onMoveShownRole = vi.fn(() => true);
	const onChangeShownRole = vi.fn(() => true);
	const onShownRoleLongPress = vi.fn();
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 0, phase: "setup" },
					seatOrder: ["p_anna"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							lifeState: "alive",
							roles: {
								actualRoleId: "r_empath",
								shownRoleIds: ["r_empath", "r_drunk", "r_saint"],
								nightRoleId: "r_empath",
							},
							statuses: [],
						},
					},
					ruleSetSnapshot: {
						teams: [],
						roles: [
							{ id: "r_empath", name: "Empath" },
							{ id: "r_drunk", name: "Drunk" },
							{ id: "r_saint", name: "Saint" },
							{ id: "r_imp", name: "Imp" },
						],
					},
					statusDefinitionsById: {},
				},
				{ id: "game_shown_roles", name: "Gezeigte Rollen" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onSavePlayer={onSavePlayer}
			onMoveShownRole={onMoveShownRole}
			onChangeShownRole={onChangeShownRole}
			onShownRoleLongPress={onShownRoleLongPress}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Sitzplatz 1" }));
	const empathRole = screen.getByRole("button", { name: "◆ Empath" });
	fireEvent.click(empathRole);
	const roleSelection = screen.getByRole("dialog", { name: "Gezeigte Rolle" });
	fireEvent.click(within(roleSelection).getByRole("button", { name: "◆ Imp" }));
	expect(onChangeShownRole).toHaveBeenCalledWith({
		playerId: "p_anna",
		index: 0,
		roleId: "r_imp",
	});

	const insertionTarget = document.querySelector<HTMLElement>(
		'[data-shown-role-insertion-index="2"]',
	);
	expect(insertionTarget).not.toBeNull();
	Object.defineProperty(empathRole, "setPointerCapture", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(document, "elementFromPoint", {
		configurable: true,
		value: vi.fn(() => insertionTarget),
	});
	vi.useFakeTimers();
	// Eine sofortige Ziehbewegung bleibt dem Scrollcontainer vorbehalten.
	fireEvent.pointerDown(empathRole, {
		pointerId: 7,
		pointerType: "mouse",
		clientX: 10,
		clientY: 10,
	});
	fireEvent.pointerMove(empathRole, {
		pointerId: 7,
		pointerType: "mouse",
		clientX: 30,
		clientY: 35,
	});
	expect(empathRole.classList.contains("shown-role-button--dragging")).toBe(
		false,
	);
	fireEvent.pointerUp(empathRole, {
		pointerId: 7,
		pointerType: "mouse",
		clientX: 30,
		clientY: 35,
	});
	expect(onMoveShownRole).not.toHaveBeenCalled();

	// Erst ein Long-Press aktiviert die sichtbare Verschiebung.
	fireEvent.pointerDown(empathRole, {
		pointerId: 8,
		pointerType: "touch",
		clientX: 10,
		clientY: 10,
	});
	await act(() => vi.advanceTimersByTime(450));
	expect(onShownRoleLongPress).toHaveBeenCalledTimes(1);
	fireEvent.pointerMove(empathRole, {
		pointerId: 8,
		pointerType: "touch",
		clientX: 30,
		clientY: 35,
	});
	expect(empathRole.classList.contains("shown-role-button--dragging")).toBe(
		true,
	);
	expect(empathRole.style.transform).toBe("translate(20px, 25px)");
	expect(insertionTarget?.classList).toContain(
		"shown-role-insertion-target--active",
	);
	fireEvent.pointerUp(empathRole, {
		pointerId: 8,
		pointerType: "touch",
		clientX: 30,
		clientY: 35,
	});
	expect(onMoveShownRole).toHaveBeenCalledWith({
		playerId: "p_anna",
		fromIndex: 0,
		toInsertionIndex: 2,
	});

	onMoveShownRole.mockClear();
	fireEvent.click(screen.getByRole("button", { name: "Weiter: ◆ Empath" }));
	expect(onMoveShownRole).toHaveBeenCalledWith({
		playerId: "p_anna",
		fromIndex: 0,
		toInsertionIndex: 2,
	});

	fireEvent.change(screen.getByLabelText("Auswählen …"), {
		target: { value: "r_imp" },
	});
	expect(onSavePlayer.mock.calls.at(-1)?.[0].player.roles.shownRoleIds).toEqual(
		["r_empath", "r_drunk", "r_saint", "r_imp"],
	);

	fireEvent.click(screen.getByRole("button", { name: "◆ Drunk entfernen" }));
	expect(onSavePlayer.mock.calls.at(-1)?.[0].player.roles.shownRoleIds).toEqual(
		["r_empath", "r_saint"],
	);
});

it("speichert, verwirft oder löscht einen bestehenden Spielerzustand", () => {
	const onSavePlayer = vi.fn<(command: SavePlayerCommand) => boolean>(
		() => true,
	);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 1, phase: "night" },
					seatOrder: ["p_anna"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							lifeState: "alive",
							roles: {},
							statuses: [
								{
									id: "s_poisoned_1",
									statusId: "d_poisoned",
									fromNight: 1,
									untilNight: 2,
									note: "Alt",
								},
							],
						},
					},
					ruleSetSnapshot: {
						teams: [],
						roles: [],
						statuses: [{ id: "d_poisoned", name: "Vergiftet" }],
					},
					statusDefinitionsById: {
						d_poisoned: { id: "d_poisoned", name: "Vergiftet" },
					},
				},
				{ id: "game_edit_status", name: "Zustandstest" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onSavePlayer={onSavePlayer}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Sitzplatz 1" }));
	fireEvent.click(screen.getByRole("button", { name: /Vergiftet/ }));
	let dialog = screen.getByRole("dialog", { name: "Zustand bearbeiten" });
	expect(
		within(dialog)
			.getAllByRole("button")
			.map((button) => button.textContent),
	).toEqual(["×", "Speichern", "Abbrechen", "Löschen"]);
	expect(
		within(dialog)
			.getByRole("button", { name: "Speichern" })
			.closest(".exit-dialog-actions"),
	).not.toBeNull();
	expect(
		within(dialog)
			.getByRole("button", { name: "Löschen" })
			.classList.contains("danger-action"),
	).toBe(true);

	fireEvent.change(within(dialog).getByLabelText("Notiz"), {
		target: { value: "Neu" },
	});
	onSavePlayer.mockReturnValueOnce(false);
	fireEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));
	expect(onSavePlayer.mock.calls[0]?.[0]).toMatchObject({
		player: {
			statuses: [
				{
					id: "s_poisoned_1",
					statusId: "d_poisoned",
					note: "Neu",
				},
			],
		},
	});
	expect(
		screen.getByRole("dialog", { name: "Zustand bearbeiten" }),
	).toBeDefined();
	fireEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));
	expect(
		screen.queryByRole("dialog", { name: "Zustand bearbeiten" }),
	).toBeNull();

	fireEvent.click(screen.getByRole("button", { name: /Vergiftet/ }));
	dialog = screen.getByRole("dialog", { name: "Zustand bearbeiten" });
	fireEvent.change(within(dialog).getByLabelText("Notiz"), {
		target: { value: "Nicht speichern" },
	});
	fireEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));
	expect(onSavePlayer).toHaveBeenCalledTimes(2);

	fireEvent.click(screen.getByRole("button", { name: /Vergiftet/ }));
	dialog = screen.getByRole("dialog", { name: "Zustand bearbeiten" });
	fireEvent.click(within(dialog).getByRole("button", { name: "Löschen" }));

	expect(onSavePlayer.mock.calls[2]?.[0]).toMatchObject({
		originalPlayerId: "p_anna",
		player: {
			id: "p_anna",
			statuses: [],
		},
		seatNumber: 1,
	});
	expect(
		screen.queryByRole("dialog", { name: "Zustand bearbeiten" }),
	).toBeNull();
});

it("fügt im Setup im Uhrzeigersinn einen neuen Spieler samt Sitzplatz ein", () => {
	const onSavePlayer = vi.fn<(command: SavePlayerCommand) => boolean>(
		() => true,
	);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 0, phase: "setup" },
					seatOrder: ["p_anna", "p_bob"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							lifeState: "alive",
							roles: {},
							statuses: [],
						},
						p_bob: {
							id: "p_bob",
							name: "Bob",
							lifeState: "alive",
							roles: {},
							statuses: [],
						},
					},
					ruleSetSnapshot: { teams: [], roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_add_setup_seat", name: "Sitz hinzufügen" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onSavePlayer={onSavePlayer}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	const addSeatButton = screen.getByRole("button", {
		name: "Nach Sitzplatz 1 Spieler hinzufügen",
	});
	expect(addSeatButton.classList.contains("icon-button")).toBe(true);
	fireEvent.click(addSeatButton);
	const dialog = screen.getByRole("alertdialog", {
		name: /neuen Sitzplatz nach\s*Sitzplatz 1\s*Spieler: Anna\s*ergänzen\?/,
	});
	expect(
		within(dialog)
			.getByRole("button", { name: "OK" })
			.closest(".exit-dialog-actions"),
	).not.toBeNull();
	expect(
		within(dialog)
			.getByRole("button", { name: "OK" })
			.classList.contains("danger-action"),
	).toBe(false);
	expect(onSavePlayer).not.toHaveBeenCalled();
	fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));

	expect(onSavePlayer.mock.calls[0]?.[0]).toEqual({
		originalPlayerId: null,
		player: {
			id: "",
			name: "Player 3",
			lifeState: "alive",
			roles: {
				actualRoleId: null,
				shownRoleIds: [],
				nightRoleId: null,
			},
			statuses: [],
		},
		seatNumber: 2,
	});
});

it("erzeugt bei einem fehlgeschlagenen Hinzufügen keinen Phantom-Sitzplatz", () => {
	const onSavePlayer = vi.fn<(command: SavePlayerCommand) => boolean>(
		() => false,
	);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 0, phase: "setup" },
					seatOrder: ["p_anna", "p_bob"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							lifeState: "alive",
							roles: {},
							statuses: [],
						},
						p_bob: {
							id: "p_bob",
							name: "Bob",
							lifeState: "alive",
							roles: {},
							statuses: [],
						},
					},
					ruleSetSnapshot: { teams: [], roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_failed_add", name: "Fehlgeschlagenes Hinzufügen" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onSavePlayer={onSavePlayer}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(
		screen.getByRole("button", {
			name: "Nach Sitzplatz 1 Spieler hinzufügen",
		}),
	);
	const dialog = screen.getByRole("alertdialog");
	fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));

	expect(onSavePlayer).toHaveBeenCalledTimes(1);
	expect(screen.getByRole("alertdialog")).toBeDefined();
	expect(screen.queryByRole("button", { name: /^Sitzplatz 3$/ })).toBeNull();
});

it("löscht im Setup einen Sitzplatz und dessen echten Spieler", () => {
	const onDeletePlayer = vi.fn(() => true);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 0, phase: "setup" },
					seatOrder: ["p_anna"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							lifeState: "alive",
							roles: {},
							statuses: [],
						},
					},
					ruleSetSnapshot: { teams: [], roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_delete_setup_player", name: "Spielerplatz löschen" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onDeletePlayer={onDeletePlayer}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Sitzplatz 1 löschen" }));
	const dialog = screen.getByRole("alertdialog", {
		name: /Sitzplatz 1\s*Spieler: Anna\s*löschen\?/,
	});
	expect(onDeletePlayer).not.toHaveBeenCalled();
	fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));

	expect(onDeletePlayer).toHaveBeenCalledWith(1);
	expect(screen.queryByRole("button", { name: "Sitzplatz 1" })).toBeNull();
});

it("löscht für p_empty im Setup nur den leeren Sitzplatz", () => {
	const onDeleteEmptySeat = vi.fn(() => true);
	const onDeletePlayer = vi.fn(() => true);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 0, phase: "setup" },
					seatOrder: ["p_empty"],
					playersById: {},
					ruleSetSnapshot: { teams: [], roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_delete_empty_setup_seat", name: "Leeren Platz löschen" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onDeleteEmptySeat={onDeleteEmptySeat}
			onDeletePlayer={onDeletePlayer}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Sitzplatz 1 löschen" }));
	const dialog = screen.getByRole("alertdialog", {
		name: /Sitzplatz 1\s*Spieler: –\s*löschen\?/,
	});
	expect(onDeleteEmptySeat).not.toHaveBeenCalled();
	fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));

	expect(onDeleteEmptySeat).toHaveBeenCalledWith(1);
	expect(onDeletePlayer).not.toHaveBeenCalled();
});

it("bietet die Sitzplatzaktionen auch neben der Detailüberschrift an", () => {
	const onSavePlayer = vi.fn<(command: SavePlayerCommand) => boolean>(
		() => true,
	);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 0, phase: "setup" },
					seatOrder: ["p_anna"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							lifeState: "alive",
							roles: {},
							statuses: [],
						},
					},
					ruleSetSnapshot: { teams: [], roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_detail_setup_actions", name: "Detailaktionen" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onSavePlayer={onSavePlayer}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Sitzplatz 1" }));
	expect(
		screen.getByRole("button", {
			name: "Ausgewählten Sitzplatz 1 löschen",
		}),
	).toBeDefined();
	fireEvent.click(
		screen.getByRole("button", {
			name: "Nach ausgewähltem Sitzplatz 1 Spieler hinzufügen",
		}),
	);
	const dialog = screen.getByRole("alertdialog");
	expect(within(dialog).getByRole("button", { name: "OK" })).toBeDefined();
	expect(within(dialog).getByRole("button", { name: "Abbruch" })).toBeDefined();
	fireEvent.click(within(dialog).getByRole("button", { name: "Abbruch" }));

	expect(onSavePlayer).not.toHaveBeenCalled();
	expect(screen.queryByRole("alertdialog")).toBeNull();
});

it("blendet die Sitzplatzaktionen nach dem Setup aus", () => {
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 1, phase: "night" },
					seatOrder: ["p_anna"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							lifeState: "alive",
							roles: {},
							statuses: [],
						},
					},
					ruleSetSnapshot: { teams: [], roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_without_setup_actions", name: "Keine Sitzaktionen" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	expect(
		screen.queryByRole("button", { name: "Sitzplatz 1 löschen" }),
	).toBeNull();
	expect(
		screen.queryByRole("button", {
			name: "Nach Sitzplatz 1 Spieler hinzufügen",
		}),
	).toBeNull();
});

it("bietet für einen leeren Sitz ungesetzte und neue Spieler sowie Löschen an", () => {
	const onSavePlayer = vi.fn<(command: SavePlayerCommand) => boolean>(
		() => true,
	);
	const onDeleteEmptySeat = vi.fn(() => true);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: ["p_empty"],
					playersById: {
						p_waiting: {
							id: "p_waiting",
							name: "Wartend",
							lifeState: "alive",
							roles: {
								actualRoleId: null,
								shownRoleIds: [],
								nightRoleId: null,
							},
							statuses: [],
						},
					},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_empty_seat", name: "Leerer Sitz" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onSavePlayer={onSavePlayer}
			onDeleteEmptySeat={onDeleteEmptySeat}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Sitzplatz 1" }));
	const playerSelect = screen.getByLabelText("Spieler");
	expect(screen.getByRole("option", { name: "Wartend" })).toBeDefined();
	fireEvent.change(playerSelect, { target: { value: "p_waiting" } });
	expect(onSavePlayer.mock.calls[0]?.[0]).toMatchObject({
		originalPlayerId: "p_waiting",
		player: { id: "p_waiting", name: "Wartend" },
		seatNumber: 1,
	});

	fireEvent.click(screen.getByRole("button", { name: "+ Spieler" }));
	expect(onSavePlayer.mock.calls[1]?.[0]).toMatchObject({
		originalPlayerId: null,
		player: { id: "", name: "Player 2" },
		seatNumber: 1,
	});

	fireEvent.click(
		screen.getByRole("button", { name: "Leeren Sitzplatz löschen" }),
	);
	expect(onDeleteEmptySeat).toHaveBeenCalledWith(1);
	expect(screen.getByText("Sitzplatz auswählen.")).toBeDefined();
});

it("bietet nach einem behebbaren Schreibfehler Wiederholen und Wiederherstellen an", async () => {
	const onSave = vi
		.fn<() => Promise<void>>()
		.mockRejectedValueOnce(
			new ObjectSaveInterruptedError("Speichern fehlgeschlagen", "command-1"),
		)
		.mockResolvedValueOnce();
	const onRestorePreviousFile = vi.fn(() => Promise.resolve());
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: [],
					playersById: {},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_recovery", name: "Rettungstest" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
			onSave={onSave}
			onRestorePreviousFile={onRestorePreviousFile}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
	fireEvent.click(screen.getByRole("button", { name: "Spiel speichern" }));

	const dialog = await screen.findByRole("alertdialog", {
		name: "Datei konnte nicht gespeichert werden.",
	});
	expect(dialog).toBeDefined();
	expect(screen.getByRole("button", { name: "Abbrechen" })).toBeDefined();
	fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

	await waitFor(() => expect(onRestorePreviousFile).toHaveBeenCalledOnce());
	expect(onRestorePreviousFile).toHaveBeenCalledWith("command-1");
	expect(onSave).toHaveBeenCalledOnce();
	expect(
		screen.queryByRole("alertdialog", {
			name: "Datei konnte nicht gespeichert werden.",
		}),
	).toBeNull();
});

it("setzt einen unterbrochenen Speicherbefehl mit Escape auf später entscheiden", async () => {
	const onSave = vi
		.fn<() => Promise<void>>()
		.mockRejectedValueOnce(
			new ObjectSaveInterruptedError(
				"Speichern fehlgeschlagen",
				"command-later",
			),
		);
	const onFinishStorageCommand = vi.fn(() => Promise.resolve());
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: [],
					playersById: {},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_recovery_later", name: "Später entscheiden" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
			onSave={onSave}
			onFinishStorageCommand={onFinishStorageCommand}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
	fireEvent.click(screen.getByRole("button", { name: "Spiel speichern" }));
	const dialog = await screen.findByRole("alertdialog", {
		name: "Datei konnte nicht gespeichert werden.",
	});
	fireEvent.keyDown(dialog, { key: "Escape" });

	await waitFor(() =>
		expect(onFinishStorageCommand).toHaveBeenCalledWith("command-later"),
	);
	await waitFor(() =>
		expect(
			screen.queryByRole("alertdialog", {
				name: "Datei konnte nicht gespeichert werden.",
			}),
		).toBeNull(),
	);
});

it("nennt einen vollen Datenträger im Speicherdialog als Ursache", async () => {
	const onSave = vi
		.fn<() => Promise<void>>()
		.mockRejectedValueOnce(
			new ObjectSaveInterruptedError(
				"No space left on device",
				"command-disk-full",
				"diskFull",
			),
		);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: [],
					playersById: {},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_disk_full", name: "Speicherplatztest" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
			onSave={onSave}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
	fireEvent.click(screen.getByRole("button", { name: "Spiel speichern" }));

	const dialog = await screen.findByRole("alertdialog", {
		name: "Datei konnte nicht gespeichert werden.",
	});
	expect(dialog.textContent).toContain(
		"Der Speicherplatz ist voll. Bitte geben Sie Speicherplatz frei und versuchen Sie es erneut.",
	);
});

it("wiederholt einen fehlgeschlagenen Storage-Befehl über seine commandId", async () => {
	const onSave = vi
		.fn<() => Promise<void>>()
		.mockRejectedValueOnce(
			new ObjectSaveInterruptedError("Speichern fehlgeschlagen", "command-1"),
		);
	const onRetryStorageCommand = vi.fn<(commandId: string) => Promise<void>>(
		() => Promise.resolve(),
	);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: [],
					playersById: {},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_recovery", name: "Rettungstest" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
			onSave={onSave}
			onRetryStorageCommand={onRetryStorageCommand}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
	fireEvent.click(screen.getByRole("button", { name: "Spiel speichern" }));
	await screen.findByRole("alertdialog", {
		name: "Datei konnte nicht gespeichert werden.",
	});
	fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));

	await waitFor(() =>
		expect(onRetryStorageCommand).toHaveBeenCalledWith("command-1"),
	);
	expect(onSave).toHaveBeenCalledOnce();
	expect(
		screen.queryByRole("alertdialog", {
			name: "Datei konnte nicht gespeichert werden.",
		}),
	).toBeNull();
});

it("öffnet die Verwaltung der Spielobjekte über den Domain-Aufruf", () => {
	const onManageGameEntities = vi.fn();
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: [],
					playersById: {},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_testspiel", name: "Testspiel" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
			onManageGameEntities={onManageGameEntities}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
	const manageButton = screen.getByRole("button", {
		name: "Teams, Rollen, Zustände verwalten",
	});
	expect((manageButton as HTMLButtonElement).disabled).toBe(false);
	fireEvent.click(manageButton);

	expect(onManageGameEntities).toHaveBeenCalledOnce();
	expect(screen.queryByRole("dialog", { name: "Spielmenü" })).toBeNull();
});

it("öffnet das Log direkt über Einstellungen als eigene Unterseite", () => {
	const onDeleteLogEntry = vi.fn(() => true);
	const onClearLog = vi.fn(() => true);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: [],
					playersById: {},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
					log: [
						{
							id: "log_1",
							night: 1,
							phase: "night",
							createdAt: "2026-07-29T20:15:00.000Z",
							type: "time_advanced",
							actor: "storyteller",
							text: "Die erste Nacht beginnt.",
						},
					],
				},
				{ id: "game_log", name: "Logtest" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
			onDeleteLogEntry={onDeleteLogEntry}
			onClearLog={onClearLog}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
	const menu = screen.getByRole("dialog", { name: "Spielmenü" });
	const actions = within(
		within(menu).getByRole("navigation", { name: "Spielaktionen" }),
	).getAllByRole("button");
	expect(actions.slice(-2).map((button) => button.textContent)).toEqual([
		"📜 Log anzeigen",
		"⚙ Einstellungen",
	]);

	fireEvent.click(within(menu).getByRole("button", { name: "Log anzeigen" }));

	expect(screen.getByRole("heading", { name: "Log" })).toBeDefined();
	expect(screen.getByText("Nacht 1")).toBeDefined();
	expect(screen.getByText("Die erste Nacht beginnt.")).toBeDefined();
	expect(screen.queryByRole("dialog", { name: "Spielmenü" })).toBeNull();
	const logEntry = screen.getByRole("listitem");
	const entryDeleteButton = within(logEntry).getByRole("button", {
		name: "Löschen",
	});
	expect(entryDeleteButton.textContent).toBe("🗑");
	fireEvent.click(entryDeleteButton);
	expect(onDeleteLogEntry).toHaveBeenCalledWith("log_1");

	const bottomDeleteButton = screen
		.getAllByRole("button", { name: "Löschen" })
		.find((button) => button.textContent === "Löschen");
	expect(bottomDeleteButton).toBeDefined();
	if (!bottomDeleteButton) return;
	fireEvent.click(bottomDeleteButton);
	expect(onClearLog).toHaveBeenCalledOnce();

	fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
	expect(
		screen.getByRole("button", { name: "Spielmenü öffnen" }),
	).toBeDefined();
});

it("zeigt das Spielmenü auf Englisch an", () => {
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: [],
					playersById: {},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_english_menu", name: "English menu" },
			)}
			language="en"
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Open game menu" }));
	const menu = screen.getByRole("dialog", { name: "Game menu" });
	expect(within(menu).getByRole("button", { name: "Save game" })).toBeDefined();
	expect(within(menu).getByRole("button", { name: "Show log" })).toBeDefined();
	expect(
		within(menu).getByRole("button", { name: "Shuffle players" }),
	).toBeDefined();
	expect(within(menu).getByRole("button", { name: "Settings" })).toBeDefined();
	const expectedSymbolsByName = new Map([
		["Save game", "💾"],
		["Save game as", "📝"],
		["Save game as template", "📋"],
		["Exit game", "🚪"],
		["Manage teams, roles and statuses", "🧩"],
		["Assign roles randomly", "🎲"],
		["Shuffle players", "🔀"],
		["Roles to be shown", "👁"],
		["Show log", "📜"],
		["Settings", "⚙"],
	]);
	for (const [name, symbol] of expectedSymbolsByName) {
		const button = within(menu).getByRole("button", { name });
		expect(button.querySelector("span[aria-hidden='true']")?.textContent).toBe(
			symbol,
		);
	}
});

it("öffnet die zufällige Rollenverteilung über den Domain-Aufruf", () => {
	const onRandomizeRoles = vi.fn();
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: [],
					playersById: {},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_testspiel", name: "Testspiel" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
			onRandomizeRoles={onRandomizeRoles}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
	const randomizeButton = screen.getByRole("button", {
		name: "Rollen zufällig vergeben",
	});
	expect(randomizeButton.hasAttribute("disabled")).toBe(false);
	fireEvent.click(randomizeButton);

	expect(onRandomizeRoles).toHaveBeenCalledOnce();
	expect(screen.queryByRole("dialog", { name: "Spielmenü" })).toBeNull();
});

it("ordnet Spieler über das Spielmenü erst nach Bestätigung zufällig an", () => {
	const onShufflePlayers = vi.fn(() => true);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: ["p_anna", "p_bob"],
					playersById: {
						p_anna: { id: "p_anna", name: "Anna" },
						p_bob: { id: "p_bob", name: "Bob" },
					},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_shuffle", name: "Mischtest" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
			onShufflePlayers={onShufflePlayers}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
	fireEvent.click(
		screen.getByRole("button", { name: "Spieler zufällig anordnen" }),
	);

	expect(onShufflePlayers).not.toHaveBeenCalled();
	expect(screen.queryByRole("dialog", { name: "Spielmenü" })).toBeNull();
	const confirmation = screen.getByRole("alertdialog", {
		name: "Spieler zufällig anordnen",
	});
	expect(
		within(confirmation)
			.getByRole("button", { name: "OK" })
			.closest(".exit-dialog-actions"),
	).not.toBeNull();
	expect(confirmation.classList.contains("seat-action-confirmation")).toBe(
		true,
	);
	fireEvent.click(
		within(confirmation).getByRole("button", { name: "Abbrechen" }),
	);
	expect(onShufflePlayers).not.toHaveBeenCalled();
	expect(
		screen.queryByRole("alertdialog", {
			name: "Spieler zufällig anordnen",
		}),
	).toBeNull();

	fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
	fireEvent.click(
		screen.getByRole("button", { name: "Spieler zufällig anordnen" }),
	);
	fireEvent.click(
		within(
			screen.getByRole("alertdialog", {
				name: "Spieler zufällig anordnen",
			}),
		).getByRole("button", { name: "OK" }),
	);

	expect(onShufflePlayers).toHaveBeenCalledOnce();
	expect(
		screen.queryByRole("alertdialog", {
			name: "Spieler zufällig anordnen",
		}),
	).toBeNull();
});

it("öffnet den Editor für Rollen zum Zeigen über den Domain-Aufruf", () => {
	const onEditRolesForShowing = vi.fn();
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: [],
					playersById: {},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_testspiel", name: "Testspiel" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
			onEditRolesForShowing={onEditRolesForShowing}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
	const editButton = screen.getByRole("button", {
		name: "Rollen, die gezeigt werden",
	});
	expect(editButton.hasAttribute("disabled")).toBe(false);
	fireEvent.click(editButton);

	expect(onEditRolesForShowing).toHaveBeenCalledOnce();
	expect(screen.queryByRole("dialog", { name: "Spielmenü" })).toBeNull();
});

it("öffnet Speichern unter mit dem Domain-Vorschlag", async () => {
	const onSuggestSaveAsName = vi.fn(() => Promise.resolve("Testspiel (1)"));
	const onSaveAs = vi.fn(() => Promise.resolve());
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: [],
					playersById: {},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_testspiel", name: "Testspiel" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
			onSuggestSaveAsName={onSuggestSaveAsName}
			onSaveAs={onSaveAs}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
	fireEvent.click(
		screen.getByRole("button", { name: "Spiel speichern unter" }),
	);
	const nameInput = await screen.findByLabelText<HTMLInputElement>("Name");
	expect(nameInput.value).toBe("Testspiel (1)");
	fireEvent.change(nameInput, { target: { value: "Testspiel Kopie" } });
	fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

	await waitFor(() => expect(onSaveAs).toHaveBeenCalledWith("Testspiel Kopie"));
	expect(screen.queryByRole("dialog")).toBeNull();
});

it("bietet bei einer Zielkollision Überschreiben, Abbrechen und Beide behalten an", async () => {
	const onSaveAs = vi.fn(() =>
		Promise.reject(
			new ObjectSaveInterruptedError(
				"Datei existiert bereits",
				"collision-1",
				"targetExists",
			),
		),
	);
	let finishContinuation: (() => void) | undefined;
	const onContinue = vi.fn(
		() =>
			new Promise<void>((resolve) => {
				finishContinuation = resolve;
			}),
	);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: [],
					playersById: {},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_collision", name: "Kollision" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
			onSuggestSaveAsName={() => Promise.resolve("Kollision")}
			onSaveAs={onSaveAs}
			onContinueCreatedStorageCommand={onContinue}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
	fireEvent.click(
		screen.getByRole("button", { name: "Spiel speichern unter" }),
	);
	fireEvent.click(await screen.findByRole("button", { name: "Speichern" }));
	const dialog = await screen.findByRole("alertdialog", {
		name: "Datei konnte nicht gespeichert werden.",
	});
	expect(
		within(dialog).getByRole("button", { name: "Überschreiben" }),
	).toBeDefined();
	expect(
		within(dialog).getByRole("button", { name: "Abbrechen" }),
	).toBeDefined();
	const keepBoth = within(dialog).getByRole("button", {
		name: "Beide behalten",
	});
	fireEvent.click(keepBoth);
	await waitFor(() =>
		expect(onContinue).toHaveBeenCalledWith("collision-1", "keepBoth"),
	);
	const collisionButtons = within(dialog).getAllByRole("button");
	await waitFor(() =>
		expect(
			collisionButtons.every((button) => button.hasAttribute("disabled")),
		).toBe(true),
	);
	fireEvent.click(keepBoth);
	expect(onContinue).toHaveBeenCalledTimes(1);
	finishContinuation?.();
	await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
});

it("zeigt Fehler bei der Auflösung einer Zielkollision im Dialog an", async () => {
	const onSaveAs = vi.fn(() =>
		Promise.reject(
			new ObjectSaveInterruptedError(
				"Datei existiert bereits",
				"collision-2",
				"targetExists",
			),
		),
	);
	const onContinue = vi.fn(() =>
		Promise.reject(new Error("collision resolution failed")),
	);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: [],
					playersById: {},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_collision_error", name: "Kollision" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
			onSuggestSaveAsName={() => Promise.resolve("Kollision")}
			onSaveAs={onSaveAs}
			onContinueCreatedStorageCommand={onContinue}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
	fireEvent.click(
		screen.getByRole("button", { name: "Spiel speichern unter" }),
	);
	fireEvent.click(await screen.findByRole("button", { name: "Speichern" }));
	const dialog = await screen.findByRole("alertdialog", {
		name: "Datei konnte nicht gespeichert werden.",
	});
	fireEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));

	await waitFor(() =>
		expect(
			within(dialog).getByText(/collision resolution failed/),
		).toBeDefined(),
	);
	expect(onContinue).toHaveBeenCalledWith("collision-2", "cancel");
	expect(
		within(dialog)
			.getByRole("button", { name: "Beide behalten" })
			.hasAttribute("disabled"),
	).toBe(false);
});

it("speichert eine Vorlage ausschließlich über die bereitgestellten Domain-Aufrufe", async () => {
	const onSuggestTemplateName = vi.fn(() =>
		Promise.resolve("Testspiel Vorlage"),
	);
	const onSaveAsTemplate = vi.fn(() => Promise.resolve());
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: [],
					playersById: {},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_testspiel", name: "Testspiel" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
			onSuggestTemplateName={onSuggestTemplateName}
			onSaveAsTemplate={onSaveAsTemplate}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Spielmenü öffnen" }));
	fireEvent.click(
		screen.getByRole("button", {
			name: "Spiel als Vorlage speichern unter",
		}),
	);
	const nameInput = await screen.findByLabelText<HTMLInputElement>("Name");
	expect(nameInput.value).toBe("Testspiel Vorlage");
	expect(onSuggestTemplateName).toHaveBeenCalledOnce();
	fireEvent.change(nameInput, { target: { value: "Meine Vorlage" } });
	fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

	await waitFor(() =>
		expect(onSaveAsTemplate).toHaveBeenCalledWith("Meine Vorlage"),
	);
	expect(screen.queryByRole("dialog")).toBeNull();
});

it("zeigt beim Sitzwechsel den Namen des neu gewählten Spielers", () => {
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: ["p_player1", "p_player2"],
					playersById: {
						p_player1: {
							id: "p_player1",
							name: "Player 1",
							roles: {},
							statuses: [],
						},
						p_player2: {
							id: "p_player2",
							name: "Player 2",
							roles: {},
							statuses: [],
						},
					},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_names", name: "Namenstest" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
			seatBoardBackgroundSource="/api/dev/assets/backgrounds/bg_game_dark?external=0"
		/>,
	);
	const seatBoard = screen.getByRole("group", { name: "Sitzordnung" });
	const zoomContent = seatBoard.querySelector<HTMLElement>(
		".seat-circle-content--with-background",
	);
	expect(zoomContent?.style.backgroundImage).toContain("bg_game_dark");
	expect(seatBoard.style.backgroundImage).toBe("");

	fireEvent.click(screen.getByRole("button", { name: "Sitzplatz 1" }));
	const firstName = screen.getByLabelText<HTMLInputElement>("Spielername");
	fireEvent.change(firstName, { target: { value: "Anna" } });
	expect(firstName.value).toBe("Anna");

	fireEvent.click(screen.getByRole("button", { name: "Sitzplatz 2" }));
	expect(screen.getByLabelText<HTMLInputElement>("Spielername").value).toBe(
		"Player 2",
	);
});

it("verschiebt Spieler auf Touchgeräten ohne den Bildschirm zu scrollen", () => {
	const onMoveSeat = vi.fn();
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: ["p_player1", "p_player2"],
					playersById: {
						p_player1: {
							id: "p_player1",
							name: "Player 1",
							roles: {},
							statuses: [],
						},
						p_player2: {
							id: "p_player2",
							name: "Player 2",
							roles: {},
							statuses: [],
						},
					},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_touch_drag", name: "Touchtest" },
			)}
			onBack={vi.fn()}
			onMoveSeat={onMoveSeat}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(
		screen.getByRole("button", { name: "Sitzordnung entsperren" }),
	);
	const source = screen.getByRole("button", { name: "Sitzplatz 1" });
	const target = screen.getByRole("button", { name: "Sitzplatz 2" });
	Object.defineProperty(source, "setPointerCapture", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(document, "elementFromPoint", {
		configurable: true,
		value: vi.fn(() => target),
	});

	fireEvent.pointerDown(source, {
		pointerId: 1,
		pointerType: "touch",
		clientX: 10,
		clientY: 10,
	});
	fireEvent.pointerMove(source, {
		pointerId: 1,
		pointerType: "touch",
		clientX: 30,
		clientY: 30,
	});
	expect(source.classList.contains("seat-button--dragging")).toBe(true);
	expect(source.style.transform).toContain("20px");
	fireEvent.pointerUp(source, {
		pointerId: 1,
		pointerType: "touch",
		clientX: 30,
		clientY: 30,
	});

	expect(onMoveSeat).toHaveBeenCalledWith({
		fromSeatNumber: 1,
		toSeatNumber: 2,
	});
});

it("behält geöffnete Spielerdetails beim Verschieben am selben Spieler", () => {
	const initialGame = createTestLoadedGameDocument(
		{
			seatOrder: ["p_player1", "p_player2"],
			playersById: {
				p_player1: {
					id: "p_player1",
					name: "Player 1",
					roles: {},
					statuses: [],
				},
				p_player2: {
					id: "p_player2",
					name: "Player 2",
					roles: {},
					statuses: [],
				},
			},
			ruleSetSnapshot: { roles: [] },
			statusDefinitionsById: {},
		},
		{ id: "game_detail_drag", name: "Detail-Drag" },
	);
	function SeatMoveHarness() {
		const [game, setGame] = useState(initialGame);
		return (
			<GameScreen
				{...requiredGameScreenActions}
				game={game}
				onBack={vi.fn()}
				onMoveSeat={({ fromSeatNumber, toSeatNumber }) => {
					setGame((current) => {
						const seatOrder = [...current.document.seatOrder];
						const [movedPlayer] = seatOrder.splice(fromSeatNumber - 1, 1);
						seatOrder.splice(toSeatNumber - 1, 0, movedPlayer);
						return {
							...current,
							document: { ...current.document, seatOrder },
						};
					});
					return true;
				}}
				onAdvanceTime={vi.fn()}
				onRewindTime={vi.fn()}
			/>
		);
	}

	render(<SeatMoveHarness />);
	const source = screen.getByRole("button", { name: "Sitzplatz 1" });
	const target = screen.getByRole("button", { name: "Sitzplatz 2" });
	fireEvent.click(source);
	expect(screen.getByLabelText<HTMLInputElement>("Spielername").value).toBe(
		"Player 1",
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Sitzordnung entsperren" }),
	);
	Object.defineProperty(source, "setPointerCapture", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(document, "elementFromPoint", {
		configurable: true,
		value: vi.fn(() => target),
	});

	fireEvent.pointerDown(source, {
		pointerId: 4,
		pointerType: "touch",
		clientX: 10,
		clientY: 10,
	});
	fireEvent.pointerMove(source, {
		pointerId: 4,
		pointerType: "touch",
		clientX: 30,
		clientY: 30,
	});
	fireEvent.pointerUp(source, {
		pointerId: 4,
		pointerType: "touch",
		clientX: 30,
		clientY: 30,
	});

	expect(screen.getByRole("heading", { name: "Sitzplatz 2" })).toBeDefined();
	expect(screen.getByLabelText<HTMLInputElement>("Spielername").value).toBe(
		"Player 1",
	);
});

it("verschiebt im Browser per Maus über denselben Pointer-Pfad wie Touch", () => {
	const onMoveSeat = vi.fn();
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: ["p_anna", "p_bob"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							roles: {},
							statuses: [],
						},
						p_bob: {
							id: "p_bob",
							name: "Bob",
							roles: {},
							statuses: [],
						},
					},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_mouse_drag", name: "Maus-Drag" },
			)}
			onBack={vi.fn()}
			onMoveSeat={onMoveSeat}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(
		screen.getByRole("button", { name: "Sitzordnung entsperren" }),
	);
	const source = screen.getByRole("button", { name: /^Sitzplatz 1$/ });
	const target = screen.getByRole("button", { name: /^Sitzplatz 2$/ });
	Object.defineProperty(source, "setPointerCapture", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(document, "elementFromPoint", {
		configurable: true,
		value: vi.fn(() =>
			source.style.pointerEvents === "none" ? target : source,
		),
	});
	fireEvent.pointerDown(source, {
		pointerId: 5,
		pointerType: "mouse",
		clientX: 10,
		clientY: 15,
	});
	fireEvent.pointerMove(source, {
		pointerId: 5,
		pointerType: "mouse",
		clientX: 35,
		clientY: 45,
	});

	expect(source.classList.contains("seat-button--dragging")).toBe(true);
	expect(source.style.transform).toContain("25px");
	expect(source.style.transform).toContain("30px");
	fireEvent.pointerUp(source, {
		pointerId: 5,
		pointerType: "mouse",
		clientX: 35,
		clientY: 45,
	});
	expect(onMoveSeat).toHaveBeenCalledWith({
		fromSeatNumber: 1,
		toSeatNumber: 2,
	});
});

it("gibt einen zurückgekehrten Sitz ohne transitionend erneut zum Ziehen frei", async () => {
	const onMoveSeat = vi.fn(() => false);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: ["p_anna", "p_bob"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							roles: {},
							statuses: [],
						},
						p_bob: {
							id: "p_bob",
							name: "Bob",
							roles: {},
							statuses: [],
						},
					},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_failed_move", name: "Fehlgeschlagenes Verschieben" },
			)}
			onBack={vi.fn()}
			onMoveSeat={onMoveSeat}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(
		screen.getByRole("button", { name: "Sitzordnung entsperren" }),
	);
	const source = screen.getByRole("button", {
		name: /^Sitzplatz 1$/,
	});
	const target = screen.getByRole("button", {
		name: /^Sitzplatz 2$/,
	});
	Object.defineProperty(source, "setPointerCapture", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(document, "elementFromPoint", {
		configurable: true,
		value: vi.fn(() => target),
	});

	fireEvent.pointerDown(source, {
		pointerId: 2,
		pointerType: "touch",
		clientX: 10,
		clientY: 10,
	});
	fireEvent.pointerMove(source, {
		pointerId: 2,
		pointerType: "touch",
		clientX: 30,
		clientY: 30,
	});
	fireEvent.pointerUp(source, {
		pointerId: 2,
		pointerType: "touch",
		clientX: 30,
		clientY: 30,
	});

	expect(onMoveSeat).toHaveBeenCalledWith({
		fromSeatNumber: 1,
		toSeatNumber: 2,
	});
	expect(source.classList.contains("seat-button--drag-returning")).toBe(true);
	expect(
		[...document.querySelectorAll(".seat-player-label")].map(
			(element) => element.textContent,
		),
	).toEqual(["Anna", "Bob"]);

	await waitFor(() =>
		expect(source.classList.contains("seat-button--drag-returning")).toBe(
			false,
		),
	);
	fireEvent.click(source);
	expect(screen.getByLabelText<HTMLInputElement>("Spielername").value).toBe(
		"Anna",
	);
	fireEvent.pointerDown(source, {
		pointerId: 3,
		pointerType: "touch",
		clientX: 10,
		clientY: 10,
	});
	fireEvent.pointerMove(source, {
		pointerId: 3,
		pointerType: "touch",
		clientX: 30,
		clientY: 30,
	});
	expect(source.classList.contains("seat-button--dragging")).toBe(true);
});

it("behält die Auswahl bei, wenn der manuelle Sitzwechsel fehlschlägt", () => {
	const onSavePlayer = vi.fn<(command: SavePlayerCommand) => boolean>(
		() => false,
	);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: ["p_anna", "p_bob"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							roles: {},
							statuses: [],
						},
						p_bob: {
							id: "p_bob",
							name: "Bob",
							roles: {},
							statuses: [],
						},
					},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{
					id: "game_failed_manual_move",
					name: "Fehlgeschlagener manueller Wechsel",
				},
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onSavePlayer={onSavePlayer}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: /^Sitzplatz 1$/ }));
	fireEvent.change(screen.getByLabelText("Sitzplatz auswählen"), {
		target: { value: "2" },
	});

	expect(onSavePlayer).toHaveBeenCalledTimes(1);
	expect(screen.getByRole("heading", { name: /^Sitzplatz 1$/ })).toBeDefined();
	expect(
		[...document.querySelectorAll(".seat-player-label")].map(
			(element) => element.textContent,
		),
	).toEqual(["Anna", "Bob"]);
});

it("erlaubt eine vorübergehend leere manuelle Sitzplatzeingabe und markiert den Wert beim Fokus", () => {
	const onSavePlayer = vi.fn(() => true);
	const selectSpy = vi.spyOn(HTMLInputElement.prototype, "select");
	const seatOrder = Array.from({ length: 6 }, (_, index) => `p_${index + 1}`);
	const playersById = Object.fromEntries(
		seatOrder.map((id, index) => [
			id,
			{
				id,
				name: `Player ${index + 1}`,
				roles: {},
				statuses: [],
			},
		]),
	);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder,
					playersById,
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_manual_seat", name: "Manueller Sitzplatz" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onSavePlayer={onSavePlayer}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: /^Sitzplatz 6$/ }));
	const input = screen.getByLabelText<HTMLInputElement>("Sitzplatz manuell");
	fireEvent.focus(input);
	expect(selectSpy).toHaveBeenCalled();

	fireEvent.change(input, { target: { value: "" } });
	expect(input.value).toBe("");
	expect(onSavePlayer).not.toHaveBeenCalled();
	fireEvent.blur(input);
	expect(input.value).toBe("6");
	expect(onSavePlayer).not.toHaveBeenCalled();

	fireEvent.focus(input);
	fireEvent.change(input, { target: { value: "5" } });
	expect(onSavePlayer).not.toHaveBeenCalled();
	fireEvent.keyDown(input, { key: "Enter" });
	expect(onSavePlayer).toHaveBeenCalledWith(
		expect.objectContaining({ seatNumber: 5 }),
	);
});

it("verwirft eine manuelle Sitzplatzänderung mit Escape", () => {
	const onSavePlayer = vi.fn(() => true);
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					seatOrder: ["p_1", "p_2"],
					playersById: {
						p_1: { id: "p_1", name: "Anna", roles: {}, statuses: [] },
						p_2: { id: "p_2", name: "Ben", roles: {}, statuses: [] },
					},
					ruleSetSnapshot: { roles: [] },
					statusDefinitionsById: {},
				},
				{ id: "game_cancel_manual_seat", name: "Sitzplatz verwerfen" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onSavePlayer={onSavePlayer}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: /^Sitzplatz 2$/ }));
	const input = screen.getByLabelText<HTMLInputElement>("Sitzplatz manuell");
	fireEvent.focus(input);
	fireEvent.change(input, { target: { value: "1" } });
	fireEvent.keyDown(input, { key: "Escape" });

	expect(input.value).toBe("2");
	expect(onSavePlayer).not.toHaveBeenCalled();
});

it("übernimmt ein geändertes Rollensymbol aus der aktuellen Domain-Antwort", () => {
	const callbacks = {
		onBack: vi.fn(),
		onMoveSeat: vi.fn(),
		onAdvanceTime: vi.fn(),
		onRewindTime: vi.fn(),
	};
	const createGame = (actualRoleId: string | null) =>
		createTestLoadedGameDocument(
			{
				seatOrder: ["p_player1"],
				playersById: {
					p_player1: {
						id: "p_player1",
						name: "Player 1",
						lifeState: "alive",
						roles: {
							actualRoleId,
							shownRoleIds: [actualRoleId],
							nightRoleId: actualRoleId,
						},
						statuses: [],
					},
				},
				ruleSetSnapshot: {
					roles: [{ id: "r_sun", name: "Sun", unicodeSymbol: "☀️" }],
				},
				statusDefinitionsById: {},
			},
			{ id: "game_symbols", name: "Symboltest" },
		);
	const view = render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createGame(null)}
			{...callbacks}
		/>,
	);
	expect(screen.getByText("◇")).toBeDefined();

	view.rerender(
		<GameScreen
			{...requiredGameScreenActions}
			game={createGame("r_sun")}
			{...callbacks}
		/>,
	);

	expect(screen.getByText("☀️")).toBeDefined();
	expect(screen.queryByText("◇")).toBeNull();
});

it("führt im Setup durch verdeckte und aufgedeckte Spielerrollen", async () => {
	const callbacks = {
		onBack: vi.fn(),
		onMoveSeat: vi.fn(),
		onAdvanceTime: vi.fn(),
		onRewindTime: vi.fn(),
	};
	let pressHardwareBack: (() => void) | undefined;
	render(
		<BackNavigationProvider
			applicationLifecycle={{
				isNativePlatform: () => true,
				exitApplication: () => undefined,
				addBackButtonListener: (handler) => {
					pressHardwareBack = handler;
					return Promise.resolve(() => undefined);
				},
			}}
		>
			<GameScreen
				{...requiredGameScreenActions}
				game={createTestLoadedGameDocument(
					{
						time: { currentNight: 0, phase: "setup" },
						seatOrder: ["p_anna", "p_bob"],
						playersById: {
							p_anna: {
								name: "Anna",
								roles: {
									shownRoleIds: ["r_empath", "r_drunk", "r_saint"],
								},
								statuses: [],
							},
							p_bob: {
								name: "Bob",
								roles: { shownRoleIds: ["r_imp"] },
								statuses: [],
							},
						},
						ruleSetSnapshot: {
							roles: [
								{ id: "r_empath", name: "Empath", unicodeSymbol: "☀" },
								{ id: "r_drunk", name: "Drunk" },
								{ id: "r_saint", name: "Saint" },
								{ id: "r_imp", name: "Imp" },
							],
						},
						statusDefinitionsById: {},
					},
					{ id: "game_reveal", name: "Rollentest" },
				)}
				{...callbacks}
				showRoleSymbols
			/>
		</BackNavigationProvider>,
	);
	await waitFor(() => expect(pressHardwareBack).toBeDefined());

	const nightListButton = screen.getByRole("button", { name: "Nachtliste" });
	expect(nightListButton.classList.contains("prominent-button-active")).toBe(
		false,
	);
	fireEvent.click(nightListButton);
	expect(nightListButton.classList.contains("prominent-button-active")).toBe(
		true,
	);
	fireEvent.click(nightListButton);
	expect(nightListButton.classList.contains("prominent-button-active")).toBe(
		false,
	);

	fireEvent.click(screen.getByRole("button", { name: "Rollen zeigen" }));
	expect(screen.getByText(/Zeige Anna \(Platz 1\)/)).toBeDefined();
	fireEvent.click(screen.getByRole("button", { name: /Zeige Anna/ }));
	const revealedRole = screen
		.getByText("☀ Empath")
		.closest(".role-reveal-value");
	expect(revealedRole?.textContent).toBe("Anna:☀ Empath◆ Drunk, ◆ Saint");
	expect(revealedRole?.classList.contains("role-reveal-value")).toBe(true);
	expect(
		within(revealedRole as HTMLElement)
			.getByText("◆ Drunk, ◆ Saint")
			.classList.contains("role-reveal-additional-roles"),
	).toBe(true);
	expect(screen.queryByRole("button", { name: "Zurück" })).toBeNull();
	expect(screen.queryByRole("button", { name: "Weiter" })).toBeNull();

	fireEvent.keyDown(window, { key: "Escape" });
	expect(screen.getByText(/Zeige Anna \(Platz 1\)/)).toBeDefined();
	fireEvent.click(screen.getByRole("button", { name: /Zeige Anna/ }));
	act(() => pressHardwareBack?.());
	expect(screen.getByText(/Zeige Anna \(Platz 1\)/)).toBeDefined();

	expect(screen.getByRole("button", { name: "Zurück" })).toBeDefined();
	fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
	expect(screen.getByText(/Zeige Bob \(Platz 2\)/)).toBeDefined();
	act(() => pressHardwareBack?.());
	expect(screen.getByText(/Zeige Anna \(Platz 1\)/)).toBeDefined();
	act(() => pressHardwareBack?.());
	expect(screen.getByRole("button", { name: "Rollen zeigen" })).toBeDefined();

	fireEvent.click(screen.getByRole("button", { name: "Rollen zeigen" }));
	fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
	expect(screen.getByText(/Zeige Bob \(Platz 2\)/)).toBeDefined();
	fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
	expect(screen.getByRole("button", { name: "Rollen zeigen" })).toBeDefined();
});

it("führt eine Nachtfähigkeit aus, sperrt die Auswahl und setzt das Häkchen", () => {
	const onUsePlayerAbility = vi
		.fn()
		.mockReturnValueOnce({
			changed: false,
			logEntry: null,
			warning: { code: "NO_EFFECT", message: "Das Ziel lebt bereits." },
		})
		.mockReturnValueOnce({ changed: true, logEntry: null });
	render(
		<GameScreen
			{...requiredGameScreenActions}
			game={createTestLoadedGameDocument(
				{
					time: { currentNight: 1, phase: "night" },
					seatOrder: ["p_anna", "p_ben"],
					playersById: {
						p_anna: {
							id: "p_anna",
							name: "Anna",
							lifeState: "alive",
							roles: {
								actualRoleId: "r_healer",
								shownRoleIds: ["r_healer"],
								nightRoleId: "r_healer",
							},
							statuses: [],
						},
						p_ben: {
							id: "p_ben",
							name: "Ben",
							lifeState: "alive",
							roles: {
								actualRoleId: null,
								shownRoleIds: [],
								nightRoleId: null,
							},
							statuses: [],
						},
					},
					ruleSetSnapshot: {
						teams: [{ id: "t_good", name: "Gut", teamOrder: 1 }],
						roles: [
							{
								id: "r_healer",
								name: "Heilerin",
								teamId: "t_good",
								night: { first: { order: 1 } },
								resurrect_someone: true,
							},
						],
					},
					statusDefinitionsById: {},
				},
				{ id: "game_night_action", name: "Nachtaktion" },
			)}
			onBack={vi.fn()}
			onMoveSeat={vi.fn()}
			onUsePlayerAbility={onUsePlayerAbility}
			onAdvanceTime={vi.fn()}
			onRewindTime={vi.fn()}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Nachtliste" }));
	fireEvent.click(screen.getByRole("button", { name: "Heilerin" }));
	const checkbox = screen.getByRole("checkbox");
	fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
	expect((checkbox as HTMLInputElement).checked).toBe(false);

	fireEvent.click(screen.getByRole("button", { name: "Heilerin" }));
	const sourceAndTargetSeat = screen.getByRole("button", {
		name: "Sitzplatz 1, Quelle und Ziel",
	});
	expect(sourceAndTargetSeat.dataset.nightMarker).toBe("✦◎ Quelle/Ziel");
	fireEvent.change(screen.getByLabelText("Zielspieler"), {
		target: { value: "p_ben" },
	});
	expect(
		screen.getByRole("button", { name: "Sitzplatz 1, Quelle" }).dataset
			.nightMarker,
	).toBe("✦ Quelle");
	expect(
		screen.getByRole("button", { name: "Sitzplatz 2, Ziel" }).dataset
			.nightMarker,
	).toBe("◎ Ziel");
	fireEvent.click(screen.getByRole("button", { name: "Sitzplatz 1, Quelle" }));
	expect(screen.getByLabelText<HTMLSelectElement>("Zielspieler").value).toBe(
		"p_anna",
	);
	fireEvent.click(screen.getByRole("button", { name: "Sitzplatz 2" }));
	expect(screen.getByLabelText<HTMLSelectElement>("Zielspieler").value).toBe(
		"p_ben",
	);
	fireEvent.click(
		screen.getByRole("button", { name: /Spielerübersicht anzeigen/ }),
	);
	expect(
		screen.getByRole("button", {
			name: "Anna, Sitzplatz 1, Quelle",
		}),
	).toBeDefined();
	expect(
		screen.getByRole("button", {
			name: "Ben, Sitzplatz 2, Ziel",
		}),
	).toBeDefined();
	fireEvent.click(
		screen.getByRole("button", {
			name: "Anna, Sitzplatz 1, Quelle",
		}),
	);
	expect(screen.getByLabelText<HTMLSelectElement>("Zielspieler").value).toBe(
		"p_anna",
	);
	fireEvent.click(
		screen.getByRole("button", {
			name: "Ben, Sitzplatz 2",
		}),
	);
	expect(screen.getByLabelText<HTMLSelectElement>("Zielspieler").value).toBe(
		"p_ben",
	);
	fireEvent.click(screen.getByRole("button", { name: /Sitzkreis anzeigen/ }));
	expect(
		screen.getByRole("button", { name: "Sitzplatz 2, Ziel" }),
	).toBeDefined();
	fireEvent.click(screen.getByRole("button", { name: "Ausführen" }));
	expect(screen.getByRole("alert").textContent).toContain(
		"Das Ziel lebt bereits.",
	);
	expect(screen.getByLabelText<HTMLSelectElement>("Aktion").disabled).toBe(
		false,
	);
	expect((checkbox as HTMLInputElement).checked).toBe(false);

	fireEvent.click(screen.getByRole("button", { name: "Ausführen" }));
	expect(screen.getByLabelText<HTMLSelectElement>("Aktion").disabled).toBe(
		true,
	);
	expect(screen.getByLabelText<HTMLSelectElement>("Zielspieler").disabled).toBe(
		true,
	);
	expect(
		within(screen.getByRole("region", { name: "Aktion für 1 Anna" })).getByRole(
			"button",
			{ name: "Zurück" },
		),
	).toBeDefined();
	expect((checkbox as HTMLInputElement).checked).toBe(true);
	const lockedTarget = screen.getByRole("button", {
		name: "Sitzplatz 2, Ziel",
	});
	expect(lockedTarget.classList.contains("seat-button--night-locked")).toBe(
		true,
	);
	fireEvent.click(screen.getByRole("button", { name: "Sitzplatz 1, Quelle" }));
	expect(screen.getByLabelText<HTMLSelectElement>("Zielspieler").value).toBe(
		"p_ben",
	);
});

it("löscht Nachtlisten-Häkchen nur beim Wechsel von Tag n zu Nacht n+1", () => {
	const callbacks = {
		...requiredGameScreenActions,
		onBack: vi.fn(),
		onMoveSeat: vi.fn(),
		onAdvanceTime: vi.fn(),
		onRewindTime: vi.fn(),
	};
	const createGame = (currentNight: number, phase: "setup" | "night" | "day") =>
		createTestLoadedGameDocument(
			{
				time: { currentNight, phase },
				seatOrder: ["p_anna"],
				playersById: {
					p_anna: {
						id: "p_anna",
						name: "Anna",
						roles: {
							actualRoleId: "r_role",
							nightRoleId: "r_role",
						},
						statuses: [],
					},
				},
				ruleSetSnapshot: {
					roles: [
						{
							id: "r_role",
							name: "Nachtrolle",
							night: { first: { order: 1 }, other: { order: 1 } },
						},
					],
				},
				statusDefinitionsById: {},
			},
			{ id: "game_night_checks", name: "Nachtlistenstatus" },
		);

	const view = render(
		<GameScreen {...callbacks} game={createGame(0, "setup")} />,
	);
	fireEvent.click(screen.getByRole("button", { name: "Nachtliste" }));
	const checkbox = screen.getByRole<HTMLInputElement>("checkbox");
	fireEvent.click(checkbox);
	expect(checkbox.checked).toBe(true);

	fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
	view.rerender(<GameScreen {...callbacks} game={createGame(1, "night")} />);
	expect(screen.getByRole<HTMLInputElement>("checkbox").checked).toBe(true);

	fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
	view.rerender(<GameScreen {...callbacks} game={createGame(1, "day")} />);
	expect(screen.getByRole<HTMLInputElement>("checkbox").checked).toBe(true);

	fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
	view.rerender(<GameScreen {...callbacks} game={createGame(2, "night")} />);
	expect(screen.getByRole<HTMLInputElement>("checkbox").checked).toBe(false);
});
