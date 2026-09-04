import { readFile } from "node:fs/promises";
import path from "node:path";
import {
	type ImageAssetCategory,
	type SupportedImageMimeType,
	validateImageId,
} from "../application/ports/imageResourceStorage";

export type DevImageFile = {
	bytes: Uint8Array;
	mimeType: SupportedImageMimeType;
};

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"] as const;

/** Server-seitiger Dev-Adapter. Sein lokaler Pfad verlässt src/storage nie. */
export class DevImageResourceStorage {
	async readImage(
		category: ImageAssetCategory,
		imageId: string,
		isExternal: boolean,
	): Promise<DevImageFile | undefined> {
		if (isExternal) return undefined;
		validateImageId(imageId);
		const directory = path.resolve(process.cwd(), "dev-data/assets", category);
		for (const extension of IMAGE_EXTENSIONS) {
			try {
				const bytes = await readFile(
					path.join(directory, `${imageId}${extension}`),
				);
				const mimeType = detectSupportedImageMimeType(bytes);
				if (!mimeType || mimeType !== mimeTypeForExtension(extension))
					throw new Error(
						`Bilddatei "${imageId}${extension}" hat eine ungültige Signatur.`,
					);
				return { bytes, mimeType };
			} catch (error) {
				if (!hasCode(error, "ENOENT")) throw error;
			}
		}
		return undefined;
	}
}

export function detectSupportedImageMimeType(
	bytes: Uint8Array,
): SupportedImageMimeType | undefined {
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	)
		return "image/png";
	if (
		bytes.length >= 3 &&
		bytes[0] === 0xff &&
		bytes[1] === 0xd8 &&
		bytes[2] === 0xff
	)
		return "image/jpeg";
	if (
		bytes.length >= 12 &&
		ascii(bytes, 0, 4) === "RIFF" &&
		ascii(bytes, 8, 12) === "WEBP"
	)
		return "image/webp";
	return undefined;
}

function mimeTypeForExtension(extension: string): SupportedImageMimeType {
	if (extension === ".png") return "image/png";
	if (extension === ".webp") return "image/webp";
	return "image/jpeg";
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
	return String.fromCharCode(...bytes.slice(start, end));
}

function hasCode(error: unknown, code: string): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === code
	);
}
