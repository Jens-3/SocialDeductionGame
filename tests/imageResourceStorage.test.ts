// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserImageResourceStorage } from "../src/storage/browserImageResourceStorage";
import { CapacitorImageResourceStorage } from "../src/storage/capacitorImageResourceStorage";

afterEach(() => vi.unstubAllGlobals());

describe("BrowserImageResourceStorage", () => {
	it("löst eine vorhandene Ressource mit MIME-Typ und ETag auf", async () => {
		const fetchMock = vi.fn(() =>
			Promise.resolve(
				new Response(null, {
					status: 200,
					headers: {
						"Content-Type": "image/webp; charset=binary",
						ETag: '"asset-v2"',
					},
				}),
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			new BrowserImageResourceStorage().resolveImage({
				category: "backgrounds",
				imageId: "main menu",
				isExternal: true,
			}),
		).resolves.toEqual({
			source: "/api/dev/assets/backgrounds/main%20menu?external=1",
			mimeType: "image/webp",
			cacheKey: '"asset-v2"',
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/dev/assets/backgrounds/main%20menu?external=1",
			{ method: "HEAD" },
		);
	});

	it("liefert für eine fehlende Ressource undefined", async () => {
		vi.stubGlobal("fetch", () =>
			Promise.resolve(new Response(null, { status: 404 })),
		);

		await expect(
			new BrowserImageResourceStorage().resolveImage({
				category: "roles",
				imageId: "r_seer",
				isExternal: false,
			}),
		).resolves.toBeUndefined();
	});

	it("weist HTTP-Fehler und nicht unterstützte Bildtypen zurück", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 503 }))
			.mockResolvedValueOnce(
				new Response(null, {
					status: 200,
					headers: { "Content-Type": "image/gif" },
				}),
			);
		vi.stubGlobal("fetch", fetchMock);
		const storage = new BrowserImageResourceStorage();
		const request = {
			category: "roles" as const,
			imageId: "r_seer",
			isExternal: false,
		};

		await expect(storage.resolveImage(request)).rejects.toThrow("(503)");
		await expect(storage.resolveImage(request)).rejects.toThrow(
			"nicht unterstützten Bildtyp",
		);
	});
});

describe("CapacitorImageResourceStorage", () => {
	it("fragt interne Erweiterungen der Reihe nach ab", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 404 }))
			.mockResolvedValueOnce(
				new Response(null, {
					status: 200,
					headers: { ETag: '"native-v1"' },
				}),
			);
		vi.stubGlobal("fetch", fetchMock);
		const storage = new CapacitorImageResourceStorage();
		const expectedSource = new URL(
			"native-seed/assets/roles/r_seer.jpg",
			document.baseURI,
		).toString();

		await expect(
			storage.resolveImage({
				category: "roles",
				imageId: "r_seer",
				isExternal: false,
			}),
		).resolves.toEqual({
			source: expectedSource,
			mimeType: "image/jpeg",
			cacheKey: '"native-v1"',
		});
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			new URL(
				"native-seed/assets/roles/r_seer.png",
				document.baseURI,
			).toString(),
			{ method: "HEAD" },
		);
		expect(fetchMock).toHaveBeenNthCalledWith(2, expectedSource, {
			method: "HEAD",
		});
	});

	it("überspringt externe Ressourcen ohne Anfrage", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			new CapacitorImageResourceStorage().resolveImage({
				category: "teams",
				imageId: "t_good",
				isExternal: true,
			}),
		).resolves.toBeUndefined();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("validiert Bild-IDs vor dem Storage-Zugriff", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			new CapacitorImageResourceStorage().resolveImage({
				category: "statuses",
				imageId: "../secret",
				isExternal: false,
			}),
		).rejects.toThrow("imageId muss");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("liefert nach vier 404-Antworten undefined und meldet andere Fehler", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 404 }));
		vi.stubGlobal("fetch", fetchMock);
		const storage = new CapacitorImageResourceStorage();
		const request = {
			category: "statuses" as const,
			imageId: "d_poisoned",
			isExternal: false,
		};

		await expect(storage.resolveImage(request)).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledTimes(4);

		fetchMock
			.mockReset()
			.mockResolvedValue(new Response(null, { status: 500 }));
		await expect(storage.resolveImage(request)).rejects.toThrow("(500)");
	});
});
