import { describe, expect, expectTypeOf, it } from "vitest";
import type { GameDraft, GamePlayerDraft } from "../src/domain/gameDraft";
import type { RuleSetDraft } from "../src/domain/ruleSet";
import type { GameDocument } from "../src/serialization/gameDocument";

describe("typisierte Game-Drafts", () => {
	it("bildet das vollständige klassenfreie Game-Dokument ab", () => {
		const document = createDraftDocument();

		expect(document).toMatchObject({
			fileType: "social-deduction-game",
			schemaVersion: 1,
			id: "game_draft_contract",
			isTemplate: false,
			time: { currentNight: 1, phase: "night" },
		});
		expect(Object.getPrototypeOf(document.players[0])).toBe(Object.prototype);
		expect(Object.getPrototypeOf(document.ruleSetSnapshot.roles[0])).toBe(
			Object.prototype,
		);
	});

	it("hält Formatmetadaten aus dem Domain-Draft heraus", () => {
		type DomainFields = keyof GameDraft;
		type DocumentFields = keyof GameDocument;

		expectTypeOf<"fileType">().not.toMatchTypeOf<DomainFields>();
		expectTypeOf<"schemaVersion">().not.toMatchTypeOf<DomainFields>();
		expectTypeOf<"statusDefinitionsById">().not.toMatchTypeOf<DomainFields>();
		expectTypeOf<"fileType">().toMatchTypeOf<DocumentFields>();
		expectTypeOf<"schemaVersion">().toMatchTypeOf<DocumentFields>();
		expectTypeOf<"statusDefinitionsById">().not.toMatchTypeOf<DocumentFields>();
	});

	it("trennt korrekte Feldtypen von später zu prüfenden fachlichen Werten", () => {
		const document: GameDocument = {
			...createDraftDocument(),
			fileType: "noch-nicht-fachlich-geprüft",
			schemaVersion: 999,
			time: { currentNight: -1, phase: "unbekannte-phase" },
		};
		document.players[0].lifeState = "unbekannter-zustand";

		expect(document.time.phase).toBe("unbekannte-phase");
		expect(document.players[0].lifeState).toBe("unbekannter-zustand");
	});

	it("definiert die verschachtelten Records und Arrays ohne Domain-Klassen", () => {
		expectTypeOf<GameDraft["ruleSetSnapshot"]>().toEqualTypeOf<RuleSetDraft>();
		expectTypeOf<GameDraft["players"]>().toEqualTypeOf<GamePlayerDraft[]>();
		expectTypeOf<GameDraft["seatOrder"]>().toEqualTypeOf<string[]>();
	});
});

function createDraftDocument(): GameDocument {
	return {
		fileType: "social-deduction-game",
		schemaVersion: 1,
		id: "game_draft_contract",
		name: "Draft-Vertrag",
		names: { de: "Draft-Vertrag" },
		isTemplate: false,
		createdAt: "2026-01-02T03:04:05.000Z",
		ruleSetSnapshot: {
			id: "ruleset_draft_contract",
			name: "Draft Rules",
			version: 1,
			teams: [{ id: "t_good", name: "Good", teamOrder: 1 }],
			roles: [{ id: "r_seer", name: "Seer", teamId: "t_good" }],
			statuses: [{ id: "d_poisoned", name: "Poisoned", defaultDuration: 0 }],
		},
		players: [
			{
				id: "p_player1",
				name: "Anna",
				lifeState: "alive",
				roles: {
					actualRoleId: "r_seer",
					shownRoleIds: ["r_seer"],
					nightRoleId: "r_seer",
				},
				statuses: [
					{
						id: "s_poisoned_1",
						statusId: "d_poisoned",
						fromNight: 1,
						untilNight: null,
						source: {
							playerId: "p_player1",
							roleSourceType: "actual",
							roleIdAtTime: "r_seer",
						},
					},
				],
			},
		],
		seatOrder: ["p_player1"],
		time: { currentNight: 1, phase: "night" },
		log: [
			{
				id: "log_draft_contract",
				night: 1,
				phase: "night",
				createdAt: "2026-01-02T04:05:06.000Z",
				type: "contract",
				actor: "storyteller",
				text: "Draft erstellt",
				payload: { playerId: "p_player1" },
			},
		],
		rolesForShowing: { roles: ["r_seer"], notice: "Bitte zeigen" },
	};
}
