import { describe, expect, it } from "vitest";

import { SystemIdGenerator } from "../src/platform/systemIdGenerator";

describe("SystemIdGenerator", () => {
	it("erzeugt neue IDs mit dem angeforderten Präfix", () => {
		const generator = new SystemIdGenerator();
		const first = generator.createId("log");
		const second = generator.createId("log");

		expect(first).toMatch(/^log_[a-zA-Z0-9_]+$/u);
		expect(second).toMatch(/^log_[a-zA-Z0-9_]+$/u);
		expect(second).not.toBe(first);
	});

	it("lehnt einen leeren Präfix ab", () => {
		expect(() => new SystemIdGenerator().createId("  ")).toThrow("ID-Präfix");
	});
});
