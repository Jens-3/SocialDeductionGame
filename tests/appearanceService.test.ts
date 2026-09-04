import { describe, expect, it, vi } from "vitest";
import { AppearanceService } from "../src/application/appearanceService";
import type {
	ResolvedTheme,
	SystemThemePort,
} from "../src/application/ports/systemThemePort";

class TestSystemThemePort implements SystemThemePort {
	theme: ResolvedTheme = "dark";
	readonly listeners = new Set<(theme: ResolvedTheme) => void>();

	getSystemTheme(): ResolvedTheme {
		return this.theme;
	}

	subscribe(listener: (theme: ResolvedTheme) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	setTheme(theme: ResolvedTheme): void {
		this.theme = theme;
		for (const listener of this.listeners) listener(theme);
	}
}

describe("AppearanceService", () => {
	it("verwaltet die Präferenz und löst nur system über den Plattform-Port auf", () => {
		const platform = new TestSystemThemePort();
		const service = new AppearanceService(platform);

		expect(service.getResolvedTheme()).toBe("dark");
		service.setThemePreference("light");
		expect(service.getResolvedTheme()).toBe("light");
		service.setThemePreference("dark");
		expect(service.getResolvedTheme()).toBe("dark");
		platform.setTheme("light");
		service.setThemePreference("system");
		expect(service.getResolvedTheme()).toBe("light");
	});

	it("meldet Plattformänderungen ausschließlich im Systemmodus weiter", () => {
		const platform = new TestSystemThemePort();
		const service = new AppearanceService(platform);
		const listener = vi.fn();

		const unsubscribe = service.subscribeResolvedTheme(listener);
		platform.setTheme("light");

		expect(listener).toHaveBeenCalledOnce();
		service.setThemePreference("dark");
		listener.mockClear();
		platform.setTheme("dark");
		expect(listener).not.toHaveBeenCalled();
		unsubscribe();
		expect(platform.listeners.size).toBe(0);
	});
});
