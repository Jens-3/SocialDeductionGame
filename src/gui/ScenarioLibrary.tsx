import {
	type Ref,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	GamePersistenceService,
	GameState,
	LoadedGameDocument,
} from "../application/gameUseCases";
import type {
	LibraryBrowseService,
	RenameScenarioRequest,
	RuleSet,
	ScenarioImportResult,
	ScenarioImportService,
	ScenarioManagementService,
} from "../application/libraryUseCases";
import type { RuleSetExportService } from "../application/ruleSetExportService";
import {
	createUniqueScenarioId,
	createUniqueScenarioIdentity,
	type ScenarioEditorFactory,
	type ScenarioEditorSection,
	type ScenarioEditorSession,
	suggestScenarioCopy,
} from "../application/scenarioEditor";
import {
	decodeRoleUnicodeSymbol,
	getObjectSerializationErrorDetails,
	getScenarioDisplayName,
} from "../application/scenarioPresentation";
import { sanitizeText } from "../shared/textSanitizer";
import {
	applicationFailureReasonText,
	GuiDisplayError,
	guiErrorText,
	objectReadProblemText,
	objectStoreReadProblemText,
} from "./applicationFailurePresentation";
import { applicationObjectSuccessText } from "./applicationSuccessPresentation";
import { useBackHandler } from "./backNavigation";
import { ColorField } from "./ColorField";
import { createGuiTranslator } from "./i18n/translate";
import { ModalDialog } from "./ModalDialog";

export type ScenarioLibraryProps = {
	editorFactory?: ScenarioEditorFactory;
	language?: string;
	active?: boolean;
	onBack: () => void;
	libraryBrowseService?: LibraryBrowseService;
	scenarioImportService?: ScenarioImportService;
	scenarioManagementService?: ScenarioManagementService;
	ruleSetExportService?: RuleSetExportService;
	gamePersistenceService?: GamePersistenceService;
	onStartScenario?: (type: ScenarioType, id: string) => void;
	canShare?: boolean;
};

const CLICK_COOLDOWN_MS = 500;

function useClickCooldown(durationMs = CLICK_COOLDOWN_MS): {
	locked: boolean;
	run(action: () => void): boolean;
} {
	const lockedRef = useRef(false);
	const timerRef = useRef<number | undefined>(undefined);
	const [locked, setLocked] = useState(false);
	useEffect(
		() => () => {
			if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
		},
		[],
	);
	return {
		locked,
		run(action) {
			if (lockedRef.current) return false;
			lockedRef.current = true;
			setLocked(true);
			timerRef.current = window.setTimeout(() => {
				lockedRef.current = false;
				timerRef.current = undefined;
				setLocked(false);
			}, durationMs);
			action();
			return true;
		},
	};
}

type ScenarioType = "ruleSet" | "template";
type ScenarioFilter = "all" | ScenarioType;

type ScenarioSummary = {
	storageKey: string;
	id: string;
	restoredIndex?: number;
	name: string;
	names: Record<string, string>;
	type: ScenarioType;
	metadata: string;
	detail: string;
};

function createRenameScenarioRequest(
	type: ScenarioType,
	oldId: string,
	newName: string,
	document: RuleSet | GameState,
): RenameScenarioRequest {
	if (type === "ruleSet") {
		if (isGameState(document))
			throw new Error("Der Regelwerk-Editor lieferte eine Vorlage.");
		return { type, oldId, newName, document };
	}
	if (!isGameState(document))
		throw new Error("Der Vorlagen-Editor lieferte ein Regelwerk.");
	return { type, oldId, newName, document };
}

function isGameState(document: RuleSet | GameState): document is GameState {
	return "playersById" in document && "seatOrder" in document;
}

function requireEditorFactory(
	factory: ScenarioEditorFactory | undefined,
): ScenarioEditorFactory {
	if (!factory) throw new Error("Der Szenario-Editor ist nicht initialisiert.");
	return factory;
}

const filters: ScenarioFilter[] = ["all", "ruleSet", "template"];

export function CurrentGameEditorScreen({
	game,
	editorFactory,
	language = "de",
	onSave,
	onCancel,
}: {
	game: LoadedGameDocument;
	editorFactory?: ScenarioEditorFactory;
	language?: string;
	onSave: (document: GameState) => void;
	onCancel: () => void;
}) {
	const t = createGuiTranslator(language);
	const scenario: ScenarioSummary = {
		storageKey: game.storageKey ?? game.id,
		id: game.id,
		name: game.displayName,
		names: {},
		type: "template",
		metadata: t("game.currentGame"),
		detail: t("scenarioEditor.workingCopy"),
	};
	return (
		<ScenarioDetailScreen
			editorFactory={editorFactory}
			language={language}
			scenario={scenario}
			data={game.document}
			onBack={onCancel}
			allScenarios={[]}
			isCurrentGame
			onSaveCurrentGame={onSave}
		/>
	);
}

async function readScenarioItems(
	libraryBrowseService?: LibraryBrowseService,
	gamePersistenceService?: GamePersistenceService,
	language = "de",
): Promise<ScenarioSummary[]> {
	const t = createGuiTranslator(language);
	const [ruleSetResult, templateResult] = await Promise.all([
		libraryBrowseService?.listObjects("ruleSet"),
		gamePersistenceService?.listObjects("template"),
	]);
	if (ruleSetResult?.status === "expectedFailure")
		throw new Error(objectStoreReadProblemText(ruleSetResult.problem, t));
	if (templateResult?.status === "expectedFailure")
		throw new Error(objectStoreReadProblemText(templateResult.problem, t));
	const ruleSets = ruleSetResult?.metadata ?? [];
	const ruleSetProblems = ruleSetResult?.problems ?? [];
	const templates = templateResult?.metadata ?? [];
	return [
		...ruleSets.map((entry) => ({
			storageKey: entry.id,
			id: entry.id,
			name: entry.name,
			names: { [language]: entry.name },
			type: "ruleSet" as const,
			metadata: t("scenarios.ruleSetMetadata", {
				version: entry.version,
				teams: entry.teamCount,
				roles: entry.roleCount,
			}),
			detail: "Library",
		})),
		...ruleSetProblems.map((problem) => ({
			storageKey: problem.id,
			id: problem.id,
			name: problem.id,
			names: { [language]: problem.id },
			type: "ruleSet" as const,
			metadata: t("scenarios.invalidRuleSet"),
			detail: objectReadProblemText(problem, t),
		})),
		...templates.map((entry) => ({
			storageKey: entry.storageKey ?? entry.id,
			id: entry.id,
			...(entry.restoredIndex ? { restoredIndex: entry.restoredIndex } : {}),
			name: entry.name,
			names: { [language]: entry.name },
			type: "template" as const,
			metadata: t("scenarios.templateMetadata", {
				count: entry.playerCount,
				ruleSet: entry.ruleSetName,
			}),
			detail: t("scenarios.savedAt", { date: entry.storedAt }),
		})),
	];
}

