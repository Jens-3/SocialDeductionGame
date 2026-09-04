import type { ThemePreference } from "./appSettings";
import type { ResolvedTheme, SystemThemePort } from "./ports/systemThemePort";

const FALLBACK_SYSTEM_THEME: SystemThemePort = {
	getSystemTheme: () => "dark",
	subscribe: () => () => undefined,
};

/** Plattformunabhängige Fassade für die Auflösung der Theme-Präferenz "system". */
export class AppearanceService {
	readonly #systemTheme: SystemThemePort;
	readonly #listeners = new Set<() => void>();
	#preference: ThemePreference;
	#resolvedSystemTheme: ResolvedTheme;
	#unsubscribeSystemTheme?: () => void;

	constructor(
		systemTheme: SystemThemePort = FALLBACK_SYSTEM_THEME,
		initialPreference: ThemePreference = "system",
	) {
		this.#systemTheme = systemTheme;
		this.#preference = initialPreference;
		this.#resolvedSystemTheme = systemTheme.getSystemTheme();
	}

	getResolvedTheme(): ResolvedTheme {
		return this.#preference === "system"
			? this.#resolvedSystemTheme
			: this.#preference;
	}

	setThemePreference(preference: ThemePreference): void {
		const previousTheme = this.getResolvedTheme();
		if (preference === "system" && this.#preference !== "system") {
			this.#resolvedSystemTheme = this.#systemTheme.getSystemTheme();
		}
		this.#preference = preference;
		if (previousTheme !== this.getResolvedTheme()) this.#notifyListeners();
	}

	subscribeResolvedTheme(listener: () => void): () => void {
		this.#listeners.add(listener);
		if (this.#listeners.size === 1) this.#startSystemThemeSubscription();

		return () => {
			this.#listeners.delete(listener);
			if (this.#listeners.size === 0) {
				this.#unsubscribeSystemTheme?.();
				this.#unsubscribeSystemTheme = undefined;
			}
		};
	}

	#startSystemThemeSubscription(): void {
		const currentTheme = this.#systemTheme.getSystemTheme();
		if (currentTheme !== this.#resolvedSystemTheme) {
			this.#resolvedSystemTheme = currentTheme;
			if (this.#preference === "system") this.#notifyListeners();
		}
		this.#unsubscribeSystemTheme = this.#systemTheme.subscribe((theme) => {
			if (theme === this.#resolvedSystemTheme) return;
			this.#resolvedSystemTheme = theme;
			if (this.#preference === "system") this.#notifyListeners();
		});
	}

	#notifyListeners(): void {
		for (const listener of this.#listeners) listener();
	}
}
