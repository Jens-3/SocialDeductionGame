export interface MotionPreferencePort {
	getSystemPrefersReducedMotion(): boolean;
	subscribe(listener: (reduceMotion: boolean) => void): () => void;
}
