export interface SystemLanguagePort {
	getSystemLanguage(): Promise<string | null>;
}
