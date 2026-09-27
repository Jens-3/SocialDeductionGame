/* eslint-disable @eslint-react/dom-no-dangerously-set-innerhtml -- Only checked-in, escaped generator output is embedded. */
import { useState } from "react";
import licenseHtml from "../../THIRD_PARTY_LICENSES.html?raw";
import licenseText from "../../THIRD_PARTY_LICENSES.txt?raw";

// This document is generated at build time with escaped package metadata and
// legal texts. Embed only its main content, never a full document or user input.
const licenseContent = licenseHtml.match(/<main>([\s\S]*?)<\/main>/u)?.[1];
if (!licenseContent)
	throw new Error("Generated license HTML has no main content");
const markup = { __html: licenseContent };

export function ThirdPartyLicenseViews() {
	const [view, setView] = useState<"html" | "txt">("html");
	return (
		<>
			<div className="license-dialog__formats">
				<button
					type="button"
					aria-pressed={view === "html"}
					onClick={() => setView("html")}
				>
					HTML
				</button>
				<button
					type="button"
					aria-pressed={view === "txt"}
					onClick={() => setView("txt")}
				>
					TXT
				</button>
			</div>
			<div
				hidden={view !== "html"}
				className="license-dialog__html"
				lang="en"
				dir="ltr"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: Build-time generated HTML escapes every metadata and license value.
				dangerouslySetInnerHTML={markup}
			/>
			<pre
				hidden={view !== "txt"}
				className="license-dialog__text"
				lang="en"
				dir="ltr"
			>
				{licenseText}
			</pre>
		</>
	);
}
