import type { MotionPreferencePort } from "../application/ports/motionPreferencePort";
import { subscribeToMediaQueryChanges } from "./mediaQueryChangeSubscription";
import { PlatformOperationError } from "./platformOperationError";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export class BrowserMotionPreferenceAdapter implements MotionPreferencePort {
	readonly #mediaQuery: MediaQueryList;

	constructor(browserWindow: Window = window) {
		if (!browserWindow.matchMedia)
			throw new PlatformOperationError(
				"Dieser Browser unterstützt keine Abfrage reduzierter Animationen.",
			);
		this.#mediaQuery = browserWindow.matchMedia(REDUCED_MOTION_QUERY);
	}

	getSystemPrefersReducedMotion(): boolean {
		return this.#mediaQuery.matches;
	}

	subscribe(listener: (reduceMotion: boolean) => void): () => void {
		return subscribeToMediaQueryChanges(this.#mediaQuery, listener);
	}
}
