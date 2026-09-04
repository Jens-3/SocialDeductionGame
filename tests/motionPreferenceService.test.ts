import { describe, expect, it, vi } from "vitest";
import { MotionPreferenceService } from "../src/application/motionPreferenceService";
import type { MotionPreferencePort } from "../src/application/ports/motionPreferencePort";

class TestMotionPreferencePort implements MotionPreferencePort {
	reduceMotion = false;
	readonly listeners = new Set<(reduceMotion: boolean) => void>();

	getSystemPrefersReducedMotion(): boolean {
		return this.reduceMotion;
	}

	subscribe(listener: (reduceMotion: boolean) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	setReduceMotion(reduceMotion: boolean): void {
		this.reduceMotion = reduceMotion;
		for (const listener of this.listeners) listener(reduceMotion);
	}
}

describe("MotionPreferenceService", () => {
	it("reduziert Bewegungen, wenn App oder System dies verlangen", () => {
		const platform = new TestMotionPreferencePort();
		const service = new MotionPreferenceService(platform);
		const listener = vi.fn();
		const unsubscribe = service.subscribeShouldReduceMotion(listener);

		expect(service.getShouldReduceMotion()).toBe(false);
		platform.setReduceMotion(true);
		expect(service.getShouldReduceMotion()).toBe(true);
		expect(listener).toHaveBeenCalledOnce();

		service.setAppReduceMotion(true);
		platform.setReduceMotion(false);
		expect(service.getShouldReduceMotion()).toBe(true);
		expect(listener).toHaveBeenCalledOnce();

		service.setAppReduceMotion(false);
		expect(service.getShouldReduceMotion()).toBe(false);
		expect(listener).toHaveBeenCalledTimes(2);

		unsubscribe();
		expect(platform.listeners.size).toBe(0);
	});
});
