import {
	type ImageResourceRequest,
	type ImageResourceStorage,
	type StoredImageResource,
	validateImageId,
} from "../application/ports/imageResourceStorage";
import { capacitorBundleUrl } from "./capacitorDataFileStorage";

const EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

export class CapacitorImageResourceStorage implements ImageResourceStorage {
	async resolveImage(
		request: ImageResourceRequest,
	): Promise<StoredImageResource | undefined> {
		if (request.isExternal) return undefined;
		validateImageId(request.imageId);
		for (const extension of EXTENSIONS) {
			const source = capacitorBundleUrl(
				`assets/${request.category}/${request.imageId}.${extension}`,
			);
			const response = await fetch(source, { method: "HEAD" });
			if (response.status === 404) continue;
			if (!response.ok)
				throw new Error(
					`Bildressource konnte nicht aufgelöst werden (${response.status}).`,
				);
			return {
				source,
				mimeType:
					extension === "png"
						? "image/png"
						: extension === "webp"
							? "image/webp"
							: "image/jpeg",
				cacheKey: response.headers.get("ETag") ?? source,
			};
		}
		return undefined;
	}
}
