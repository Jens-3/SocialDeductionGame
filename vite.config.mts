import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { isImageAssetCategory } from "./src/application/ports/imageResourceStorage";
import type { DataFileCategory } from "./src/persistence/ports/dataFileStorage";
import { isRecoverableStorageWriteError } from "./src/persistence/ports/dataFileStorage";
import { DevDataFileStorage } from "./src/storage/dataFileStorage.dev";
import { initializeDevDataFromBundle } from "./src/storage/devSeed";
import { DevImageResourceStorage } from "./src/storage/imageResourceStorage.dev";

export default defineConfig({
	plugins: [react(), devGameFilesPlugin()],
	define: {
		__DEV__: "import.meta.env.DEV",
	},
	server: {
		host: "127.0.0.1",
	},
	preview: {
		host: "127.0.0.1",
	},
	build: {
		chunkSizeWarningLimit: 1024,
	},
});

function devGameFilesPlugin(): Plugin {
	const storage = new DevDataFileStorage();
	const imageStorage = new DevImageResourceStorage();
	const installMiddleware = async (
		server: {
			middlewares: {
				use: (
					handler: (
						request: import("node:http").IncomingMessage,
						response: import("node:http").ServerResponse,
						next: () => void,
					) => void,
				) => void;
			};
		},
		showLibraryMessage: boolean,
	) => {
		const resetLibrary = process.env.SDG_DEV_RESET_LIBRARY === "1";
		await initializeDevDataFromBundle({ resetLibrary });
		if (showLibraryMessage)
			console.info(
				resetLibrary
					? "[info] Development library reset from app-seed/library.json."
					: "[info] Reset the development library with: pnpm run dev --reset-library",
			);
		server.middlewares.use((request, response, next) => {
			void handleDevGameRequest(request, response, next, storage, imageStorage);
		});
	};
	return {
		name: "dev-game-files",
		configureServer: (server) => installMiddleware(server, true),
		configurePreviewServer: (server) => installMiddleware(server, false),
	};
}

