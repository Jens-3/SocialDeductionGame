import { describe, expect, it } from "vitest";
import {
	createUniqueScenarioId,
	createUniqueScenarioIdentity,
	type RoleEditorValues,
	ScenarioEditorFactory,
	suggestScenarioCopy,
} from "../src/application/scenarioEditor";
import { Role, Team } from "../src/domain/models";
import { createTemplateFromGame } from "../src/domain/templateFactory";
import { fixedDomainServices } from "./fixedClock";
import { createTestGame, createTestRuleSet } from "./fixtures";

const ScenarioEditorSession = new ScenarioEditorFactory();

function completeRoleUpdate(
	overrides: Partial<RoleEditorValues> = {},
): RoleEditorValues {
	return {
		name: "Seer",
		displayName: null,
		teamId: "t_good",
		firstNightOrder: null,
		otherNightOrder: null,
		isUnique: true,
		unicodeEscaped: null,
		killsSomeone: false,
		resurrectSomeone: false,
		applyStatusEffect: [],
		...overrides,
	};
}

describe("ScenarioEditorSession", () => {
	it("sortiert Teams nach teamOrder und Rollen nach Team, Name und ID", () => {
		const editor = ScenarioEditorSession.fromRuleSet(createTestRuleSet());

		expect(editor.items("teams").map(({ id }) => id)).toEqual([
			"t_good",
			"t_evil",
			"t_unknown",
		]);
		expect(editor.items("roles").map(({ id }) => id)).toEqual([
			"r_seer",
			"r_villager",
			"r_wolf",
		]);
	});

	it("wird erst nach einer Änderung dirty und nach dem Speichern wieder clean", () => {
		const editor = ScenarioEditorSession.fromRuleSet(createTestRuleSet());
		expect(editor.isDirty()).toBe(false);

		const updatedId = editor.update(
			"roles",
			"r_seer",
			completeRoleUpdate({
				name: "  Wahrsager  ",
			}),
		);
		expect(editor.isDirty()).toBe(true);
		expect(updatedId).toBe("r_wahrsager");
		expect(editor.getItem("roles", updatedId)?.name).toBe("Wahrsager");

		editor.markSaved();
		expect(editor.isDirty()).toBe(false);
	});

	it("liefert bei gleichen Namen die ID der tatsächlich geänderten Rolle", () => {
		const editor = ScenarioEditorSession.fromRuleSet(createTestRuleSet());

		const updatedId = editor.update(
			"roles",
			"r_wolf",
			completeRoleUpdate({
				name: "Seer",
				teamId: "t_evil",
			}),
		);

		expect(updatedId).toBe("r_seer_2");
		expect(editor.getItem("roles", "r_seer")?.teamId).toBe("t_good");
		expect(editor.getItem("roles", updatedId)?.teamId).toBe("t_evil");
		expect(editor.getItem("roles", updatedId)?.name).toBe("Seer 2");
	});

	it("liefert beim Erstellen trotz Sortierung die ID des neuen Objekts", () => {
		const editor = ScenarioEditorSession.fromRuleSet(createTestRuleSet());

		const newTeamId = editor.create("teams", "Neues Team");

		expect(newTeamId).toBe("t_neues_team");
		expect(editor.getItem("teams", newTeamId)?.name).toBe("Neues Team");
	});

	it("repariert vor der Ausgabe IDs und ihre Folgereferenzen", () => {
		const ruleSet = createTestRuleSet();
		ruleSet.teams[0] = new Team({
			id: "p_outsider",
			name: "Outsider",
			teamOrder: 10,
		});
		ruleSet.roles[0] = new Role({
			id: "r_seer",
			name: "Seer",
			teamId: "p_outsider",
		});
		const editor = ScenarioEditorSession.fromRuleSet(ruleSet);

		const saved = editor.toDocument() as typeof ruleSet;

		expect(saved.teams[0]?.id).toBe("t_outsider");
		expect(saved.roles[0]?.teamId).toBe("t_outsider");
	});

	it("bearbeitet Nachtfolgen, Symbol und aktive Fähigkeiten einer Rolle", () => {
		const editor = ScenarioEditorSession.fromRuleSet(createTestRuleSet());
		const statusId = editor.create("statuses", "Neuer Zustand");

		editor.update(
			"roles",
			"r_seer",
			completeRoleUpdate({
				name: "Seer",
				teamId: "t_good",
				firstNightOrder: 5,
				otherNightOrder: 12,
				isUnique: false,
				unicodeEscaped: "\\u{1F539}",
				killsSomeone: true,
				resurrectSomeone: true,
				applyStatusEffect: [statusId],
			}),
		);

		const role = (
			editor.toDocument() as ReturnType<typeof createTestRuleSet>
		).roles.find(({ id }) => id === "r_seer");
		expect(role?.night).toEqual({ first: { order: 5 }, other: { order: 12 } });
		expect(role?.isUnique).toBe(false);
		expect(role?.unicodeEscaped).toBe("\\u{1F539}");
		expect(role?.unicodeSymbol).toBe("🔹");
		expect(role?.kills_someone).toBe(true);
		expect(role?.resurrect_someone).toBe(true);
		expect(role?.apply_status_effect).toEqual([statusId]);
		expect(editor.getItem("roles", "r_seer")).toMatchObject({
			killsSomeone: true,
			resurrectSomeone: true,
			applyStatusEffect: [statusId],
		});
	});

	it("bearbeitet die Standarddauer eines Zustands einschließlich unendlich", () => {
		const editor = ScenarioEditorSession.fromRuleSet(createTestRuleSet());
		let statusId = editor.create("statuses", "Neuer Zustand");

		statusId = editor.update("statuses", statusId, {
			name: "Dauerzustand",
			defaultDuration: 0,
		});

		expect(editor.getItem("statuses", statusId)?.defaultDuration).toBe(0);
		expect(
			(
				editor.toDocument() as ReturnType<typeof createTestRuleSet>
			).statuses?.find(({ id }) => id === statusId)?.defaultDuration,
		).toBe(0);
		expect(() =>
			editor.update("statuses", statusId, {
				name: "Dauerzustand",
				defaultDuration: -1,
			}),
		).toThrow("invalidValue");
	});

	it("aktualisiert und entfernt den DisplayName von Teams, Rollen und Zuständen", () => {
		const editor = ScenarioEditorSession.fromRuleSet(createTestRuleSet());
		let statusId = editor.create("statuses", "Neuer Zustand");

		editor.update("teams", "t_good", {
			name: "Good",
			displayName: "  Gute Leute  ",
		});
		editor.update(
			"roles",
			"r_seer",
			completeRoleUpdate({
				name: "Seer",
				displayName: "Seher",
			}),
		);
		statusId = editor.update("statuses", statusId, {
			name: "New status",
			displayName: "Neuer Zustand",
		});
		let saved = editor.toDocument() as ReturnType<typeof createTestRuleSet>;
		expect(saved.teams.find(({ id }) => id === "t_good")?.names).toEqual({
			de: "Gute Leute",
		});
		expect(saved.roles.find(({ id }) => id === "r_seer")?.names).toEqual({
			de: "Seher",
		});
		expect(saved.statuses?.find(({ id }) => id === statusId)?.names).toEqual({
			de: "Neuer Zustand",
		});

		editor.update("teams", "t_good", { name: "Good", displayName: "" });
		editor.update(
			"roles",
			"r_seer",
			completeRoleUpdate({ name: "Seer", displayName: null }),
		);
		editor.update("statuses", statusId, {
			name: "New status",
			displayName: "",
		});
		saved = editor.toDocument() as ReturnType<typeof createTestRuleSet>;
		expect(
			saved.teams.find(({ id }) => id === "t_good")?.names,
		).toBeUndefined();
		expect(
			saved.roles.find(({ id }) => id === "r_seer")?.names,
		).toBeUndefined();
		expect(
			saved.statuses?.find(({ id }) => id === statusId)?.names,
		).toBeUndefined();
	});

	it("ändert bei Rollen nur den DisplayName der aktuellen Sprache", () => {
		const ruleSet = createTestRuleSet();
		const role = ruleSet.roles.find(({ id }) => id === "r_seer");
		expect(role).toBeDefined();
		if (!role) return;
		role.names = { de: "Seher", en: "Seer", fr: "Voyante" };
		const editor = ScenarioEditorSession.fromRuleSet(ruleSet);

		editor.update("roles", "r_seer", completeRoleUpdate({ displayName: null }));
		let savedRole = (
			editor.toDocument() as ReturnType<typeof createTestRuleSet>
		).roles.find(({ id }) => id === "r_seer");
		expect(savedRole?.names).toEqual({ en: "Seer", fr: "Voyante" });

		editor.update(
			"roles",
			"r_seer",
			completeRoleUpdate({ displayName: "Wahrsagerin" }),
		);
		savedRole = (
			editor.toDocument() as ReturnType<typeof createTestRuleSet>
		).roles.find(({ id }) => id === "r_seer");
		expect(savedRole?.names).toEqual({
			de: "Wahrsagerin",
			en: "Seer",
			fr: "Voyante",
		});
	});

	it("bearbeitet den DisplayName eines Spielers und bewahrt andere Sprachen", () => {
		const game = createTestGame();
		const template = createTemplateFromGame({
			services: fixedDomainServices,
			game,
		}).template;
		let playerId = template.seatOrder[0];
		expect(playerId).toBeDefined();
		if (!playerId) return;
		const player = template.playersById[playerId];
		expect(player).toBeDefined();
		if (!player) return;
		player.names = { en: "Player One" };
		const editor = ScenarioEditorSession.fromTemplate(template);

		playerId = editor.update("players", playerId, {
			name: template.playersById[playerId]?.name ?? "Player 1",
			displayName: "Spieler Eins",
		});
		expect(
			(editor.toDocument() as typeof game).playersById[playerId]?.names,
		).toEqual({ en: "Player One", de: "Spieler Eins" });

		editor.update("players", playerId, {
			name: template.playersById[playerId]?.name ?? "Player 1",
			displayName: "",
		});
		expect(
			(editor.toDocument() as typeof game).playersById[playerId]?.names,
		).toEqual({ en: "Player One" });
	});

	it("bearbeitet und entfernt Farben bei Teams, Rollen und Spielern", () => {
		const template = createTemplateFromGame({
			services: fixedDomainServices,
			game: createTestGame(),
		}).template;
		let playerId = template.seatOrder[0];
		expect(playerId).toBeDefined();
		if (!playerId) return;
		const editor = ScenarioEditorSession.fromTemplate(template);

		editor.update("teams", "t_good", { name: "Good", color: "112233" });
		editor.update("roles", "r_seer", completeRoleUpdate({ color: "AABBCC" }));
		playerId = editor.update("players", playerId, {
			name: template.playersById[playerId]?.name ?? "Player 1",
			color: "00FF88",
		});

		let saved = editor.toDocument() as typeof template;
		expect(
			saved.ruleSetSnapshot.teams.find(({ id }) => id === "t_good")?.color,
		).toBe("112233");
		expect(
			saved.ruleSetSnapshot.roles.find(({ id }) => id === "r_seer")?.color,
		).toBe("AABBCC");
		expect(saved.playersById[playerId]?.color).toBe("00FF88");

		editor.update("players", playerId, {
			name: saved.playersById[playerId]?.name ?? "Player 1",
			color: null,
		});
		saved = editor.toDocument() as typeof template;
		expect(saved.playersById[playerId]?.color).toBeUndefined();
	});

	it("löscht Objekte nur aus der Arbeitskopie", () => {
		const original = createTestRuleSet();
		const editor = ScenarioEditorSession.fromRuleSet(original);

		editor.delete("roles", "r_seer");

		expect(editor.getItem("roles", "r_seer")).toBeUndefined();
		expect(original.roles.some(({ id }) => id === "r_seer")).toBe(true);
		expect(editor.isDirty()).toBe(true);
	});

	it("entfernt gelöschte Rollen vollständig aus rolesForShowing", () => {
		const original = createTestGame();
		original.rolesForShowing = {
			notice: "Hinweis",
			roles: ["r_seer", "r_wolf", "r_seer"],
			showRoleSymbols: true,
		};
		const editor = ScenarioEditorSession.fromGame(original);

		editor.delete("roles", "r_seer");

		const saved = editor.toDocument() as typeof original;
		expect(saved.rolesForShowing).toEqual({
			notice: "Hinweis",
			roles: ["r_wolf"],
			showRoleSymbols: true,
		});
		expect(original.rolesForShowing?.roles).toEqual([
			"r_seer",
			"r_wolf",
			"r_seer",
		]);
	});

	it("erstellt eine reparierte, zunächst unveränderte Arbeitskopie eines Spiels", () => {
		const original = createTestGame();
		(original.ruleSetSnapshot.teams[0] as { id: string }).id = "Falsche ID";
		const role = original.ruleSetSnapshot.roles[0];
		if (!role) throw new Error("Testrolle fehlt.");
		role.teamId = "Falsche ID";

		const editor = ScenarioEditorSession.fromGame(original);

		expect(editor.type).toBe("game");
		expect(editor.isDirty()).toBe(false);
		expect(editor.getItem("teams", "t_falsche_id")).toBeDefined();
		expect(original.ruleSetSnapshot.teams[0]?.id).toBe("Falsche ID");
		expect(role.teamId).toBe("Falsche ID");

		editor.update("teams", "t_falsche_id", {
			name: "Repariertes Team",
			displayName: "Repariertes Team",
		});
		const result = editor.toDocument() as typeof original;
		expect(result.isTemplate).toBe(false);
		expect(result.ruleSetSnapshot.teams[0]?.name).toBe("Repariertes Team");
		expect(original.ruleSetSnapshot.teams[0]?.name).toBe("Good");
	});
});

