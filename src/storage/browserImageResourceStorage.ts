import {
	type ImageResourceRequest,
	type ImageResourceStorage,
	isSupportedImageMimeType,
	type StoredImageResource,
} from "../application/ports/imageResourceStorage";

const IMAGE_API_PATH = "/api/dev/assets";

export class BrowserImageResourceStorage implements ImageResourceStorage {
	async resolveImage(
		request: ImageResourceRequest,
	): Promise<StoredImageResource | undefined> {
		const query = new URLSearchParams({
			external: request.isExternal ? "1" : "0",
		});
		const source = `${IMAGE_API_PATH}/${encodeURIComponent(request.category)}/${encodeURIComponent(request.imageId)}?${query}`;
		const response = await fetch(source, { method: "HEAD" });
		if (response.status === 404) return undefined;
		if (!response.ok)
			throw new Error(
				`Bildressource konnte nicht aufgelöst werden (${response.status}).`,
			);
		const mimeType = response.headers
			.get("Content-Type")
			?.split(";", 1)[0]
			?.trim();
		if (!mimeType || !isSupportedImageMimeType(mimeType))
			throw new Error("Storage lieferte einen nicht unterstützten Bildtyp.");
		return {
			source,
			mimeType,
			cacheKey: response.headers.get("ETag") ?? undefined,
		};
	}
}
