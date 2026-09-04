import { describe, expect, it } from "vitest";
import { createGameFromRuleSet } from "../src/domain/gameFactory";
import { createRuleSetExportJsonText } from "../src/serialization/ruleSetExport";
import { fixedDomainServices } from "./fixedClock";
import { importRuleSetFromJsonText } from "./ruleSetImportTestHelper";

describe("RuleSet-Import und -Export", () => {
	it("akzeptiert optionale Metadaten und lehnt gekapselte Formate ab", () => {
		const ruleSet = {
			name: "Old Rules",
			teams: [],
			roles: [],
		};
		expect(() =>
			importRuleSetFromJsonText(JSON.stringify(ruleSet)),
		).not.toThrow();
		expect(() =>
			importRuleSetFromJsonText(
				JSON.stringify({
					fileType: "social-deduction-ruleset",
					schemaVersion: 1,
					ruleSet,
				}),
			),
		).toThrow('unbekanntes Feld: "ruleSet"');
	});

	it("lehnt die früheren absoluten Statusgrenzen ab", () => {
		expect(() =>
			importRuleSetFromJsonText(
				JSON.stringify({
					fileType: "social-deduction-ruleset",
					schemaVersion: 1,
					name: "Status Rules",
					teams: [],
					roles: [],
					statuses: [
						{
							id: "d_old",
							name: "Old",
							defaultFromNight: 1,
							defaultUntilNight: 2,
						},
					],
				}),
			),
		).toThrow('unbekannte Felder: "defaultFromNight", "defaultUntilNight"');
	});

	it("ergänzt das System-Team unknown und übersteht einen Export-Rundlauf", () => {
		const input = JSON.stringify({
			fileType: "social-deduction-ruleset",
			schemaVersion: 1,
			id: "minimal_rules",
			name: "Minimal Rules",
			version: 1,
			teams: [{ id: "t_good", name: "Good", teamOrder: 10 }],
			roles: [{ id: "r_seer", name: "Seer", teamId: "t_good" }],
		});

		const firstImport = importRuleSetFromJsonText(input);
		expect(firstImport.ruleSet.teams.map((team) => team.id)).toContain(
			"t_unknown",
		);

		const exported = createRuleSetExportJsonText(firstImport.ruleSet);
		const secondImport = importRuleSetFromJsonText(exported);

		expect(secondImport.ruleSet).toEqual(firstImport.ruleSet);
		expect(JSON.parse(exported)).toMatchObject({
			fileType: "social-deduction-ruleset",
			schemaVersion: 1,
			id: "ruleset_minimal_rules",
			name: "Minimal Rules",
		});
		expect(JSON.parse(exported)).not.toHaveProperty("ruleSet");
	});

	it("importiert das flache Minimalformat mit Standardwerten", () => {
		const imported = importRuleSetFromJsonText(
			JSON.stringify({
				fileType: "social-deduction-ruleset",
				schemaVersion: 1,
				name: "Flat Rules",
				teams: [{ id: "t_good", name: "Good", teamOrder: 10 }],
				roles: [{ id: "r_seer", name: "Seer", teamId: "t_good" }],
			}),
		);

		expect(imported.ruleSet).toMatchObject({
			id: "ruleset_flat_rules",
			name: "Flat Rules",
			version: 1,
		});
	});

	it("bewahrt eine gültige abweichende ID und ersetzt eine ungültige aus dem Namen", () => {
		const base = {
			fileType: "social-deduction-ruleset",
			schemaVersion: 1,
			name: "Human Name",
			teams: [{ id: "t_good", name: "Good", teamOrder: 10 }],
			roles: [{ id: "r_seer", name: "Seer", teamId: "t_good" }],
		};
		const valid = importRuleSetFromJsonText(
			JSON.stringify({ ...base, id: "ruleset_stable_external_id" }),
		);
		const invalid = importRuleSetFromJsonText(
			JSON.stringify({ ...base, id: "Already occupied?" }),
		);

		expect(valid.ruleSet.id).toBe("ruleset_stable_external_id");
		expect(invalid.ruleSet.id).toBe("ruleset_human_name");
	});

	it("lehnt doppelte Rollen-IDs ab", () => {
		const input = JSON.stringify({
			fileType: "social-deduction-ruleset",
			schemaVersion: 1,
			id: "duplicate_roles",
			name: "Duplicate Roles",
			version: 1,
			teams: [{ id: "t_good", name: "Good", teamOrder: 10 }],
			roles: [
				{ id: "r_seer", name: "Seer", teamId: "t_good" },
				{ id: "r_seer", name: "Other Seer", teamId: "t_good" },
			],
		});

		expect(() => importRuleSetFromJsonText(input)).toThrow(
			/Doppelte Rollen-ID/,
		);
	});

	it("übernimmt alle optionalen Felder und exportiert byteweise stabil", () => {
		const input = JSON.stringify({
			fileType: "social-deduction-ruleset",
			schemaVersion: 1,
			id: "localized_rules",
			name: "Localized Rules",
			names: { de: "Lokalisierte Regeln", en: "Localized Rules" },
			version: 1,
			teams: [
				{
					id: "t_good",
					name: "Good",
					names: { de: "Gut", en: "Good" },
					teamOrder: 10,
				},
			],
			statuses: [
				{
					id: "d_poisoned",
					name: "Poisoned",
					names: { de: "Vergiftet", ja: "毒状態" },
					defaultDuration: 2,
				},
				{
					id: "d_sleeping",
					name: "Sleeping",
					defaultDuration: 1,
				},
			],
			roles: [
				{
					id: "empath",
					name: "Empath",
					names: { de: "Empath", ja: "エンパス" },
					teamId: "t_good",
					kills_someone: false,
					resurrect_someone: true,
					apply_status_effect: ["d_poisoned", "d_sleeping"],
				},
			],
		});

		const firstImport = importRuleSetFromJsonText(input);
		const role = firstImport.ruleSet.roles[0];
		expect(firstImport.ruleSet.names?.de).toBe("Lokalisierte Regeln");
		expect(firstImport.ruleSet.teams[0]?.names?.de).toBe("Gut");
		expect(firstImport.ruleSet.statuses?.[0]).toMatchObject({
			id: "d_poisoned",
			name: "Poisoned",
			names: { de: "Vergiftet", ja: "毒状態" },
			defaultDuration: 2,
		});
		expect(role).toMatchObject({
			names: { de: "Empath", ja: "エンパス" },
			kills_someone: false,
			resurrect_someone: true,
			apply_status_effect: ["d_poisoned", "d_sleeping"],
		});

		const firstExport = createRuleSetExportJsonText(firstImport.ruleSet);
		expect(firstExport.charCodeAt(0)).toBe("{".charCodeAt(0));
		const secondImport = importRuleSetFromJsonText(firstExport);
		expect(secondImport.ruleSet).toEqual(firstImport.ruleSet);
		expect(createRuleSetExportJsonText(secondImport.ruleSet)).toBe(firstExport);

		const game = createGameFromRuleSet({
			services: fixedDomainServices,
			ruleSet: firstImport.ruleSet,
			playerCount: 1,
		});
		expect(game.statusDefinitionsById.d_poisoned).toMatchObject({
			name: "Poisoned",
			names: { de: "Vergiftet" },
		});
	});

	it("meldet unbekannte Felder mit einem Vorschlag", () => {
		const input = JSON.stringify({
			fileType: "social-deduction-ruleset",
			schemaVersion: 1,
			id: "ruleset_typo",
			name: "Typo",
			version: 1,
			teams: [{ id: "t_good", name: "Good", teamOrder: 1 }],
			roles: [
				{ id: "r_seer", name: "Seer", teamId: "t_good", isUnqiue: false },
			],
		});

		expect(() => importRuleSetFromJsonText(input)).toThrow(
			'roles[0] enthält ein unbekanntes Feld: "isUnqiue" (war "isUnique" gemeint?)',
		);
	});

	it("lehnt falsche Typen optionaler Felder ab", () => {
		const input = JSON.stringify({
			fileType: "social-deduction-ruleset",
			schemaVersion: 1,
			id: "ruleset_type",
			name: "Type",
			version: 1,
			teams: [{ id: "t_good", name: "Good", teamOrder: 1 }],
			roles: [
				{
					id: "r_seer",
					name: "Seer",
					teamId: "t_good",
					expectsVisual: "yes",
				},
			],
		});

		expect(() => importRuleSetFromJsonText(input)).toThrow(
			"roles[0].expectsVisual muss boolean sein",
		);
	});

	it("listet fehlende Definitionen und doppelte Statuseinträge gemeinsam auf", () => {
		const input = JSON.stringify({
			fileType: "social-deduction-ruleset",
			schemaVersion: 1,
			id: "ruleset_statuses",
			name: "Statuses",
			version: 1,
			teams: [{ id: "t_good", name: "Good", teamOrder: 1 }],
			statuses: [{ id: "d_known", name: "Known" }],
			roles: [
				{
					id: "r_seer",
					name: "Seer",
					teamId: "t_good",
					apply_status_effect: ["d_missing", "d_known", "d_missing"],
				},
			],
		});

		expect(() => importRuleSetFromJsonText(input)).toThrow(
			/Statusdefinitionen fehlen für: "d_missing"\. Doppelte Statuseinträge in Rollen: Rolle "r_seer": "d_missing"\./,
		);
	});

	it("bewahrt JSON-Parserdetails getrennt von der kurzen Meldung", () => {
		try {
			importRuleSetFromJsonText('{\n  "fileType": }');
			expect.unreachable();
		} catch (error) {
			expect(error).toMatchObject({
				failure: {
					source: "serialization",
					reason: "invalidJson",
					repairable: true,
				},
			});
			expect((error as Error).message).toContain("Unexpected");
			expect((error as { details: string }).details).toContain(
				"Ungültiges JSON",
			);
		}
	});
});
