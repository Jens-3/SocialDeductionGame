import { beforeEach, describe, expect, it, vi } from "vitest";

const nativePlatform = vi.hoisted(() => vi.fn(() => false));
const capacitorApp = vi.hoisted(() => ({
	exitApp: vi.fn(() => Promise.resolve()),
	addListener: vi.fn(),
}));
const haptics = vi.hoisted(() => ({
	impact: vi.fn(() => Promise.resolve()),
	notification: vi.fn(() => Promise.resolve()),
}));
const screenOrientation = vi.hoisted(() => ({
	unlock: vi.fn(() => Promise.resolve()),
	orientation: vi.fn(() => Promise.resolve({ type: "portrait-primary" })),
	lock: vi.fn(() => Promise.resolve()),
}));
const keepAwake = vi.hoisted(() => ({
	isSupported: vi.fn(() => Promise.resolve({ isSupported: true })),
	keepAwake: vi.fn(() => Promise.resolve()),
	allowSleep: vi.fn(() => Promise.resolve()),
}));

vi.mock("@capacitor/core", () => ({
	Capacitor: { isNativePlatform: nativePlatform },
}));
vi.mock("@capacitor/app", () => ({ App: capacitorApp }));
vi.mock("@capacitor/haptics", () => ({
	Haptics: haptics,
	ImpactStyle: { Light: "LIGHT" },
	NotificationType: { Success: "SUCCESS", Warning: "WARNING" },
}));
vi.mock("@capacitor/screen-orientation", () => ({
	ScreenOrientation: screenOrientation,
}));
vi.mock("@capacitor-community/keep-awake", () => ({ KeepAwake: keepAwake }));

import { CapacitorApplicationLifecycleAdapter } from "../src/platform/capacitorApplicationLifecycleAdapter";
import { CapacitorHapticFeedbackAdapter } from "../src/platform/capacitorHapticFeedbackAdapter";
import { CapacitorScreenOrientationAdapter } from "../src/platform/capacitorScreenOrientationAdapter";
import { CapacitorScreenWakeLockAdapter } from "../src/platform/capacitorScreenWakeLockAdapter";

beforeEach(() => {
	vi.clearAllMocks();
	nativePlatform.mockReturnValue(false);
	keepAwake.isSupported.mockResolvedValue({ isSupported: true });
	screenOrientation.orientation.mockResolvedValue({
		type: "portrait-primary",
	});
});

describe("CapacitorApplicationLifecycleAdapter", () => {
	it("führt Browser-Lifecycle-Aktionen als No-op aus", async () => {
		const adapter = new CapacitorApplicationLifecycleAdapter();

		expect(adapter.isNativePlatform()).toBe(false);
		adapter.exitApplication();
		const remove = await adapter.addBackButtonListener(vi.fn());
		remove();

		expect(capacitorApp.exitApp).not.toHaveBeenCalled();
		expect(capacitorApp.addListener).not.toHaveBeenCalled();
	});

	it("beendet die native App und entfernt den Back-Button-Listener wieder", async () => {
		nativePlatform.mockReturnValue(true);
		const removeListener = vi.fn(() => Promise.resolve());
		capacitorApp.addListener.mockResolvedValue({ remove: removeListener });
		const handler = vi.fn();
		const adapter = new CapacitorApplicationLifecycleAdapter();

		adapter.exitApplication();
		const remove = await adapter.addBackButtonListener(handler);
		remove();

		expect(capacitorApp.exitApp).toHaveBeenCalledOnce();
		expect(capacitorApp.addListener).toHaveBeenCalledWith(
			"backButton",
			handler,
		);
		expect(removeListener).toHaveBeenCalledOnce();
	});
});

describe("CapacitorHapticFeedbackAdapter", () => {
	it("überspringt haptisches Feedback im Browser", async () => {
		await new CapacitorHapticFeedbackAdapter().trigger("selection");

		expect(haptics.impact).not.toHaveBeenCalled();
		expect(haptics.notification).not.toHaveBeenCalled();
	});

	it.each([
		["success" as const, "SUCCESS"],
		["warning" as const, "WARNING"],
	])("übersetzt natives %s-Feedback", async (kind, type) => {
		nativePlatform.mockReturnValue(true);

		await new CapacitorHapticFeedbackAdapter().trigger(kind);

		expect(haptics.notification).toHaveBeenCalledWith({ type });
		expect(haptics.impact).not.toHaveBeenCalled();
	});

	it("übersetzt natives Auswahlfeedback in einen leichten Impuls", async () => {
		nativePlatform.mockReturnValue(true);

		await new CapacitorHapticFeedbackAdapter().trigger("selection");

		expect(haptics.impact).toHaveBeenCalledWith({ style: "LIGHT" });
		expect(haptics.notification).not.toHaveBeenCalled();
	});
});

describe("CapacitorScreenOrientationAdapter", () => {
	it("greift im Browser nicht auf die Orientierung zu", async () => {
		await new CapacitorScreenOrientationAdapter().setAutoRotate(false);

		expect(screenOrientation.orientation).not.toHaveBeenCalled();
		expect(screenOrientation.lock).not.toHaveBeenCalled();
	});

	it("entsperrt die native Orientierung bei aktiviertem Auto-Rotate", async () => {
		nativePlatform.mockReturnValue(true);

		await new CapacitorScreenOrientationAdapter().setAutoRotate(true);

		expect(screenOrientation.unlock).toHaveBeenCalledOnce();
		expect(screenOrientation.orientation).not.toHaveBeenCalled();
	});

	it("sperrt die native Orientierung in der aktuellen Ausrichtung", async () => {
		nativePlatform.mockReturnValue(true);
		screenOrientation.orientation.mockResolvedValue({
			type: "landscape-secondary",
		});

		await new CapacitorScreenOrientationAdapter().setAutoRotate(false);

		expect(screenOrientation.lock).toHaveBeenCalledWith({
			orientation: "landscape-secondary",
		});
		expect(screenOrientation.unlock).not.toHaveBeenCalled();
	});
});

describe("CapacitorScreenWakeLockAdapter", () => {
	it("prüft Wake-Lock-Unterstützung nur auf nativen Plattformen", async () => {
		await new CapacitorScreenWakeLockAdapter().setKeepAwake(true);

		expect(keepAwake.isSupported).not.toHaveBeenCalled();
	});

	it("führt auf nicht unterstützten Geräten keine Wake-Lock-Aktion aus", async () => {
		nativePlatform.mockReturnValue(true);
		keepAwake.isSupported.mockResolvedValue({ isSupported: false });

		await new CapacitorScreenWakeLockAdapter().setKeepAwake(true);

		expect(keepAwake.keepAwake).not.toHaveBeenCalled();
		expect(keepAwake.allowSleep).not.toHaveBeenCalled();
	});

	it.each([
		[true, "keepAwake" as const],
		[false, "allowSleep" as const],
	])("setzt den nativen Wake-Lock-Zustand %s", async (enabled, method) => {
		nativePlatform.mockReturnValue(true);

		await new CapacitorScreenWakeLockAdapter().setKeepAwake(enabled);

		expect(keepAwake[method]).toHaveBeenCalledOnce();
	});
});
