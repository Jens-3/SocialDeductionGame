import { describe, expect, it } from "vitest";

import { Role, Team } from "../src/domain/models";
import type { RuleSet, RuleSetDraft } from "../src/domain/ruleSet";
import {
	assertRuleSetExportable,
	createRuleSetFromDraft,
} from "../src/domain/ruleSetValidation";

function createDraft(overrides: Partial<RuleSetDraft> = {}): RuleSetDraft {
	return {
		name: "Testregeln",
		teams: [{ id: "t_good", name: "Gut", teamOrder: 1 }],
		roles: [{ id: "r_seer", name: "Seher", teamId: "t_good" }],
		...overrides,
	};
}

describe("fachliche RuleSet-Validierung", () => {
	it("prüft Werte eines bereits typisierten Entwurfs", () => {
		expect(() => createRuleSetFromDraft(createDraft({ version: 1.5 }))).toThrow(
			"version muss eine positive ganze Zahl sein",
		);
		expect(() =>
			createRuleSetFromDraft(
				createDraft({
					statuses: [
						{
							id: "d_poisoned",
							name: "Vergiftet",
							defaultDuration: -1,
						},
					],
				}),
			),
		).toThrow("defaultDuration muss eine ganze Zahl >= 0 sein");
	});

	it("prüft Referenzen und doppelte Listeneinträge fachlich", () => {
		expect(() =>
			createRuleSetFromDraft(
				createDraft({
					roles: [
						{
							id: "r_seer",
							name: "Seher",
							teamId: "t_good",
							apply_status_effect: ["d_missing", "d_missing"],
						},
					],
				}),
			),
		).toThrow(/Statusdefinitionen fehlen.*Doppelte Statuseinträge/u);
	});

	it("normalisiert gültige Fachwerte und erzeugt eine fehlende RuleSet-ID", () => {
		const result = createRuleSetFromDraft(
			createDraft({ name: "  Meine Regeln  " }),
		);

		expect(result.ruleSet).toMatchObject({
			id: "ruleset_meine_regeln",
			name: "Meine Regeln",
			version: 1,
		});
		expect(result.ruleSet.teams.map(({ id }) => id)).toContain("t_unknown");
	});

	it("erzeugt fehlende Unicode-Darstellungen und prüft vorhandene Paare", () => {
		const fromSymbol = createRuleSetFromDraft(
			createDraft({
				roles: [
					{
						id: "r_seer",
						name: "Seher",
						teamId: "t_good",
						unicodeSymbol: "👁️",
					},
				],
				statuses: [
					{
						id: "d_poisoned",
						name: "Vergiftet",
						unicodeEscaped: "\\u{1F922}",
					},
				],
			}),
		).ruleSet;

		expect(fromSymbol.roles[0]).toMatchObject({
			unicodeSymbol: "👁️",
			unicodeEscaped: "\\u{1F441}\\u{FE0F}",
		});
		expect(fromSymbol.statuses?.[0]).toMatchObject({
			unicodeSymbol: "🤢",
			unicodeEscaped: "\\u{1F922}",
		});
		expect(() =>
			createRuleSetFromDraft(
				createDraft({
					roles: [
						{
							id: "r_seer",
							name: "Seher",
							teamId: "t_good",
							unicodeSymbol: "🐺",
							unicodeEscaped: "\\u{1F441}",
						},
					],
				}),
			),
		).toThrow("beschreiben nicht dasselbe Unicode-Symbol");
	});

	it("normalisiert IDs beim Import und prüft gespeicherte Snapshots strikt", () => {
		const draft = createDraft({
			teams: [
				{ id: "t_good", name: "Gut", teamOrder: 1 },
				{ id: "t_unknown", name: "Unbekannt", teamOrder: 99 },
			],
			roles: [{ id: "Seer Role", name: "Seher", teamId: "t_good" }],
		});

		expect(createRuleSetFromDraft(draft).ruleSet.roles[0]?.id).toBe(
			"r_seer_role",
		);
		expect(() => createRuleSetFromDraft(draft, { mode: "stored" })).toThrow(
			"Role id",
		);
	});
	it("akzeptiert Farben nur als kanonischen sechsstelligen RGB-Hexcode", () => {
		const valid = createRuleSetFromDraft(
			createDraft({
				teams: [{ id: "t_good", name: "Gut", color: "12ABEF", teamOrder: 1 }],
				roles: [
					{ id: "r_seer", name: "Seher", color: "ABCDEF", teamId: "t_good" },
				],
			}),
		).ruleSet;
		expect(valid.teams.find(({ id }) => id === "t_good")?.color).toBe("12ABEF");
		expect(valid.roles[0]?.color).toBe("ABCDEF");

		for (const color of ["abcdef", "#ABCDEF", "ABCDE", "ABCDEG", ""]) {
			expect(() =>
				createRuleSetFromDraft(
					createDraft({
						teams: [{ id: "t_good", name: "Gut", color, teamOrder: 1 }],
					}),
				),
			).toThrow("sechs Zeichen");
		}
	});
});

describe("fachliche RuleSet-Exportvalidierung", () => {
	it("akzeptiert ein fachlich exportierbares RuleSet", () => {
		expect(() =>
			assertRuleSetExportable(createExportableRuleSet()),
		).not.toThrow();
	});

	it("prüft IDs, Eindeutigkeit und Teamreferenzen in der Domain", () => {
		const duplicateTeam = new Team({
			id: "t_good",
			name: "Auch gut",
			teamOrder: 2,
		});
		expect(() =>
			assertRuleSetExportable({
				...createExportableRuleSet(),
				teams: [...createExportableRuleSet().teams, duplicateTeam],
			}),
		).toThrow('Doppelte Team-ID "t_good"');

		const role = new Role({
			id: "r_lost",
			name: "Verloren",
			teamId: "t_missing",
		});
		expect(() =>
			assertRuleSetExportable({
				...createExportableRuleSet(),
				roles: [role],
			}),
		).toThrow('verweist auf unbekanntes Team "t_missing"');
	});

	it("prüft optionale Fachwerte und ASCII-Escapes in der Domain", () => {
		expect(() =>
			assertRuleSetExportable({
				...createExportableRuleSet(),
				statuses: [
					{
						id: "d_poisoned",
						name: "Vergiftet",
						defaultDuration: -1,
					},
				],
			}),
		).toThrow("defaultDuration");

		const role = new Role({
			id: "r_seer",
			name: "Seher",
			teamId: "t_good",
		});
		role.unicodeEscaped = "👁";
		expect(() =>
			assertRuleSetExportable({
				...createExportableRuleSet(),
				roles: [role],
			}),
		).toThrow("darf nur ASCII-Zeichen enthalten");
	});
});

function createExportableRuleSet(): RuleSet {
	return {
		id: "ruleset_test",
		name: "Test",
		version: 1,
		teams: [new Team({ id: "t_good", name: "Gut", teamOrder: 1 })],
		roles: [
			new Role({
				id: "r_seer",
				name: "Seher",
				teamId: "t_good",
			}),
		],
	};
}
