import { describe, expect, it } from "vitest";

import type { LifeState } from "../src/domain/models";
import {
	applyStatusToPlayer as applyStatus,
	changePlayerLifeState as changeLifeState,
	type EditPlayerStatusParams,
	editPlayerStatus as editStatus,
	type LifeStateAction,
	type PlayerAbilityAction,
	usePlayerAbility as useAbility,
} from "../src/domain/playerActions";
import { fixedDomainServices } from "./fixedClock";
import { createTestGame } from "./fixtures";

const changePlayerLifeState = (
	game: Parameters<typeof changeLifeState>[0],
	playerId: string,
	action: LifeStateAction,
	language = "de",
) => changeLifeState(game, fixedDomainServices, playerId, action, language);

const applyStatusToPlayer = (
	game: Parameters<typeof applyStatus>[0],
	playerId: string,
	statusId: string,
	sourcePlayerId?: string,
	language = "de",
) =>
	applyStatus(
		game,
		fixedDomainServices,
		playerId,
		statusId,
		sourcePlayerId,
		language,
	);

const usePlayerAbility = (
	game: Parameters<typeof useAbility>[0],
	actorPlayerId: string,
	targetPlayerId: string,
	action?: PlayerAbilityAction,
	status?: string,
	validateAbility = true,
	language = "de",
) =>
	useAbility(
		game,
		fixedDomainServices,
		actorPlayerId,
		targetPlayerId,
		action,
		status,
		validateAbility,
		language,
	);

const editPlayerStatus = (
	game: Parameters<typeof editStatus>[0],
	playerId: string,
	statusInstanceId: string,
	params: EditPlayerStatusParams,
) => editStatus(game, playerId, statusInstanceId, params);

const transitions: Array<{
	action: LifeStateAction;
	from: LifeState;
	to: LifeState;
	warning?: string;
}> = [
	{ action: "kill", from: "alive", to: "dead_vote_available" },
	{
		action: "kill",
		from: "dead_vote_available",
		to: "doubledead_vote_available",
	},
	{ action: "kill", from: "dead_vote_spent", to: "doubledead_vote_spent" },
	{
		action: "kill",
		from: "doubledead_vote_available",
		to: "doubledead_vote_available",
	},
	{
		action: "kill",
		from: "doubledead_vote_spent",
		to: "doubledead_vote_spent",
	},
	{
		action: "resurrect",
		from: "doubledead_vote_available",
		to: "dead_vote_available",
	},
	{ action: "resurrect", from: "doubledead_vote_spent", to: "dead_vote_spent" },
	{ action: "resurrect", from: "dead_vote_available", to: "alive" },
	{ action: "resurrect", from: "dead_vote_spent", to: "alive" },
	{ action: "resurrect", from: "alive", to: "alive" },
	{ action: "spend_vote", from: "alive", to: "alive" },
	{ action: "spend_vote", from: "dead_vote_available", to: "dead_vote_spent" },
	{
		action: "spend_vote",
		from: "doubledead_vote_available",
		to: "doubledead_vote_spent",
	},
	{
		action: "spend_vote",
		from: "dead_vote_spent",
		to: "dead_vote_spent",
		warning: "VOTE_ALREADY_SPENT",
	},
	{
		action: "spend_vote",
		from: "doubledead_vote_spent",
		to: "doubledead_vote_spent",
		warning: "VOTE_ALREADY_SPENT",
	},
	{ action: "gain_vote", from: "alive", to: "alive" },
	{
		action: "gain_vote",
		from: "dead_vote_available",
		to: "dead_vote_available",
	},
	{
		action: "gain_vote",
		from: "doubledead_vote_available",
		to: "doubledead_vote_available",
	},
	{ action: "gain_vote", from: "dead_vote_spent", to: "dead_vote_available" },
	{
		action: "gain_vote",
		from: "doubledead_vote_spent",
		to: "doubledead_vote_available",
	},
];

