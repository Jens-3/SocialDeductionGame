import { describe, expect, it } from "vitest";

import { Player, Role } from "../src/domain/models";

describe("Player-Rollenkaskade", () => {
	it("erzeugt unicodeSymbol aus unicodeEscaped", () => {
		const role = new Role({
			id: "r_sun",
			name: "Sun",
			unicodeEscaped: "\\u2600\\ufe0f",
		});

		expect(role.unicodeSymbol).toBe("☀️");
	});
	it("zieht gekoppelte shownRole und nightRole bei actualRole mit", () => {
		const player = new Player({
			id: "p_alice",
			name: "Alice",
			roles: {
				actualRoleId: "r_old",
				shownRoleIds: ["r_old"],
				nightRoleId: "r_old",
			},
		});

		player.changeActualRole("r_new");

		expect(player.roles).toMatchObject({
			actualRoleId: "r_new",
			shownRoleIds: ["r_new"],
			nightRoleId: "r_new",
		});
	});

	it("ändert bei einer gekoppelten tatsächlichen Rolle nur die erste gezeigte Rolle", () => {
		const player = new Player({
			id: "p_alice",
			name: "Alice",
			roles: {
				actualRoleId: "r_old",
				shownRoleIds: ["r_old", "r_extra"],
				nightRoleId: "r_old",
			},
		});

		player.changeActualRole("r_new");

		expect(player.roles).toMatchObject({
			actualRoleId: "r_new",
			shownRoleIds: ["r_new", "r_extra"],
			nightRoleId: "r_new",
		});
	});

	it("bewahrt bewusst abweichende shownRole und nightRole", () => {
		const player = new Player({
			id: "p_alice",
			name: "Alice",
			roles: {
				actualRoleId: "r_old",
				shownRoleIds: ["r_shown"],
				nightRoleId: "r_night",
			},
		});

		player.changeActualRole("r_new");

		expect(player.roles).toMatchObject({
			actualRoleId: "r_new",
			shownRoleIds: ["r_shown"],
			nightRoleId: "r_night",
		});
	});

	it("zieht eine leere nightRole bei Änderung der shownRole mit", () => {
		const player = new Player({
			id: "p_alice",
			name: "Alice",
			roles: {
				actualRoleId: "r_actual",
				shownRoleIds: ["r_old"],
				nightRoleId: null,
			},
		});

		player.changeShownRole({ newShownRoleId: "r_new" });

		expect(player.roles.shownRoleIds[0]).toBe("r_new");
		expect(player.roles.nightRoleId).toBe("r_new");
	});

	it("ändert eine namensbasierte Rollen-ID gültig und kollisionsfrei", () => {
		const role = new Role({ id: "r_seer", name: "Seer" });

		role.rename("Oracle", new Set(["r_oracle", "r_oracle_1"]));

		expect(role.name).toBe("Oracle");
		expect(role.id).toBe("r_oracle_2");
	});

	it("bewahrt eine manuell abweichende Rollen-ID beim Umbenennen", () => {
		const role = new Role({ id: "r_custom", name: "Seer" });

		role.rename("Oracle", new Set(["r_oracle"]));

		expect(role.name).toBe("Oracle");
		expect(role.id).toBe("r_custom");
	});
});
