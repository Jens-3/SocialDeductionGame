import { describe, expect, it, vi } from "vitest";
import { AppearanceService } from "../src/application/appearanceService";
import { MotionPreferenceService } from "../src/application/motionPreferenceService";
import { BrowserMotionPreferenceAdapter } from "../src/platform/browserMotionPreferenceAdapter";
import { createBrowserPreferenceAdapters } from "../src/platform/browserPreferenceAdapters";
import { BrowserSystemThemeAdapter } from "../src/platform/browserSystemThemeAdapter";

function createMediaQuery(matches: boolean) {
	const listeners = new Set<(event: MediaQueryListEvent) => void>();
	const addEventListener = vi.fn(
		(_type: string, listener: (event: MediaQueryListEvent) => void) => {
			listeners.add(listener);
		},
	);
	const removeEventListener = vi.fn(
		(_type: string, listener: (event: MediaQueryListEvent) => void) => {
			listeners.delete(listener);
		},
	);
	const mediaQuery = {
		matches,
		addEventListener,
		removeEventListener,
	} as unknown as MediaQueryList;
	return {
		mediaQuery,
		addEventListener,
		removeEventListener,
		emit(nextMatches: boolean) {
			for (const listener of listeners)
				listener({ matches: nextMatches } as MediaQueryListEvent);
		},
	};
}

function createCompatibleMediaQuery(matches: boolean) {
	const listeners = new Set<(event: MediaQueryListEvent) => void>();
	const addListener = vi.fn(
		(listener: (event: MediaQueryListEvent) => void) => {
			listeners.add(listener);
		},
	);
	const removeListener = vi.fn(
		(listener: (event: MediaQueryListEvent) => void) => {
			listeners.delete(listener);
		},
	);
	const mediaQuery = {
		matches,
		addListener,
		removeListener,
	} as unknown as MediaQueryList;
	return {
		mediaQuery,
		addListener,
		removeListener,
		emit(nextMatches: boolean) {
			for (const listener of listeners)
				listener({ matches: nextMatches } as MediaQueryListEvent);
		},
	};
}

