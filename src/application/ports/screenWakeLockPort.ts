export interface ScreenWakeLockPort {
	setKeepAwake(enabled: boolean): Promise<void>;
}
