import type { Clock } from "../src/domain/clock";
import type { DomainServices } from "../src/domain/domainServices";
import { createInstant } from "../src/domain/instant";

const fixedInstant = "2026-07-14T12:00:00.000Z";

let fixedClockId = 1;

export const fixedClock: Clock & DomainServices = {
	now: () => createInstant(fixedInstant),
	get clock() {
		return fixedClock;
	},
	idGenerator: {
		createId: (prefix) => `${prefix}_clock_${fixedClockId++}`,
	},
};

export function createFixedDomainServices(
	instant = fixedInstant,
): DomainServices {
	let nextId = 1;
	return {
		clock: { now: () => createInstant(instant) },
		idGenerator: {
			createId: (prefix) => `${prefix}_test_${nextId++}`,
		},
	};
}

export const fixedDomainServices = createFixedDomainServices();
