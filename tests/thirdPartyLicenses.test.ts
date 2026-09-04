import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const notices = readFileSync(
	path.join(projectRoot, "THIRD_PARTY_LICENSES.txt"),
	"utf8",
);
const packageMetadata = JSON.parse(
	readFileSync(path.join(projectRoot, "package.json"), "utf8"),
) as { dependencies?: Record<string, string> };

describe("Drittanbieter-Lizenzverzeichnis", () => {
	it("verifiziert den lokal versionierten offiziellen Apache-2.0-Text", () => {
		const sources = JSON.parse(
			readFileSync(
				path.join(projectRoot, "scripts", "license-texts", "sources.json"),
				"utf8",
			),
		) as Record<string, { file: string; source: string; sha256: string }>;
		const apacheSource = sources["Apache-2.0"];
		const apacheText = readFileSync(
			path.join(projectRoot, "scripts", "license-texts", apacheSource.file),
			"utf8",
		);

		expect(apacheSource.source).toBe(
			"https://www.apache.org/licenses/LICENSE-2.0.txt",
		);
		expect(createHash("sha256").update(apacheText).digest("hex")).toBe(
			apacheSource.sha256,
		);
		expect(apacheText).toContain(
			"APPENDIX: How to apply the Apache License to your work.",
		);
	});

	it("enthält jede direkt verwendete npm-Produktionsabhängigkeit in installierter Version", () => {
		for (const dependency of Object.keys(packageMetadata.dependencies ?? {})) {
			const dependencyMetadata = JSON.parse(
				readFileSync(
					path.join(
						projectRoot,
						"node_modules",
						...dependency.split("/"),
						"package.json",
					),
					"utf8",
				),
			) as { name: string; version: string; license: string };

			expect(notices).toContain(
				`${dependencyMetadata.name}@${dependencyMetadata.version} — ${dependencyMetadata.license}`,
			);
		}
	});

	it("enthält die zentral versionierten Android-Produktionsabhängigkeiten", () => {
		const variables = readFileSync(
			path.join(projectRoot, "android", "variables.gradle"),
			"utf8",
		);
		const version = (variable: string): string => {
			const match = variables.match(
				new RegExp(`${variable}\\s*=\\s*'([^']+)'`, "u"),
			);
			if (!match) throw new Error(`Android-Version ${variable} fehlt.`);
			return match[1];
		};

		for (const [coordinate, variable] of [
			["androidx.appcompat:appcompat", "androidxAppCompatVersion"],
			[
				"androidx.coordinatorlayout:coordinatorlayout",
				"androidxCoordinatorLayoutVersion",
			],
			["androidx.core:core-splashscreen", "coreSplashScreenVersion"],
			["org.apache.cordova:framework", "cordovaAndroidVersion"],
		] as const) {
			expect(notices).toContain(`${coordinate}:${version(variable)}`);
		}
	});

	it("belegt jedes tatsächlich paketierte Android-Artefakt durch Maven-Metadaten", () => {
		const androidIndex = notices.match(
			/ANDROID RELEASE-RUNTIME ARTIFACT INDEX[\s\S]*?LICENSE AND NOTICE TEXTS/u,
		)?.[0];
		if (!androidIndex) throw new Error("Android-Artefaktindex fehlt.");
		const coordinates = [
			...androidIndex.matchAll(/^([^\s].+:.+:.+) — .+$/gmu),
		].map((match) => match[1]);

		expect(coordinates.length).toBeGreaterThan(0);
		expect(
			androidIndex.match(/^ {2}Maven POM: https:\/\/.+\.pom$/gmu),
		).toHaveLength(coordinates.length);
		for (const coordinate of coordinates) {
			expect(notices.slice(notices.indexOf("ANDROID LICENSE TEXTS"))).toContain(
				coordinate,
			);
		}
		expect(notices).toContain("ANDROID EMBEDDED NOTICE TEXTS");
	});

	it("enthält die vollständigen Lizenztexte und keine ungeprüften Einträge", () => {
		expect(notices).toContain("MIT License");
		expect(notices).toContain("Apache License");
		expect(notices).not.toMatch(/\b(?:UNKNOWN|UNREVIEWED)\b/u);
		expect(notices).not.toContain("reviewed fallback");
	});

	it("gruppiert inhaltlich gleiche Lizenztexte unabhängig vom Rand-Whitespace", () => {
		expect(notices).toContain(
			"Components: @capacitor/app@8.1.1, @capacitor/device@8.0.3, @capacitor/haptics@8.0.2, @capacitor/preferences@8.0.1, @capacitor/screen-orientation@8.0.1, @capacitor/share@8.0.1",
		);
	});

	it("trennt die beiden Lizenztextabschnitte durch eine zusätzliche Leerzeile", () => {
		expect(notices).toContain("\n\n\nLICENSE AND NOTICE TEXTS\n");
		expect(notices).toContain("\n\n\nANDROID LICENSE TEXTS\n");
	});

	it("verwendet durchgehend Android-/Unix-Zeilenumbrüche", () => {
		expect(notices).not.toContain("\r");
		expect(notices.endsWith("\n")).toBe(true);
	});
});
