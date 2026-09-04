import { describe, expect, it } from "vitest";

import type { PlayerStatus } from "../src/domain/models";
import { isPlayerStatusActiveAtNight } from "../src/domain/playerStatus";

const status: PlayerStatus = {
	id: "ps_poisoned",
	statusId: "s_poisoned",
	fromNight: 2,
	untilNight: 4,
};

describe("isPlayerStatusActiveAtNight", () => {
	it("ist vor der Startnacht inaktiv", () => {
		expect(isPlayerStatusActiveAtNight(status, 1)).toBe(false);
	});

	it("bezieht Start- und Endnacht ein", () => {
		expect(isPlayerStatusActiveAtNight(status, 2)).toBe(true);
		expect(isPlayerStatusActiveAtNight(status, 4)).toBe(true);
	});

	it("ist nach der Endnacht inaktiv", () => {
		expect(isPlayerStatusActiveAtNight(status, 5)).toBe(false);
	});

	it("bleibt ohne Endnacht aktiv", () => {
		expect(
			isPlayerStatusActiveAtNight({ ...status, untilNight: null }, 100),
		).toBe(true);
	});
});
