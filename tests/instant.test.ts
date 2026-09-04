import { describe, expect, it } from "vitest";

import { createInstant } from "../src/domain/instant";

describe("Instant", () => {
	it("akzeptiert ausschließlich den kanonischen UTC-Zeitpunkt", () => {
		expect(createInstant("2026-07-22T10:15:30.000Z")).toBe(
			"2026-07-22T10:15:30.000Z",
		);
		for (const value of [
			"2026-07-22T12:15:30.000+02:00",
			"2026-07-22T10:15:30Z",
			"2026-02-31T10:15:30.000Z",
			"kein Zeitpunkt",
		]) {
			expect(() => createInstant(value)).toThrow("Instant muss das UTC-Format");
		}
	});
});
