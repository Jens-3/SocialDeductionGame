import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import {
	convertToAndroidLineEndings,
	ensureTrailingLineBreak,
	isCompleteApache20License,
	normalizeLegalTextForComparison,
	renderNormalizedLegalText,
	selectApache20LicenseFiles,
} from "./license_text_selection.mjs";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(projectRoot, "THIRD_PARTY_LICENSES.txt");
const packageJsonPath = path.join(projectRoot, "package.json");
const canonicalLicenseDirectory = path.join(
	projectRoot,
	"scripts",
	"license-texts",
);
const canonicalLicenseSourcesPath = path.join(
	canonicalLicenseDirectory,
	"sources.json",
);
const mode = process.argv[2] ?? "generate";

if (mode !== "generate" && mode !== "check") {
	throw new Error(
		"Usage: node scripts/generate_third_party_licenses.mjs generate|check",
	);
}

const compatibleNpmLicenses = new Set([
	"0BSD",
	"Apache-2.0",
	"BSD-2-Clause",
	"BSD-3-Clause",
	"CC0-1.0",
	"ISC",
	"MIT",
	"MIT-0",
	"Unlicense",
]);

const reviewedNpmLicenseConflicts = new Map([
	[
		"@capacitor/synapse@1.0.4",
		{
			metadataLicense: "ISC",
			includedLicense: "MIT",
			explanation:
				"The published package metadata declares ISC, but its included LICENSE.md contains the MIT license.",
		},
	],
]);

const reviewedNpmLicenseFileFallbacks = new Map([
	[
		"client-only@0.0.1",
		{
			sourcePackage: "react",
			explanation:
				"The published marker package declares MIT but contains no license file; the identical MIT license from its React project is included instead.",
		},
	],
]);

function normalizeRepository(repository) {
	const value =
		typeof repository === "string"
			? repository
			: typeof repository?.url === "string"
				? repository.url
				: undefined;
	return value?.replace(/^git\+/u, "").replace(/\.git$/u, "");
}