async function handleDevGameRequest(
	request: import("node:http").IncomingMessage,
	response: import("node:http").ServerResponse,
	next: () => void,
	storage: DevDataFileStorage,
	imageStorage: DevImageResourceStorage,
): Promise<void> {
	const requestUrl = new URL(request.url ?? "/", "http://localhost");
	const isExternalImageRequest =
		requestUrl.searchParams.get("external") === "1";

	try {
		if (
			request.method === "PATCH" &&
			requestUrl.pathname === "/api/dev/storage-command"
		) {
			const commandId = requestUrl.searchParams.get("commandId");
			const decision = requestUrl.searchParams.get("decision");
			if (
				!commandId ||
				(decision !== "retry" &&
					decision !== "finishLater" &&
					decision !== "keepOld" &&
					decision !== "keepNew" &&
					decision !== "keepBoth" &&
					decision !== "cancel" &&
					decision !== "overwrite")
			)
				throw new Error("Ungültige Entscheidung für den Storage-Befehl.");
			const continuation =
				requestUrl.searchParams.get("continuation") === "1"
					? {
							file:
								dataFileReferenceFromUrl(requestUrl) ??
								(() => {
									throw new Error("Fortsetzungsdatei fehlt.");
								})(),
							bytes: await readRequestBytes(request),
						}
					: undefined;
			const status = await storage.continueInternalCommand(
				commandId,
				decision,
				continuation,
			);
			return sendJson(response, 200, { status });
		}
		if (requestUrl.pathname === "/api/dev/storage-recoveries") {
			if (request.method === "GET") {
				return sendJson(
					response,
					200,
					(
						await storage.listRecoveries(
							dataFileCategoryFromOptionalUrl(requestUrl),
						)
					).map(
						({
							category,
							recoveryKey,
							fileName,
							recoverySource,
							oldBytes,
							newBytes,
						}) => ({
							category,
							recoveryKey,
							fileName,
							...(recoverySource ? { recoverySource } : {}),
							oldBytesBase64: Buffer.from(oldBytes).toString("base64"),
							...(newBytes
								? {
										newBytesBase64: Buffer.from(newBytes).toString("base64"),
									}
								: {}),
						}),
					),
				);
			}
			if (request.method === "POST") {
				const recoveryKey = requestUrl.searchParams.get("recoveryKey");
				if (!recoveryKey) throw new Error("Recovery-Schlüssel fehlt.");
				const result = await storage.requestRecovery(recoveryKey);
				return sendJson(
					response,
					200,
					result.status === "discarded"
						? result
						: {
								status: result.status,
								commandId: result.commandId,
								candidate: encodeRecoveryCandidate(result.candidate),
							},
				);
			}
			return next();
		}
		const imageMatch = requestUrl.pathname.match(
			/^\/api\/dev\/assets\/([^/]+)\/([^/]+)$/,
		);
		if (imageMatch && (request.method === "HEAD" || request.method === "GET")) {
			const category = decodeURIComponent(imageMatch[1] ?? "");
			const imageId = decodeURIComponent(imageMatch[2] ?? "");
			if (!isImageAssetCategory(category))
				return sendJson(response, 404, {
					error: "Asset-Kategorie nicht gefunden.",
				});
			const image = await imageStorage.readImage(
				category,
				imageId,
				isExternalImageRequest,
			);
			if (!image)
				return sendJson(response, 404, { error: "Bild nicht gefunden." });
			response.statusCode = 200;
			response.setHeader("Content-Type", image.mimeType);
			response.setHeader("Content-Length", String(image.bytes.byteLength));
			response.setHeader("Cache-Control", "no-cache");
			if (request.method === "HEAD") response.end();
			else response.end(image.bytes);
			return;
		}
		if (requestUrl.pathname !== "/api/dev/data-files") return next();
		const file = dataFileReferenceFromUrl(requestUrl);
		if (request.method === "GET" && !file) {
			const category = dataFileCategoryFromUrl(requestUrl);
			if (requestUrl.searchParams.get("names") === "1") {
				if (category === "library")
					throw new Error("Für die Library gibt es keine Dateinamenliste.");
				return sendJson(
					response,
					200,
					await storage.listInternalFileNames(category),
				);
			}
			if (requestUrl.searchParams.get("metadata") === "1")
				return sendJson(
					response,
					200,
					await storage.listInternalFiles(category),
				);
			return sendJson(
				response,
				200,
				(await storage.readAllInternal(category)).map(
					({ category: storedCategory, fileName, bytes }) => ({
						category: storedCategory,
						fileName,
						bytesBase64: Buffer.from(bytes).toString("base64"),
					}),
				),
			);
		}
		if (!file) throw new Error("Dateiname fehlt.");
		if (request.method === "GET") {
			const requestedVersion = requestUrl.searchParams.get("version");
			if (
				requestedVersion !== null &&
				requestedVersion !== "primary" &&
				requestedVersion !== "backup"
			)
				throw new Error("Ungültige Datei-Version.");
			const result = await storage.readInternal(
				file,
				requestedVersion ?? "primary",
			);
			if (result.status === "success") return sendBytes(response, result.bytes);
			return sendJson(
				response,
				result.error.reason === "notFound"
					? 404
					: result.error.reason === "unreadable"
						? 422
						: 503,
				result,
			);
		}
		if (request.method === "PUT") {
			const previousFileName = requestUrl.searchParams.get("previousFileName");
			const previousCategory = requestUrl.searchParams.get("previousCategory");
			if (
				previousCategory !== null &&
				previousCategory !== "game" &&
				previousCategory !== "template" &&
				previousCategory !== "library"
			)
				throw new Error("Ungültige vorherige Datei-Kategorie.");
			await storage.writeInternal(file, await readRequestBytes(request), {
				createOnly: requestUrl.searchParams.get("createOnly") === "1",
				backup: requestUrl.searchParams.get("backup") === "1",
				...(previousFileName && previousCategory
					? {
							previousFile: {
								category: previousCategory,
								fileName: previousFileName,
							},
						}
					: {}),
			});
			return sendJson(response, 200, { ok: true });
		}
		if (request.method === "DELETE") {
			await storage.deleteInternal(file, {
				includeBackup: requestUrl.searchParams.get("includeBackup") === "1",
				includeRecovery: requestUrl.searchParams.get("includeRecovery") === "1",
			});
			return sendJson(response, 200, { ok: true });
		}
		if (request.method === "PATCH") {
			const newFileName = requestUrl.searchParams.get("newFileName");
			const newCategory = requestUrl.searchParams.get("newCategory");
			if (!newFileName) throw new Error("Neuer Dateiname fehlt.");
			if (newCategory !== "game" && newCategory !== "template")
				throw new Error("Ungültige neue Datei-Kategorie.");
			await storage.renameInternal(file, {
				category: newCategory,
				fileName: newFileName,
			});
			return sendJson(response, 200, { ok: true });
		}
		return next();
	} catch (error) {
		const recoverable = isRecoverableStorageWriteError(error);
		return sendJson(response, recoverable ? 409 : 404, {
			error: error instanceof Error ? error.message : String(error),
			...(recoverable
				? {
						code: error.code,
						commandId: error.commandId,
						reason: error.reason,
					}
				: {}),
		});
	}
}

