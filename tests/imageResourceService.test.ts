import { describe, expect, it, vi } from "vitest";
import { AppearanceService } from "../src/application/appearanceService";
import { ImageResourceService } from "../src/application/imageResourceService";
import type { ImageResourceStorage } from "../src/application/ports/imageResourceStorage";
import { detectSupportedImageMimeType } from "../src/storage/imageResourceStorage.dev";

describe("ImageResourceService", () => {
	it("übersetzt Einsatzort und Theme in konkrete interne Storage-Anfragen", async () => {
		const resolveImage = vi.fn<ImageResourceStorage["resolveImage"]>(() =>
			Promise.resolve(undefined),
		);
		const appearanceService = new AppearanceService(undefined, "dark");
		const service = new ImageResourceService(
			{ resolveImage },
			appearanceService,
		);

		await service.getBackground("mainMenu");
		appearanceService.setThemePreference("light");
		await service.getBackground("mainMenu");
		appearanceService.setThemePreference("dark");
		await service.getBackground("gameBoard");
		appearanceService.setThemePreference("light");
		await service.getBackground("gameBoard");

		expect(resolveImage).toHaveBeenNthCalledWith(1, {
			category: "backgrounds",
			imageId: "bg_main_menu_dark",
			isExternal: false,
		});
		expect(resolveImage).toHaveBeenNthCalledWith(2, {
			category: "backgrounds",
			imageId: "bg_main_menu_light",
			isExternal: false,
		});
		expect(resolveImage).toHaveBeenNthCalledWith(3, {
			category: "backgrounds",
			imageId: "bg_game_dark",
			isExternal: false,
		});
		expect(resolveImage).toHaveBeenNthCalledWith(4, {
			category: "backgrounds",
			imageId: "bg_game_light",
			isExternal: false,
		});
	});

	it.each([
		["image/png" as const, "/api/dev/assets/roles/r_seer"],
		["image/jpeg" as const, "https://example.test/r_seer.jpg"],
		["image/webp" as const, "blob:https://example.test/image"],
	])(
		"reicht erlaubte Bildressourcen ohne Bildbytes weiter",
		async (mimeType, source) => {
			const storage: ImageResourceStorage = {
				resolveImage: () =>
					Promise.resolve({ source, mimeType, cacheKey: "v1" }),
			};

			await expect(
				new ImageResourceService(storage).getImage("roles", "r_seer"),
			).resolves.toEqual({
				source,
				mimeType,
				cacheKey: "v1",
			});
		},
	);

	it("fragt den Storage bei einer ungültigen Bild-ID nicht an", async () => {
		const resolveImage = vi.fn<ImageResourceStorage["resolveImage"]>();
		const service = new ImageResourceService({ resolveImage });

		await expect(service.getImage("roles", "../secret")).rejects.toThrow(
			"imageId muss",
		);
		expect(resolveImage).not.toHaveBeenCalled();
	});

	it("weist unsichere Quellen aus dem Storage zurück", async () => {
		const service = new ImageResourceService({
			resolveImage: () =>
				Promise.resolve({
					source: "javascript:alert(1)",
					mimeType: "image/png",
				}),
		});

		await expect(
			service.getImage("backgrounds", "image_test"),
		).rejects.toMatchObject({ reason: "unsafeResourceSource" });
	});
});

describe("Bildsignaturen", () => {
	it("erkennt PNG, JPEG und WebP anhand ihrer Signatur", () => {
		expect(
			detectSupportedImageMimeType(
				Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
			),
		).toBe("image/png");
		expect(
			detectSupportedImageMimeType(Uint8Array.from([0xff, 0xd8, 0xff])),
		).toBe("image/jpeg");
		expect(
			detectSupportedImageMimeType(new TextEncoder().encode("RIFF0000WEBP")),
		).toBe("image/webp");
	});

	it("akzeptiert keine unbekannte Signatur", () => {
		expect(
			detectSupportedImageMimeType(new TextEncoder().encode("GIF89a")),
		).toBeUndefined();
	});
});