async function readJson(filePath) {
	return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function findPackageJson(dependency, requiringPackageJson) {
	const requireFromPackage = createRequire(requiringPackageJson);
	try {
		return requireFromPackage.resolve(`${dependency}/package.json`);
	} catch {
		let current = path.dirname(requireFromPackage.resolve(dependency));
		while (current !== path.dirname(current)) {
			const candidate = path.join(current, "package.json");
			try {
				const metadata = await readJson(candidate);
				if (metadata.name === dependency) return candidate;
			} catch {
				// Continue towards the package-store root.
			}
			current = path.dirname(current);
		}
		throw new Error(`Package metadata not found for ${dependency}`);
	}
}

function declaredLicense(metadata) {
	if (typeof metadata.license === "string") return metadata.license;
	if (typeof metadata.license?.type === "string") return metadata.license.type;
	if (Array.isArray(metadata.licenses)) {
		return metadata.licenses
			.map((entry) => (typeof entry === "string" ? entry : entry?.type))
			.filter(Boolean)
			.join(" OR ");
	}
	return undefined;
}

function isCompatibleLicense(expression) {
	const identifiers = licenseExpressionIdentifiers(expression);
	return (
		identifiers.length > 0 &&
		identifiers.every((identifier) => compatibleNpmLicenses.has(identifier))
	);
}

function licenseExpressionIdentifiers(expression) {
	return expression
		.split(/\s+(?:AND|OR|WITH)\s+|[()]/u)
		.map((identifier) => identifier.trim())
		.filter(Boolean);
}

function detectIncludedLicenses(notices) {
	const detected = new Set();
	if (
		/\bMIT License\b/iu.test(notices) &&
		/Permission is hereby granted, free of charge/iu.test(notices)
	) {
		detected.add("MIT");
	}
	if (
		/Permission to use, copy, modify, and\/?or distribute this software/iu.test(
			notices,
		) &&
		/provided that the above copyright notice and this permission notice appear in all copies/iu.test(
			notices,
		) &&
		/THE SOFTWARE IS PROVIDED [“"]AS IS[”"]/iu.test(notices)
	) {
		detected.add("ISC");
	}
	if (
		/Permission to use, copy, modify, and\/?or distribute this software/iu.test(
			notices,
		) &&
		/THE SOFTWARE IS PROVIDED [“"]AS IS[”"] AND THE (?:AUTHOR|AUTHORS)/iu.test(
			notices,
		)
	) {
		detected.add("0BSD");
	}
	if (
		/Apache License\s+Version 2\.0/iu.test(notices) &&
		/https?:\/\/www\.apache\.org\/licenses\/(?:LICENSE-2\.0)?/iu.test(notices)
	) {
		detected.add("Apache-2.0");
	}
	return [...detected].sort((left, right) => left.localeCompare(right, "en"));
}

const licenseFileNamePattern =
	/(?:^|[._-])(?:license|licence|copying)(?:$|[._-])/iu;
const noticeFileNamePattern = /(?:^|[._-])notice(?:$|[._-])/iu;

function legalFileKind(fileName) {
	const normalizedName = fileName.replaceAll("\\", "/");
	const baseName = normalizedName.slice(normalizedName.lastIndexOf("/") + 1);
	if (noticeFileNamePattern.test(baseName)) return "notice";
	if (licenseFileNamePattern.test(baseName)) return "license";
	return undefined;
}

async function readPackageLegalFiles(packageDirectory) {
	const names = (await fs.readdir(packageDirectory))
		.filter(
			(name) =>
				licenseFileNamePattern.test(name) || noticeFileNamePattern.test(name),
		)
		.sort((left, right) => left.localeCompare(right, "en"));
	const files = [];
	for (const name of names) {
		const filePath = path.join(packageDirectory, name);
		const stat = await fs.stat(filePath);
		if (!stat.isFile()) continue;
		files.push({
			name,
			kind: noticeFileNamePattern.test(name) ? "notice" : "license",
			text: await fs.readFile(filePath, "utf8"),
		});
	}
	return files;
}

function renderPackageLegalFiles(files) {
	return files
		.map(({ name, text }) => `--- ${name} ---\n\n${text}`)
		.join("\n\n");
}

async function readCanonicalPackageLicenseNotices(
	dependency,
	expectedLicense,
) {
	const dependencyPackageJson = await findPackageJson(
		dependency,
		packageJsonPath,
	);
	const metadata = await readJson(dependencyPackageJson);
	const license = declaredLicense(metadata);
	if (!licenseExpressionIdentifiers(license ?? "").includes(expectedLicense)) {
		throw new Error(
			`${dependency} cannot provide the canonical ${expectedLicense} text: declared license is ${license ?? "missing"}`,
		);
	}
	const licenseFiles = (
		await readPackageLegalFiles(path.dirname(dependencyPackageJson))
	).filter(({ kind }) => kind === "license");
	const notices = renderPackageLegalFiles(licenseFiles);
	if (!detectIncludedLicenses(notices).includes(expectedLicense)) {
		throw new Error(
			`${dependency} does not contain a recognizable ${expectedLicense} license text`,
		);
	}
	return notices;
}

async function readCanonicalLicenseText(licenseIdentifier) {
	const sources = await readJson(canonicalLicenseSourcesPath);
	const source = sources[licenseIdentifier];
	if (!source || typeof source !== "object") {
		throw new Error(
			`Canonical license source metadata is missing for ${licenseIdentifier}`,
		);
	}
	requireNonEmptyString(source.file, `${licenseIdentifier} source file`);
	requireNonEmptyString(source.source, `${licenseIdentifier} source URL`);
	requireNonEmptyString(source.sha256, `${licenseIdentifier} SHA-256`);
	const fileName = source.file;
	const sourceUrl = source.source;
	const expectedHash = source.sha256.toLowerCase();
	if (path.basename(fileName) !== fileName) {
		throw new Error(`${licenseIdentifier} source file must be a plain file name`);
	}
	if (!URL.canParse(sourceUrl)) {
		throw new Error(`${licenseIdentifier} source URL is invalid: ${sourceUrl}`);
	}
	if (!/^[a-f\d]{64}$/u.test(expectedHash)) {
		throw new Error(`${licenseIdentifier} SHA-256 is invalid`);
	}

	const text = await fs.readFile(
		path.join(canonicalLicenseDirectory, fileName),
		"utf8",
	);
	const actualHash = createHash("sha256").update(text, "utf8").digest("hex");
	if (actualHash !== expectedHash) {
		throw new Error(
			`${licenseIdentifier} canonical text SHA-256 mismatch: expected ${expectedHash}, got ${actualHash}`,
		);
	}
	if (!detectIncludedLicenses(text).includes(licenseIdentifier)) {
		throw new Error(
			`${fileName} does not contain a recognizable ${licenseIdentifier} license text`,
		);
	}
	return { name: fileName, kind: "license", text };
}

function noticeRecordId(component, fileName, text) {
	const hash = createHash("sha256").update(text, "utf8").digest("hex");
	return `${component}\t${fileName}\t${hash}`;
}

async function collectNpmRuntimePackages(canonicalApacheFile) {
	const rootMetadata = await readJson(packageJsonPath);
	const queue = [];
	for (const dependency of Object.keys(rootMetadata.dependencies ?? {})) {
		queue.push({ dependency, requiringPackageJson: packageJsonPath });
	}

	const packages = new Map();
	while (queue.length > 0) {
		const { dependency, requiringPackageJson } = queue.shift();
		let dependencyPackageJson;
		try {
			dependencyPackageJson = await findPackageJson(
				dependency,
				requiringPackageJson,
			);
		} catch (error) {
			const requiringMetadata = await readJson(requiringPackageJson);
			if (requiringMetadata.optionalDependencies?.[dependency]) continue;
			throw error;
		}
		const metadata = await readJson(dependencyPackageJson);
		const key = `${metadata.name}@${metadata.version}`;
		if (packages.has(key)) continue;

		const license = declaredLicense(metadata);
		if (!license) throw new Error(`${key} has no declared license`);
		if (!isCompatibleLicense(license)) {
			throw new Error(
				`${key} uses an unreviewed license expression: ${license}`,
			);
		}
		const declaredIdentifiers = new Set(licenseExpressionIdentifiers(license));
		const directory = path.dirname(dependencyPackageJson);
		let legalFiles = await readPackageLegalFiles(directory);
		let licenseFiles = legalFiles.filter(({ kind }) => kind === "license");
		let licenseFileFallback;
		if (licenseFiles.length === 0) {
			if (declaredIdentifiers.has("Apache-2.0")) {
				licenseFiles = [canonicalApacheFile];
				legalFiles = [...licenseFiles, ...legalFiles];
				licenseFileFallback = {
					sourceKey: "scripts/license-texts/Apache-2.0.txt",
					explanation:
						"The package declares Apache-2.0 but contains no offline license file; the verified ASF text is included instead.",
				};
			} else {
				licenseFileFallback = reviewedNpmLicenseFileFallbacks.get(key);
				if (!licenseFileFallback) {
					throw new Error(
						`${key} contains no LICENSE, LICENCE, or COPYING file`,
					);
				}
				const fallbackPackageJson = await findPackageJson(
					licenseFileFallback.sourcePackage,
					packageJsonPath,
				);
				const fallbackMetadata = await readJson(fallbackPackageJson);
				const fallbackLicense = declaredLicense(fallbackMetadata);
				if (fallbackLicense !== license) {
					throw new Error(
						`${key} license-file fallback has different metadata: package=${license}, fallback=${fallbackLicense}`,
					);
				}
				const fallbackKey = `${fallbackMetadata.name}@${fallbackMetadata.version}`;
				const fallbackLegalFiles = await readPackageLegalFiles(
					path.dirname(fallbackPackageJson),
				);
				licenseFiles = fallbackLegalFiles
					.filter(({ kind }) => kind === "license")
					.map((file) => ({
						...file,
						name: `${file.name} (from ${fallbackKey})`,
					}));
				if (licenseFiles.length === 0) {
					throw new Error(`${fallbackKey} contains no fallback license file`);
				}
				licenseFileFallback = {
					...licenseFileFallback,
					sourceKey: fallbackKey,
				};
				legalFiles = [...licenseFiles, ...legalFiles];
			}
		}
		if (declaredIdentifiers.has("Apache-2.0")) {
			const selectedApacheFiles = selectApache20LicenseFiles(
				legalFiles,
				canonicalApacheFile,
			);
			const completeApacheFiles = new Set(
				legalFiles.filter(
					({ kind, text }) =>
						kind === "license" && isCompleteApache20License(text),
				),
			);
			legalFiles = [
				...selectedApacheFiles,
				...legalFiles.filter((file) => !completeApacheFiles.has(file)),
			];
			if (completeApacheFiles.size === 0 && !licenseFileFallback) {
				licenseFileFallback = {
					sourceKey: "scripts/license-texts/Apache-2.0.txt",
					explanation:
						"The package contains no complete offline Apache-2.0 text; the verified ASF text is included instead.",
				};
			}
		}
		const noticeFiles = legalFiles
			.filter(({ kind }) => kind === "notice")
			.map(({ name }) => name);
		const notices = renderPackageLegalFiles(legalFiles);

		const includedLicenses = detectIncludedLicenses(notices);
		const conflictingIncludedLicenses = includedLicenses.filter(
			(includedLicense) => !declaredIdentifiers.has(includedLicense),
		);
		let licenseConflict;
		if (conflictingIncludedLicenses.length > 0) {
			licenseConflict = reviewedNpmLicenseConflicts.get(key);
			const matchesReviewedConflict =
				licenseConflict?.metadataLicense === license &&
				conflictingIncludedLicenses.length === 1 &&
				licenseConflict.includedLicense === conflictingIncludedLicenses[0];
			if (!matchesReviewedConflict) {
				throw new Error(
					`${key} has conflicting license information: package metadata=${license}, included text=${includedLicenses.join(", ")}`,
				);
			}
		}

		packages.set(key, {
			key,
			name: metadata.name,
			version: metadata.version,
			license,
			includedLicenses,
			licenseConflict,
			licenseFileFallback,
			legalFiles,
			noticeFiles,
			homepage: metadata.homepage,
			repository: normalizeRepository(metadata.repository),
			notices,
		});

		const runtimeDependencies = {
			...metadata.dependencies,
			...metadata.optionalDependencies,
		};
		for (const child of Object.keys(runtimeDependencies)) {
			queue.push({
				dependency: child,
				requiringPackageJson: dependencyPackageJson,
			});
		}
		for (const peer of Object.keys(metadata.peerDependencies ?? {})) {
			if (metadata.peerDependenciesMeta?.[peer]?.optional) continue;
			queue.push({
				dependency: peer,
				requiringPackageJson: dependencyPackageJson,
			});
		}
	}

	return [...packages.values()].sort((left, right) =>
		left.key.localeCompare(right.key, "en"),
	);
}

function androidLicenseFor(group, artifact) {
	if (
		group.startsWith("androidx.") ||
		group.startsWith("org.jetbrains.kotlin") ||
		group === "org.jetbrains" ||
		group === "org.apache.cordova" ||
		group === "com.google.guava" ||
		group === "org.jspecify"
	) {
		return "Apache-2.0";
	}
	if (group === "io.ionic.libs" && artifact === "ionfilesystem-android") {
		return "MIT";
	}
	return undefined;
}

function mavenPomUrl(group, artifact, version) {
	const repository = group.startsWith("androidx.")
		? "https://dl.google.com/dl/android/maven2"
		: "https://repo.maven.apache.org/maven2";
	return `${repository}/${group.replaceAll(".", "/")}/${artifact}/${version}/${artifact}-${version}.pom`;
}

function decodeXml(text) {
	return text
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&quot;", '"')
		.replaceAll("&apos;", "'")
		.replaceAll("&amp;", "&");
}

function xmlTag(xml, tag) {
	const match = xml.match(
		new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "iu"),
	);
	return match?.[1] ? decodeXml(match[1].trim()) : undefined;
}

