import { describe, expect, it } from "vitest";
import {
	createEmptySeatEditorModel,
	createGameSeatColorLayers,
	createGameSeatDetailRows,
	createGameSeatEditorModel,
	createGameSeatLabels,
	createGameSeatSymbols,
	createNightListPresentation,
	createRoleRevealPresentation,
	SEAT_SYMBOLS,
} from "../src/application/gameScreenPresentation";
import type { GameState } from "../src/domain/gameFactory";
import { createTestGame } from "./fixtures";

const document = {
	seatOrder: ["p_empty", "p_no_role", "p_alive", "p_dead"],
	playersById: {
		p_no_role: {
			id: "p_no_role",
			name: "Ohne Rolle",
			lifeState: "alive",
			roles: { actualRoleId: null, shownRoleIds: [] },
			statuses: [],
		},
		p_alive: {
			id: "p_alive",
			name: "Alice",
			lifeState: "alive",
			roles: { actualRoleId: "r_empath", shownRoleIds: ["r_drunk"] },
			statuses: [{ id: "s_poisoned_1", statusId: "d_poisoned" }],
		},
		p_dead: {
			id: "p_dead",
			name: "Bob",
			lifeState: "dead_vote_available",
			roles: { actualRoleId: "r_imp", shownRoleIds: ["r_imp"] },
			statuses: [],
		},
	},
	ruleSetSnapshot: {
		roles: [
			{ id: "r_empath", name: "Empath" },
			{ id: "r_drunk", name: "Drunk" },
			{ id: "r_imp", name: "Imp" },
		],
		statuses: [{ id: "d_poisoned", name: "Poisoned" }],
	},
	statusDefinitionsById: {
		d_poisoned: {
			id: "d_poisoned",
			name: "Poisoned",
			defaultDuration: 2,
		},
	},
	time: { currentNight: 1, phase: "night" },
} as unknown as GameState;

