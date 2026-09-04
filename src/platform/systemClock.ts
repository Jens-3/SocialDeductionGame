import type { Clock } from "../domain/clock";
import { createInstant, type Instant } from "../domain/instant";

/** Plattformadapter für die Systemzeit der aktuellen Laufzeitumgebung. */
export class SystemClock implements Clock {
	now(): Instant {
		return createInstant(new Date().toISOString());
	}
}
