import { useEffect, useMemo, useState } from "react";
import type { GamePreparationService } from "../application/gamePreparationService";
import type {
	GamePersistenceService,
	GameState,
	TemplateSummary,
} from "../application/gameUseCases";
import type {
	LibraryBrowseService,
	RuleSetSummary,
} from "../application/libraryUseCases";
import { sanitizeText } from "../shared/textSanitizer";
import {
	GuiDisplayError,
	guiErrorText,
	objectStoreReadProblemText,
} from "./applicationFailurePresentation";
import { useBackHandler } from "./backNavigation";
import { createGuiTranslator } from "./i18n/translate";
import { RoleDistributionFlow } from "./RoleDistributionFlow";

export type NewGameScreenProps = {
	onBack: () => void;
	onGamePrepared?: (game: GameState) => void;
	gamePreparationService?: GamePreparationService;
	gamePersistenceService?: GamePersistenceService;
	libraryBrowseService?: LibraryBrowseService;
	initialSelection?: { type: "ruleSet" | "template"; id: string };
	onSelectionChange?: (selection: {
		type: "ruleSet" | "template";
		id: string;
	}) => void;
	language?: string;
};

type StartingPoint = "ruleSet" | "template";
type NewGameStep = "details" | "distribution";

export function NewGameScreen({
	onBack,
	onGamePrepared,
	gamePreparationService,
	gamePersistenceService,
	libraryBrowseService,
	initialSelection,
	onSelectionChange,
	language = "de",
}: NewGameScreenProps) {
	const t = useMemo(() => createGuiTranslator(language), [language]);
	const [startingPoint, setStartingPoint] = useState<StartingPoint>(
		initialSelection?.type ?? "ruleSet",
	);
	const [playerCount, setPlayerCount] = useState(12);
	const [gameName, setGameName] = useState("");
	const [step, setStep] = useState<NewGameStep>("details");
	const [preparedGame, setPreparedGame] = useState<GameState>();
	const [error, setError] = useState<string>();
	const [ruleSets, setRuleSets] = useState<RuleSetSummary[]>([]);
	const [templates, setTemplates] = useState<TemplateSummary[]>([]);
	const [selectedRuleSetId, setSelectedRuleSetId] = useState(
		initialSelection?.type === "ruleSet" ? initialSelection.id : "",
	);
	const [selectedTemplateId, setSelectedTemplateId] = useState(
		initialSelection?.type === "template" ? initialSelection.id : "",
	);
	const [isLoadingSources, setIsLoadingSources] = useState(true);
	const [initialSelectionAtMount] = useState(initialSelection);
	const initialSelectionType = initialSelectionAtMount?.type;
	const initialSelectionId = initialSelectionAtMount?.id;
	useBackHandler(
		() => {
			if (step === "distribution") setStep("details");
			else onBack();
		},
		true,
		10,
	);

	useEffect(() => {
		let active = true;
		void Promise.all([
			libraryBrowseService?.listObjects("ruleSet"),
			gamePersistenceService?.listObjects("template"),
		])
			.then(([ruleSetResult, templateResult]) => {
				if (!active) return;
				if (ruleSetResult?.status === "expectedFailure")
					throw new Error(objectStoreReadProblemText(ruleSetResult.problem, t));
				if (templateResult?.status === "expectedFailure")
					throw new Error(
						objectStoreReadProblemText(templateResult.problem, t),
					);
				const nextRuleSets = ruleSetResult?.metadata ?? [];
				const nextTemplates = templateResult?.metadata ?? [];
				setRuleSets(nextRuleSets);
				setTemplates(nextTemplates);
				const hasInitialRuleSet =
					initialSelectionType === "ruleSet" &&
					nextRuleSets.some((ruleSet) => ruleSet.id === initialSelectionId);
				const hasInitialTemplate =
					initialSelectionType === "template" &&
					nextTemplates.some(
						(template) =>
							(template.storageKey ?? template.id) === initialSelectionId,
					);
				const nextStartingPoint: StartingPoint =
					hasInitialRuleSet ||
					(initialSelectionType === "ruleSet" && nextRuleSets.length > 0)
						? "ruleSet"
						: hasInitialTemplate ||
								(initialSelectionType === "template" &&
									nextTemplates.length > 0)
							? "template"
							: nextRuleSets.length > 0
								? "ruleSet"
								: nextTemplates.length > 0
									? "template"
									: "ruleSet";
				const nextRuleSetId = hasInitialRuleSet
					? (initialSelectionId ?? "")
					: (nextRuleSets[0]?.id ?? "");
				const nextTemplateId = hasInitialTemplate
					? (initialSelectionId ?? "")
					: (nextTemplates[0]?.storageKey ?? nextTemplates[0]?.id ?? "");
				setStartingPoint(nextStartingPoint);
				setSelectedRuleSetId(nextRuleSetId);
				setSelectedTemplateId(nextTemplateId);
				const nextSelectionId =
					nextStartingPoint === "ruleSet" ? nextRuleSetId : nextTemplateId;
				if (nextSelectionId)
					onSelectionChange?.({
						type: nextStartingPoint,
						id: nextSelectionId,
					});
				setIsLoadingSources(false);
			})
			.catch((cause: unknown) => {
				if (active) {
					setError(guiErrorText(cause, t));
					setIsLoadingSources(false);
				}
			});
		return () => {
			active = false;
		};
	}, [
		gamePersistenceService,
		initialSelectionId,
		initialSelectionType,
		libraryBrowseService,
		onSelectionChange,
		t,
	]);
	const selectStartingPoint = (type: StartingPoint) => {
		setStartingPoint(type);
		const id = type === "ruleSet" ? selectedRuleSetId : selectedTemplateId;
		if (id) onSelectionChange?.({ type, id });
	};

	const prepareGame = async () => {
		setError(undefined);
		try {
			let game: GameState;
			if (startingPoint === "ruleSet") {
				if (
					!gamePreparationService ||
					!libraryBrowseService ||
					!selectedRuleSetId
				)
					throw new GuiDisplayError(t("newGame.noRuleSetSelected"));
				game = gamePreparationService.createGameFromRuleSet({
					ruleSet: await libraryBrowseService.loadRuleSet(selectedRuleSetId),
					playerCount,
					name: gameName.trim() || undefined,
				});
			} else {
				if (!gamePersistenceService || !selectedTemplateId)
					throw new GuiDisplayError(t("newGame.noTemplateSelected"));
				const loaded = await gamePersistenceService.createGameFromTemplate(
					selectedTemplateId,
					gameName.trim() || undefined,
				);
				game = loaded.document;
			}
			if (startingPoint === "template") {
				finish(game);
				return;
			}
			setPreparedGame(game);
			setStep("distribution");
		} catch (cause) {
			setError(guiErrorText(cause, t));
		}
	};
	const finish = (game: GameState) => onGamePrepared?.(game);

	if (step === "distribution" && preparedGame) {
		return (
			<RoleDistributionFlow
				game={preparedGame}
				language={language}
				title={t("newGame.prepare")}
				onBack={() => setStep("details")}
				onManual={() => finish(preparedGame)}
				onDistribute={(mode, counts) =>
					finish(
						gamePreparationService
							? gamePreparationService.distributeRoles(
									preparedGame,
									mode,
									counts,
									language,
								)
							: preparedGame,
					)
				}
			/>
		);
	}

	return (
		<main className="app-shell form-shell">
			<section className="form-screen" aria-labelledby="new-game-title">
				<ScreenHeader
					title={t("newGame.title")}
					titleId="new-game-title"
					onBack={onBack}
					backLabel={t("common.back")}
				/>
				<form
					className="mobile-form"
					onSubmit={(event) => {
						event.preventDefault();
						void prepareGame();
					}}
				>
					<fieldset className="choice-group">
						<legend>{t("newGame.startingPoint")}</legend>
						<StartingPointChoice
							selected={startingPoint === "ruleSet"}
							title={t("newGame.useRuleSet", { count: ruleSets.length })}
							detail={t("newGame.ruleSetDetail")}
							onSelect={() => selectStartingPoint("ruleSet")}
						/>
						<StartingPointChoice
							selected={startingPoint === "template"}
							title={t("newGame.useTemplate", { count: templates.length })}
							detail={t("newGame.templateDetail")}
							onSelect={() => selectStartingPoint("template")}
						/>
					</fieldset>
					<label className="form-field">
						<span>
							{startingPoint === "ruleSet"
								? t("newGame.ruleSet")
								: t("newGame.template")}
						</span>
						<select
							data-testid="new-game-source"
							disabled={
								isLoadingSources ||
								(startingPoint === "ruleSet"
									? ruleSets.length === 0
									: templates.length === 0)
							}
							value={
								startingPoint === "ruleSet"
									? selectedRuleSetId
									: selectedTemplateId
							}
							onChange={(event) => {
								const id = event.target.value;
								if (startingPoint === "ruleSet") setSelectedRuleSetId(id);
								else setSelectedTemplateId(id);
								if (id) onSelectionChange?.({ type: startingPoint, id });
							}}
						>
							{(startingPoint === "ruleSet" ? ruleSets : templates).map(
								(entry) => {
									const entryKey =
										"storageKey" in entry
											? (entry.storageKey ?? entry.id)
											: entry.id;
									return (
										<option value={entryKey} key={entryKey}>
											{entry.name}
											{"restoredIndex" in entry && entry.restoredIndex
												? ` (${t("common.restored", { index: entry.restoredIndex })})`
												: ""}
										</option>
									);
								},
							)}
							{!isLoadingSources &&
							(startingPoint === "ruleSet" ? ruleSets : templates).length ===
								0 ? (
								<option value="">{t("newGame.noEntries")}</option>
							) : null}
						</select>
					</label>
					{!isLoadingSources &&
					(startingPoint === "ruleSet" ? ruleSets.length : templates.length) ===
						0 ? (
						<p className="empty-state">
							{startingPoint === "ruleSet"
								? t("newGame.noRuleSets")
								: t("newGame.noTemplates")}
						</p>
					) : null}
					{startingPoint === "ruleSet" ? (
						<label className="form-field">
							<span>{t("newGame.playerCount")}</span>
							<input
								data-testid="new-game-player-count"
								type="number"
								min="1"
								max="50"
								value={playerCount}
								onChange={(event) => setPlayerCount(event.target.valueAsNumber)}
							/>
						</label>
					) : null}
					<label className="form-field">
						<span>{t("newGame.gameName")}</span>
						<input
							data-testid="new-game-name"
							type="text"
							placeholder={t("newGame.generatedName")}
							value={gameName}
							onChange={(event) =>
								setGameName(sanitizeText(event.target.value))
							}
						/>
					</label>
					{error ? <p className="load-error">{error}</p> : null}
					<button
						data-testid="new-game-prepare"
						type="submit"
						disabled={
							isLoadingSources ||
							(startingPoint === "ruleSet"
								? !selectedRuleSetId
								: !selectedTemplateId)
						}
						className={`primary-form-button${
							isLoadingSources ||
							(
								startingPoint === "ruleSet"
									? !selectedRuleSetId
									: !selectedTemplateId
							)
								? " button-disabled"
								: ""
						}`}
					>
						{t("newGame.prepare")}
					</button>
				</form>
			</section>
		</main>
	);
}

function StartingPointChoice({
	selected,
	title,
	detail,
	onSelect,
}: {
	selected: boolean;
	title: string;
	detail: string;
	onSelect: () => void;
}) {
	return (
		<label className="choice-card">
			<input
				type="radio"
				name="starting-point"
				checked={selected}
				onChange={onSelect}
			/>
			<span>
				<strong>{title}</strong>
				<small>{detail}</small>
			</span>
		</label>
	);
}

function ScreenHeader({
	title,
	titleId,
	onBack,
	backLabel,
}: {
	title: string;
	titleId: string;
	onBack: () => void;
	backLabel: string;
}) {
	return (
		<header className="screen-header settings-header">
			<button
				type="button"
				data-testid="new-game-back"
				className="icon-button"
				onClick={onBack}
			>
				<span aria-hidden="true">‹</span>
				<span className="visually-hidden">{backLabel}</span>
			</button>
			<h1 id={titleId}>{title}</h1>
		</header>
	);
}
