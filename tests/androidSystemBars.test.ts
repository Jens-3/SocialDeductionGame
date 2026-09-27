// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { observeAndroidSystemBars } from "../src/platform/androidSystemBars";

const native = vi.hoisted(() => ({
	platform: "android",
	setAppearance: vi.fn(async () => {}),
}));
vi.mock("@capacitor/core", () => ({
	Capacitor: { getPlatform: () => native.platform },
	registerPlugin: () => ({ setAppearance: native.setAppearance }),
}));

let stop = () => {};
afterEach(() => {
	stop();
	delete document.documentElement.dataset.theme;
	document.documentElement.style.removeProperty("--system-bars-background");
	vi.clearAllMocks();
	native.platform = "android";
});

it("übernimmt Theme-Farbe und Symbolkontrast und reagiert auf App-Theme-Wechsel", async () => {
	const root = document.documentElement;
	root.dataset.theme = "dark";
	root.style.setProperty("--system-bars-background", "#15171c");
	stop = observeAndroidSystemBars();
	expect(native.setAppearance).toHaveBeenLastCalledWith({
		background: "#15171c",
		light: false,
	});
	root.style.setProperty("--system-bars-background", "#f3efe8");
	root.dataset.theme = "light";
	await vi.waitFor(() =>
		expect(native.setAppearance).toHaveBeenLastCalledWith({
			background: "#f3efe8",
			light: true,
		}),
	);
	stop();
	native.setAppearance.mockClear();
	root.dataset.theme = "dark";
	await Promise.resolve();
	expect(native.setAppearance).not.toHaveBeenCalled();
});

it("greift im Browser nicht auf das native Plugin zu", () => {
	native.platform = "web";
	stop = observeAndroidSystemBars();
	expect(native.setAppearance).not.toHaveBeenCalled();
});
