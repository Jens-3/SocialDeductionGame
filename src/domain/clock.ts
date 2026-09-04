import type { Instant } from "./instant";

/** Von der Domain benötigte, injizierbare Quelle für die aktuelle Zeit. */
export interface Clock {
	now(): Instant;
}
