import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "./fileByteStorage.dev";

const DEV_DATA_ROOT = "dev-data";
const SEED_ROOT = "app-seed";
const LIBRARY_FILE = "library.json";
const LIBRARY_RECOVERY_FILES = [
	"library.backup.json",
	"library.temp.json",
] as const;

type SeedManifest = Readonly<{
	files: readonly string[];
	assets: readonly string[];
}>;

export async function initializeDevDataFromBundle(
	options: { resetLibrary?: boolean } = {},
): Promise<void> {
	const targetRoot = path.resolve(DEV_DATA_ROOT);
	const sourceRoot = path.resolve(SEED_ROOT);
	const manifest = JSON.parse(
		await readFile(path.join(sourceRoot, "manifest.json"), "utf8"),
	) as unknown;
	if (!isSeedManifest(manifest))
		throw new Error("app-seed/manifest.json ist ungültig.");

	await mkdir(targetRoot, { recursive: true });
	for (const relativePath of [...manifest.files, ...manifest.assets]) {
		const targetPath = path.join(targetRoot, ...relativePath.split("/"));
		const resetThisFile =
			options.resetLibrary === true && relativePath === LIBRARY_FILE;
		if (!resetThisFile && (await pathExists(targetPath))) continue;
		await mkdir(path.dirname(targetPath), { recursive: true });
		await copyFile(
			path.join(sourceRoot, ...relativePath.split("/")),
			targetPath,
		);
	}

	if (options.resetLibrary)
		await Promise.all(
			LIBRARY_RECOVERY_FILES.map((fileName) =>
				rm(path.join(targetRoot, fileName), { force: true }),
			),
		);
	// Migration vom früheren markerbasierten Dev-Seed.
	await rm(path.join(targetRoot, ".initial-data-copied"), { force: true });
}

function isSeedManifest(value: unknown): value is SeedManifest {
	return (
		typeof value === "object" &&
		value !== null &&
		"files" in value &&
		Array.isArray(value.files) &&
		value.files.every(isSafeRelativePath) &&
		"assets" in value &&
		Array.isArray(value.assets) &&
		value.assets.every(
			(relativePath) =>
				isSafeRelativePath(relativePath) && relativePath.startsWith("assets/"),
		)
	);
}

function isSafeRelativePath(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		!value.startsWith("/") &&
		!value.includes("\\") &&
		!value.split("/").some((part) => !part || part === "." || part === "..")
	);
}
