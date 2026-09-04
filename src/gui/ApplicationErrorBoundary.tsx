import { Component, type ErrorInfo, type ReactNode } from "react";
import { createGuiErrorPresentation } from "./applicationFailurePresentation";
import { createGuiTranslator } from "./i18n/translate";
import { TechnicalErrorDetails } from "./TechnicalErrorDetails";

export type ApplicationErrorBoundaryProps = {
	children: ReactNode;
	language?: string;
};

type ApplicationErrorBoundaryState = {
	error?: unknown;
};

export class ApplicationErrorBoundary extends Component<
	ApplicationErrorBoundaryProps,
	ApplicationErrorBoundaryState
> {
	state: ApplicationErrorBoundaryState = {};

	static getDerivedStateFromError(
		error: unknown,
	): ApplicationErrorBoundaryState {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		console.error("Unerwarteter Fehler in der Benutzeroberfläche", error, info);
	}

	render(): ReactNode {
		if (!this.state.error) return this.props.children;
		const language = this.props.language ?? "de";
		const t = createGuiTranslator(language);
		const error = createGuiErrorPresentation(this.state.error, t);

		return (
			<main className="app-shell error-fallback-shell">
				<section className="error-fallback" role="alert">
					<p className="eyebrow">{t("errorBoundary.eyebrow")}</p>
					<h1>{t("errorBoundary.title")}</h1>
					<p>{error.message}</p>
					{error.technicalDetails ? (
						<TechnicalErrorDetails
							details={error.technicalDetails}
							language={language}
						/>
					) : null}
					<button
						type="button"
						onClick={() => this.setState({ error: undefined })}
					>
						{t("errorBoundary.retry")}
					</button>
				</section>
			</main>
		);
	}
}
