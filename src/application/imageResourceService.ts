import { AppearanceService } from "./appearanceService";
import { expectedApplicationError } from "./applicationError";
import {
	type ImageAssetCategory,
	type ImageResourceStorage,
	isSupportedImageMimeType,
	validateImageId,
} from "./ports/imageResourceStorage";
import type { ResolvedTheme } from "./ports/systemThemePort";

export type ImagePresentation = {
	source: string;
	mimeType: "image/png" | "image/jpeg" | "image/webp";
	cacheKey?: string;
};

export type BackgroundPlacement = "gameBoard" | "mainMenu";

const BACKGROUND_IMAGE_IDS: Record<
	BackgroundPlacement,
	Record<ResolvedTheme, string>
> = {
	mainMenu: {
		dark: "bg_main_menu_dark",
		light: "bg_main_menu_light",
	},
	gameBoard: {
		dark: "bg_game_dark",
		light: "bg_game_light",
	},
};

/**
 * Fachliche Durchreiche für Bilder. Die Domain überträgt keine Bildbytes,
 * sondern ausschließlich eine vom Storage darstellbar aufgelöste Quelle.
 */
export class ImageResourceService {
	readonly #storage: ImageResourceStorage;
	readonly #appearanceService: AppearanceService;

	constructor(
		storage: ImageResourceStorage,
		appearanceService: AppearanceService = new AppearanceService(),
	) {
		this.#storage = storage;
		this.#appearanceService = appearanceService;
	}

	async getBackground(
		placement: BackgroundPlacement,
	): Promise<ImagePresentation | undefined> {
		const theme = this.#appearanceService.getResolvedTheme();
		return this.getImage(
			"backgrounds",
			BACKGROUND_IMAGE_IDS[placement][theme],
			false,
		);
	}

	async getImage(
		category: ImageAssetCategory,
		imageId: string,
		isExternal = false,
	): Promise<ImagePresentation | undefined> {
		validateImageId(imageId);
		const resource = await this.#storage.resolveImage({
			category,
			imageId,
			isExternal,
		});
		if (!resource) return undefined;
		const receivedMimeType: string = resource.mimeType;
		if (!isSupportedImageMimeType(receivedMimeType))
			throw expectedApplicationError(
				"load",
				"image",
				"unsupportedMediaType",
				`mimeType=${receivedMimeType}`,
			);
		const source = resource.source.trim();
		if (!source || hasControlCharacter(source))
			throw expectedApplicationError("load", "image", "invalidResourceSource");
		if (/^javascript:/iu.test(source))
			throw expectedApplicationError("load", "image", "unsafeResourceSource");
		return {
			source,
			mimeType: receivedMimeType,
			cacheKey: resource.cacheKey,
		};
	}
}

function hasControlCharacter(value: string): boolean {
	return [...value].some((character) => {
		const codePoint = character.codePointAt(0) ?? 0;
		return codePoint <= 0x1f || codePoint === 0x7f;
	});
}
