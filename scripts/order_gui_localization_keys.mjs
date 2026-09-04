import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "@babel/parser";

const i18nDirectory = path.resolve("src/gui/i18n");
const referenceFileName = "de.ts";
const mode = process.argv[2] ?? "check";
const infrastructureFiles = new Set([
	"messages.ts",
	"pluralRules.ts",
	"registry.ts",
	"translate.ts",
]);

if (mode !== "check" && mode !== "apply") {
	throw new Error(
		"Usage: node scripts/order_gui_localization_keys.mjs check|apply",
	);
}

function unwrapExpression(expression) {
	let current = expression;
	while (
		current.type === "TSAsExpression" ||
		current.type === "TSSatisfiesExpression" ||
		current.type === "ParenthesizedExpression"
	) {
		current = current.expression;
	}
	return current;
}

function findTranslationObject(source, filePath) {
	let sourceFile;
	try {
		sourceFile = parse(source, {
			sourceFilename: filePath,
			sourceType: "module",
			plugins: ["typescript"],
		});
	} catch (error) {
		const position =
			typeof error === "object" && error !== null && "pos" in error
				? error.pos
				: 0;
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`${path.basename(filePath)}:${position}: ${message}`, {
			cause: error,
		});
	}

	for (const moduleItem of sourceFile.program.body) {
		const statement =
			moduleItem.type === "ExportNamedDeclaration"
				? moduleItem.declaration
				: moduleItem;
		if (statement?.type !== "VariableDeclaration") continue;
		for (const declaration of statement.declarations) {
			if (!declaration.init) continue;
			const initializer = unwrapExpression(declaration.init);
			if (initializer.type === "ObjectExpression") return initializer;
		}
	}
	throw new Error(`${path.basename(filePath)}: translation object not found`);
}

function propertyKey(property, fileName) {
	if (
		property.type !== "ObjectProperty" ||
		property.computed ||
		property.key.type !== "StringLiteral"
	) {
		throw new Error(
			`${fileName}: every top-level translation entry must be a string-keyed property assignment`,
		);
	}
	return property.key.value;
}

function lineStart(source, position) {
	const previousNewline = source.lastIndexOf("\n", position - 1);
	return previousNewline < 0 ? 0 : previousNewline + 1;
}

function parseLocalization(source, filePath) {
	const object = findTranslationObject(source, filePath);
	const fileName = path.basename(filePath);
	const properties = [...object.properties];
	if (properties.length === 0) {
		throw new Error(`${fileName}: translation object is empty`);
	}

	const keys = properties.map((property) => propertyKey(property, fileName));
	const duplicateKeys = keys.filter(
		(key, index) => keys.indexOf(key) !== index,
	);
	if (duplicateKeys.length > 0) {
		throw new Error(
			`${fileName}: duplicate keys: ${[...new Set(duplicateKeys)].join(", ")}`,
		);
	}

	const starts = properties.map((property) =>
		lineStart(source, property.start),
	);
	const closingBraceStart = lineStart(source, object.end - 1);
	const blocks = new Map();
	for (let index = 0; index < properties.length; index += 1) {
		const end = starts[index + 1] ?? closingBraceStart;
		blocks.set(keys[index], source.slice(starts[index], end));
	}

	return {
		keys,
		blocks,
		prefix: source.slice(0, starts[0]),
		suffix: source.slice(closingBraceStart),
	};
}

function assertSameKeys(fileName, referenceKeys, actualKeys) {
	const referenceSet = new Set(referenceKeys);
	const actualSet = new Set(actualKeys);
	const missing = referenceKeys.filter((key) => !actualSet.has(key));
	const additional = actualKeys.filter((key) => !referenceSet.has(key));
	if (missing.length === 0 && additional.length === 0) return;
	throw new Error(
		`${fileName}: key set differs from ${referenceFileName}; missing=[${missing.join(", ")}], additional=[${additional.join(", ")}]`,
	);
}

const referencePath = path.join(i18nDirectory, referenceFileName);
const referenceSource = await fs.readFile(referencePath, "utf8");
const reference = parseLocalization(referenceSource, referencePath);

const localeFileNames = (await fs.readdir(i18nDirectory))
	.filter(
		(fileName) =>
			fileName.endsWith(".ts") && !infrastructureFiles.has(fileName),
	)
	.sort((left, right) => left.localeCompare(right, "en"));

const unorderedFiles = [];
for (const fileName of localeFileNames) {
	const filePath = path.join(i18nDirectory, fileName);
	const source = await fs.readFile(filePath, "utf8");
	const localization = parseLocalization(source, filePath);
	assertSameKeys(fileName, reference.keys, localization.keys);

	const orderedBody = reference.keys
		.map((key) => localization.blocks.get(key))
		.join("");
	const orderedSource = localization.prefix + orderedBody + localization.suffix;
	if (orderedSource === source) continue;

	unorderedFiles.push(fileName);
	if (mode === "apply") await fs.writeFile(filePath, orderedSource, "utf8");
}

if (mode === "check" && unorderedFiles.length > 0) {
	console.error(
		`Localization key order differs from ${referenceFileName}: ${unorderedFiles.join(", ")}`,
	);
	process.exitCode = 1;
} else {
	console.log(
		JSON.stringify(
			{
				mode,
				reference: referenceFileName,
				locales: localeFileNames.length,
				reordered: unorderedFiles.length,
			},
			null,
			2,
		),
	);
}
