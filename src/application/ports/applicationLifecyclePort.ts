export interface ApplicationLifecyclePort {
	isNativePlatform(): boolean;
	exitApplication(): void;
	addBackButtonListener(handler: () => void): Promise<() => void>;
}
