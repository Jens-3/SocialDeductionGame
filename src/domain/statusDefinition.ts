export type StatusDefinition = {
	id: string;
	name: string;
	names?: Record<string, string>;
	unicodeEscaped?: string;
	unicodeSymbol?: string;
	defaultDuration?: number;
};
