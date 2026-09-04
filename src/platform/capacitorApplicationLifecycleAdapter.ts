import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type { ApplicationLifecyclePort } from "../application/ports/applicationLifecyclePort";

export class CapacitorApplicationLifecycleAdapter
	implements ApplicationLifecyclePort
{
	isNativePlatform(): boolean {
		return Capacitor.isNativePlatform();
	}

	exitApplication(): void {
		if (this.isNativePlatform()) void CapacitorApp.exitApp();
	}

	async addBackButtonListener(handler: () => void): Promise<() => void> {
		if (!this.isNativePlatform()) return () => {};
		const listener = await CapacitorApp.addListener("backButton", handler);
		return () => {
			void listener.remove();
		};
	}
}