function parsePomLicenseMetadata(xml) {
	const licensesBlock = xmlTag(xml, "licenses");
	const licenses = licensesBlock
		? [
				...licensesBlock.matchAll(
					/<license(?:\s[^>]*)?>([\s\S]*?)<\/license>/giu,
				),
			].map((match) => ({
				name: xmlTag(match[1], "name"),
				url: xmlTag(match[1], "url"),
			}))
		: [];
	const parentBlock = xmlTag(xml, "parent");
	const parent = parentBlock
		? {
				group: xmlTag(parentBlock, "groupId"),
				artifact: xmlTag(parentBlock, "artifactId"),
				version: xmlTag(parentBlock, "version"),
			}
		: undefined;
	return { licenses, parent };
}

function normalizedMavenLicense(licenses, fallback) {
	const description = licenses
		.flatMap(({ name, url }) => [name, url])
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
	if (
		description.includes("apache license") ||
		description.includes("apache software license") ||
		description.includes("licenses/license-2.0")
	) {
		return "Apache-2.0";
	}
	if (
		description.includes("mit license") ||
		description.includes("opensource.org/license/mit")
	) {
		return "MIT";
	}
	return fallback;
}

async function fetchPomLicenseMetadata(
	group,
	artifact,
	version,
	seen = new Set(),
) {
	const coordinate = `${group}:${artifact}:${version}`;
	if (seen.has(coordinate)) {
		throw new Error(`Cyclic Maven POM parent chain at ${coordinate}`);
	}
	seen.add(coordinate);
	const url = mavenPomUrl(group, artifact, version);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Maven POM request failed (${response.status}): ${url}`);
	}
	const { licenses, parent } = parsePomLicenseMetadata(await response.text());
	if (licenses.length > 0) return { licenses, pomUrl: url };
	if (parent?.group && parent.artifact && parent.version) {
		return fetchPomLicenseMetadata(
			parent.group,
			parent.artifact,
			parent.version,
			seen,
		);
	}
	return { licenses: [], pomUrl: url };
}

function formatEmbeddedAndroidNotices(notices) {
	if (notices.length === 0) return undefined;
	return notices
		.map(
			({ path: entryPath, text }) => `--- embedded ${entryPath} ---\n\n${text}`,
		)
		.join("\n\n");
}

async function collectAndroidRuntimeArtifacts(canonicalApacheFile) {
	const androidDirectory = path.join(projectRoot, "android");
	const gradleWrapper = path.join(
		androidDirectory,
		process.platform === "win32" ? "gradlew.bat" : "gradlew",
	);
	const executable =
		process.platform === "win32"
			? (process.env.ComSpec ?? "cmd.exe")
			: gradleWrapper;
	const gradleArguments = [
		"--init-script",
		"../scripts/android_runtime_artifacts.init.gradle",
		"thirdPartyRuntimeArtifactReport",
		"--console=plain",
		"--quiet",
		"--no-configuration-cache",
	];
	const argumentsForProcess =
		process.platform === "win32"
			? ["/d", "/s", "/c", `gradlew.bat ${gradleArguments.join(" ")}`]
			: gradleArguments;
	const { stdout } = await execFileAsync(executable, argumentsForProcess, {
		cwd: androidDirectory,
		maxBuffer: 32 * 1024 * 1024,
		windowsHide: true,
	});

	const artifacts = new Map();
	for (const line of stdout.split(/\r?\n/u)) {
		const prefix = "THIRD_PARTY_ANDROID_ARTIFACT\t";
		if (!line.startsWith(prefix)) continue;
		const report = JSON.parse(line.slice(prefix.length));
		artifacts.set(report.coordinate, report);
	}
	if (artifacts.size === 0) {
		throw new Error("Gradle reported no Android release-runtime artifacts");
	}

	// Android's Apache license must not depend on whether the current npm
	// runtime graph happens to contain an Apache-licensed package. The official
	// ASF text is checked into scripts/license-texts with verified provenance.
	const ionicMit = await readCanonicalPackageLicenseNotices(
		"@capacitor/filesystem",
		"MIT",
	);

	const resolved = await Promise.all(
		[...artifacts.values()].map(async (report) => {
			const [group, artifact, version] = report.coordinate.split(":");
			const reviewedLicense = androidLicenseFor(group, artifact);
			if (!reviewedLicense) {
				throw new Error(
					`Android artifact has no reviewed license mapping: ${report.coordinate}`,
				);
			}
			const metadata = await fetchPomLicenseMetadata(group, artifact, version);
			const license = normalizedMavenLicense(
				metadata.licenses,
				reviewedLicense,
			);
			if (license !== reviewedLicense) {
				throw new Error(
					`Android license mismatch for ${report.coordinate}: POM=${license}, reviewed=${reviewedLicense}`,
				);
			}
			const embeddedNotices = formatEmbeddedAndroidNotices(
				report.notices ?? [],
			);
			const embeddedLegalFiles = (report.notices ?? [])
				.map(({ path: entryPath, text }) => ({
					name: `embedded ${entryPath}`,
					kind: legalFileKind(entryPath),
					text,
				}))
				.filter(({ kind }) => kind !== undefined);
			const licenseNotices =
				license === "Apache-2.0"
					? renderPackageLegalFiles(
							selectApache20LicenseFiles(
								embeddedLegalFiles,
								canonicalApacheFile,
							),
						)
					: ionicMit;
			return {
				coordinate: report.coordinate,
				license,
				pomUrl: metadata.pomUrl,
				pomLicenses: metadata.licenses,
				licenseNotices,
				embeddedNotices,
				embeddedNoticeFiles: report.notices ?? [],
			};
		}),
	);
	return resolved.sort((left, right) =>
		left.coordinate.localeCompare(right.coordinate, "en"),
	);
}

function requireNonEmptyString(value, description) {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${description} is missing or empty`);
	}
}

