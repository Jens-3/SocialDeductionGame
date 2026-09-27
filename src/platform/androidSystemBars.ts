import { Capacitor, registerPlugin } from "@capacitor/core";

const nativeAppearance = registerPlugin<{
	setAppearance(options: { background: string; light: boolean }): Promise<void>;
}>("AppSystemBars");

/** Paint native inset areas without changing the WebView's safe-area layout. */
export function observeAndroidSystemBars(): () => void {
	if (Capacitor.getPlatform() !== "android") return () => {};
	const root = document.documentElement;
	const update = () => {
		const background = getComputedStyle(root)
			.getPropertyValue("--system-bars-background")
			.trim();
		if (!background) return;
		void nativeAppearance
			.setAppearance({ background, light: root.dataset.theme === "light" })
			.catch((error: unknown) =>
				console.error("Android system bar appearance failed", error),
			);
	};
	const observer = new MutationObserver(update);
	observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
	update();
	return () => observer.disconnect();
}