describe("changePlayerLifeState", () => {
	it.each(transitions)(
		"$action: $from -> $to",
		({ action, from, to, warning }) => {
			const game = createTestGame();
			const player = game.playersById.p_player1;
			expect(player).toBeDefined();
			if (!player) return;
			player.setLifeState(from);

			const result = changePlayerLifeState(game, "p_player1", action);

			expect(player.lifeState).toBe(to);
			expect(result.changed).toBe(from !== to);
			expect(result.warning?.code).toBe(warning);
			expect(game.log).toHaveLength(from === to ? 0 : 1);
			if (from !== to) {
				expect(result.logEntry?.payload).toMatchObject({
					playerId: "p_player1",
					oldStatus: from,
					newStatus: to,
					time: game.time,
				});
			}
		},
	);
});

describe("usePlayerAbility", () => {
	it("ermittelt eine eindeutige Kill-Fähigkeit über actualRoleId", () => {
		const game = createTestGame();
		const actor = game.playersById.p_player1;
		const role = game.ruleSetSnapshot.roles[0];
		expect(actor).toBeDefined();
		expect(role).toBeDefined();
		if (!actor || !role) return;
		actor.assignActualRole(role.id);
		role.kills_someone = true;

		expect(usePlayerAbility(game, "p_player1", "p_player2").changed).toBe(true);
		expect(game.playersById.p_player2?.lifeState).toBe("dead_vote_available");
	});

	it("bricht bei mehreren möglichen Aktionsarten ab", () => {
		const game = createTestGame();
		const actor = game.playersById.p_player1;
		const role = game.ruleSetSnapshot.roles[0];
		expect(actor).toBeDefined();
		expect(role).toBeDefined();
		if (!actor || !role) return;
		actor.assignActualRole(role.id);
		role.kills_someone = true;
		role.apply_status_effect = ["d_poisoned", "d_sleeping"];

		expect(usePlayerAbility(game, "p_player1", "p_player2").warning?.code).toBe(
			"ABILITY_NOT_UNAMBIGUOUS",
		);
	});

	it("prüft explizite Fähigkeiten standardmäßig und kann die Prüfung abschalten", () => {
		const game = createTestGame();
		const actor = game.playersById.p_player1;
		const role = game.ruleSetSnapshot.roles[0];
		expect(actor).toBeDefined();
		expect(role).toBeDefined();
		if (!actor || !role) return;
		actor.assignActualRole(role.id);

		expect(
			usePlayerAbility(game, "p_player1", "p_player2", "kill").warning?.code,
		).toBe("ABILITY_NOT_ALLOWED");
		expect(
			usePlayerAbility(game, "p_player1", "p_player2", "kill", undefined, false)
				.changed,
		).toBe(true);
	});

	it("verlangt bei mehreren erlaubten Zuständen eine explizite Auswahl", () => {
		const game = createTestGame();
		const actor = game.playersById.p_player1;
		const role = game.ruleSetSnapshot.roles[0];
		expect(actor).toBeDefined();
		expect(role).toBeDefined();
		if (!actor || !role) return;
		actor.assignActualRole(role.id);
		role.apply_status_effect = ["d_poisoned", "d_sleeping"];

		expect(usePlayerAbility(game, "p_player1", "p_player2").warning?.code).toBe(
			"STATUS_NOT_UNAMBIGUOUS",
		);
	});

	it("wendet denselben Zustand mehrfach mit eindeutigen Instanz-IDs an", () => {
		const game = createTestGame();
		game.time = { currentNight: 2, phase: "night" };
		game.statusDefinitionsById.d_poisoned = {
			id: "d_poisoned",
			name: "Vergiftet",
		};
		const actor = game.playersById.p_player1;
		const role = game.ruleSetSnapshot.roles[0];
		expect(actor).toBeDefined();
		expect(role).toBeDefined();
		if (!actor || !role) return;
		actor.assignActualRole(role.id);
		role.apply_status_effect = ["d_poisoned"];

		expect(usePlayerAbility(game, "p_player1", "p_player2").changed).toBe(true);
		expect(usePlayerAbility(game, "p_player1", "p_player2").changed).toBe(true);
		expect(game.playersById.p_player2?.statuses).toMatchObject([
			{
				id: "s_poisoned_1",
				statusId: "d_poisoned",
				fromNight: 2,
				untilNight: 2,
				source: { playerId: "p_player1", roleSourceType: "actual" },
			},
			{ id: "s_poisoned_2", statusId: "d_poisoned" },
		]);
	});

	it.each([
		[0, null],
		[1, 4],
		[3, 6],
	] as const)(
		"berechnet bei Dauer %s das Ende %s",
		(defaultDuration, expectedUntilNight) => {
			const game = createTestGame();
			game.time = { currentNight: 4, phase: "night" };
			game.statusDefinitionsById.d_poisoned = {
				id: "d_poisoned",
				name: "Vergiftet",
				defaultDuration,
			};

			expect(applyStatusToPlayer(game, "p_player1", "d_poisoned").changed).toBe(
				true,
			);
			expect(game.playersById.p_player1?.statuses[0]).toMatchObject({
				fromNight: 4,
				untilNight: expectedUntilNight,
			});
		},
	);
});

