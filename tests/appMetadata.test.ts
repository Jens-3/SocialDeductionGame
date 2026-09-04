import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appMetadata } from "../src/application/appMetadata";

const projectRoot = process.cwd();
const packageMetadata = JSON.parse(
	readFileSync(path.join(projectRoot, "package.json"), "utf8"),
) as {
	version: string;
	author: string;
	license: string;
	appMetadata: {
		copyrightYears: string;
		softwareLicenseName: string;
	};
};

describe("zentrale App-Metadaten", () => {
	it("stellt die Paketmetadaten unverändert für die GUI bereit", () => {
		expect(appMetadata).toMatchObject({
			version: packageMetadata.version,
			author: packageMetadata.author,
			licenseSpdx: packageMetadata.license,
			softwareLicenseName: packageMetadata.appMetadata.softwareLicenseName,
			copyrightYears: packageMetadata.appMetadata.copyrightYears,
		});
		expect(appMetadata.copyrightNotice).toBe(
			`Copyright © ${packageMetadata.appMetadata.copyrightYears} ${packageMetadata.author}`,
		);
	});

	it("bezieht auch Androids versionName aus package.json", () => {
		const androidBuild = readFileSync(
			path.join(projectRoot, "android", "app", "build.gradle"),
			"utf8",
		);
		expect(androidBuild).toContain(
			"def packageMetadata = new JsonSlurper().parse(file('../../package.json'))",
		);
		expect(androidBuild).toContain("versionName packageMetadata.version");
		expect(androidBuild).not.toMatch(/versionName\s+["'][^"']+["']/u);
	});
});
