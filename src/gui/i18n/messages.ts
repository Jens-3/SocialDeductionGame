export type GuiPluralCategory = Intl.LDMLPluralRule;

export type GuiPluralMessage = Readonly<{
	plural: Readonly<
		Partial<Record<GuiPluralCategory, string>> & { other: string }
	>;
}>;

export type GuiTranslationMessage = string | GuiPluralMessage;
