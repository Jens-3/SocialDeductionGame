import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import type { ScreenOrientationPort } from "../application/ports/screenOrientationPort";

export class CapacitorScreenOrientationAdapter
	implements ScreenOrientationPort
{
	async setAutoRotate(enabled: boolean): Promise<void> {
		if (!Capacitor.isNativePlatform()) return;

		if (enabled) {
			await ScreenOrientation.unlock();
			return;
		}

		const { type } = await ScreenOrientation.orientation();
		await ScreenOrientation.lock({
			orientation: type,
		});
	}
}
