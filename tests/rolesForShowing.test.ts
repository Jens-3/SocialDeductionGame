import { describe, expect, it } from "vitest";
import {
	createRolesForShowingEditorModel,
	createRolesForShowingPresentation,
} from "../src/application/rolesForShowing";
import { repairIds } from "../src/domain/gameIdRepair";
import { saveRolesForShowing } from "../src/domain/gameRolesForShowing";
import { createTestGame } from "./fixtures";
import { editRole } from "./sessionEditingTestAdapter";

describe("Rollen zum Zeigen", () => {
	it("sortiert die Auswahl nach Team, DisplayName und ID", () => {
		const game = createTestGame();

		expect(
			createRolesForShowingEditorModel(game).roleOptions.map(({ id }) => id),
		).toEqual(["r_seer", "r_villager", "r_wolf"]);
	});

	it("speichert Rollen-IDs einschließlich Duplikaten und bereinigt den Hinweis", () => {
		const game = createTestGame();

		const result = saveRolesForShowing(game, {
			roles: ["r_seer", "r_seer", "r_wolf"],
			notice: "  Gute Rollen\u202e  ",
			showRoleSymbols: true,
		});

		expect(result.rolesForShowing).toEqual({
			roles: ["r_seer", "r_seer", "r_wolf"],
			notice: "Gute Rollen",
			showRoleSymbols: true,
		});
		expect(game.rolesForShowing).toBeUndefined();
	});

	it("speichert nur vorhandene Rollen-IDs und bewahrt gültige Duplikate", () => {
		const game = createTestGame();

		const result = saveRolesForShowing(game, {
			roles: ["r_seer", "r_missing", " r_wolf ", "r_seer"],
			notice: "Auswahl",
			showRoleSymbols: false,
		});

		expect(result.rolesForShowing?.roles).toEqual([
			"r_seer",
			"r_wolf",
			"r_seer",
		]);
	});

	it("erzeugt die Vorschau aus DisplayNames und fällt auf unbekannte IDs zurück", () => {
		const game = createTestGame();

		expect(
			createRolesForShowingPresentation(game, {
				roles: ["r_seer", "r_missing", "r_seer"],
				notice: "Auswahl",
				showRoleSymbols: false,
			}),
		).toEqual({
			notice: "Auswahl",
			roleNames: ["Seer", "r_missing", "Seer"],
		});
	});

	it("stellt bei aktiviertem Toggle Rollensymbol oder Standardsymbol voran", () => {
		const game = createTestGame();
		const seer = game.ruleSetSnapshot.roles.find(({ id }) => id === "r_seer");
		if (!seer) throw new Error("Seer fehlt.");
		seer.unicodeSymbol = "👁";

		expect(
			createRolesForShowingPresentation(game, {
				roles: ["r_seer", "r_wolf"],
				notice: "",
				showRoleSymbols: true,
			}).roleNames,
		).toEqual(["👁 Seer", "◆ Wolf"]);
	});

	it("führt Rollen-ID-Änderungen in der Zeigeliste mit", () => {
		const game = createTestGame();
		game.rolesForShowing = {
			roles: ["r_seer", "r_seer"],
			showRoleSymbols: false,
		};

		const edited = editRole(game, {
			roleId: "r_seer",
			name: "Oracle",
		}).game;

		expect(edited.rolesForShowing?.roles).toEqual(["r_oracle", "r_oracle"]);
	});

	it("zieht eine syntaktisch reparierte Rollen-ID nach", () => {
		const game = createTestGame();
		const role = game.ruleSetSnapshot.roles[0];
		if (!role) throw new Error("Testrolle fehlt.");
		role.id = "Bad Role";
		game.rolesForShowing = {
			roles: ["Bad Role", "Bad Role"],
			showRoleSymbols: false,
		};

		expect(repairIds(game)).not.toBeTypeOf("string");
		expect(
			game.ruleSetSnapshot.roles.find(({ name }) => name === role.name)?.id,
		).toBe("r_bad_role");
		expect(game.rolesForShowing?.roles).toEqual(["r_bad_role", "r_bad_role"]);
	});
});
