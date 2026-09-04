import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const appCss = readFileSync(
	join(process.cwd(), "src", "gui", "app.css"),
	"utf8",
);

function getThemeBlock(theme: "dark" | "light"): string {
	const selector = `[data-theme="${theme}"]`;
	const selectorStart = appCss.indexOf(selector);
	const blockStart = appCss.indexOf("{", selectorStart);
	const blockEnd = appCss.indexOf("\n}", blockStart);

	expect(selectorStart).toBeGreaterThanOrEqual(0);
	expect(blockStart).toBeGreaterThan(selectorStart);
	expect(blockEnd).toBeGreaterThan(blockStart);

	return appCss.slice(blockStart + 1, blockEnd);
}

function getVariableNames(block: string): string[] {
	return [...block.matchAll(/(--[a-z0-9-]+)\s*:/gu)]
		.map((match) => match[1])
		.sort();
}

describe("Theme-CSS-Vertrag", () => {
	it("definiert die bestehenden dunklen und hellen Schriftfarben für kontrastreiche Sitze", () => {
		expect(appCss).toContain("--seat-text-dark: #25221e;");
		expect(appCss).toContain("--seat-text-light: #f6f1e7;");
	});

	it("definiert in Dark und Light dieselben semantischen Variablen", () => {
		expect(getVariableNames(getThemeBlock("light"))).toEqual(
			getVariableNames(getThemeBlock("dark")),
		);
	});

	it("verwendet Theme-Selektoren nur für die beiden zentralen Variablenblöcke", () => {
		const explicitThemeSelectors = appCss.match(
			/\[data-theme="(?:dark|light)"\]/gu,
		);

		expect(explicitThemeSelectors).toEqual([
			'[data-theme="dark"]',
			'[data-theme="light"]',
		]);
	});

	it("zentriert Zeichen in runden Icon-Schaltflächen auf beiden Achsen", () => {
		expect(appCss).toMatch(
			/\.sheet-close-button\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;/su,
		);
		expect(appCss).toMatch(
			/\.setup-seat-action\s*>\s*span\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;/su,
		);
	});

	it("reserviert Touchgesten auf verschiebbaren Sitzen für die Sitzplatzverschiebung", () => {
		expect(appCss).toMatch(
			/\.seat-button--draggable\s*\{[^}]*touch-action:\s*none;/su,
		);
	});

	it("bezieht sichtbare Nachtmarkierungen aus dem lokalisierten Datenattribut", () => {
		expect(appCss).toContain("content: attr(data-night-marker);");
		expect(appCss).not.toContain('content: "✦ Quelle";');
		expect(appCss).not.toContain('content: "◎ Ziel";');
	});

	it("ordnet das Spiel auf Smartphones im Querformat zweispaltig an", () => {
		expect(appCss).toContain(
			"@media (orientation: landscape) and (max-height: 50rem)",
		);
		expect(appCss).toContain('"board controls"');
		expect(appCss).toContain('"board details"');
		expect(appCss).toContain("70vw");
		expect(appCss).toContain("grid-template-columns: auto minmax(15rem, 1fr)");
		expect(appCss).toContain("grid-area: board;");
		expect(appCss).toContain("grid-area: details;");
	});
});
