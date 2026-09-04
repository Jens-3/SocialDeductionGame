export interface ScreenOrientationPort {
	setAutoRotate(enabled: boolean): Promise<void>;
}
