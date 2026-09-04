export const SUPPORTED_IMAGE_MIME_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
] as const;

export type SupportedImageMimeType =
	(typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

export const IMAGE_ASSET_CATEGORIES = [
	"backgrounds",
	"roles",
	"statuses",
	"teams",
] as const;

export type ImageAssetCategory = (typeof IMAGE_ASSET_CATEGORIES)[number];

export type ImageResourceRequest = {
	category: ImageAssetCategory;
	imageId: string;
	isExternal: boolean;
};

/** Vom jeweiligen Plattform-Storage bereits für die GUI aufgelöste Ressource. */
export type StoredImageResource = {
	source: string;
	mimeType: SupportedImageMimeType;
	cacheKey?: string;
};

export interface ImageResourceStorage {
	resolveImage(
		request: ImageResourceRequest,
	): Promise<StoredImageResource | undefined>;
}

export function isImageAssetCategory(
	value: string,
): value is ImageAssetCategory {
	return (IMAGE_ASSET_CATEGORIES as readonly string[]).includes(value);
}

export function isSupportedImageMimeType(
	value: string,
): value is SupportedImageMimeType {
	return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

export function validateImageId(imageId: string): void {
	if (!/^[a-z][a-z0-9_]*$/u.test(imageId))
		throw new Error(
			"imageId muss mit einem Kleinbuchstaben beginnen und darf nur Kleinbuchstaben, Zahlen und Unterstriche enthalten.",
		);
}
