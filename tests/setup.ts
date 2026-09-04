import { beforeAll } from "vitest";
import { englishGuiMessages } from "../src/gui/i18n/en";
import {
	guiMessagesByLanguageTag,
	loadAllGuiLanguages,
} from "../src/gui/i18n/registry";

guiMessagesByLanguageTag.en = englishGuiMessages;
beforeAll(async () => loadAllGuiLanguages());

if (!globalThis.CSS) {
	Object.defineProperty(globalThis, "CSS", { value: {} });
}

if (!globalThis.CSS.escape) {
	Object.defineProperty(globalThis.CSS, "escape", {
		value: (value: string) => value.replaceAll(/[^a-zA-Z0-9_-]/g, "\\$&"),
	});
}