it("hält den Status im Anwendungslog bei späterer Bearbeitung unverändert", () => {
	const game = createTestGame();
	game.statusDefinitionsById.d_poisoned = {
		id: "d_poisoned",
		name: "Vergiftet",
	};

	const result = applyStatusToPlayer(game, "p_player1", "d_poisoned");
	const statusId = game.playersById.p_player1?.statuses[0]?.id;
	expect(result.changed).toBe(true);
	expect(statusId).toBeDefined();
	if (!statusId) return;
	const originalPayload = structuredClone(result.logEntry?.payload);

	editPlayerStatus(game, "p_player1", statusId, {
		fromNight: 4,
		untilNight: 7,
		note: "Später bearbeitet",
	});

	expect(result.logEntry?.payload).toEqual(originalPayload);
	expect(game.playersById.p_player1?.statuses[0]).toMatchObject({
		fromNight: 4,
		untilNight: 7,
		note: "Später bearbeitet",
	});
});

describe("editPlayerStatus", () => {
	it("weist negative Startnächte zurück, ohne den Status zu verändern", () => {
		const game = createTestGame();
		const player = game.playersById.p_player1;
		expect(player).toBeDefined();
		if (!player) return;
		player.statuses = [
			{
				id: "s_marked_1",
				statusId: "d_marked",
				fromNight: 2,
				untilNight: 4,
				note: "Unverändert",
			},
		];
		const before = structuredClone(player.statuses[0]);

		expect(() =>
			editPlayerStatus(game, player.id, "s_marked_1", {
				fromNight: -1,
				note: "Geändert",
			}),
		).toThrow("fromNight darf nicht negativ sein");
		expect(player.statuses[0]).toEqual(before);
	});

	it("validiert bei Teilupdates das resultierende Statusintervall atomar", () => {
		const game = createTestGame();
		const player = game.playersById.p_player1;
		expect(player).toBeDefined();
		if (!player) return;
		player.statuses = [
			{
				id: "s_marked_1",
				statusId: "d_marked",
				fromNight: 2,
				untilNight: 4,
				note: "Unverändert",
			},
		];
		const before = structuredClone(player.statuses[0]);

		expect(() =>
			editPlayerStatus(game, player.id, "s_marked_1", {
				fromNight: 5,
				note: "Geändert",
			}),
		).toThrow("untilNight darf nicht vor fromNight liegen");
		expect(player.statuses[0]).toEqual(before);

		expect(() =>
			editPlayerStatus(game, player.id, "s_marked_1", {
				untilNight: 1,
			}),
		).toThrow("untilNight darf nicht vor fromNight liegen");
		expect(player.statuses[0]).toEqual(before);
	});

	it("akzeptiert ein unbegrenztes oder chronologisch gültiges Ende", () => {
		const game = createTestGame();
		const player = game.playersById.p_player1;
		expect(player).toBeDefined();
		if (!player) return;
		player.statuses = [
			{
				id: "s_marked_1",
				statusId: "d_marked",
				fromNight: 2,
				untilNight: 4,
			},
		];

		expect(
			editPlayerStatus(game, player.id, "s_marked_1", {
				fromNight: 5,
				untilNight: null,
			}),
		).toMatchObject({ fromNight: 5, untilNight: null });
		expect(
			editPlayerStatus(game, player.id, "s_marked_1", {
				untilNight: 7,
			}),
		).toMatchObject({ fromNight: 5, untilNight: 7 });
	});
});