export function ScenarioLibrary({
	editorFactory,
	language = "de",
	active = true,
	onBack,
	libraryBrowseService,
	scenarioImportService,
	scenarioManagementService,
	ruleSetExportService,
	gamePersistenceService,
	onStartScenario,
	canShare = false,
}: ScenarioLibraryProps) {
	const t = useMemo(() => createGuiTranslator(language), [language]);
	const [filter, setFilter] = useState<ScenarioFilter>("all");
	const [scenarioItems, setScenarioItems] = useState<ScenarioSummary[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [activeScenarioId, setActiveScenarioId] = useState<string>();
	const [importMessage, setImportMessage] = useState<string>();
	const [importError, setImportError] = useState<string>();
	const [importErrorDetails, setImportErrorDetails] = useState<string>();
	const [importConflict, setImportConflict] =
		useState<Extract<ScenarioImportResult, { status: "decisionRequired" }>>();
	const [isResolvingImport, setIsResolvingImport] = useState(false);
	const resolvingImportRef = useRef(false);
	const [detailScenarioId, setDetailScenarioId] = useState<string>();
	const [detailData, setDetailData] = useState<RuleSet | GameState>();
	const [detailError, setDetailError] = useState<string>();
	const [draftScenario, setDraftScenario] = useState<ScenarioSummary>();
	const [actionMode, setActionMode] = useState<
		"rename" | "duplicate" | "delete"
	>();
	const [actionName, setActionName] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const detailRequestIdRef = useRef(0);
	const scenarioActionClick = useClickCooldown();
	const visibleScenarios = scenarioItems.filter(
		(scenario) => filter === "all" || scenario.type === filter,
	);
	const activeScenario = scenarioItems.find(
		(scenario) => scenario.storageKey === activeScenarioId,
	);

	useEffect(() => {
		let active = true;
		void readScenarioItems(
			libraryBrowseService,
			gamePersistenceService,
			language,
		)
			.then((items) => {
				if (!active) return;
				setScenarioItems(items);
				setIsLoading(false);
			})
			.catch((error: unknown) => {
				if (active) {
					setImportError(guiErrorText(error, t));
					setIsLoading(false);
				}
			});
		return () => {
			active = false;
		};
	}, [gamePersistenceService, language, libraryBrowseService, t]);

	const closeActionSheet = () => {
		setActiveScenarioId(undefined);
		setActionMode(undefined);
	};

	const openDetails = async (scenario: ScenarioSummary) => {
		const requestId = ++detailRequestIdRef.current;
		setDetailScenarioId(scenario.storageKey);
		setDetailData(undefined);
		setDetailError(undefined);
		try {
			const document =
				scenario.type === "ruleSet"
					? await libraryBrowseService?.loadRuleSet(scenario.id)
					: await gamePersistenceService?.loadTemplateDocument(
							scenario.storageKey,
						);
			if (detailRequestIdRef.current !== requestId) return;
			if (!document) throw new GuiDisplayError(t("scenarios.loadError"));
			setDetailData(document);
		} catch (error) {
			if (detailRequestIdRef.current !== requestId) return;
			setDetailError(guiErrorText(error, t));
		}
	};
	const closeDetails = () => {
		detailRequestIdRef.current++;
		setDetailScenarioId(undefined);
		setDetailData(undefined);
		setDetailError(undefined);
		setDraftScenario(undefined);
	};
	useBackHandler(
		() => (detailScenarioId ? closeDetails() : onBack()),
		active,
		10,
	);
	const loadScenarioEditor = async (
		scenario: ScenarioSummary,
	): Promise<ScenarioEditorSession> => {
		const document =
			scenario.type === "ruleSet"
				? await libraryBrowseService?.loadRuleSet(scenario.id)
				: await gamePersistenceService?.loadTemplateDocument(
						scenario.storageKey,
					);
		if (!document) throw new GuiDisplayError(t("scenarios.loadError"));
		return scenario.type === "ruleSet"
			? requireEditorFactory(editorFactory).fromRuleSet(
					document as RuleSet,
					language,
				)
			: requireEditorFactory(editorFactory).fromTemplate(
					document as GameState,
					language,
				);
	};
	const exportFromMenu = async (scenario: ScenarioSummary) => {
		if (!scenarioManagementService) return;
		setImportError(undefined);
		try {
			const editor = await loadScenarioEditor(scenario);
			const document = editor.toDocument();
			if (scenario.type === "ruleSet") {
				if (!ruleSetExportService)
					throw new GuiDisplayError(t("scenarios.exportUnsupported"));
				await ruleSetExportService.exportRuleSet(document as RuleSet);
			} else
				await scenarioManagementService.exportTemplate(document as GameState);
			setImportMessage(t("scenarios.exported", { name: scenario.name }));
			setActiveScenarioId(undefined);
		} catch (actionError) {
			if (
				actionError instanceof DOMException &&
				actionError.name === "AbortError"
			)
				return;
			setImportError(guiErrorText(actionError, t));
		}
	};
	const shareFromMenu = async (scenario: ScenarioSummary) => {
		if (!scenarioManagementService) return;
		setImportError(undefined);
		try {
			const document = (await loadScenarioEditor(scenario)).toDocument();
			if (scenario.type === "ruleSet") {
				if (!ruleSetExportService)
					throw new GuiDisplayError(t("scenarios.exportUnsupported"));
				await ruleSetExportService.shareRuleSet(document as RuleSet);
			} else
				await scenarioManagementService.shareTemplate(document as GameState);
			setImportMessage(t("scenarios.shared", { name: scenario.name }));
			setActiveScenarioId(undefined);
		} catch (actionError) {
			setImportError(guiErrorText(actionError, t));
		}
	};
	const submitScenarioAction = async (scenario: ScenarioSummary) => {
		if (!scenarioManagementService || !actionMode) return;
		if (scenario.restoredIndex && actionMode !== "duplicate") {
			setImportError(t("scenarios.restoredRestriction"));
			return;
		}
		setImportError(undefined);
		try {
			if (actionMode === "delete") {
				await scenarioManagementService.deleteScenario(
					scenario.type,
					scenario.id,
				);
				if (scenario.type === "template")
					gamePersistenceService?.clearBrowseCache();
				setScenarioItems((current) =>
					current.filter(
						(item) => !(item.type === scenario.type && item.id === scenario.id),
					),
				);
				setImportMessage(t("scenarios.deleted", { name: scenario.name }));
			} else {
				const editor = await loadScenarioEditor(scenario);
				if (actionMode === "rename") {
					const renamed = await scenarioManagementService.renameScenario(
						createRenameScenarioRequest(
							scenario.type,
							scenario.id,
							actionName,
							editor.toDocument(),
						),
					);
					if (scenario.type === "template")
						gamePersistenceService?.clearBrowseCache();
					setScenarioItems((current) =>
						current.map((item) =>
							item.type === scenario.type && item.id === scenario.id
								? {
										...item,
										storageKey: renamed.storageKey,
										id: renamed.id,
										name: renamed.name,
										names: { [language]: renamed.name },
									}
								: item,
						),
					);
					setImportMessage(t("scenarios.renamed", { name: renamed.name }));
				} else {
					const existing = scenarioItems
						.filter((item) => item.type === scenario.type)
						.map(({ id, name }) => ({ id, name }));
					const id = createUniqueScenarioId(
						actionName,
						scenario.type,
						existing.map((entry) => entry.id),
					);
					const document = editor.toDocument(actionName, id);
					if (scenario.type === "ruleSet")
						await scenarioManagementService.saveRuleSet(document as RuleSet);
					else {
						await scenarioManagementService.saveTemplate(document as GameState);
						gamePersistenceService?.clearBrowseCache();
					}
					const name = actionName.trim();
					setScenarioItems((current) => [
						...current,
						{
							...scenario,
							storageKey: id,
							id,
							restoredIndex: undefined,
							name,
							names: { [language]: name },
							detail: t("scenarios.duplicated"),
						},
					]);
					setImportMessage(t("scenarios.duplicatedMessage", { name }));
				}
			}
			setActiveScenarioId(undefined);
			setActionMode(undefined);
		} catch (actionError) {
			setImportError(guiErrorText(actionError, t));
		}
	};
	const resolveScenarioImport = async (
		resolution: "cancel" | "repair" | "keepBoth" | "overwrite",
	) => {
		if (!scenarioImportService || !importConflict || resolvingImportRef.current)
			return;
		resolvingImportRef.current = true;
		setIsResolvingImport(true);
		setImportError(undefined);
		try {
			const result = await scenarioImportService.resolveScenarioImport(
				importConflict.commandId,
				resolution,
			);
			if (!result) return;
			if (result.status === "decisionRequired") {
				setImportConflict(result);
				return;
			}
			setImportConflict(undefined);
			gamePersistenceService?.clearBrowseCache();
			setImportMessage(applicationObjectSuccessText(result, t));
			setScenarioItems(
				await readScenarioItems(
					libraryBrowseService,
					gamePersistenceService,
					language,
				),
			);
		} catch (error) {
			setImportError(guiErrorText(error, t));
		} finally {
			resolvingImportRef.current = false;
			setIsResolvingImport(false);
			if (resolution === "cancel") setImportConflict(undefined);
		}
	};
	const detailScenario =
		scenarioItems.find((item) => item.storageKey === detailScenarioId) ??
		(draftScenario?.storageKey === detailScenarioId
			? draftScenario
			: undefined);
	if (detailScenario) {
		if (!detailData) {
			return (
				<main className="app-shell scenario-detail-shell">
					<section className="scenario-detail">
						<header className="screen-header">
							<button
								type="button"
								className="icon-button"
								onClick={closeDetails}
								aria-label={t("common.back")}
							>
								‹
							</button>
							<h1>{detailScenario.name}</h1>
						</header>
						{detailError ? (
							<p className="load-error" role="alert">
								{detailError}
							</p>
						) : (
							<p className="empty-state">{t("scenarios.detailsReading")}</p>
						)}
					</section>
				</main>
			);
		}
		return (
			<ScenarioDetailScreen
				editorFactory={editorFactory}
				language={language}
				active={active}
				key={`${detailScenario.type}-${detailScenario.storageKey}`}
				scenario={detailScenario}
				data={detailData}
				error={detailError}
				onBack={closeDetails}
				onStart={() =>
					onStartScenario?.(detailScenario.type, detailScenario.id)
				}
				allScenarios={scenarioItems}
				scenarioManagementService={scenarioManagementService}
				ruleSetExportService={ruleSetExportService}
				gamePersistenceService={gamePersistenceService}
				canShare={canShare}
				isNew={draftScenario?.storageKey === detailScenario.storageKey}
				onSaved={(saved, savedDocument, continueWithCopy) => {
					setScenarioItems((current) => {
						const next = current.filter(
							(item) => !(item.type === saved.type && item.id === saved.id),
						);
						return [...next, saved];
					});
					setDraftScenario(undefined);
					if (continueWithCopy) {
						detailRequestIdRef.current++;
						setDetailData(savedDocument);
						setDetailError(undefined);
						setDetailScenarioId(saved.id);
					}
				}}
			/>
		);
	}

	return (
		<main className="app-shell library-shell">
			<section className="library-screen" aria-labelledby="library-title">
				<header className="screen-header">
					<button
						type="button"
						data-testid="scenarios-back"
						className="icon-button"
						onClick={onBack}
					>
						<span aria-hidden="true">‹</span>
						<span className="visually-hidden">{t("common.back")}</span>
					</button>
					<h1 id="library-title">{t("scenarios.title")}</h1>
					<button
						type="button"
						className="text-button"
						onClick={() => fileInputRef.current?.click()}
					>
						{t("common.import")}
					</button>
					<input
						ref={fileInputRef}
						type="file"
						accept=".json,.txt,application/json,text/plain"
						className="visually-hidden"
						aria-label={t("common.import")}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (!file || !scenarioImportService) return;
							setImportError(undefined);
							setImportErrorDetails(undefined);
							void scenarioImportService
								.importScenario(file)
								.then(async (result) => {
									if (result.status === "decisionRequired") {
										setImportConflict(result);
										return;
									}
									if (result.kind === "template")
										gamePersistenceService?.clearBrowseCache();
									setImportMessage(applicationObjectSuccessText(result, t));
									setScenarioItems(
										await readScenarioItems(
											libraryBrowseService,
											gamePersistenceService,
											language,
										),
									);
								})
								.catch((error: unknown) => {
									setImportError(guiErrorText(error, t));
									setImportErrorDetails(
										getObjectSerializationErrorDetails(error),
									);
								});
							event.target.value = "";
						}}
					/>
				</header>
				{importMessage ? (
					<p className="prototype-note" role="status">
						{importMessage}
					</p>
				) : null}
				{importError ? (
					<div className="load-error import-error" role="alert">
						<span>{importError}</span>
						{importErrorDetails ? (
							<details>
								<summary>{t("common.detailsParenthetical")}</summary>
								<pre>{importErrorDetails}</pre>
							</details>
						) : null}
					</div>
				) : null}
				{importConflict ? (
					<ModalDialog
						open
						onClose={() => void resolveScenarioImport("cancel")}
						role="alertdialog"
						labelledBy="scenario-import-conflict-title"
					>
						<h2 id="scenario-import-conflict-title">
							{importConflict.decisionKind === "serializationRepair"
								? t("scenarios.repairImportQuestion")
								: importConflict.type === "ruleSet"
									? t("scenarios.ruleSetExists")
									: t("scenarios.templateExists")}
						</h2>
						{importConflict.decisionKind === "serializationRepair" ? (
							<p>{applicationFailureReasonText(importConflict.reason, t)}</p>
						) : (
							<p>
								{t("scenarios.existingObject")}: {importConflict.existing.name}{" "}
								· {t("common.schemaVersion")}{" "}
								{importConflict.existing.schemaVersion ?? t("common.unknown")}
								<br />
								{t("scenarios.importedObject")}: {importConflict.imported.name}{" "}
								· {t("common.schemaVersion")}{" "}
								{importConflict.imported.schemaVersion ?? t("common.unknown")}
							</p>
						)}
						<div className="modal-actions">
							<button
								type="button"
								data-modal-initial-focus
								disabled={isResolvingImport}
								onClick={() => void resolveScenarioImport("cancel")}
							>
								{t("common.cancelImport")}
							</button>
							{importConflict.availableActions
								.filter((action) => action !== "cancel")
								.map((resolution) => (
									<button
										type="button"
										key={resolution}
										disabled={isResolvingImport}
										onClick={() => void resolveScenarioImport(resolution)}
									>
										{resolution === "repair"
											? t("common.tryRepair")
											: resolution === "keepBoth"
												? t("common.keepBoth")
												: t("scenarios.overwriteExisting")}
									</button>
								))}
						</div>
					</ModalDialog>
				) : null}

				<fieldset className="filter-bar">
					<legend className="visually-hidden">{t("scenarios.filter")}</legend>
					{filters.map((value) => (
						<button
							type="button"
							className="filter-button"
							aria-pressed={filter === value}
							key={value}
							onClick={() => setFilter(value)}
						>
							{t(
								value === "all"
									? "scenarios.filter.all"
									: value === "ruleSet"
										? "scenarios.filter.ruleSets"
										: "scenarios.filter.templates",
							)}
						</button>
					))}
				</fieldset>

				<ul className="scenario-list">
					{visibleScenarios.map((scenario) => (
						<li key={`${scenario.type}:${scenario.storageKey}`}>
							<article className="scenario-card">
								<button
									type="button"
									className="scenario-card__open"
									onClick={() => void openDetails(scenario)}
								>
									<span className="scenario-card__heading">
										<strong>
											{getScenarioDisplayName(scenario, language)}
										</strong>
										<span className={`type-badge type-badge--${scenario.type}`}>
											{scenario.type === "ruleSet"
												? t("scenarios.ruleSet")
												: t("scenarios.template")}
										</span>
										{scenario.restoredIndex ? (
											<span className="type-badge type-badge--template">
												{t("common.restored", {
													index: scenario.restoredIndex,
												})}
											</span>
										) : null}
									</span>
									<span>{scenario.metadata}</span>
								</button>
								<footer>
									<small>{scenario.detail}</small>
									<button
										type="button"
										className="more-button"
										aria-label={t("common.moreActionsFor", {
											name: scenario.name,
										})}
										aria-haspopup="dialog"
										aria-expanded={activeScenarioId === scenario.storageKey}
										onClick={() => setActiveScenarioId(scenario.storageKey)}
									>
										•••
									</button>
								</footer>
							</article>
						</li>
					))}
				</ul>
				{isLoading ? (
					<p className="empty-state">{t("scenarios.reading")}</p>
				) : null}
				{!isLoading && visibleScenarios.length === 0 ? (
					<p className="empty-state">{t("scenarios.empty")}</p>
				) : null}

				<button
					type="button"
					data-testid="scenarios-create"
					className="create-button"
					onClick={() => {
						const { id, name } = createUniqueScenarioIdentity(
							t("scenarios.newRuleSet"),
							"ruleSet",
							scenarioItems
								.filter((item) => item.type === "ruleSet")
								.map((item) => ({ id: item.id, name: item.name })),
						);
						const scenario: ScenarioSummary = {
							storageKey: id,
							id,
							name,
							names: { [language]: name },
							type: "ruleSet",
							metadata: t("scenarios.ruleSetMetadata", {
								version: 1,
								teams: 0,
								roles: 0,
							}),
							detail: t("scenarios.newWorkingCopy"),
						};
						setDraftScenario(scenario);
						setDetailData({
							id,
							name,
							version: 1,
							teams: [],
							roles: [],
							statuses: [],
						} satisfies RuleSet);
						setDetailError(undefined);
						setDetailScenarioId(id);
					}}
				>
					<span aria-hidden="true">＋</span> {t("scenarios.create")}
				</button>

				{activeScenario ? (
					<ModalDialog
						open
						onClose={closeActionSheet}
						className="action-sheet"
						labelledBy="action-sheet-title"
					>
						<header>
							<div>
								<small>{t("common.actionsFor")}</small>
								<h2 id="action-sheet-title">{activeScenario.name}</h2>
							</div>
							<button
								type="button"
								className="sheet-close-button"
								aria-label={t("common.close")}
								onClick={closeActionSheet}
							>
								×
							</button>
						</header>
						{actionMode ? (
							<form
								className="scenario-card-action-form"
								onSubmit={(event) => {
									event.preventDefault();
									scenarioActionClick.run(() => {
										void submitScenarioAction(activeScenario);
									});
								}}
							>
								{actionMode === "delete" ? (
									<p>
										{t("scenarios.deleteQuestion", {
											name: activeScenario.name,
										})}
									</p>
								) : (
									<label>
										{t("common.name")}
										<input
											required
											value={actionName}
											onChange={(event) =>
												setActionName(sanitizeText(event.target.value))
											}
										/>
									</label>
								)}
								<div>
									<button
										type="button"
										onClick={() => setActionMode(undefined)}
									>
										{t("common.cancel")}
									</button>
									<button
										type="submit"
										data-testid="scenario-delete-confirm"
										disabled={scenarioActionClick.locked}
										className={
											actionMode === "delete" ? "danger-action" : undefined
										}
									>
										{actionMode === "delete"
											? t("common.deletePermanently")
											: actionMode === "rename"
												? t("common.rename")
												: t("common.duplicate")}
									</button>
								</div>
							</form>
						) : (
							<div className="action-sheet-action-list action-sheet__actions">
								<button
									type="button"
									disabled={Boolean(activeScenario.restoredIndex)}
									className={
										activeScenario.restoredIndex ? "button-disabled" : undefined
									}
									onClick={() => {
										setActionName(activeScenario.name);
										setActionMode("rename");
									}}
								>
									{t("common.rename")}
								</button>
								<button
									type="button"
									onClick={() => {
										const existing = scenarioItems
											.filter((item) => item.type === activeScenario.type)
											.map(({ id, name }) => ({ id, name }));
										setActionName(
											suggestScenarioCopy(
												activeScenario.name,
												activeScenario.type,
												existing,
											).name,
										);
										setActionMode("duplicate");
									}}
								>
									{t("common.duplicate")}
								</button>
								<button
									type="button"
									onClick={() => void exportFromMenu(activeScenario)}
								>
									{t("common.export")}
								</button>
								{canShare ? (
									<button
										type="button"
										onClick={() => void shareFromMenu(activeScenario)}
									>
										{t("common.share")}
									</button>
								) : null}
								<button
									type="button"
									data-testid="scenario-delete"
									disabled={Boolean(activeScenario.restoredIndex)}
									className={`danger-action${
										activeScenario.restoredIndex ? " button-disabled" : ""
									}`}
									onClick={() => setActionMode("delete")}
								>
									{t("common.delete")}
								</button>
							</div>
						)}
					</ModalDialog>
				) : null}
			</section>
		</main>
	);
}

