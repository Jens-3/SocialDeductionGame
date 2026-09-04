export type HapticFeedbackKind = "selection" | "success" | "warning";

export interface HapticFeedbackPort {
	trigger(kind: HapticFeedbackKind): Promise<void>;
}
