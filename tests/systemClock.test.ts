import { afterEach, expect, it, vi } from "vitest";

import { SystemClock } from "../src/platform/systemClock";

afterEach(() => vi.useRealTimers());

it("liefert die Systemzeit über den Clock-Port", () => {
	const instant = new Date("2026-07-22T10:15:30.000Z");
	vi.useFakeTimers();
	vi.setSystemTime(instant);

	expect(new SystemClock().now()).toBe(instant.toISOString());
});
