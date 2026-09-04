import { describe, expect, it } from "vitest";
import { ScenarioEditorFactory } from "../src/application/scenarioEditor";
import { isDomainOperationError } from "../src/domain/domainFailure";
import type { GameDraft } from "../src/domain/gameDraft";
import type { GameState } from "../src/domain/gameFactory";
import { hydrateGameState } from "../src/domain/gameValidation";
import { Player, Role, Team } from "../src/domain/models";
import {
	applyStatusToPlayer,
	changePlayerLifeState,
} from "../src/domain/playerActions";
import type { RuleSetDraft } from "../src/domain/ruleSet";
import { createRuleSetFromDraft } from "../src/domain/ruleSetValidation";
import type { DataFileStorage } from "../src/persistence/ports/dataFileStorage";
import { createGameExportDocument } from "../src/serialization/gameExport";
import { fixedDomainServices } from "./fixedClock";
import { createTestGame, createTestRuleSet } from "./fixtures";
import { GameTestFacade } from "./gameTestFacade";

const ScenarioEditorSession = new ScenarioEditorFactory();

class GameReadService extends GameTestFacade {}

describe("GameState-Hydrierung", () => {
	it.each([
		[
			{ currentNight: 0, phase: "day" },
			{ currentNight: 0, phase: "setup" },
		],
		[
			{ currentNight: 3, phase: "setup" },
			{ currentNight: 3, phase: "night" },
		],
	] as const)("normalisiert die Spielzeit %j zu %j", (time, expected) => {
		const game = createTestGame();
		game.time = { ...time };

		expect(hydrateGameState(game).time).toEqual(expected);
	});

	it("stellt beim Laden Team-, Rollen- und Player-Methoden wieder her", async () => {
		const source = createGameWithStatus();
		const bytes = new TextEncoder().encode(
			JSON.stringify(createGameExportDocument(source)),
		);
		const storage: DataFileStorage = {
			readInternal: () => Promise.resolve({ status: "success", bytes }),
		};
		const service = new GameReadService(storage);

		const loaded = await service.loadGame(source.id);
		const game = loaded.document;
		const playerId = game.seatOrder[0];

		expect(game.ruleSetSnapshot.teams[0]).toBeInstanceOf(Team);
		expect(game.ruleSetSnapshot.roles[0]).toBeInstanceOf(Role);
		expect(game.playersById[playerId]).toBeInstanceOf(Player);
		expect(
			changePlayerLifeState(game, fixedDomainServices, playerId, "kill")
				.changed,
		).toBe(true);
		expect(
			applyStatusToPlayer(game, fixedDomainServices, playerId, "d_poisoned")
				.changed,
		).toBe(true);
	});

	it("bewahrt die aktuelle Statusdauer", () => {
		const game = createGameWithStatus();
		const definition = {
			id: "d_poisoned",
			name: "Poisoned",
			defaultDuration: 3,
		};
		game.statusDefinitionsById.d_poisoned = {
			...definition,
			name: "Veralteter Laufzeitwert",
			defaultDuration: 99,
		};
		game.ruleSetSnapshot.statuses = [definition];

		const hydrated = hydrateGameState(game);
		expect(hydrated.statusDefinitionsById.d_poisoned).toMatchObject({
			id: "d_poisoned",
			name: "Poisoned",
			defaultDuration: 3,
		});
		expect(hydrated.ruleSetSnapshot.statuses?.[0]).toMatchObject({
			id: "d_poisoned",
			name: "Poisoned",
			defaultDuration: 3,
		});
	});

	it.each([
		[
			"Nachtzahl",
			(game: GameDraft): void => {
				game.time.currentNight = -1;
			},
			"time.currentNight",
		],
		[
			"Phase",
			(game: GameDraft): void => {
				game.time.phase = "dämmerung";
			},
			"time.phase",
		],
		[
			"Lebenszustand",
			(game: GameDraft): void => {
				game.players[0].lifeState = "schlafend";
			},
			"lifeState",
		],
		[
			"Rollenquelle",
			(game: GameDraft) => {
				game.players[0].statuses = [
					{
						id: "s_test",
						statusId: "d_test",
						fromNight: 0,
						untilNight: null,
						source: {
							playerId: "p_player1",
							roleSourceType: "erfunden",
						},
					},
				];
				game.ruleSetSnapshot.statuses = [{ id: "d_test", name: "Test" }];
			},
			"roleSourceType",
		],
		[
			"Statusdauer",
			(game: GameDraft) => {
				game.ruleSetSnapshot.statuses = [
					{
						id: "d_test",
						name: "Test",
						defaultDuration: -1,
					},
				];
			},
			"defaultDuration",
		],
		[
			"Log-Akteur",
			(game: GameDraft) => {
				game.log = [
					{
						id: "log_test",
						night: 0,
						phase: "setup",
						createdAt: "2026-01-02T03:04:05.000Z",
						type: "test",
						actor: "moderator",
						text: "Test",
					},
				];
			},
			"actor",
		],
	] as const)(
		"lehnt den fachlich ungültigen Wert %s ab",
		(_label, mutate, message) => {
			const draft: GameDraft = structuredClone(
				createGameExportDocument(createTestGame(1)),
			);
			mutate(draft);

			expect(() => hydrateGameState(draft)).toThrow(message);
		},
	);

	it("lehnt unbekannte Live-Referenzen nach der Reparaturgrenze ab", () => {
		const draft: GameDraft = structuredClone(
			createGameExportDocument(createTestGame(1)),
		);
		draft.players[0].roles.actualRoleId = "r_missing";

		expect(() => hydrateGameState(draft)).toThrow("unbekannte Rolle");
	});

	it("lehnt doppelte Spieler-IDs in der Dokumentliste ab", () => {
		const draft: GameDraft = structuredClone(
			createGameExportDocument(createTestGame(1)),
		);
		draft.players.push(structuredClone(draft.players[0]));

		expect(() => hydrateGameState(draft)).toThrow(
			'Doppelte Spieler-ID "p_player1"',
		);
	});

	it("klassifiziert erwartete Validierungsfehler an ihrer Quelle", () => {
		const repairableDraft: GameDraft = structuredClone(
			createGameExportDocument(createTestGame(1)),
		);
		repairableDraft.id = "falsche id";

		expectDomainFailure(repairableDraft, true);

		const unrepairableDraft: GameDraft = structuredClone(
			createGameExportDocument(createTestGame(1)),
		);
		unrepairableDraft.time.phase = "dämmerung";

		expectDomainFailure(unrepairableDraft, false);
	});

	it("reicht unerwartete Fehler bei der Game-Validierung unverändert weiter", () => {
		const draft: GameDraft = structuredClone(
			createGameExportDocument(createTestGame(1)),
		);
		const unexpected = new Error("Programmierfehler in der Game-Validierung");
		Object.defineProperty(draft, "name", {
			get: () => {
				throw unexpected;
			},
		});

		try {
			hydrateGameState(draft);
			throw new Error("Der unerwartete Fehler wurde nicht ausgelöst.");
		} catch (error) {
			expect(error).toBe(unexpected);
			expect(isDomainOperationError(error)).toBe(false);
		}
	});

	it("reicht unerwartete Fehler bei der RuleSet-Validierung unverändert weiter", () => {
		const draft = structuredClone(createTestRuleSet()) as RuleSetDraft;
		const unexpected = new Error(
			"Programmierfehler in der RuleSet-Validierung",
		);
		Object.defineProperty(draft, "teams", {
			get: () => {
				throw unexpected;
			},
		});

		try {
			createRuleSetFromDraft(draft, { mode: "stored" });
			throw new Error("Der unerwartete Fehler wurde nicht ausgelöst.");
		} catch (error) {
			expect(error).toBe(unexpected);
			expect(isDomainOperationError(error)).toBe(false);
		}
	});

	it("erhält Player-Methoden auch nach einer dokumentbasierten GUI-Änderung", async () => {
		const source = createGameWithStatus();
		const bytes = new TextEncoder().encode(
			JSON.stringify(createGameExportDocument(source)),
		);
		const service = new GameReadService({
			readInternal: () => Promise.resolve({ status: "success", bytes }),
		});
		await service.loadGame(source.id);

		const playerDraft = createGameExportDocument(source).players[0];
		if (!playerDraft) throw new Error("Testspieler fehlt.");
		const changed = service.saveLoadedPlayer({
			originalPlayerId: source.seatOrder[0],
			player: { ...playerDraft, name: "Anna" },
			seatNumber: 1,
		});
		const game = changed.document;
		const player = game.playersById[game.seatOrder[0]];

		expect(player).toBeInstanceOf(Player);
		expect(() => player.setLifeState("dead_vote_available")).not.toThrow();
	});

	it("kann in einer aus JSON geklonten Editor-Arbeitskopie Zustände löschen", () => {
		const plainDocument = JSON.parse(
			JSON.stringify(createGameWithStatus()),
		) as GameState;
		const editor = ScenarioEditorSession.fromGame(plainDocument);

		expect(() => editor.delete("statuses", "d_poisoned")).not.toThrow();
		const saved = editor.toDocument() as GameState;

		expect(saved.ruleSetSnapshot.statuses).toEqual([]);
		expect(saved.ruleSetSnapshot.roles[0]?.apply_status_effect).toEqual([]);
		expect(saved.playersById[saved.seatOrder[0]]?.statuses).toEqual([]);
	});
});

function createGameWithStatus(): GameState {
	const game = createTestGame();
	const definition = { id: "d_poisoned", name: "Poisoned" };
	game.statusDefinitionsById[definition.id] = definition;
	game.ruleSetSnapshot.statuses = [definition];
	const role = game.ruleSetSnapshot.roles[0];
	role.apply_status_effect = [definition.id];
	const player = game.playersById[game.seatOrder[0]];
	player.statuses = [
		{
			id: "s_poisoned_1",
			statusId: definition.id,
			fromNight: 0,
			untilNight: null,
		},
	];
	return game;
}

function expectDomainFailure(draft: GameDraft, repairable: boolean): void {
	try {
		hydrateGameState(draft);
		throw new Error("Der erwartete Domainfehler wurde nicht ausgelöst.");
	} catch (error) {
		expect(isDomainOperationError(error)).toBe(true);
		if (!isDomainOperationError(error)) return;
		expect(error.failure).toMatchObject({
			operation: "validate",
			reason: "invalidObject",
			repairable,
		});
	}
}
