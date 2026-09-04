import type { MotionPreferencePort } from "./ports/motionPreferencePort";

const FALLBACK_MOTION_PREFERENCE: MotionPreferencePort = {
	getSystemPrefersReducedMotion: () => false,
	subscribe: () => () => undefined,
};

/** Plattformunabhängige Fassade für reduzierte Animationen. */
export class MotionPreferenceService {
	readonly #platform: MotionPreferencePort;
	readonly #listeners = new Set<() => void>();
	#appReduceMotion: boolean;
	#systemReduceMotion: boolean;
	#unsubscribePlatform?: () => void;

	constructor(
		platform: MotionPreferencePort = FALLBACK_MOTION_PREFERENCE,
		initialAppReduceMotion = false,
	) {
		this.#platform = platform;
		this.#appReduceMotion = initialAppReduceMotion;
		this.#systemReduceMotion = platform.getSystemPrefersReducedMotion();
	}

	getShouldReduceMotion(): boolean {
		return this.#appReduceMotion || this.#systemReduceMotion;
	}

	setAppReduceMotion(reduceMotion: boolean): void {
		const previous = this.getShouldReduceMotion();
		this.#appReduceMotion = reduceMotion;
		if (previous !== this.getShouldReduceMotion()) this.#notifyListeners();
	}

	subscribeShouldReduceMotion(listener: () => void): () => void {
		this.#listeners.add(listener);
		if (this.#listeners.size === 1) this.#startPlatformSubscription();
		return () => {
			this.#listeners.delete(listener);
			if (this.#listeners.size === 0) {
				this.#unsubscribePlatform?.();
				this.#unsubscribePlatform = undefined;
			}
		};
	}

	#startPlatformSubscription(): void {
		const current = this.#platform.getSystemPrefersReducedMotion();
		if (current !== this.#systemReduceMotion) {
			const previous = this.getShouldReduceMotion();
			this.#systemReduceMotion = current;
			if (previous !== this.getShouldReduceMotion()) this.#notifyListeners();
		}
		this.#unsubscribePlatform = this.#platform.subscribe((reduceMotion) => {
			if (reduceMotion === this.#systemReduceMotion) return;
			const previous = this.getShouldReduceMotion();
			this.#systemReduceMotion = reduceMotion;
			if (previous !== this.getShouldReduceMotion()) this.#notifyListeners();
		});
	}

	#notifyListeners(): void {
		for (const listener of this.#listeners) listener();
	}
}