type ScenarioDetailScreenProps = {
	editorFactory?: ScenarioEditorFactory;
	language: string;
	scenario: ScenarioSummary;
	data: RuleSet | GameState;
	error?: string;
	onBack: () => void;
	allScenarios: ScenarioSummary[];
	scenarioManagementService?: ScenarioManagementService;
	ruleSetExportService?: RuleSetExportService;
	gamePersistenceService?: GamePersistenceService;
	isNew?: boolean;
	canShare?: boolean;
	active?: boolean;
} & (
	| {
			isCurrentGame: true;
			onSaveCurrentGame: (document: GameState) => void;
			onStart?: never;
			onSaved?: never;
	  }
	| {
			isCurrentGame?: false;
			onStart: () => void;
			onSaved: (
				scenario: ScenarioSummary,
				document: RuleSet | GameState,
				continueWithCopy: boolean,
			) => void;
			onSaveCurrentGame?: never;
	  }
);

type ScenarioObjectValues = {
	name: string;
	displayName: string | null;
	color: string | null;
	teamId: string;
	teamOrder: number;
	firstNightOrder: number | null;
	otherNightOrder: number | null;
	isUnique: boolean;
	unicodeEscaped: string | null;
	killsSomeone: boolean;
	resurrectSomeone: boolean;
	applyStatusEffect: string[];
	defaultDuration: number;
};

