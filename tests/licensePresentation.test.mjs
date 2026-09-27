import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
	contactLines,
	npmContacts,
	renderHtmlDocument,
} from "../scripts/license_presentation.mjs";

describe("License presentation", () => {
	it("keeps authors separate from publishers and preserves contact provenance", () => {
		const contacts = npmContacts({
			author: "Example <author@example.org> (https://example.org)",
			maintainers: [{ name: "Maintainer" }],
		});
		expect(contacts[0]).toEqual({
			role: "Author",
			name: "Example",
			email: "author@example.org",
			source: "package.json: author",
		});
		expect(contactLines(contacts)).toEqual([
			"Author: Example",
			"Author email: author@example.org",
			"Metadata source: package.json: author",
			"Maintainer: Maintainer",
			"Metadata source: package.json: maintainers",
		]);
		expect(
			contactLines(
				npmContacts({
					publisher: { name: "Publisher", email: "contact@example.org" },
				}),
			),
		).toContain("Publisher email: contact@example.org");
	});
	it("renders every component and legal file as inert text in collapsible sections", () => {
		const hostileText =
			'<script>alert("x")</script> & <notice>copyright</notice>';
		const document = new JSDOM(
			renderHtmlDocument(
				[
					{
						key: "package<one>@1",
						license: "MIT",
						legalFiles: [
							{ name: "LICENSE", text: hostileText },
							{ name: "NOTICE", text: "npm notice" },
						],
						licenseConflict: { explanation: "conflict explanation" },
						licenseFileFallback: {
							sourceKey: "fallback",
							explanation: "fallback explanation",
						},
					},
				],
				[
					{
						coordinate: "group:artifact:1",
						license: "Apache-2.0",
						licenseNotices: "Android license",
						embeddedNoticeFiles: [
							{ path: "META-INF/NOTICE", text: "Android notice" },
						],
					},
				],
			),
		).window.document;
		const sections = [...document.querySelectorAll("details")];
		expect(sections.map((section) => section.dataset.component)).toEqual([
			"package<one>@1",
			"group:artifact:1",
		]);
		expect(
			sections.every(
				(section) => section.querySelector("summary") && !section.open,
			),
		).toBe(true);
		expect(
			[...document.querySelectorAll("pre")].map(
				(element) => element.textContent,
			),
		).toEqual([hostileText, "npm notice", "Android license", "Android notice"]);
		expect(document.querySelector("script, notice")).toBeNull();
		expect(
			document.querySelector("style, link[rel='stylesheet'], [style]"),
		).toBeNull();
		expect(document.body.textContent).not.toContain("Not specified");
		expect(sections[0].textContent).toContain("conflict explanation");
		expect(sections[0].textContent).toContain("fallback explanation");
	});
});
