export type ResolvedTheme = "light" | "dark";

export interface SystemThemePort {
	getSystemTheme(): ResolvedTheme;
	subscribe(listener: (theme: ResolvedTheme) => void): () => void;
}
