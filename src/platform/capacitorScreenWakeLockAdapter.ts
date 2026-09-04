import { Capacitor } from "@capacitor/core";
import { KeepAwake } from "@capacitor-community/keep-awake";
import type { ScreenWakeLockPort } from "../application/ports/screenWakeLockPort";

export class CapacitorScreenWakeLockAdapter implements ScreenWakeLockPort {
	async setKeepAwake(enabled: boolean): Promise<void> {
		if (!Capacitor.isNativePlatform()) return;
		const { isSupported } = await KeepAwake.isSupported();
		if (!isSupported) return;

		if (enabled) await KeepAwake.keepAwake();
		else await KeepAwake.allowSleep();
	}
}