function encodeRecoveryCandidate(candidate: {
	category: DataFileCategory;
	recoveryKey: string;
	fileName: string;
	recoverySource?: "temporary" | "backup";
	oldBytes: Uint8Array;
	newBytes?: Uint8Array;
}) {
	return {
		category: candidate.category,
		recoveryKey: candidate.recoveryKey,
		fileName: candidate.fileName,
		...(candidate.recoverySource
			? { recoverySource: candidate.recoverySource }
			: {}),
		oldBytesBase64: Buffer.from(candidate.oldBytes).toString("base64"),
		...(candidate.newBytes
			? { newBytesBase64: Buffer.from(candidate.newBytes).toString("base64") }
			: {}),
	};
}

function dataFileCategoryFromUrl(requestUrl: URL): DataFileCategory {
	const category = requestUrl.searchParams.get("category");
	if (category !== "library" && category !== "template" && category !== "game")
		throw new Error("Ungültige Datei-Kategorie.");
	return category;
}

function dataFileCategoryFromOptionalUrl(
	requestUrl: URL,
): DataFileCategory | undefined {
	return requestUrl.searchParams.has("category")
		? dataFileCategoryFromUrl(requestUrl)
		: undefined;
}

function dataFileReferenceFromUrl(requestUrl: URL):
	| {
			category: DataFileCategory;
			fileName: string;
	  }
	| undefined {
	const fileName = requestUrl.searchParams.get("fileName");
	if (!fileName) return undefined;
	return {
		category: dataFileCategoryFromUrl(requestUrl),
		fileName,
	};
}

async function readRequestBytes(
	request: import("node:http").IncomingMessage,
): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	for await (const chunk of request) {
		const value: unknown = chunk;
		if (typeof value === "string") chunks.push(Buffer.from(value));
		else if (value instanceof Uint8Array) chunks.push(value);
		else throw new Error("Ungültige Schreibdaten empfangen.");
	}
	return Buffer.concat(chunks);
}

function sendBytes(
	response: import("node:http").ServerResponse,
	bytes: Uint8Array,
): void {
	response.statusCode = 200;
	response.setHeader("Content-Type", "application/octet-stream");
	response.end(bytes);
}

function sendJson(
	response: import("node:http").ServerResponse,
	statusCode: number,
	value: unknown,
): void {
	response.statusCode = statusCode;
	response.setHeader("Content-Type", "application/json; charset=utf-8");
	response.end(JSON.stringify(value));
}