function validateCollectedRuntimeData(npmPackages, androidArtifacts) {
	const npmKeys = new Set();
	for (const packageInfo of npmPackages) {
		requireNonEmptyString(packageInfo.name, `${packageInfo.key} name`);
		requireNonEmptyString(packageInfo.version, `${packageInfo.key} version`);
		requireNonEmptyString(packageInfo.license, `${packageInfo.key} license`);
		if (npmKeys.has(packageInfo.key)) {
			throw new Error(`Duplicate npm runtime package: ${packageInfo.key}`);
		}
		npmKeys.add(packageInfo.key);
		const licenseFiles = packageInfo.legalFiles.filter(
			({ kind }) => kind === "license",
		);
		if (licenseFiles.length === 0) {
			throw new Error(`${packageInfo.key} has no collected license text`);
		}
		for (const file of packageInfo.legalFiles) {
			requireNonEmptyString(
				file.text,
				`${packageInfo.key} legal file ${file.name}`,
			);
		}
	}

	const androidCoordinates = new Set();
	for (const artifact of androidArtifacts) {
		requireNonEmptyString(artifact.coordinate, "Android artifact coordinate");
		const coordinateParts = artifact.coordinate.split(":");
		if (
			coordinateParts.length !== 3 ||
			coordinateParts.some((part) => part.trim().length === 0)
		) {
			throw new Error(
				`Invalid Android artifact coordinate: ${artifact.coordinate}`,
			);
		}
		requireNonEmptyString(artifact.license, `${artifact.coordinate} license`);
		requireNonEmptyString(
			artifact.licenseNotices,
			`${artifact.coordinate} license text`,
		);
		if (androidCoordinates.has(artifact.coordinate)) {
			throw new Error(
				`Duplicate Android runtime artifact: ${artifact.coordinate}`,
			);
		}
		androidCoordinates.add(artifact.coordinate);
		for (const notice of artifact.embeddedNoticeFiles) {
			requireNonEmptyString(
				notice.text,
				`${artifact.coordinate} embedded legal file ${notice.path}`,
			);
		}
	}
}

