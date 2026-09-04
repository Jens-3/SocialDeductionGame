import { useState } from "react";
import { createGuiTranslator } from "./i18n/translate";

export function TechnicalErrorDetails({
	details,
	language = "de",
}: {
	details: string;
	language?: string;
}) {
	const t = createGuiTranslator(language);
	const [copied, setCopied] = useState(false);
	return (
		<details className="technical-error-details">
			<summary>{t("error.technicalDetails")}</summary>
			<pre>{details}</pre>
			<button
				type="button"
				onClick={() => {
					if (!navigator.clipboard) return;
					void navigator.clipboard
						.writeText(details)
						.then(() => setCopied(true))
						.catch(() => undefined);
				}}
			>
				{t(copied ? "error.details.copied" : "error.details.copy")}
			</button>
		</details>
	);
}
