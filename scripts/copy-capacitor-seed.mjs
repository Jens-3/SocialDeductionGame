import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceRoot = path.resolve("app-seed");
const targetRoot = path.resolve("dist/native-seed");
const manifestPath = path.join(sourceRoot, "manifest.json");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!isSeedManifest(manifest))
	throw new Error("app-seed/manifest.json ist ungültig.");

const selectedFiles = [...manifest.files, ...manifest.assets].sort((left, right) =>
	left.localeCompare(right),
);
const duplicateFiles = selectedFiles.filter(
	(file, index) => file === selectedFiles[index - 1],
);
if (duplicateFiles.length > 0)
	throw new Error(
		`app-seed/manifest.json enthält doppelte Einträge: ${duplicateFiles.join(", ")}`,
	);

const actualFiles = (await collectFiles(sourceRoot)).filter(
	(relativePath) => relativePath !== "manifest.json",
);
const selectedFileSet = new Set(selectedFiles);
const actualFileSet = new Set(actualFiles);
const missingFiles = selectedFiles.filter((file) => !actualFileSet.has(file));
const unexpectedFiles = actualFiles.filter((file) => !selectedFileSet.has(file));
if (missingFiles.length > 0 || unexpectedFiles.length > 0) {
	const problems = [];
	if (missingFiles.length > 0)
		problems.push(`fehlend: ${missingFiles.join(", ")}`);
	if (unexpectedFiles.length > 0)
		problems.push(`nicht im Manifest: ${unexpectedFiles.join(", ")}`);
	throw new Error(`app-seed stimmt nicht mit dem Manifest überein (${problems.join("; ")}).`);
}

await rm(targetRoot, { recursive: true, force: true });
await mkdir(targetRoot, { recursive: true });

for (const relativePath of selectedFiles) {
	const targetPath = path.join(targetRoot, relativePath);
	await mkdir(path.dirname(targetPath), { recursive: true });
	await copyFile(path.join(sourceRoot, relativePath), targetPath);
}
await writeFile(
	path.join(targetRoot, "manifest.json"),
	`${JSON.stringify(
		{
			files: manifest.files,
		},
		null,
		2,
	)}\n`,
	"utf8",
);

function isSeedManifest(value) {
	return (
		typeof value === "object" &&
		value !== null &&
		Array.isArray(value.files) &&
		Array.isArray(value.assets) &&
		value.files.every(isSafeRelativePath) &&
		value.assets.every(
			(relativePath) =>
				isSafeRelativePath(relativePath) && relativePath.startsWith("assets/"),
		)
	);
}

function isSafeRelativePath(value) {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		!value.startsWith("/") &&
		!value.includes("\\") &&
		!value.split("/").some((part) => !part || part === "." || part === "..")
	);
}

async function collectFiles(directory, relativeDirectory = "") {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const relativePath = path.posix.join(relativeDirectory, entry.name);
		if (entry.isDirectory())
			files.push(
				...(await collectFiles(path.join(directory, entry.name), relativePath)),
			);
		else if (entry.isFile() && entry.name !== ".gitkeep")
			files.push(relativePath);
	}
	return files.sort((left, right) => left.localeCompare(right));
}