function assertExactCoverage(description, expected, actual) {
	const expectedSorted = [...expected].sort((left, right) =>
		left.localeCompare(right, "en"),
	);
	const actualSorted = [...actual].sort((left, right) =>
		left.localeCompare(right, "en"),
	);
	if (JSON.stringify(expectedSorted) !== JSON.stringify(actualSorted)) {
		throw new Error(
			`${description} coverage mismatch: discovered=${expectedSorted.length}, rendered=${actualSorted.length}`,
		);
	}
}

function validateRenderedDocument(
	document,
	npmPackages,
	androidArtifacts,
	audit,
) {
	const npmCount = document.match(/^npm runtime packages: (\d+)$/mu)?.[1];
	const androidCount = document.match(
		/^Android runtime artifacts: (\d+)$/mu,
	)?.[1];
	if (Number(npmCount) !== npmPackages.length) {
		throw new Error(
			`npm runtime package count mismatch: declared=${npmCount ?? "missing"}, discovered=${npmPackages.length}`,
		);
	}
	if (Number(androidCount) !== androidArtifacts.length) {
		throw new Error(
			`Android runtime artifact count mismatch: declared=${androidCount ?? "missing"}, discovered=${androidArtifacts.length}`,
		);
	}

	const npmKeys = npmPackages.map(({ key }) => key);
	const androidCoordinates = androidArtifacts.map(
		({ coordinate }) => coordinate,
	);
	const npmNoticeRecords = npmPackages.flatMap((packageInfo) =>
		packageInfo.legalFiles
			.filter(({ kind }) => kind === "notice")
			.map(({ name, text }) => noticeRecordId(packageInfo.key, name, text)),
	);
	const androidNoticeRecords = androidArtifacts.flatMap((artifact) =>
		artifact.embeddedNoticeFiles.map(({ path: filePath, text }) =>
			noticeRecordId(artifact.coordinate, filePath, text),
		),
	);

	assertExactCoverage("npm package index", npmKeys, audit.npmIndexKeys);
	assertExactCoverage("npm license text", npmKeys, audit.npmLicenseKeys);
	assertExactCoverage("npm NOTICE file", npmNoticeRecords, audit.npmNotices);
	assertExactCoverage(
		"Android artifact index",
		androidCoordinates,
		audit.androidIndexCoordinates,
	);
	assertExactCoverage(
		"Android license text",
		androidCoordinates,
		audit.androidLicenseCoordinates,
	);
	assertExactCoverage(
		"Android embedded legal file",
		androidNoticeRecords,
		audit.androidNotices,
	);
}