describe("gameScreenPresentation", () => {
	it("entscheidet alle Sitzplatzsymbole vollständig in der Domain", () => {
		expect(createGameSeatSymbols(document)).toEqual([
			SEAT_SYMBOLS.empty,
			SEAT_SYMBOLS.playerWithoutRole,
			`${SEAT_SYMBOLS.alivePlayerFallback} ${SEAT_SYMBOLS.hasStatus} ${SEAT_SYMBOLS.shownRoleDiffers}`,
			SEAT_SYMBOLS.deadPlayer,
		]);
	});

	it("liefert höchstens sechs Unicode-Zeichen als Sitzbeschriftung", () => {
		const withLongName = structuredClone(document);
		withLongName.playersById.p_alive.name = "Änne😊Test";

		expect(createGameSeatLabels(withLongName)).toEqual([
			"",
			"Ohne R",
			"Änne😊T",
			"Bob",
		]);
	});

	it("liefert Spieler-, tatsächliche Rollen- und zugehörige Teamfarbe", () => {
		const colored = {
			seatOrder: ["p_alive"],
			playersById: {
				p_alive: {
					id: "p_alive",
					color: "112233",
					roles: { actualRoleId: "r_actual", shownRoleIds: ["r_shown"] },
				},
			},
			ruleSetSnapshot: {
				teams: [
					{ id: "t_good", color: "AABBCC" },
					{ id: "t_wrong", color: "000000" },
				],
				roles: [
					{ id: "r_actual", teamId: "t_good", color: "445566" },
					{ id: "r_shown", teamId: "t_wrong", color: "FFFFFF" },
				],
			},
		} as unknown as GameState;

		expect(createGameSeatColorLayers(colored)).toEqual([
			{
				teamColor: "AABBCC",
				roleColor: "445566",
				playerColor: "112233",
			},
		]);
	});

	it("verwendet für lebende Spieler das dekodierte Rollensymbol", () => {
		const withSymbol = {
			...structuredClone(document),
			ruleSetSnapshot: {
				...structuredClone(document.ruleSetSnapshot),
				roles: document.ruleSetSnapshot.roles.map((role, index) =>
					index === 0 ? { ...role, unicodeEscaped: "\\u2600\\ufe0f" } : role,
				),
			},
		} as unknown as GameState;
		expect(createGameSeatSymbols(withSymbol)[2]).toBe(
			`☀️ ${SEAT_SYMBOLS.hasStatus} ${SEAT_SYMBOLS.shownRoleDiffers}`,
		);
	});

	it("liefert für einen belegten Sitz fertige Detailzeilen", () => {
		expect(createGameSeatDetailRows(document, 3)).toEqual([
			{ field: "seat", value: "3" },
			{ field: "player", value: "Alice" },
			{ field: "id", value: "p_alive" },
			{ field: "role", value: "Empath" },
			{ field: "lifeState", value: "alive" },
			{ field: "shownRole", value: "Drunk" },
			{ field: "status", value: "Poisoned" },
		]);
	});

	it("zeigt vorhandene Übersetzungen und fällt sonst auf name zurück", () => {
		const localized = {
			...structuredClone(document),
			playersById: {
				...structuredClone(document.playersById),
				p_alive: {
					...structuredClone(document.playersById.p_alive),
					names: { fr: "Alice française" },
				},
			},
			ruleSetSnapshot: {
				...structuredClone(document.ruleSetSnapshot),
				roles: document.ruleSetSnapshot.roles.map((role) =>
					role.id === "r_empath" ? { ...role, names: { fr: "Empathe" } } : role,
				),
				statuses: (document.ruleSetSnapshot.statuses ?? []).map((status) => ({
					...status,
					names: { fr: "Empoisonné" },
				})),
			},
			statusDefinitionsById: {
				d_poisoned: {
					...structuredClone(document.statusDefinitionsById.d_poisoned),
					names: { fr: "Empoisonné" },
				},
			},
		} as unknown as GameState;

		expect(createGameSeatDetailRows(localized, 3, "fr")).toEqual(
			expect.arrayContaining([
				{ field: "player", value: "Alice française" },
				{ field: "role", value: "Empathe" },
				{ field: "shownRole", value: "Drunk" },
				{ field: "status", value: "Empoisonné" },
			]),
		);
		expect(localized.playersById.p_alive.name).toBe("Alice");
		expect(localized.ruleSetSnapshot.roles[0]?.name).toBe("Empath");
		expect(localized.statusDefinitionsById.d_poisoned.name).toBe("Poisoned");
	});

	it("liefert für p_empty keine Details", () => {
		expect(createGameSeatDetailRows(document, 1)).toEqual([]);
	});

	it("liefert bearbeitbare Rollen- und Zustandsfelder", () => {
		const editor = createGameSeatEditorModel(document, 3);

		expect(editor?.roleFields.map((field) => field.field)).toEqual([
			"actualRoleId",
			"nightRoleId",
			"claimedRoleId",
		]);
		expect(editor?.shownRoles.map((role) => role.value)).toEqual(["r_drunk"]);
		expect(editor?.statuses[0]).toMatchObject({ name: "Poisoned" });
		expect(editor?.roleFields[0]?.optionGroups[0]?.options).toEqual([
			{ value: "r_drunk", label: "◆ Drunk" },
			{ value: "r_empath", label: "◆ Empath" },
			{ value: "r_imp", label: "◆ Imp" },
		]);
		expect(editor?.roleFields[2]?.optionGroups[0]?.options).toEqual([
			{ value: "r_drunk", label: "◆ Drunk" },
			{ value: "r_empath", label: "◆ Empath" },
			{ value: "r_imp", label: "◆ Imp" },
		]);
	});

	it("blendet auf Wunsch alle nicht aktiven Zustände unabhängig von der Phase aus", () => {
		const game = createTestGame(1);
		const player = game.playersById.p_player1;
		if (!player) throw new Error("Testspieler fehlt.");
		game.time = { currentNight: 3, phase: "day" };
		game.ruleSetSnapshot.statuses = [{ id: "d_test", name: "Testzustand" }];
		game.statusDefinitionsById = {
			d_test: { id: "d_test", name: "Testzustand" },
		};
		player.statuses = [
			{
				id: "s_past",
				statusId: "d_test",
				fromNight: 1,
				untilNight: 2,
			},
			{
				id: "s_active_boundary",
				statusId: "d_test",
				fromNight: 3,
				untilNight: 3,
			},
			{
				id: "s_active_open",
				statusId: "d_test",
				fromNight: 2,
				untilNight: null,
			},
			{
				id: "s_future",
				statusId: "d_test",
				fromNight: 4,
				untilNight: null,
			},
		];

		expect(
			createGameSeatEditorModel(game, 1)?.statuses.map(({ id }) => id),
		).toEqual(["s_past", "s_active_boundary", "s_active_open", "s_future"]);
		expect(
			createGameSeatEditorModel(game, 1, "de", {
				hideExpiredStatuses: true,
			})?.statuses.map(({ id }) => id),
		).toEqual(["s_active_boundary", "s_active_open"]);

		const onlyInactive = structuredClone(game);
		const inactivePlayer = onlyInactive.playersById.p_player1;
		if (!inactivePlayer) throw new Error("Kopierter Testspieler fehlt.");
		inactivePlayer.statuses = inactivePlayer.statuses.filter(
			({ id }) => id === "s_past" || id === "s_future",
		);
		expect(createGameSeatSymbols(onlyInactive)[0]).toContain(
			SEAT_SYMBOLS.hasStatus,
		);
		expect(
			createGameSeatSymbols(onlyInactive, {
				hideExpiredStatuses: true,
			})[0],
		).not.toContain(SEAT_SYMBOLS.hasStatus);

		game.time.phase = "night";
		expect(
			createGameSeatEditorModel(game, 1, "de", {
				hideExpiredStatuses: true,
			})?.statuses.map(({ id }) => id),
		).toEqual(["s_active_boundary", "s_active_open"]);
	});

	it("stellt in den Rollenauswahlen Unicode-Symbol oder Standardsymbol voran", () => {
		const withSymbols = {
			...structuredClone(document),
			ruleSetSnapshot: {
				...structuredClone(document.ruleSetSnapshot),
				roles: [
					{
						id: "r_empath",
						name: "Empath",
						unicodeEscaped: "\\u{1F441}",
					},
					{ id: "r_drunk", name: "Drunk" },
					{ id: "r_imp", name: "Imp", unicodeSymbol: "😈" },
				],
			},
		} as unknown as GameState;

		const fields = createGameSeatEditorModel(withSymbols, 3)?.roleFields;
		for (const field of fields ?? []) {
			expect(field.optionGroups[0]?.options).toEqual([
				{ value: "r_drunk", label: "◆ Drunk" },
				{ value: "r_empath", label: "👁 Empath" },
				{ value: "r_imp", label: "😈 Imp" },
			]);
		}
	});

	it("liefert für einen freien Sitz die noch ungesetzten Spieler", () => {
		const game = createTestGame(2);
		game.seatOrder = ["p_player1", "p_empty"];

		expect(createEmptySeatEditorModel(game, 2)).toMatchObject({
			seatNumber: 2,
			newPlayer: { id: "", name: "Player 3" },
			playerOptions: [
				{
					value: "p_player2",
					label: "Player 2",
					player: { id: "p_player2", name: "Player 2" },
				},
			],
		});
	});

	it("gruppiert Rollen nach Teamreihenfolge und sortiert sie nach Namen", () => {
		const groupedDocument = {
			...structuredClone(document),
			ruleSetSnapshot: {
				...structuredClone(document.ruleSetSnapshot),
				teams: [
					{ id: "t_late", name: "Spät", teamOrder: 20 },
					{ id: "t_early", name: "Früh", teamOrder: 10 },
				],
				roles: [
					{ id: "r_zeta", name: "Zeta", teamId: "t_early" },
					{ id: "r_beta", name: "Beta", teamId: "t_late" },
					{ id: "r_alpha", name: "Alpha", teamId: "t_early" },
				],
			},
		} as unknown as GameState;

		const groups = createGameSeatEditorModel(groupedDocument, 3)?.roleFields[0]
			?.optionGroups;

		expect(groups).toEqual([
			{
				kind: "team",
				label: "Früh",
				options: [
					{ value: "r_alpha", label: "◆ Alpha" },
					{ value: "r_zeta", label: "◆ Zeta" },
				],
			},
			{
				kind: "team",
				label: "Spät",
				options: [{ value: "r_beta", label: "◆ Beta" }],
			},
		]);
	});

	it("erstellt den Rollen-Zeigeablauf nur im Setup und in Sitzreihenfolge", () => {
		const setupDocument = {
			...structuredClone(document),
			time: { currentNight: 0, phase: "setup" },
		} as GameState;

		expect(createRoleRevealPresentation(setupDocument)).toMatchObject({
			steps: [
				{
					playerName: "Ohne Rolle",
					seatNumber: 2,
					shownRoleNames: [],
				},
				{
					playerName: "Alice",
					seatNumber: 3,
					shownRoleNames: ["Drunk"],
				},
				{
					playerName: "Bob",
					seatNumber: 4,
					shownRoleNames: ["Imp"],
				},
			],
		});
		expect(createRoleRevealPresentation(document)).toBeUndefined();
	});

	it("listet nur nachtaktive Spieler nach nightOrder mit Rollenabweichung und Tod", () => {
		const nightDocument = {
			time: { currentNight: 1, phase: "night" },
			seatOrder: ["p_late", "p_inactive", "p_early"],
			playersById: {
				p_late: {
					name: "Late",
					lifeState: "dead_vote_available",
					roles: {
						actualRoleId: "r_actual",
						shownRoleIds: ["r_shown"],
						nightRoleId: "r_late",
					},
				},
				p_inactive: {
					name: "Inactive",
					lifeState: "alive",
					roles: { nightRoleId: "r_inactive" },
				},
				p_early: {
					name: "Early",
					lifeState: "alive",
					roles: {
						actualRoleId: "r_early",
						shownRoleIds: ["r_early"],
						nightRoleId: "r_early",
					},
				},
			},
			ruleSetSnapshot: {
				roles: [
					{ id: "r_early", name: "Early role", night: { first: { order: 1 } } },
					{ id: "r_late", name: "Late role", night: { first: { order: 10 } } },
					{
						id: "r_inactive",
						name: "Inactive role",
						night: { first: { order: 0 } },
					},
					{ id: "r_actual", name: "Actual" },
					{ id: "r_shown", name: "Shown" },
				],
			},
			statusDefinitionsById: {},
		} as unknown as GameState;

		expect(createNightListPresentation(nightDocument)).toMatchObject([
			{
				playerId: "p_early",
				seatNumber: 3,
				playerName: "Early",
				actualRoleName: "Early role",
				isDead: false,
				nightOrder: 1,
			},
			{
				playerId: "p_late",
				seatNumber: 1,
				playerName: "Late",
				shownRoleName: "Shown",
				actualRoleName: "Actual",
				isDead: true,
				nightOrder: 10,
			},
		]);
	});
});
