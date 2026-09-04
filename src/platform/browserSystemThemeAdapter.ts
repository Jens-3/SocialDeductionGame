import type {
	ResolvedTheme,
	SystemThemePort,
} from "../application/ports/systemThemePort";
import { subscribeToMediaQueryChanges } from "./mediaQueryChangeSubscription";
import { PlatformOperationError } from "./platformOperationError";

const LIGHT_THEME_QUERY = "(prefers-color-scheme: light)";
const NATIVE_SYSTEM_THEME_CHANGE_EVENT = "socialDeductionGameSystemThemeChange";

export class BrowserSystemThemeAdapter implements SystemThemePort {
	readonly #browserWindow: Window;
	readonly #mediaQuery: MediaQueryList;
	#nativeSystemTheme?: ResolvedTheme;

	constructor(browserWindow: Window = window) {
		if (!browserWindow.matchMedia)
			throw new PlatformOperationError(
				"Dieser Browser unterstützt keine System-Theme-Abfrage.",
			);
		this.#browserWindow = browserWindow;
		this.#mediaQuery = browserWindow.matchMedia(LIGHT_THEME_QUERY);
	}

	getSystemTheme(): ResolvedTheme {
		return (
			this.#nativeSystemTheme ?? (this.#mediaQuery.matches ? "light" : "dark")
		);
	}

	subscribe(listener: (theme: ResolvedTheme) => void): () => void {
		const unsubscribeMediaQuery = subscribeToMediaQueryChanges(
			this.#mediaQuery,
			(matches) => {
				this.#nativeSystemTheme = undefined;
				listener(matches ? "light" : "dark");
			},
		);
		const handleNativeSystemThemeChange = (event: Event) => {
			const theme = (event as CustomEvent<unknown>).detail;
			if (theme !== "light" && theme !== "dark") return;
			this.#nativeSystemTheme = theme;
			listener(theme);
		};
		const supportsWindowEvents =
			typeof this.#browserWindow.addEventListener === "function" &&
			typeof this.#browserWindow.removeEventListener === "function";
		if (supportsWindowEvents)
			this.#browserWindow.addEventListener(
				NATIVE_SYSTEM_THEME_CHANGE_EVENT,
				handleNativeSystemThemeChange,
			);

		return () => {
			unsubscribeMediaQuery();
			if (supportsWindowEvents)
				this.#browserWindow.removeEventListener(
					NATIVE_SYSTEM_THEME_CHANGE_EVENT,
					handleNativeSystemThemeChange,
				);
		};
	}
}