function renderDocument(npmPackages, androidArtifacts) {
	const audit = {
		npmIndexKeys: [],
		npmLicenseKeys: [],
		npmNotices: [],
		androidIndexCoordinates: [],
		androidLicenseCoordinates: [],
		androidNotices: [],
	};
	const noticeGroups = new Map();
	for (const packageInfo of npmPackages) {
		const groupKey = normalizeLegalTextForComparison(packageInfo.notices);
		const group = noticeGroups.get(groupKey) ?? [];
		group.push(packageInfo);
		noticeGroups.set(groupKey, group);
	}

	const lines = [
		"THIRD-PARTY SOFTWARE NOTICES",
		"================================",
		"",
		"This file is generated by scripts/generate_third_party_licenses.mjs.",
		"Do not edit it manually.",
		"",
		"It lists the third-party software components included in the application",
		"release, covering npm production dependencies and resolved Android runtime",
		"artifacts. Development-only dependencies are excluded.",
		"",
		"Each component remains subject to its own applicable license terms. The",
		"licenses and notices listed in this file apply only to the respective",
		"third-party components and do not alter, replace, or limit the",
		"AGPL-3.0-only license terms applicable to this application's own code.",
		"",
		`npm runtime packages: ${npmPackages.length}`,
		`Android runtime artifacts: ${androidArtifacts.length}`,
		"",
		"NPM RUNTIME PACKAGE INDEX",
		"-------------------------",
	];

	for (const packageInfo of npmPackages) {
		if (packageInfo.licenseConflict) {
			lines.push(
				`${packageInfo.key} — package metadata: ${packageInfo.license}; included license text: ${packageInfo.licenseConflict.includedLicense} (conflict)`,
			);
		} else {
			lines.push(`${packageInfo.key} — ${packageInfo.license}`);
		}
		if (packageInfo.licenseFileFallback) {
			lines.push(
				`  License file fallback: ${packageInfo.licenseFileFallback.sourceKey}`,
			);
		}
		if (packageInfo.homepage) lines.push(`  Homepage: ${packageInfo.homepage}`);
		if (packageInfo.repository) {
			lines.push(`  Repository: ${packageInfo.repository}`);
		}
		audit.npmIndexKeys.push(packageInfo.key);
	}

	const npmPackagesWithNotices = npmPackages.filter(
		(packageInfo) => packageInfo.noticeFiles.length > 0,
	);
	lines.push("", "NPM NOTICE FILES", "----------------");
	if (npmPackagesWithNotices.length === 0) {
		lines.push(
			"",
			"No NOTICE, NOTICE.txt, or NOTICE-* file is included in the installed npm runtime packages.",
		);
	} else {
		for (const packageInfo of npmPackagesWithNotices) {
			lines.push(`${packageInfo.key} — ${packageInfo.noticeFiles.join(", ")}`);
		}
	}

	lines.push(
		"",
		"ANDROID RELEASE-RUNTIME ARTIFACT INDEX",
		"--------------------------------------",
	);
	for (const artifact of androidArtifacts) {
		lines.push(`${artifact.coordinate} — ${artifact.license}`);
		lines.push(`  Maven POM: ${artifact.pomUrl}`);
		for (const { name, url } of artifact.pomLicenses) {
			lines.push(
				`  Declared: ${name ?? "unnamed license"}${url ? ` (${url})` : ""}`,
			);
		}
		audit.androidIndexCoordinates.push(artifact.coordinate);
	}

	lines.push("", "", "LICENSE AND NOTICE TEXTS", "------------------------");
	const groups = [...noticeGroups.entries()].sort((left, right) =>
		left[1][0].key.localeCompare(right[1][0].key, "en"),
	);
	for (const [notices, packages] of groups) {
		const metadataLicenses = [
			...new Set(packages.map((entry) => entry.license)),
		].join(", ");
		const includedLicenses = [
			...new Set(packages.flatMap((entry) => entry.includedLicenses)),
		].join(", ");
		const conflicts = packages
			.map((entry) => entry.licenseConflict)
			.filter(Boolean);
		const licenseFileFallbacks = packages
			.map((entry) => entry.licenseFileFallback)
			.filter(Boolean);
		lines.push(
			"",
			"===============================================================================",
			`Components: ${packages.map((entry) => entry.key).join(", ")}`,
			...(conflicts.length > 0
				? [
						`Package metadata license: ${metadataLicenses}`,
						`Included license text: ${includedLicenses}`,
						...conflicts.map((conflict) => `Warning: ${conflict.explanation}`),
					]
				: [`Declared license: ${metadataLicenses}`]),
			...licenseFileFallbacks.map(
				(fallback) =>
					`License file fallback: ${fallback.sourceKey}. ${fallback.explanation}`,
			),
			"===============================================================================",
			"",
			renderNormalizedLegalText(notices),
		);
		for (const packageInfo of packages) {
			audit.npmLicenseKeys.push(packageInfo.key);
			for (const file of packageInfo.legalFiles) {
				if (file.kind !== "notice") continue;
				audit.npmNotices.push(
					noticeRecordId(packageInfo.key, file.name, file.text),
				);
			}
		}
	}

	lines.push("", "", "ANDROID LICENSE TEXTS", "---------------------");
	const androidLicenseGroups = Map.groupBy(androidArtifacts, (artifact) =>
		JSON.stringify([
			artifact.license,
			normalizeLegalTextForComparison(artifact.licenseNotices),
		]),
	);
	for (const [groupKey, artifacts] of [...androidLicenseGroups.entries()].sort(
		([left], [right]) => left.localeCompare(right, "en"),
	)) {
		const [license, licenseNotices] = JSON.parse(groupKey);
		lines.push(
			"",
			"===============================================================================",
			`Components: ${artifacts.map((entry) => entry.coordinate).join(", ")}`,
			`Declared license: ${license}`,
			"===============================================================================",
			"",
			renderNormalizedLegalText(licenseNotices),
		);
		audit.androidLicenseCoordinates.push(
			...artifacts.map(({ coordinate }) => coordinate),
		);
	}

	const embeddedAndroidNotices = androidArtifacts.filter(
		(artifact) => artifact.embeddedNotices,
	);
	lines.push(
		"",
		"ANDROID EMBEDDED NOTICE TEXTS",
		"-----------------------------",
	);
	if (embeddedAndroidNotices.length === 0) {
		lines.push(
			"",
			"No LICENSE, NOTICE, COPYING, or LICENCE file is embedded in the resolved archives.",
		);
	} else {
		for (const artifact of embeddedAndroidNotices) {
			lines.push(
				"",
				`Component: ${artifact.coordinate}`,
				ensureTrailingLineBreak(artifact.embeddedNotices),
			);
			for (const notice of artifact.embeddedNoticeFiles) {
				audit.androidNotices.push(
					noticeRecordId(artifact.coordinate, notice.path, notice.text),
				);
			}
		}
	}

	const document = convertToAndroidLineEndings(`${lines.join("\n")}\n`);
	return { document, audit };
}

const canonicalApacheFile = await readCanonicalLicenseText("Apache-2.0");
const [npmPackages, androidArtifacts] = await Promise.all([
	collectNpmRuntimePackages(canonicalApacheFile),
	collectAndroidRuntimeArtifacts(canonicalApacheFile),
]);
validateCollectedRuntimeData(npmPackages, androidArtifacts);
const { document, audit } = renderDocument(npmPackages, androidArtifacts);
validateRenderedDocument(document, npmPackages, androidArtifacts, audit);

if (mode === "check") {
	let existing;
	try {
		existing = await fs.readFile(outputPath, "utf8");
	} catch {
		throw new Error("THIRD_PARTY_LICENSES.txt is missing; run the generator");
	}
	if (existing !== document) {
		throw new Error(
			"THIRD_PARTY_LICENSES.txt does not match the runtime dependencies (entries may be missing, superfluous, or outdated); run .\\update-third-party-licenses.ps1",
		);
	}
} else {
	await fs.writeFile(outputPath, document, "utf8");
}

console.log(
	`${mode}: ${npmPackages.length} npm packages, ${androidArtifacts.length} Android artifacts`,
);