describe("Browser-Präferenzadapter", () => {
	it("ordnet matches=true light und matches=false dark zu", () => {
		const lightQuery = createMediaQuery(true);
		const darkQuery = createMediaQuery(false);
		const lightWindow = {
			matchMedia: () => lightQuery.mediaQuery,
		} as unknown as Window;
		const darkWindow = {
			matchMedia: () => darkQuery.mediaQuery,
		} as unknown as Window;

		expect(new BrowserSystemThemeAdapter(lightWindow).getSystemTheme()).toBe(
			"light",
		);
		expect(new BrowserSystemThemeAdapter(darkWindow).getSystemTheme()).toBe(
			"dark",
		);
	});

	it("reichen Theme- und Bewegungsänderungen über ihre Plattform-Ports weiter", () => {
		const themeQuery = createMediaQuery(true);
		const motionQuery = createMediaQuery(false);
		const matchMedia = vi.fn((query: string) =>
			query.includes("color-scheme")
				? themeQuery.mediaQuery
				: motionQuery.mediaQuery,
		);
		const browserWindow = {
			matchMedia,
		} as unknown as Window;
		const themeAdapter = new BrowserSystemThemeAdapter(browserWindow);
		const motionAdapter = new BrowserMotionPreferenceAdapter(browserWindow);
		const themeListener = vi.fn();
		const motionListener = vi.fn();

		expect(themeAdapter.getSystemTheme()).toBe("light");
		expect(motionAdapter.getSystemPrefersReducedMotion()).toBe(false);
		expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: light)");
		expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
		const unsubscribeTheme = themeAdapter.subscribe(themeListener);
		const unsubscribeMotion = motionAdapter.subscribe(motionListener);
		themeQuery.emit(false);
		themeQuery.emit(true);
		motionQuery.emit(true);

		expect(themeListener).toHaveBeenNthCalledWith(1, "dark");
		expect(themeListener).toHaveBeenNthCalledWith(2, "light");
		expect(motionListener).toHaveBeenCalledWith(true);
		expect(themeQuery.addEventListener).toHaveBeenCalledWith(
			"change",
			expect.any(Function),
		);
		const registeredThemeListener =
			themeQuery.addEventListener.mock.calls[0]?.[1];
		unsubscribeTheme();
		unsubscribeMotion();
		expect(themeQuery.removeEventListener).toHaveBeenCalledWith(
			"change",
			registeredThemeListener,
		);
		expect(motionQuery.removeEventListener).toHaveBeenCalledOnce();
	});

	it("Ã¼bernimmt native Android-Themewechsel auch bei veralteter Media Query", () => {
		const themeQuery = createMediaQuery(true);
		const browserWindow = new EventTarget() as Window & EventTarget;
		browserWindow.matchMedia = vi.fn(() => themeQuery.mediaQuery);
		const themeAdapter = new BrowserSystemThemeAdapter(browserWindow);
		const listener = vi.fn();

		const unsubscribe = themeAdapter.subscribe(listener);
		browserWindow.dispatchEvent(
			new CustomEvent("socialDeductionGameSystemThemeChange", {
				detail: "dark",
			}),
		);

		expect(themeAdapter.getSystemTheme()).toBe("dark");
		expect(listener).toHaveBeenCalledWith("dark");

		unsubscribe();
		browserWindow.dispatchEvent(
			new CustomEvent("socialDeductionGameSystemThemeChange", {
				detail: "light",
			}),
		);
		expect(listener).toHaveBeenCalledOnce();
	});

	it("meldet eine fehlende Browser-API an der Adaptergrenze eindeutig", () => {
		const browserWindow = {} as Window;

		expect(() => new BrowserSystemThemeAdapter(browserWindow)).toThrowError(
			"Dieser Browser unterstützt keine System-Theme-Abfrage.",
		);
		expect(
			() => new BrowserMotionPreferenceAdapter(browserWindow),
		).toThrowError(
			"Dieser Browser unterstützt keine Abfrage reduzierter Animationen.",
		);
	});

	it("verwendet in älteren WebViews addListener und removeListener", () => {
		const themeQuery = createCompatibleMediaQuery(false);
		const motionQuery = createCompatibleMediaQuery(false);
		const browserWindow = {
			matchMedia: (query: string) =>
				query.includes("color-scheme")
					? themeQuery.mediaQuery
					: motionQuery.mediaQuery,
		} as unknown as Window;
		const themeAdapter = new BrowserSystemThemeAdapter(browserWindow);
		const motionAdapter = new BrowserMotionPreferenceAdapter(browserWindow);
		const themeListener = vi.fn();
		const motionListener = vi.fn();

		const unsubscribeTheme = themeAdapter.subscribe(themeListener);
		const unsubscribeMotion = motionAdapter.subscribe(motionListener);
		themeQuery.emit(true);
		motionQuery.emit(true);

		expect(themeListener).toHaveBeenCalledWith("light");
		expect(motionListener).toHaveBeenCalledWith(true);
		expect(themeQuery.addListener).toHaveBeenCalledOnce();
		expect(motionQuery.addListener).toHaveBeenCalledOnce();
		const registeredThemeListener = themeQuery.addListener.mock.calls[0]?.[0];
		const registeredMotionListener = motionQuery.addListener.mock.calls[0]?.[0];
		unsubscribeTheme();
		unsubscribeMotion();
		expect(themeQuery.removeListener).toHaveBeenCalledWith(
			registeredThemeListener,
		);
		expect(motionQuery.removeListener).toHaveBeenCalledWith(
			registeredMotionListener,
		);
	});

	it("behält den Startwert bei, wenn keine Listener-API vorhanden ist", () => {
		const browserWindow = {
			matchMedia: () => ({ matches: true }) as MediaQueryList,
		} as unknown as Window;
		const themeAdapter = new BrowserSystemThemeAdapter(browserWindow);
		const motionAdapter = new BrowserMotionPreferenceAdapter(browserWindow);

		const result = createBrowserPreferenceAdapters(browserWindow);
		const appearanceService = new AppearanceService(result.systemThemeAdapter);
		const motionPreferenceService = new MotionPreferenceService(
			result.motionPreferenceAdapter,
		);

		expect(themeAdapter.getSystemTheme()).toBe("light");
		expect(motionAdapter.getSystemPrefersReducedMotion()).toBe(true);
		expect(() => themeAdapter.subscribe(vi.fn())()).not.toThrow();
		expect(() => motionAdapter.subscribe(vi.fn())()).not.toThrow();
		expect(appearanceService.getResolvedTheme()).toBe("light");
		expect(motionPreferenceService.getShouldReduceMotion()).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("liefert sichere Domain-Fallbacks, wenn matchMedia fehlt", () => {
		const browserWindow = {} as Window;

		const result = createBrowserPreferenceAdapters(browserWindow);
		const appearanceService = new AppearanceService(result.systemThemeAdapter);
		const motionPreferenceService = new MotionPreferenceService(
			result.motionPreferenceAdapter,
		);

		expect(appearanceService.getResolvedTheme()).toBe("dark");
		expect(motionPreferenceService.getShouldReduceMotion()).toBe(false);
		expect(result.errors).toHaveLength(2);
	});
});