describe("Szenario-Kopien", () => {
	it("hält beim Erstellen einen kollisionsfreien Namen und eine kollisionsfreie ID synchron", () => {
		expect(
			createUniqueScenarioIdentity("Neues Regelwerk", "ruleSet", [
				{
					id: "ruleset_neues_regelwerk",
					name: "Neues Regelwerk",
				},
				{
					id: "ruleset_neues_regelwerk_1",
					name: "Neues Regelwerk (1)",
				},
			]),
		).toEqual({
			name: "Neues Regelwerk (2)",
			id: "ruleset_neues_regelwerk_2",
		});
	});

	it("schlägt die erste freie Nummer innerhalb desselben Typs vor", () => {
		expect(
			suggestScenarioCopy("Standard Rule Set", "ruleSet", [
				{ id: "ruleset_standard_rule_set", name: "Standard Rule Set" },
				{
					id: "ruleset_standard_rule_set_1",
					name: "Standard Rule Set (1)",
				},
			]),
		).toEqual({
			name: "Standard Rule Set (2)",
			id: "ruleset_standard_rule_set_2",
		});
	});

	it("erzeugt aus einem manuell geänderten Pflichtnamen eine eindeutige Bereichs-ID", () => {
		expect(
			createUniqueScenarioId("Meine Vorlage (1)", "template", [
				"template_meine_vorlage_1",
			]),
		).toBe("template_meine_vorlage_1_2");
	});
});
