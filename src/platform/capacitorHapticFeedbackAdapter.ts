import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import type {
	HapticFeedbackKind,
	HapticFeedbackPort,
} from "../application/ports/hapticFeedbackPort";

export class CapacitorHapticFeedbackAdapter implements HapticFeedbackPort {
	async trigger(kind: HapticFeedbackKind): Promise<void> {
		if (!Capacitor.isNativePlatform()) return;

		if (kind === "selection") {
			await Haptics.impact({ style: ImpactStyle.Light });
			return;
		}

		await Haptics.notification({
			type:
				kind === "success"
					? NotificationType.Success
					: NotificationType.Warning,
		});
	}
}