type ScenarioObjectFormHandle = {
	apply: () => boolean;
};

function ScenarioDetailScreen(props: ScenarioDetailScreenProps) {
	const {
		editorFactory,
		language,
		scenario,
		data,
		error,
		onBack,
		allScenarios,
		scenarioManagementService,
		ruleSetExportService,
		gamePersistenceService,
		isNew,
		canShare = false,
		active = true,
	} = props;
	const t = useMemo(() => createGuiTranslator(language), [language]);
	const isCurrentGame = props.isCurrentGame === true;
	const isRestored = (scenario.restoredIndex ?? 0) > 0;
	const [editor] = useState(() =>
		isCurrentGame
			? requireEditorFactory(editorFactory).fromGame(
					data as GameState,
					language,
				)
			: scenario.type === "ruleSet"
				? requireEditorFactory(editorFactory).fromRuleSet(
						data as RuleSet,
						language,
					)
				: requireEditorFactory(editorFactory).fromTemplate(
						data as GameState,
						language,
					),
	);
	if (isNew && !editor.isDirty()) editor.markChanged();
	const [section, setSection] = useState<ScenarioEditorSection>("teams");
	const [selectedId, setSelectedId] = useState<string>();
	const [revision, setRevision] = useState(0);
	const [message, setMessage] = useState<string>();
	const [editorError, setEditorError] = useState<string>();
	const [copyDialog, setCopyDialog] = useState(false);
	const [copyName, setCopyName] = useState("");
	const [exitDialog, setExitDialog] = useState(false);
	const [startDialog, setStartDialog] = useState(false);
	const saveClick = useClickCooldown();

	const selected = selectedId ? editor.getItem(section, selectedId) : undefined;
	const objectFormRef = useRef<ScenarioObjectFormHandle>(null);
	const updateSelectedObject = (values: ScenarioObjectValues): boolean => {
		if (!selected) return false;
		try {
			const nextId = editor.update(section, selected.id, values);
			setSelectedId(nextId);
			setRevision((value) => value + 1);
			setEditorError(undefined);
			return true;
		} catch (updateError) {
			setEditorError(guiErrorText(updateError, t));
			return false;
		}
	};
	const leaveSelectedObject = (next: () => void): void => {
		if (!selected || (objectFormRef.current?.apply() ?? true)) next();
	};
	const save = async (asCopy: boolean): Promise<boolean> => {
		if (!editor) return false;
		setEditorError(undefined);
		try {
			if (props.isCurrentGame) {
				props.onSaveCurrentGame(editor.toDocument() as GameState);
				editor.markSaved();
				setRevision((value) => value + 1);
				return true;
			}
			if (!scenarioManagementService) return false;
			let name = editor.name;
			let id = editor.originalId;
			if (asCopy) {
				name = copyName;
				const existing = allScenarios
					.filter((item) => item.type === scenario.type)
					.map(({ id: itemId, name: itemName }) => ({
						id: itemId,
						name: itemName,
					}));
				id = createUniqueScenarioId(
					name,
					scenario.type,
					existing.map((entry) => entry.id),
				);
			}
			const document = editor.toDocument(name, id);
			if (scenario.type === "ruleSet")
				await scenarioManagementService.saveRuleSet(document as RuleSet);
			else {
				await scenarioManagementService.saveTemplate(document as GameState);
				gamePersistenceService?.clearBrowseCache();
			}
			editor.markSaved();
			setRevision((value) => value + 1);
			setCopyDialog(false);
			setMessage(t(asCopy ? "scenarios.copySaved" : "scenarios.changesSaved"));
			props.onSaved(
				{
					...scenario,
					storageKey: asCopy ? id : scenario.storageKey,
					id,
					...(asCopy ? { restoredIndex: undefined } : {}),
					name: name.trim(),
					names: { [language]: name.trim() },
					detail: t("scenarios.justSaved"),
				},
				document,
				asCopy,
			);
			return true;
		} catch (saveError) {
			setEditorError(guiErrorText(saveError, t));
			return false;
		}
	};
	const requestBack = () => {
		leaveSelectedObject(() => {
			if (editor.isDirty()) setExitDialog(true);
			else onBack();
		});
	};
	const startScenario = () => {
		if (props.isCurrentGame) return;
		props.onStart();
	};
	const requestStart = () =>
		leaveSelectedObject(() => {
			if (scenario.type === "ruleSet" && editor.isDirty()) {
				setStartDialog(true);
				return;
			}
			startScenario();
		});
	useBackHandler(requestBack, active, 20);
	const openCopyDialog = () => {
		if (!editor) return;
		const existing = allScenarios
			.filter((item) => item.type === scenario.type)
			.map(({ id, name }) => ({ id, name }));
		setCopyName(suggestScenarioCopy(editor.name, scenario.type, existing).name);
		setCopyDialog(true);
	};
	const exportScenario = async () => {
		if (!scenarioManagementService) return;
		setEditorError(undefined);
		try {
			const document = editor.toDocument();
			if (scenario.type === "ruleSet") {
				if (!ruleSetExportService)
					throw new GuiDisplayError(t("scenarios.exportUnsupported"));
				await ruleSetExportService.exportRuleSet(document as RuleSet);
			} else
				await scenarioManagementService.exportTemplate(document as GameState);
			setRevision((value) => value + 1);
			setMessage(t("scenarios.detailExported"));
		} catch (exportError) {
			if (
				exportError instanceof DOMException &&
				exportError.name === "AbortError"
			)
				return;
			setEditorError(guiErrorText(exportError, t));
		}
	};
	const shareScenario = async () => {
		if (!scenarioManagementService) return;
		setEditorError(undefined);
		try {
			const document = editor.toDocument();
			if (scenario.type === "ruleSet") {
				if (!ruleSetExportService)
					throw new GuiDisplayError(t("scenarios.exportUnsupported"));
				await ruleSetExportService.shareRuleSet(document as RuleSet);
			} else
				await scenarioManagementService.shareTemplate(document as GameState);
			setMessage(t("scenarios.detailShared"));
		} catch (shareError) {
			setEditorError(guiErrorText(shareError, t));
		}
	};
	return (
		<main className="app-shell scenario-detail-shell">
			<section
				className="scenario-detail"
				aria-labelledby="scenario-detail-title"
			>
				<header className="screen-header">
					<button
						type="button"
						data-testid="scenario-detail-back"
						className="icon-button"
						onClick={requestBack}
						aria-label={t("common.back")}
					>
						‹
					</button>
					<div>
						<span
							className={`type-badge type-badge--${isCurrentGame ? "game" : scenario.type}`}
						>
							{isCurrentGame
								? t("game.currentGame")
								: scenario.type === "ruleSet"
									? t("scenarios.ruleSet")
									: t("scenarios.template")}
						</span>
						<h1 id="scenario-detail-title">{scenario.name}</h1>
					</div>
					{!isCurrentGame ? (
						<div>
							<button
								type="button"
								className="text-button"
								onClick={() => void exportScenario()}
							>
								{t("common.export")}
							</button>
							{canShare ? (
								<button
									type="button"
									className="text-button"
									onClick={() => void shareScenario()}
								>
									{t("common.share")}
								</button>
							) : null}
						</div>
					) : null}
				</header>
				<nav
					className="scenario-editor-tabs"
					aria-label={t("scenarioEditor.objectType")}
				>
					{(["teams", "roles", "players", "statuses"] as const).map((value) => {
						const disabled = scenario.type === "ruleSet" && value === "players";
						const labels = {
							teams: t("scenarioEditor.teams"),
							roles: t("scenarioEditor.roles"),
							players: t("scenarioEditor.players"),
							statuses: t("scenarioEditor.statuses"),
						};
						return (
							<button
								type="button"
								key={value}
								data-testid={`scenario-tab-${value}`}
								disabled={disabled}
								className={
									disabled
										? "button-disabled"
										: section === value
											? "prominent-button-active"
											: undefined
								}
								onClick={() => {
									leaveSelectedObject(() => {
										setSection(value);
										setSelectedId(undefined);
									});
								}}
							>
								{labels[value]}
							</button>
						);
					})}
				</nav>
				{error || editorError ? (
					<p className="load-error" role="alert">
						{error ?? editorError}
					</p>
				) : null}
				{message ? (
					<p className="prototype-note" role="status">
						{message}
					</p>
				) : null}
				{!data && !error ? (
					<p className="empty-state">{t("scenarioEditor.readingDetails")}</p>
				) : null}
				{editor ? (
					<div className="scenario-editor-content">
						<ul className="scenario-editor-list">
							{editor.items(section).map((item) => (
								<li key={item.id}>
									<button
										type="button"
										onClick={() =>
											leaveSelectedObject(() => setSelectedId(item.id))
										}
									>
										<strong>{item.displayName}</strong>
										<small>{item.secondary ?? item.id}</small>
									</button>
								</li>
							))}
						</ul>
						{selected ? (
							<ScenarioObjectForm
								controllerRef={objectFormRef}
								language={language}
								key={`${section}-${selected.id}-${revision}`}
								section={section}
								item={selected}
								teams={editor.teamOptions()}
								statuses={editor.items("statuses").map((status) => ({
									id: status.id,
									name: status.displayName,
								}))}
								onSubmit={updateSelectedObject}
								onDelete={() => {
									try {
										editor.delete(section, selected.id);
										setSelectedId(undefined);
										setRevision((value) => value + 1);
										setEditorError(undefined);
									} catch (deleteError) {
										setEditorError(guiErrorText(deleteError, t));
									}
								}}
								onClose={() =>
									leaveSelectedObject(() => setSelectedId(undefined))
								}
								onCancel={() => setSelectedId(undefined)}
							/>
						) : null}
					</div>
				) : null}
				<footer className="scenario-editor-actions">
					<button
						type="button"
						data-testid="scenario-object-create"
						onClick={() => {
							if (!editor) return;
							leaveSelectedObject(() => {
								try {
									const id = editor.create(
										section,
										t(`scenarioEditor.new.${section}`),
									);
									setSelectedId(id);
									setRevision((value) => value + 1);
								} catch (createError) {
									setEditorError(guiErrorText(createError, t));
								}
							});
						}}
						disabled={!editor}
					>
						{t("scenarioEditor.create")}
					</button>
					<div>
						{isCurrentGame ? (
							<>
								<button
									type="button"
									onClick={() => {
										saveClick.run(() => {
											void save(false).then((saved) => saved && onBack());
										});
									}}
									disabled={saveClick.locked}
								>
									{t("scenarioEditor.saveChange")}
								</button>
								<button type="button" onClick={onBack}>
									{t("common.cancel")}
								</button>
							</>
						) : (
							<>
								<button
									type="button"
									data-testid="scenario-save"
									disabled={
										saveClick.locked || isRestored || !editor?.isDirty()
									}
									className={
										isRestored || !editor?.isDirty()
											? "button-disabled"
											: undefined
									}
									onClick={() =>
										saveClick.run(() => {
											void save(false);
										})
									}
								>
									{t("scenarioEditor.saveChange")}
								</button>
								<button
									type="button"
									disabled={!isRestored && !editor?.isDirty()}
									className={
										!isRestored && !editor?.isDirty()
											? "button-disabled"
											: undefined
									}
									onClick={openCopyDialog}
								>
									{t(
										scenario.type === "ruleSet"
											? "scenarioEditor.saveAsNewRuleSet"
											: "scenarioEditor.saveAsNewTemplate",
									)}
								</button>
							</>
						)}
					</div>
				</footer>
				{!props.isCurrentGame ? (
					<button
						type="button"
						className="text-button scenario-detail__start"
						onClick={requestStart}
						disabled={!data}
					>
						{scenario.type === "ruleSet"
							? t("scenarioEditor.newGameWithRuleSet")
							: t("scenarioEditor.newGameFromTemplate")}
					</button>
				) : null}
				{copyDialog && !isCurrentGame ? (
					<ModalDialog
						open
						onClose={() => setCopyDialog(false)}
						className="save-copy-dialog"
						labelledBy="copy-dialog-title"
					>
						<form
							onSubmit={(event) => {
								event.preventDefault();
								saveClick.run(() => {
									void save(true);
								});
							}}
						>
							<h2 id="copy-dialog-title">{t("scenarioEditor.saveCopy")}</h2>
							<label>
								{t("common.name")}
								<input
									data-modal-initial-focus
									required
									value={copyName}
									onChange={(event) =>
										setCopyName(sanitizeText(event.target.value))
									}
								/>
							</label>
							<div>
								<button type="button" onClick={() => setCopyDialog(false)}>
									{t("common.cancel")}
								</button>
								<button type="submit" disabled={saveClick.locked}>
									{t("common.save")}
								</button>
							</div>
						</form>
					</ModalDialog>
				) : null}
				{exitDialog ? (
					<ModalDialog
						open
						onClose={() => setExitDialog(false)}
						onBack={onBack}
						className="scenario-exit-dialog"
						role="alertdialog"
						labelledBy="scenario-exit-title"
					>
						<p id="scenario-exit-title">
							{isCurrentGame
								? t("scenarioEditor.unsavedChanges")
								: t(
										scenario.type === "ruleSet"
											? "scenarioEditor.unsavedRuleSet"
											: "scenarioEditor.unsavedTemplate",
									)}
						</p>
						<div>
							<button
								type="button"
								onClick={() => {
									saveClick.run(() => {
										void save(false).then((saved) => {
											if (saved) onBack();
										});
									});
								}}
								disabled={saveClick.locked}
							>
								{t("scenarioEditor.saveAndExit")}
							</button>
							<button type="button" onClick={onBack}>
								{t("scenarioEditor.exitWithoutSaving")}
							</button>
							<button
								type="button"
								data-modal-initial-focus
								onClick={() => setExitDialog(false)}
							>
								{t("common.cancel")}
							</button>
						</div>
					</ModalDialog>
				) : null}
				{startDialog && scenario.type === "ruleSet" ? (
					<ModalDialog
						open
						onClose={() => setStartDialog(false)}
						className="scenario-exit-dialog"
						role="alertdialog"
						labelledBy="scenario-start-title"
					>
						<p id="scenario-start-title">
							{t("scenarioEditor.unsavedRuleSet")}
						</p>
						<div>
							<button
								type="button"
								onClick={() => {
									saveClick.run(() => {
										void save(false).then((saved) => {
											if (saved) startScenario();
										});
									});
								}}
								disabled={saveClick.locked}
							>
								{t("scenarioEditor.saveAndContinue")}
							</button>
							<button type="button" onClick={startScenario}>
								{t("scenarioEditor.continueWithoutSaving")}
							</button>
							<button
								type="button"
								data-modal-initial-focus
								onClick={() => setStartDialog(false)}
							>
								{t("common.cancel")}
							</button>
						</div>
					</ModalDialog>
				) : null}
			</section>
		</main>
	);
}

function ScenarioObjectForm({
	controllerRef,
	language,
	section,
	item,
	teams,
	statuses,
	onSubmit,
	onDelete,
	onClose,
	onCancel,
}: {
	controllerRef: Ref<ScenarioObjectFormHandle>;
	language: string;
	section: ScenarioEditorSection;
	item: {
		id: string;
		name: string;
		displayName: string;
		localizedName: string;
		color?: string;
		teamId?: string;
		teamOrder?: number;
		firstNightOrder?: number;
		otherNightOrder?: number;
		isUnique?: boolean;
		unicodeEscaped?: string;
		killsSomeone?: boolean;
		resurrectSomeone?: boolean;
		applyStatusEffect?: string[];
		defaultDuration?: number;
	};
	teams: Array<{ id: string; name: string }>;
	statuses: Array<{ id: string; name: string }>;
	onSubmit: (values: ScenarioObjectValues) => boolean;
	onDelete: () => void;
	onClose: () => void;
	onCancel?: () => void;
}) {
	const t = createGuiTranslator(language);
	const [name, setName] = useState(item.name);
	const [displayName, setDisplayName] = useState(item.localizedName);
	const [color, setColor] = useState(item.color);
	const [teamId, setTeamId] = useState(item.teamId ?? teams[0]?.id ?? "");
	const [teamOrder, setTeamOrder] = useState(item.teamOrder ?? 0);
	const [firstNightOrder, setFirstNightOrder] = useState(
		item.firstNightOrder?.toString() ?? "",
	);
	const [otherNightOrder, setOtherNightOrder] = useState(
		item.otherNightOrder?.toString() ?? "",
	);
	const [isUnique, setIsUnique] = useState(item.isUnique ?? false);
	const [unicodeEscaped, setUnicodeEscaped] = useState(
		item.unicodeEscaped ?? "",
	);
	const [killsSomeone, setKillsSomeone] = useState(item.killsSomeone ?? false);
	const [resurrectSomeone, setResurrectSomeone] = useState(
		item.resurrectSomeone ?? false,
	);
	const [applyStatusEffect, setApplyStatusEffect] = useState(
		() => new Set(item.applyStatusEffect ?? []),
	);
	const [defaultDuration, setDefaultDuration] = useState(
		item.defaultDuration ?? 1,
	);
	const [deleteConfirmation, setDeleteConfirmation] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);
	const unicodePreview = decodeRoleUnicodeSymbol(unicodeEscaped);
	const optionalOrder = (value: string): number | null =>
		value.trim() ? Number(value) : null;
	const values = (): ScenarioObjectValues => ({
		name,
		displayName: displayName.trim() ? displayName : null,
		color: color ?? null,
		teamId,
		teamOrder,
		firstNightOrder: optionalOrder(firstNightOrder),
		otherNightOrder: optionalOrder(otherNightOrder),
		isUnique,
		unicodeEscaped: unicodeEscaped.trim() ? unicodeEscaped : null,
		killsSomeone,
		resurrectSomeone,
		applyStatusEffect: [...applyStatusEffect],
		defaultDuration,
	});
	const apply = (): boolean => {
		if (formRef.current && !formRef.current.reportValidity()) return false;
		return onSubmit(values());
	};
	useImperativeHandle(controllerRef, () => ({ apply }));
	return (
		<form
			ref={formRef}
			className="scenario-object-form"
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit(values());
			}}
		>
			<header className="scenario-object-form__header">
				<h2>{t("scenarioEditor.editDetails")}</h2>
				<button
					type="button"
					data-testid="scenario-object-close"
					className="sheet-close-button"
					aria-label={t("scenarioEditor.closeDetails")}
					onClick={onClose}
				>
					×
				</button>
			</header>
			<label>
				{t("common.name")}
				<input
					required
					data-testid="scenario-object-name"
					value={name}
					onChange={(event) => setName(sanitizeText(event.target.value))}
				/>
			</label>
			<label>
				{t("scenarioEditor.displayName", { language })}
				<input
					value={displayName}
					onChange={(event) => setDisplayName(sanitizeText(event.target.value))}
				/>
			</label>
			{section === "teams" ? (
				<label>
					{t("scenarioEditor.teamOrder")}
					<input
						type="number"
						value={teamOrder}
						onChange={(event) => setTeamOrder(Number(event.target.value))}
					/>
				</label>
			) : null}
			{section === "statuses" ? (
				<label>
					{t("scenarioEditor.defaultDuration")}
					<input
						type="number"
						min="0"
						step="1"
						value={defaultDuration}
						onChange={(event) => setDefaultDuration(Number(event.target.value))}
					/>
				</label>
			) : null}
			{section === "roles" ? (
				<>
					<label>
						{t("scenarioEditor.team")}
						<select
							value={teamId}
							onChange={(event) => setTeamId(event.target.value)}
						>
							{teams.map((team) => (
								<option key={team.id} value={team.id}>
									{team.name}
								</option>
							))}
						</select>
					</label>
					<label>
						{t("scenarioEditor.firstNightOrder")}
						<input
							type="number"
							min="1"
							step="1"
							value={firstNightOrder}
							onChange={(event) =>
								setFirstNightOrder(sanitizeText(event.target.value))
							}
						/>
					</label>
					<label>
						{t("scenarioEditor.otherNightOrder")}
						<input
							type="number"
							min="1"
							step="1"
							value={otherNightOrder}
							onChange={(event) =>
								setOtherNightOrder(sanitizeText(event.target.value))
							}
						/>
					</label>
					<label className="scenario-checkbox-field">
						<input
							type="checkbox"
							checked={isUnique}
							onChange={(event) => setIsUnique(event.target.checked)}
						/>
						{t("scenarioEditor.unique")}
					</label>
					<fieldset className="scenario-role-abilities">
						<legend>{t("scenarioEditor.activeAbilities")}</legend>
						<label className="scenario-checkbox-field">
							<input
								type="checkbox"
								checked={killsSomeone}
								onChange={(event) => setKillsSomeone(event.target.checked)}
							/>
							{t("scenarioEditor.canKill")}
						</label>
						<label className="scenario-checkbox-field">
							<input
								type="checkbox"
								checked={resurrectSomeone}
								onChange={(event) => setResurrectSomeone(event.target.checked)}
							/>
							{t("scenarioEditor.canResurrect")}
						</label>
					</fieldset>
					<fieldset className="scenario-role-statuses">
						<legend>{t("scenarioEditor.canApplyStatuses")}</legend>
						{statuses.length > 0 ? (
							statuses.map((status) => (
								<label key={status.id} className="scenario-checkbox-field">
									<input
										type="checkbox"
										checked={applyStatusEffect.has(status.id)}
										onChange={(event) =>
											setApplyStatusEffect((current) => {
												const next = new Set(current);
												if (event.target.checked) next.add(status.id);
												else next.delete(status.id);
												return next;
											})
										}
									/>
									{status.name}
								</label>
							))
						) : (
							<small>{t("scenarioEditor.noStatuses")}</small>
						)}
					</fieldset>
					<label>
						{t("scenarioEditor.unicodeSymbol")}
						<span className="unicode-editor-field">
							<input
								data-testid="scenario-object-unicode"
								value={unicodeEscaped}
								placeholder="\\u{1F539}"
								onChange={(event) =>
									setUnicodeEscaped(sanitizeText(event.target.value))
								}
							/>
							<output aria-label={t("scenarioEditor.unicodePreview")}>
								{unicodePreview ?? "◇"}
							</output>
						</span>
					</label>
				</>
			) : null}
			{section !== "statuses" ? (
				<ColorField
					color={color}
					onChange={setColor}
					labels={{
						useColor: t("scenarioEditor.useColor"),
						editColor: t("scenarioEditor.editColor"),
						pickerTitle: t("scenarioEditor.colorPickerTitle"),
						colorCode: t("scenarioEditor.colorCode"),
						preview: t("scenarioEditor.colorPreview"),
						close: t("common.close"),
						ok: t("common.ok"),
						cancel: t("common.cancel"),
					}}
				/>
			) : null}
			<div
				className={`scenario-object-form__actions${onCancel ? " scenario-object-form__actions--three" : ""}`}
			>
				<button type="submit" data-testid="scenario-object-apply">
					{t("scenarioEditor.apply")}
				</button>
				{onCancel ? (
					<button type="button" onClick={onCancel}>
						{t("common.cancel")}
					</button>
				) : null}
				<button
					type="button"
					className="danger-action"
					onClick={() => setDeleteConfirmation(true)}
				>
					{t("common.delete")}
				</button>
			</div>
			{deleteConfirmation ? (
				<ModalDialog
					open
					onClose={() => setDeleteConfirmation(false)}
					className="scenario-delete-confirmation"
					role="alertdialog"
					labelledBy="scenario-delete-title"
				>
					<strong id="scenario-delete-title">
						{t("scenarioEditor.deleteQuestion", { name: item.displayName })}
					</strong>
					<div>
						<button
							type="button"
							data-modal-initial-focus
							onClick={() => setDeleteConfirmation(false)}
						>
							{t("common.cancel")}
						</button>
						<button
							type="button"
							data-testid="scenario-object-delete-confirm"
							className="danger-action"
							onClick={onDelete}
						>
							{t("common.deletePermanently")}
						</button>
					</div>
				</ModalDialog>
			) : null}
		</form>
	);
}
