import {
	type CSSProperties,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";

import "./app.css";
import { AppearanceService } from "../application/appearanceService";
import {
	type AppSettings,
	defaultAppSettings,
	systemLanguagePreference,
} from "../application/appSettings";
import type {
	ApplicationObjectReadProblem,
	GameUseCases,
	LoadedGameDocument,
	StoredGameReference,
} from "../application/gameUseCases";
import type { ImageResourceService } from "../application/imageResourceService";
import type {
	LibraryLoadProblem,
	LibraryRepairReport,
	LibraryUseCases,
} from "../application/libraryUseCases";
import {
	LoadProblemDecisionService,
	sortLoadProblems,
} from "../application/loadProblemQueue";
import {
	LoadProblemResolutionService,
	type QueuedLoadProblem,
} from "../application/loadProblemResolutionService";
import { MotionPreferenceService } from "../application/motionPreferenceService";
import type { PersistenceActivityService } from "../application/persistenceActivityService";
import type { ApplicationLifecyclePort } from "../application/ports/applicationLifecyclePort";
import type {
	HapticFeedbackKind,
	HapticFeedbackPort,
} from "../application/ports/hapticFeedbackPort";
import type { ScreenOrientationPort } from "../application/ports/screenOrientationPort";
import type { ScreenWakeLockPort } from "../application/ports/screenWakeLockPort";
import type { RuleSetExportService } from "../application/ruleSetExportService";
import type { SettingsService } from "../application/settingsService";
import type {
	ObjectRecoveryResolution,
	StorageRecoverySummary,
} from "../application/storageRecovery";
import {
	createGuiErrorPresentation,
	GuiDisplayError,
	type GuiErrorPresentation,
	guiErrorText,
	objectStoreReadProblemText,
} from "./applicationFailurePresentation";
import { useBackHandler } from "./backNavigation";
import { GameScreen } from "./GameScreen";
import type { GuiTranslationKey } from "./i18n/de";
import {
	createGuiTranslator,
	isGuiLanguageAvailable,
	loadGuiLanguage,
	resolveGuiLocale,
} from "./i18n/translate";
import { LoadGameScreen } from "./LoadGameScreen";
import {
	LibraryLoadProblemDialog,
	LibraryRepairReportDialog,
	ObjectReadProblemDialog,
	WriteRecoveryDialog,
} from "./LoadProblemDialogs";
import { ModalDialog } from "./ModalDialog";
import { NewGameScreen } from "./NewGameScreen";
import { RoleDistributionFlow } from "./RoleDistributionFlow";
import { RolesForShowingScreen } from "./RolesForShowingScreen";
import { CurrentGameEditorScreen, ScenarioLibrary } from "./ScenarioLibrary";
import { SettingsScreen } from "./SettingsScreen";
import { TechnicalErrorDetails } from "./TechnicalErrorDetails";

export type AppProps = {
	currentGameName?: string;
	currentGameId?: string;
	onContinueGame?: () => void;
	initialSettings?: AppSettings;
	initialError?: string;
	settingsService?: SettingsService;
	gameUseCases?: GameUseCases;
	libraryUseCases?: LibraryUseCases;
	ruleSetExportService?: RuleSetExportService;
	imageResourceService?: ImageResourceService;
	appearanceService?: AppearanceService;
	motionPreferenceService?: MotionPreferenceService;
	applicationLifecycle?: ApplicationLifecyclePort;
	persistenceActivity?: PersistenceActivityService;
	hapticFeedback?: HapticFeedbackPort;
	screenOrientation?: ScreenOrientationPort;
	screenWakeLock?: ScreenWakeLockPort;
};

const menuItems = [
	{ key: "home.newGame", screen: "newGame" },
	{ key: "home.loadGame", screen: "loadGame" },
	{ key: "home.manageScenarios", screen: "scenarios" },
	{ key: "home.settings", screen: "settings" },
] as const satisfies ReadonlyArray<{
	key: GuiTranslationKey;
	screen: "newGame" | "loadGame" | "scenarios" | "settings";
}>;

class BackgroundCommandRegistry {
	readonly #commandIds = new Set<string>();

	start(commandId: string): boolean {
		if (this.#commandIds.has(commandId)) return false;
		this.#commandIds.add(commandId);
		return true;
	}

	finish(commandId: string): void {
		this.#commandIds.delete(commandId);
	}
}

export function App({
	currentGameName,
	currentGameId,
	onContinueGame,
	initialSettings = defaultAppSettings,
	initialError,
	settingsService,
	gameUseCases,
	libraryUseCases,
	ruleSetExportService,
	imageResourceService,
	appearanceService: providedAppearanceService,
	motionPreferenceService: providedMotionPreferenceService,
	applicationLifecycle,
	persistenceActivity,
	hapticFeedback,
	screenOrientation,
	screenWakeLock,
}: AppProps) {
	const libraryBrowseService = libraryUseCases?.browse;
	const libraryRecoveryService = libraryUseCases?.recovery;
	const objectReadProblemService =
		libraryUseCases?.objectProblems ?? gameUseCases?.objectProblems;
	const gamePreparationService = gameUseCases?.preparation;
	const gameSessionService = gameUseCases?.session;
	const gamePersistenceService = gameUseCases?.persistence;
	const scenarioEditorFactory = gameUseCases?.editor ?? libraryUseCases?.editor;
	const [localAppearanceService] = useState(
		() => new AppearanceService(undefined, initialSettings.theme),
	);
	const appearanceService = providedAppearanceService ?? localAppearanceService;
	const [localMotionPreferenceService] = useState(
		() => new MotionPreferenceService(undefined, initialSettings.reduceMotion),
	);
	const motionPreferenceService =
		providedMotionPreferenceService ?? localMotionPreferenceService;
	const [screen, setScreen] = useState<
		| "home"
		| "newGame"
		| "loadGame"
		| "scenarios"
		| "settings"
		| "game"
		| "gameEditor"
		| "roleDistribution"
		| "rolesForShowing"
	>("home");
	const [settings, setSettings] = useState(initialSettings);
	const desiredContentLocale = useMemo(
		() =>
			settingsService?.getEffectiveLocale(settings.language) ??
			resolveGuiLocale(
				settings.language === systemLanguagePreference
					? defaultAppSettings.language
					: settings.language,
			),
		[settings.language, settingsService],
	);
	const [contentLocale, setContentLocale] = useState(() =>
		isGuiLanguageAvailable(desiredContentLocale.languageTag)
			? desiredContentLocale
			: resolveGuiLocale(defaultAppSettings.language),
	);
	const contentLanguage = contentLocale.languageTag;
	const t = useMemo(
		() => createGuiTranslator(contentLanguage),
		[contentLanguage],
	);
	useEffect(() => {
		document.documentElement.lang = contentLocale.languageTag;
	}, [contentLocale.languageTag]);
	const [applicationError, setApplicationError] = useState<
		GuiErrorPresentation | undefined
	>(initialError ? { message: initialError } : undefined);
	useEffect(() => {
		let active = true;
		void loadGuiLanguage(desiredContentLocale.languageTag)
			.then(() => {
				if (active) setContentLocale(desiredContentLocale);
			})
			.catch((error: unknown) => {
				if (active) setApplicationError(createGuiErrorPresentation(error, t));
			});
		return () => {
			active = false;
		};
	}, [desiredContentLocale, t]);
	const [loadedGame, setLoadedGame] = useState<LoadedGameDocument>();
	const [settingsReturnScreen, setSettingsReturnScreen] = useState<
		"home" | "game"
	>("home");
	const [isSavingSettings, setIsSavingSettings] = useState(false);
	const activeSettingsOperationsRef = useRef(0);
	const initialHomeSynchronizationStartedRef = useRef(false);
	const [settingsSaveError, setSettingsSaveError] = useState<string>();
	const [isSettingsSaveDialogOpen, setIsSettingsSaveDialogOpen] =
		useState(false);
	const [latestStoredGame, setLatestStoredGame] =
		useState<StoredGameReference>();
	const [newGameSelection, setNewGameSelection] = useState<{
		type: "ruleSet" | "template";
		id: string;
	}>();
	const [newGameOrigin, setNewGameOrigin] = useState<"home" | "scenarios">(
		"home",
	);
	const [isAppExitDialogOpen, setIsAppExitDialogOpen] = useState(false);
	const [isExitGracePeriodExpired, setIsExitGracePeriodExpired] =
		useState(false);
	const [isBrowserExited, setIsBrowserExited] = useState(false);
	const [homeBackgroundSource, setHomeBackgroundSource] = useState<string>();
	const [gameBoardBackgroundSource, setGameBoardBackgroundSource] =
		useState<string>();
	const [writeRecoveries, setWriteRecoveries] = useState<
		StorageRecoverySummary[]
	>([]);
	const [backgroundWriteRecoveryCommands] = useState(
		() => new BackgroundCommandRegistry(),
	);
	const [gameObjectReadProblems, setGameObjectReadProblems] = useState<
		ApplicationObjectReadProblem<"game" | "template">[]
	>([]);
	const [ruleSetReadProblems, setRuleSetReadProblems] = useState<
		ApplicationObjectReadProblem<"ruleSet">[]
	>([]);
	const [objectReadProblemError, setObjectReadProblemError] =
		useState<string>();
	const [isResolvingObjectReadProblem, setIsResolvingObjectReadProblem] =
		useState(false);
	const [libraryLoadProblem, setLibraryLoadProblem] =
		useState<LibraryLoadProblem>();
	const [libraryRepairReport, setLibraryRepairReport] =
		useState<LibraryRepairReport>();
	const [isResolvingLibraryProblem, setIsResolvingLibraryProblem] =
		useState(false);
	const [libraryProblemError, setLibraryProblemError] = useState<string>();
	const [loadProblemDecisionService] = useState(
		() => new LoadProblemDecisionService(),
	);
	const [loadProblemResolutionService] = useState(
		() =>
			new LoadProblemResolutionService(
				loadProblemDecisionService,
				gamePersistenceService,
				libraryRecoveryService,
				objectReadProblemService,
				libraryBrowseService,
			),
	);
	const queuedLoadProblems = sortLoadProblems<QueuedLoadProblem>(
		[
			...writeRecoveries.map((value) => ({
				...value,
				queueType: "write" as const,
				value,
			})),
			...gameObjectReadProblems.map((value) => ({
				...value,
				queueType: "object" as const,
				value,
			})),
			...ruleSetReadProblems.map((value) => ({
				...value,
				queueType: "object" as const,
				value,
			})),
			...(libraryLoadProblem
				? [
						{
							...libraryLoadProblem,
							queueType: "library" as const,
							value: libraryLoadProblem,
						},
					]
				: []),
		],
		(problem) => {
			if (problem.queueType === "write") return problem.value.recoveryKey;
			if (problem.queueType === "object")
				return "storageKey" in problem.value
					? problem.value.storageKey
					: problem.value.id;
			return "library";
		},
	);
	const activeLoadProblem =
		loadProblemResolutionService.problemsForDisplay(queuedLoadProblems)[0];
	const activeProblemGroupSize = activeLoadProblem
		? loadProblemResolutionService.matchingProblemCount(
				queuedLoadProblems,
				activeLoadProblem,
			)
		: 0;
	const activeProblemIdentity = activeLoadProblem
		? activeLoadProblem.queueType === "write"
			? `write:${activeLoadProblem.value.recoveryKey}`
			: activeLoadProblem.queueType === "object"
				? `object:${activeLoadProblem.value.kind}:${
						"storageKey" in activeLoadProblem.value
							? activeLoadProblem.value.storageKey
							: activeLoadProblem.value.id
					}`
				: "library"
		: "";
	const loadProblemProcessingKey =
		loadProblemResolutionService.processingKey(queuedLoadProblems);
	const subscribeTheme = useCallback(
		(listener: () => void) =>
			appearanceService.subscribeResolvedTheme(listener),
		[appearanceService],
	);
	const getThemeSnapshot = useCallback(
		() => appearanceService.getResolvedTheme(),
		[appearanceService],
	);
	const resolvedTheme = useSyncExternalStore(
		subscribeTheme,
		getThemeSnapshot,
		getThemeSnapshot,
	);
	const subscribeMotionPreference = useCallback(
		(listener: () => void) =>
			motionPreferenceService.subscribeShouldReduceMotion(listener),
		[motionPreferenceService],
	);
	const getMotionPreferenceSnapshot = useCallback(
		() => motionPreferenceService.getShouldReduceMotion(),
		[motionPreferenceService],
	);
	const reduceMotion = useSyncExternalStore(
		subscribeMotionPreference,
		getMotionPreferenceSnapshot,
		getMotionPreferenceSnapshot,
	);
	const subscribePersistenceActivity = useCallback(
		(listener: () => void) =>
			persistenceActivity?.subscribe(listener) ?? (() => {}),
		[persistenceActivity],
	);
	const getPersistenceActivitySnapshot = useCallback(
		() => persistenceActivity?.getActiveWriteCount() ?? 0,
		[persistenceActivity],
	);
	const activeWriteCount = useSyncExternalStore(
		subscribePersistenceActivity,
		getPersistenceActivitySnapshot,
		getPersistenceActivitySnapshot,
	);
	const isBrowseScreen =
		screen === "newGame" || screen === "loadGame" || screen === "scenarios";
	const wasBrowseScreenRef = useRef(isBrowseScreen);
	const effectiveCurrentGameName =
		loadedGame?.displayName ??
		currentGameName ??
		(latestStoredGame ? t("home.latestSave") : undefined);
	const continueGameId =
		loadedGame?.storageKey ??
		loadedGame?.id ??
		currentGameId ??
		latestStoredGame?.storageKey;
	const hasCurrentGame = effectiveCurrentGameName !== undefined;
	const reportApplicationError = (context: string, error: unknown) => {
		const presentation = createGuiErrorPresentation(error, t);
		setApplicationError({
			...presentation,
			message: `${context} ${presentation.message}`,
		});
	};
	const runDomainAction = <Result,>(
		context: string,
		action: () => Result,
	): Result | undefined => {
		try {
			setApplicationError(undefined);
			return action();
		} catch (error) {
			reportApplicationError(context, error);
			return undefined;
		}
	};
	const renderWithApplicationError = (content: ReactNode) => (
		<>
			{applicationError ? (
				<div className="application-error-banner" role="alert">
					<div>
						<span>{applicationError.message}</span>
						{applicationError.technicalDetails ? (
							<TechnicalErrorDetails
								details={applicationError.technicalDetails}
								language={contentLanguage}
							/>
						) : null}
					</div>
					<button
						type="button"
						aria-label={t("app.closeError")}
						onClick={() => setApplicationError(undefined)}
					>
						×
					</button>
				</div>
			) : null}
			{content}
			{isSettingsSaveDialogOpen ? (
				<ModalDialog
					open
					onClose={cancelSavingSettings}
					onBack={cancelSavingSettings}
					role="alertdialog"
					labelledBy="settings-save-failed-title"
					className="app-exit-dialog"
				>
					<h2 id="settings-save-failed-title">
						{t("settings.saveFailedTitle")}
					</h2>
					<p>{t("settings.saveFailedQuestion")}</p>
					{settingsSaveError ? (
						<p className="load-error" role="alert">
							{settingsSaveError}
						</p>
					) : null}
					<div className="exit-dialog-actions">
						<button
							type="button"
							disabled={isSavingSettings}
							className={isSavingSettings ? "button-disabled" : undefined}
							onClick={() => void retrySavingSettings()}
						>
							{isSavingSettings ? t("common.saving") : t("common.retry")}
						</button>
						<button
							type="button"
							data-modal-initial-focus
							disabled={isSavingSettings}
							onClick={cancelSavingSettings}
						>
							{t("common.cancel")}
						</button>
					</div>
				</ModalDialog>
			) : null}
			{libraryRepairReport ? (
				<LibraryRepairReportDialog
					report={libraryRepairReport}
					t={t}
					onClose={() => setLibraryRepairReport(undefined)}
				/>
			) : activeLoadProblem?.queueType === "write" ? (
				<WriteRecoveryDialog
					key={activeProblemIdentity}
					t={t}
					recovery={activeLoadProblem.value}
					remainingCount={queuedLoadProblems.length}
					matchingCount={activeProblemGroupSize}
					onResolve={(resolution, remember) =>
						void resolveWriteRecovery(
							activeLoadProblem.value,
							resolution,
							remember,
						)
					}
					onExport={() => void exportFailedWrite(activeLoadProblem.value)}
					onLater={(remember) =>
						void deferWriteRecovery(activeLoadProblem.value, remember)
					}
				/>
			) : activeLoadProblem?.queueType === "object" ? (
				<ObjectReadProblemDialog
					key={activeProblemIdentity}
					t={t}
					problem={activeLoadProblem.value}
					busy={isResolvingObjectReadProblem}
					error={objectReadProblemError}
					remainingCount={queuedLoadProblems.length}
					matchingCount={activeProblemGroupSize}
					onResolve={(action, remember) =>
						void resolveObjectReadProblem(
							activeLoadProblem.value,
							action,
							remember,
						)
					}
				/>
			) : activeLoadProblem?.queueType === "library" ? (
				<LibraryLoadProblemDialog
					key={activeProblemIdentity}
					t={t}
					problem={activeLoadProblem.value}
					busy={isResolvingLibraryProblem}
					error={libraryProblemError}
					remainingCount={queuedLoadProblems.length}
					matchingCount={activeProblemGroupSize}
					onResolve={(action, remember) =>
						void resolveLibraryProblem(action, remember)
					}
					onExport={() => void resolveLibraryProblem("export")}
				/>
			) : null}
		</>
	);
	const dismissWriteRecovery = (recovery: StorageRecoverySummary) => {
		setWriteRecoveries((current) =>
			current.filter((entry) => entry.commandId !== recovery.commandId),
		);
	};
	const dismissObjectReadProblem = (problem: ApplicationObjectReadProblem) => {
		setObjectReadProblemError(undefined);
		if (problem.kind === "ruleSet") {
			setRuleSetReadProblems((current) =>
				current.filter((entry) => entry.id !== problem.id),
			);
			return;
		}
		setGameObjectReadProblems((current) =>
			current.filter(
				(entry) =>
					entry.kind !== problem.kind ||
					entry.storageKey !== problem.storageKey,
			),
		);
	};
	const resolveObjectReadProblem = async (
		problem: ApplicationObjectReadProblem,
		action:
			| "retry"
			| "export"
			| "delete"
			| "repair"
			| "repairFileName"
			| "keepBoth"
			| "later",
		remember = false,
	): Promise<boolean> => {
		if (!objectReadProblemService && action !== "later" && action !== "retry")
			return false;
		setIsResolvingObjectReadProblem(true);
		setObjectReadProblemError(undefined);
		try {
			const result = await loadProblemResolutionService.resolve(
				{ ...problem, queueType: "object", value: problem },
				action,
				remember,
			);
			if (!result.applied) return false;
			if (result.libraryRepairReport)
				setLibraryRepairReport(result.libraryRepairReport);
			dismissObjectReadProblem(problem);
			if (problem.kind === "ruleSet") await refreshRuleSetReadProblems();
			return true;
		} catch (error) {
			if (!(error instanceof DOMException && error.name === "AbortError"))
				setObjectReadProblemError(guiErrorText(error, t));
			return false;
		} finally {
			setIsResolvingObjectReadProblem(false);
		}
	};
	const restoreFailedBackgroundRecovery = async (
		recovery: StorageRecoverySummary,
		error: unknown,
	): Promise<void> => {
		loadProblemResolutionService.forget(recovery);
		let refreshedRecoveries: StorageRecoverySummary[] = [];
		try {
			refreshedRecoveries =
				recovery.kind === "ruleSet"
					? ((await libraryRecoveryService?.listWriteRecoveries()) ?? [])
					: ((await gamePersistenceService?.listWriteRecoveries(
							recovery.kind,
						)) ?? []);
		} catch {
			// Der ursprüngliche Eintrag bleibt als sichere Rückfalloption erhalten.
		}
		const matchingRecoveries = refreshedRecoveries.filter(
			(candidate) =>
				candidate.kind === recovery.kind &&
				candidate.recoveryKey === recovery.recoveryKey,
		);
		const recoveriesToRestore =
			matchingRecoveries.length > 0 ? matchingRecoveries : [recovery];
		setWriteRecoveries((current) => [
			...current.filter(
				(entry) =>
					!recoveriesToRestore.some(
						(candidate) => candidate.commandId === entry.commandId,
					),
			),
			...recoveriesToRestore,
		]);
		if (!(error instanceof DOMException && error.name === "AbortError"))
			reportApplicationError(t("appError.continueStorageCommand"), error);
	};
	const runWriteRecoveryInBackground = (
		recovery: StorageRecoverySummary,
		action: ObjectRecoveryResolution | "later" | "export",
		remember = false,
	): void => {
		if (!backgroundWriteRecoveryCommands.start(recovery.commandId)) return;
		dismissWriteRecovery(recovery);

		void (async () => {
			const result = await loadProblemResolutionService.resolve(
				{ ...recovery, queueType: "write", value: recovery },
				action,
				remember,
			);
			if (!result.applied)
				throw new GuiDisplayError(t("error.invalidDecision"));
		})()
			.then(() => {
				if (recovery.kind !== "ruleSet") return;
				void refreshLibraryLoadProblem().catch((error: unknown) =>
					reportApplicationError(t("appError.checkFiles"), error),
				);
			})
			.catch((error: unknown) =>
				restoreFailedBackgroundRecovery(recovery, error),
			)
			.finally(() =>
				backgroundWriteRecoveryCommands.finish(recovery.commandId),
			);
	};
	const deferWriteRecovery = (
		recovery: StorageRecoverySummary,
		remember = false,
	): void => runWriteRecoveryInBackground(recovery, "later", remember);
	const resolveWriteRecovery = (
		recovery: StorageRecoverySummary,
		resolution: ObjectRecoveryResolution,
		remember = false,
	): void => runWriteRecoveryInBackground(recovery, resolution, remember);
	const exportFailedWrite = (recovery: StorageRecoverySummary): void =>
		runWriteRecoveryInBackground(recovery, "export");
	const refreshLibraryLoadProblem = async (): Promise<void> => {
		const problem = await libraryRecoveryService?.inspectLibraryLoadProblem();
		setLibraryLoadProblem(problem);
	};
	const refreshRuleSetReadProblems = async (): Promise<void> => {
		const result = await libraryBrowseService?.listObjects("ruleSet");
		if (result?.status === "loaded") {
			setRuleSetReadProblems(result.problems);
			setLibraryLoadProblem(undefined);
			return;
		}
		setRuleSetReadProblems([]);
		if (result?.status === "expectedFailure") await refreshLibraryLoadProblem();
	};
	const resolveLibraryProblem = async (
		action: "restoreBackup" | "repair" | "createEmpty" | "export" | "later",
		remember = false,
	): Promise<boolean> => {
		if (!libraryRecoveryService) return false;
		setIsResolvingLibraryProblem(true);
		setLibraryProblemError(undefined);
		try {
			if (!libraryLoadProblem) return false;
			const result = await loadProblemResolutionService.resolve(
				{
					...libraryLoadProblem,
					queueType: "library",
					value: libraryLoadProblem,
				},
				action,
				remember,
			);
			if (!result.applied) return false;
			if (result.libraryRepairReport)
				setLibraryRepairReport(result.libraryRepairReport);
			if (action !== "export") setLibraryLoadProblem(undefined);
			return true;
		} catch (error) {
			if (!(error instanceof DOMException && error.name === "AbortError"))
				setLibraryProblemError(guiErrorText(error, t));
			return false;
		} finally {
			setIsResolvingLibraryProblem(false);
		}
	};

	// Die Identität und Generation sind hier absichtlich die einzigen Auslöser;
	// die Handler gehören zur jeweils dadurch ausgelösten Render-Version.
	/* eslint-disable react-hooks/exhaustive-deps -- siehe Begründung oben */
	// biome-ignore lint/correctness/useExhaustiveDependencies: siehe Begründung oben
	useEffect(() => {
		let active = true;
		void loadProblemResolutionService
			.applyRemembered(
				queuedLoadProblems,
				async ({ problem, libraryRepairReport }) => {
					if (!active) return;
					if (problem.queueType === "write")
						dismissWriteRecovery(problem.value);
					else if (problem.queueType === "object") {
						dismissObjectReadProblem(problem.value);
						if (problem.value.kind === "ruleSet")
							await refreshRuleSetReadProblems();
					} else setLibraryLoadProblem(undefined);
					if (libraryRepairReport) setLibraryRepairReport(libraryRepairReport);
				},
			)
			.catch((error: unknown) => {
				if (active) reportApplicationError(t("appError.checkFiles"), error);
			});
		return () => {
			active = false;
		};
	}, [loadProblemProcessingKey]);
	/* eslint-enable react-hooks/exhaustive-deps */

	useEffect(() => {
		let active = true;
		if (screen !== "home" || currentGameId || !gamePersistenceService) return;
		void gamePersistenceService
			.findLatestStoredGame()
			.then((game) => {
				if (active) setLatestStoredGame(game);
			})
			.catch(() => {
				if (active) setLatestStoredGame(undefined);
			});
		return () => {
			active = false;
		};
	}, [screen, currentGameId, gamePersistenceService]);

	useEffect(() => {
		let active = true;
		if (screen !== "loadGame" && screen !== "newGame" && screen !== "scenarios")
			return;
		void (async () => {
			if (screen === "loadGame") {
				const result = await gamePersistenceService?.listObjects("game");
				if (!active) return;
				if (result?.status === "expectedFailure")
					throw new Error(objectStoreReadProblemText(result.problem, t));
				setGameObjectReadProblems(result?.problems ?? []);
				setWriteRecoveries(
					(await gamePersistenceService?.listWriteRecoveries("game")) ?? [],
				);
				return;
			}

			const [
				templateResult,
				ruleSetResult,
				templateRecoveries,
				libraryRecoveries,
			] = await Promise.all([
				gamePersistenceService?.listObjects("template"),
				libraryBrowseService?.listObjects("ruleSet"),
				gamePersistenceService?.listWriteRecoveries("template") ??
					Promise.resolve([]),
				libraryRecoveryService?.listWriteRecoveries() ?? Promise.resolve([]),
			]);
			if (!active) return;
			if (templateResult?.status === "expectedFailure")
				throw new Error(objectStoreReadProblemText(templateResult.problem, t));
			setGameObjectReadProblems(templateResult?.problems ?? []);
			setWriteRecoveries([...templateRecoveries, ...libraryRecoveries]);
			if (
				libraryRecoveries.length === 0 &&
				ruleSetResult?.status === "expectedFailure"
			)
				setLibraryLoadProblem(
					await libraryRecoveryService?.inspectLibraryLoadProblem(),
				);
			else if (ruleSetResult?.status === "loaded") {
				setLibraryLoadProblem(undefined);
				setRuleSetReadProblems(ruleSetResult.problems);
			}
			if (ruleSetResult?.status === "expectedFailure")
				setRuleSetReadProblems([]);
		})().catch((error: unknown) => {
			if (active) {
				const presentation = createGuiErrorPresentation(error, t);
				setApplicationError({
					...presentation,
					message: `${t("appError.checkFiles")} ${presentation.message}`,
				});
			}
		});
		return () => {
			active = false;
		};
	}, [
		gamePersistenceService,
		libraryBrowseService,
		libraryRecoveryService,
		screen,
		t,
	]);

	useEffect(() => {
		let isActive = true;
		const themeAtRequest = resolvedTheme;
		if (!imageResourceService) return;
		void imageResourceService
			.getBackground("mainMenu")
			.then((image) => {
				if (isActive && themeAtRequest === appearanceService.getResolvedTheme())
					setHomeBackgroundSource(image?.source);
			})
			.catch(() => {
				if (isActive && themeAtRequest === appearanceService.getResolvedTheme())
					setHomeBackgroundSource(undefined);
			});
		return () => {
			isActive = false;
		};
	}, [appearanceService, imageResourceService, resolvedTheme]);

	useEffect(() => {
		let isActive = true;
		const themeAtRequest = resolvedTheme;
		if (!imageResourceService) return;
		void imageResourceService
			.getBackground("gameBoard")
			.then((image) => {
				if (isActive && themeAtRequest === appearanceService.getResolvedTheme())
					setGameBoardBackgroundSource(image?.source);
			})
			.catch(() => {
				if (isActive && themeAtRequest === appearanceService.getResolvedTheme())
					setGameBoardBackgroundSource(undefined);
			});
		return () => {
			isActive = false;
		};
	}, [appearanceService, imageResourceService, resolvedTheme]);

	useEffect(() => {
		if (wasBrowseScreenRef.current && !isBrowseScreen) {
			gamePersistenceService?.clearBrowseCache();
		}
		wasBrowseScreenRef.current = isBrowseScreen;
	}, [gamePersistenceService, isBrowseScreen]);

	useEffect(() => {
		document.documentElement.dataset.theme = resolvedTheme;
	}, [resolvedTheme]);

	useEffect(() => {
		document.documentElement.dataset.textSize = settings.textSize;
		document.documentElement.dataset.reduceMotion = String(reduceMotion);
	}, [settings.textSize, reduceMotion]);

	useEffect(() => {
		motionPreferenceService.setAppReduceMotion(settings.reduceMotion);
	}, [motionPreferenceService, settings.reduceMotion]);

	const isGameSessionScreen =
		loadedGame !== undefined &&
		(screen === "game" ||
			screen === "gameEditor" ||
			screen === "roleDistribution" ||
			screen === "rolesForShowing" ||
			(screen === "settings" && settingsReturnScreen === "game"));

	useEffect(() => {
		if (!screenWakeLock) return;
		void screenWakeLock
			.setKeepAwake(settings.keepScreenAwake && isGameSessionScreen)
			.catch(() => undefined);
	}, [isGameSessionScreen, screenWakeLock, settings.keepScreenAwake]);

	useEffect(() => {
		if (!screenOrientation) return;
		void screenOrientation
			.setAutoRotate(settings.autoRotate)
			.catch(() => undefined);
	}, [screenOrientation, settings.autoRotate]);

	useEffect(
		() => () => {
			if (screenWakeLock)
				void screenWakeLock.setKeepAwake(false).catch(() => undefined);
		},
		[screenWakeLock],
	);

	const triggerHapticFeedback = (kind: HapticFeedbackKind): void => {
		if (!settings.hapticFeedback || !hapticFeedback) return;
		void hapticFeedback.trigger(kind).catch(() => undefined);
	};

	const updateSettings = (nextSettings: AppSettings) => {
		const updatedSettings = runDomainAction(
			t("appError.settingsUpdate"),
			() => {
				const updated = settingsService
					? settingsService.updateEditing(nextSettings)
					: nextSettings;
				if (!settingsService)
					appearanceService.setThemePreference(updated.theme);
				return updated;
			},
		);
		if (updatedSettings) {
			setSettings(updatedSettings);
			if (
				!settings.hapticFeedback &&
				updatedSettings.hapticFeedback &&
				hapticFeedback
			)
				void hapticFeedback.trigger("selection").catch(() => undefined);
		}
	};
	const openSettings = (returnTo: "home" | "game" = "home") => {
		runDomainAction(t("appError.settingsOpen"), () => {
			if (settingsService) setSettings(settingsService.beginEditing());
			setSettingsSaveError(undefined);
			setIsSettingsSaveDialogOpen(false);
			setSettingsReturnScreen(returnTo);
			setScreen("settings");
		});
	};
	const closeSettings = () => {
		setSettingsSaveError(undefined);
		if (settingsService) setSettings(settingsService.finishEditing());
		setScreen(settingsReturnScreen);
		if (settingsReturnScreen === "home") {
			initialHomeSynchronizationStartedRef.current = true;
			void synchronizeSettingsOnHome();
		}
	};
	const synchronizeSettingsOnHome = useCallback(async () => {
		if (!settingsService) return;
		activeSettingsOperationsRef.current++;
		setIsSavingSettings(true);
		setSettingsSaveError(undefined);
		try {
			setSettings(await settingsService.synchronizeOnHome());
			setIsSettingsSaveDialogOpen(false);
		} catch (error) {
			setSettingsSaveError(guiErrorText(error, t));
			setIsSettingsSaveDialogOpen(true);
		} finally {
			activeSettingsOperationsRef.current--;
			if (activeSettingsOperationsRef.current === 0) setIsSavingSettings(false);
		}
	}, [settingsService, t]);
	useEffect(() => {
		if (screen !== "home" || initialHomeSynchronizationStartedRef.current)
			return;
		const timeout = window.setTimeout(() => {
			initialHomeSynchronizationStartedRef.current = true;
			void synchronizeSettingsOnHome();
		}, 0);
		return () => window.clearTimeout(timeout);
	}, [screen, synchronizeSettingsOnHome]);
	const goHome = () => {
		initialHomeSynchronizationStartedRef.current = true;
		setScreen("home");
		void synchronizeSettingsOnHome();
	};
	const retrySavingSettings = async () => {
		if (activeSettingsOperationsRef.current > 0 || !settingsService) return;
		activeSettingsOperationsRef.current++;
		setIsSavingSettings(true);
		setSettingsSaveError(undefined);
		try {
			setSettings(await settingsService.retrySaving());
			setIsSettingsSaveDialogOpen(false);
		} catch (error) {
			setSettingsSaveError(guiErrorText(error, t));
		} finally {
			activeSettingsOperationsRef.current--;
			if (activeSettingsOperationsRef.current === 0) setIsSavingSettings(false);
		}
	};
	const cancelSavingSettings = () => {
		if (activeSettingsOperationsRef.current > 0) return;
		if (settingsService) setSettings(settingsService.cancelSaving());
		setIsSettingsSaveDialogOpen(false);
		setSettingsSaveError(undefined);
	};
	const exitApplication = () => {
		if (applicationLifecycle?.isNativePlatform())
			applicationLifecycle.exitApplication();
		else setIsBrowserExited(true);
	};
	const openAppExitDialog = () => {
		setIsExitGracePeriodExpired(false);
		setIsAppExitDialogOpen(true);
	};
	const canExitApplication = activeWriteCount === 0 || isExitGracePeriodExpired;
	const attemptExitApplication = () => {
		if (canExitApplication) exitApplication();
	};
	useEffect(() => {
		if (!isAppExitDialogOpen) return;
		const timer = window.setTimeout(
			() => setIsExitGracePeriodExpired(true),
			2_000,
		);
		return () => window.clearTimeout(timer);
	}, [isAppExitDialogOpen]);
	useBackHandler(
		() => {
			if (isAppExitDialogOpen) {
				attemptExitApplication();
				return;
			}
			if (screen === "home") openAppExitDialog();
			else if (screen === "settings") closeSettings();
			else if (
				screen === "gameEditor" ||
				screen === "roleDistribution" ||
				screen === "rolesForShowing"
			)
				setScreen("game");
			else goHome();
		},
		true,
		0,
	);

	if (isBrowserExited) {
		return (
			<main className="app-shell form-shell">
				<section className="form-screen empty-state">
					<h1>{t("app.exited")}</h1>
					<button type="button" onClick={() => setIsBrowserExited(false)}>
						{t("app.restart")}
					</button>
				</section>
			</main>
		);
	}
	const loadGame = async (gameId: string): Promise<void> => {
		if (!gamePersistenceService) return;
		const game = await gamePersistenceService.loadGame(gameId);
		setLoadedGame(game);
		setScreen("game");
	};
	const continueGame = async (): Promise<void> => {
		setApplicationError(undefined);
		if (loadedGame) {
			setScreen("game");
			return;
		}
		if (continueGameId && gamePersistenceService) {
			try {
				await loadGame(continueGameId);
			} catch (error) {
				reportApplicationError(t("appError.continueLastGame"), error);
			}
			return;
		}
		runDomainAction(t("appError.continueGame"), () => onContinueGame?.());
	};
	const settingsScreen = (
		<SettingsScreen
			settings={settings}
			translationLanguage={contentLanguage}
			onSettingsChange={updateSettings}
			onBack={closeSettings}
			libraryBackupService={libraryUseCases?.backup}
			canShare={applicationLifecycle?.isNativePlatform() ?? false}
		/>
	);
	const newGameScreen =
		screen === "newGame" ? (
			<NewGameScreen
				language={contentLanguage}
				onBack={() => {
					if (newGameOrigin === "scenarios") setScreen("scenarios");
					else goHome();
				}}
				gamePreparationService={gamePreparationService}
				gamePersistenceService={gamePersistenceService}
				libraryBrowseService={libraryBrowseService}
				initialSelection={newGameSelection}
				onSelectionChange={setNewGameSelection}
				onGamePrepared={(game) => {
					const prepared = runDomainAction(
						t("appError.openPreparedGame"),
						() =>
							gameSessionService
								? gameSessionService.setPreparedGame(game)
								: {
										storageKey: null,
										id: game.id,
										name: game.name,
										displayName: game.name,
										document: game,
									},
					);
					if (!prepared) return;
					setLoadedGame(prepared);
					setNewGameOrigin("home");
					setScreen("game");
				}}
			/>
		) : null;
	if (screen === "newGame" && newGameOrigin === "home")
		return renderWithApplicationError(newGameScreen);
	if (
		loadedGame &&
		(screen === "game" ||
			screen === "gameEditor" ||
			screen === "roleDistribution" ||
			(screen === "rolesForShowing" && Boolean(gameSessionService)) ||
			(screen === "settings" && settingsReturnScreen === "game"))
	) {
		const isSettingsOverGame = screen === "settings";
		const isEditorOverGame = screen === "gameEditor";
		const isRoleDistributionOverGame = screen === "roleDistribution";
		const isRolesForShowingOverGame = screen === "rolesForShowing";
		const isGameScreenInactive =
			isSettingsOverGame ||
			isEditorOverGame ||
			isRoleDistributionOverGame ||
			isRolesForShowingOverGame;
		return renderWithApplicationError(
			<>
				<div className="game-screen-layer" inert={isGameScreenInactive}>
					<GameScreen
						game={loadedGame}
						active={!isGameScreenInactive}
						language={contentLanguage}
						theme={resolvedTheme}
						reduceMotion={reduceMotion}
						hideExpiredStatuses={settings.hideExpiredStatuses}
						initialSeatOrderUnlocked={settings.unlockSeatOrderByDefault}
						seatCircleFirstSeatAtTop={settings.seatCircleFirstSeatAtTop}
						seatCircleClockwise={settings.seatCircleClockwise}
						showRoleSymbols={settings.showRoleSymbols}
						seatBoardBackgroundSource={gameBoardBackgroundSource}
						onBack={goHome}
						isDirty={gameSessionService?.isLoadedGameDirty() ?? false}
						onSave={async () => {
							if (!gamePersistenceService) return;
							setLoadedGame(await gamePersistenceService.saveLoadedGame());
						}}
						onRestorePreviousFile={async (commandId) => {
							if (!gamePersistenceService)
								throw new GuiDisplayError(t("appError.restoreOldFile"));
							await gamePersistenceService.resolveWriteRecovery(
								commandId,
								"cancel",
							);
						}}
						onRetryStorageCommand={async (commandId) => {
							if (!gamePersistenceService)
								throw new GuiDisplayError(t("appError.retryStorageCommand"));
							setLoadedGame(
								await gamePersistenceService.retryLoadedGameSave(commandId),
							);
						}}
						onFinishStorageCommand={async (commandId) => {
							if (!gamePersistenceService)
								throw new GuiDisplayError(t("appError.finishStorageCommand"));
							await gamePersistenceService.finishInternalStorageCommand(
								commandId,
							);
						}}
						onContinueCreatedStorageCommand={async (commandId, decision) => {
							if (!gamePersistenceService)
								throw new GuiDisplayError(t("appError.continueStorageCommand"));
							setLoadedGame(
								await gamePersistenceService.continuePendingCreatedDocument(
									commandId,
									decision,
								),
							);
						}}
						onSuggestSaveAsName={async () => {
							if (!gamePersistenceService)
								throw new GuiDisplayError(t("appError.saveGamesUnavailable"));
							return await gamePersistenceService.suggestLoadedGameSaveAsName();
						}}
						onSaveAs={async (name) => {
							if (!gamePersistenceService)
								throw new GuiDisplayError(t("appError.saveGamesUnavailable"));
							setLoadedGame(
								await gamePersistenceService.saveLoadedGameAs(name),
							);
						}}
						onSuggestTemplateName={async () => {
							if (!gamePersistenceService)
								throw new GuiDisplayError(
									t("appError.saveTemplatesUnavailable"),
								);
							return await gamePersistenceService.suggestLoadedGameTemplateName();
						}}
						onSaveAsTemplate={async (name) => {
							if (!gamePersistenceService)
								throw new GuiDisplayError(
									t("appError.saveTemplatesUnavailable"),
								);
							await gamePersistenceService.saveLoadedGameAsTemplate(name);
						}}
						onExit={() => {
							setLoadedGame(undefined);
							goHome();
						}}
						onManageGameEntities={() => setScreen("gameEditor")}
						onRandomizeRoles={() => setScreen("roleDistribution")}
						onShufflePlayers={() => {
							if (!gameSessionService) return false;
							const updated = runDomainAction(
								t("appError.changeSeatOrder"),
								() => gameSessionService.shuffleLoadedPlayers(),
							);
							if (!updated) return false;
							setLoadedGame(updated);
							return true;
						}}
						onEditRolesForShowing={() => setScreen("rolesForShowing")}
						onOpenSettings={() => openSettings("game")}
						onMoveSeat={(command) => {
							if (!gameSessionService) return false;
							const updated = runDomainAction(
								t("appError.changeSeatOrder"),
								() => gameSessionService.moveLoadedSeat(command),
							);
							if (!updated) return false;
							setLoadedGame(updated);
							return true;
						}}
						onMoveShownRole={(command) => {
							if (!gameSessionService) return false;
							const updated = runDomainAction(t("appError.savePlayer"), () =>
								gameSessionService.moveLoadedShownRole(command),
							);
							if (!updated) return false;
							setLoadedGame(updated);
							return true;
						}}
						onShownRoleLongPress={() => triggerHapticFeedback("selection")}
						onChangeShownRole={(command) => {
							if (!gameSessionService) return false;
							const updated = runDomainAction(t("appError.savePlayer"), () =>
								gameSessionService.changeLoadedShownRole(command),
							);
							if (!updated) return false;
							setLoadedGame(updated);
							return true;
						}}
						onSavePlayer={(command) => {
							if (!gameSessionService) return false;
							const updated = runDomainAction(t("appError.savePlayer"), () =>
								gameSessionService.saveLoadedPlayer(command),
							);
							if (!updated) return false;
							setLoadedGame(updated);
							return true;
						}}
						onDeleteEmptySeat={(seatNumber) => {
							if (!gameSessionService) return false;
							const updated = runDomainAction(
								t("appError.deleteEmptySeat"),
								() => gameSessionService.deleteLoadedEmptySeat(seatNumber),
							);
							if (!updated) return false;
							setLoadedGame(updated);
							return true;
						}}
						onDeletePlayer={(seatNumber) => {
							if (!gameSessionService) return false;
							const updated = runDomainAction(t("appError.deletePlayer"), () =>
								gameSessionService.deleteLoadedPlayerAtSeat(seatNumber),
							);
							if (!updated) return false;
							setLoadedGame(updated);
							return true;
						}}
						onDeleteLogEntry={(logEntryId) => {
							if (!gameSessionService) return false;
							const updated = runDomainAction(t("common.delete"), () =>
								gameSessionService.deleteLoadedGameLogEntry(logEntryId),
							);
							if (!updated) return false;
							setLoadedGame(updated);
							return true;
						}}
						onClearLog={() => {
							if (!gameSessionService) return false;
							const updated = runDomainAction(t("common.delete"), () =>
								gameSessionService.clearLoadedGameLog(),
							);
							if (!updated) return false;
							setLoadedGame(updated);
							return true;
						}}
						onUsePlayerAbility={(
							actorPlayerId,
							targetPlayerId,
							action,
							statusId,
						) => {
							if (!gameSessionService)
								return { changed: false, logEntry: null };
							const outcome = gameSessionService.useLoadedPlayerAbility(
								actorPlayerId,
								targetPlayerId,
								action,
								statusId,
							);
							if (outcome.result.changed) {
								setLoadedGame(outcome.game);
								triggerHapticFeedback("success");
							}
							return outcome.result;
						}}
						onAdvanceTime={() => {
							if (!gameSessionService) return;
							const updated = runDomainAction(t("appError.advanceTime"), () =>
								gameSessionService.advanceLoadedGameTime(),
							);
							if (updated) {
								setLoadedGame(updated);
								triggerHapticFeedback("selection");
							}
						}}
						onRewindTime={() => {
							if (!gameSessionService) return;
							const updated = runDomainAction(t("appError.rewindTime"), () =>
								gameSessionService.rewindLoadedGameTime(),
							);
							if (updated) {
								setLoadedGame(updated);
								triggerHapticFeedback("warning");
							}
						}}
					/>
				</div>
				{isSettingsOverGame ? (
					<div className="settings-over-game">{settingsScreen}</div>
				) : null}
				{isEditorOverGame ? (
					<div className="editor-over-game">
						<CurrentGameEditorScreen
							editorFactory={scenarioEditorFactory}
							game={loadedGame}
							language={contentLanguage}
							onCancel={() => setScreen("game")}
							onSave={(document) => {
								if (!gameSessionService) {
									throw new GuiDisplayError(t("appError.applyGameChanges"));
								}
								setLoadedGame(
									gameSessionService.replaceLoadedGameWithEditedCopy(document),
								);
							}}
						/>
					</div>
				) : null}
				{isRoleDistributionOverGame ? (
					<div className="role-distribution-over-game">
						<RoleDistributionFlow
							game={loadedGame.document}
							language={contentLanguage}
							onBack={() => setScreen("game")}
							initializeFromAssignments
							confirmOverwrite
							onDistribute={(mode, counts) => {
								if (!gameSessionService)
									throw new GuiDisplayError(t("appError.distributeRoles"));
								const updated =
									mode === "teams"
										? gameSessionService.assignLoadedGameRolesByTeamCounts(
												counts,
											)
										: gameSessionService.assignLoadedGameRolesByRoleCounts(
												counts,
											);
								setLoadedGame(updated);
								setScreen("game");
							}}
						/>
					</div>
				) : null}
				{isRolesForShowingOverGame && gameSessionService ? (
					<div className="roles-for-showing-over-game">
						<RolesForShowingScreen
							language={contentLanguage}
							model={gameSessionService.getLoadedRolesForShowingEditorModel()}
							onCancel={() => setScreen("game")}
							onCreatePresentation={(draft) =>
								gameSessionService.createLoadedRolesForShowingPresentation(
									draft,
								)
							}
							onSave={(draft) => {
								setLoadedGame(
									gameSessionService.updateLoadedRolesForShowing(draft),
								);
								setScreen("game");
							}}
						/>
					</div>
				) : null}
			</>,
		);
	}
	if (screen === "loadGame") {
		return renderWithApplicationError(
			<LoadGameScreen
				language={contentLanguage}
				gamePersistenceService={gamePersistenceService}
				gameSessionService={gameSessionService}
				onLoadGame={loadGame}
				onBack={goHome}
				currentGameStorageKey={loadedGame?.storageKey ?? undefined}
				onLoadedGameChanged={setLoadedGame}
				canShare={applicationLifecycle?.isNativePlatform() ?? false}
			/>,
		);
	}
	if (
		screen === "scenarios" ||
		(screen === "newGame" && newGameOrigin === "scenarios")
	) {
		const isScenarioLibraryActive = screen === "scenarios";
		return renderWithApplicationError(
			<>
				<div
					hidden={!isScenarioLibraryActive}
					inert={!isScenarioLibraryActive}
					aria-hidden={isScenarioLibraryActive ? undefined : true}
				>
					<ScenarioLibrary
						active={isScenarioLibraryActive}
						editorFactory={scenarioEditorFactory}
						language={contentLanguage}
						onBack={goHome}
						libraryBrowseService={libraryBrowseService}
						scenarioImportService={libraryUseCases?.import}
						scenarioManagementService={libraryUseCases?.management}
						ruleSetExportService={ruleSetExportService}
						gamePersistenceService={gamePersistenceService}
						onStartScenario={(type, id) => {
							setNewGameSelection({ type, id });
							setNewGameOrigin("scenarios");
							setScreen("newGame");
						}}
						canShare={applicationLifecycle?.isNativePlatform() ?? false}
					/>
				</div>
				{newGameScreen}
			</>,
		);
	}
	if (screen === "settings") {
		return renderWithApplicationError(settingsScreen);
	}

	return renderWithApplicationError(
		<main
			className={`app-shell${homeBackgroundSource ? " home-shell--with-background" : ""}`}
			style={
				homeBackgroundSource
					? ({
							"--home-background-image": `url("${homeBackgroundSource.replaceAll('"', "%22")}")`,
						} as CSSProperties)
					: undefined
			}
		>
			<section className="home-screen" aria-labelledby="app-title">
				<header className="app-header">
					<p className="eyebrow">{t("home.eyebrow")}</p>
					<h1 id="app-title">Social Deduction</h1>
				</header>

				<nav className="main-menu" aria-label={t("home.mainMenu")}>
					<button
						data-testid="home-continue"
						type="button"
						className={`menu-button interactive-surface menu-button--continue${
							!hasCurrentGame ? " button-disabled" : ""
						}`}
						disabled={!hasCurrentGame}
						onClick={() => void continueGame()}
					>
						<span>{t("home.continueGame")}</span>
						<small>{effectiveCurrentGameName ?? t("home.noCurrentGame")}</small>
					</button>

					{menuItems.map((item) => (
						<button
							type="button"
							data-testid={`home-${item.screen}`}
							className={`menu-button interactive-surface${
								item.screen === "newGame" && !hasCurrentGame
									? " menu-button--primary"
									: ""
							}`}
							key={item.key}
							onClick={() => {
								if (item.screen === "newGame") {
									setNewGameOrigin("home");
									setScreen("newGame");
								}
								if (item.screen === "loadGame") setScreen("loadGame");
								if (item.screen === "scenarios") setScreen("scenarios");
								if (item.screen === "settings") openSettings("home");
							}}
						>
							{t(item.key)}
						</button>
					))}
					<button
						type="button"
						className="text-button main-menu__exit"
						onClick={openAppExitDialog}
					>
						{t("home.exitApp")}
					</button>
				</nav>
			</section>
			{isAppExitDialogOpen ? (
				<ModalDialog
					open
					onClose={() => setIsAppExitDialogOpen(false)}
					onBack={attemptExitApplication}
					role="alertdialog"
					labelledBy="app-exit-title"
					className="app-exit-dialog"
				>
					<h2 id="app-exit-title">{t("home.exitQuestion")}</h2>
					{activeWriteCount > 0 ? (
						<p>{t("home.activeWrites", { count: activeWriteCount })}</p>
					) : null}
					<div className="exit-dialog-actions">
						<button
							type="button"
							disabled={!canExitApplication}
							className={!canExitApplication ? "button-disabled" : undefined}
							onClick={attemptExitApplication}
						>
							{t(
								activeWriteCount > 0 && isExitGracePeriodExpired
									? "home.exitAnyway"
									: "home.exitConfirm",
							)}
						</button>
						<button
							type="button"
							data-modal-initial-focus
							onClick={() => setIsAppExitDialogOpen(false)}
						>
							{t("common.cancel")}
						</button>
					</div>
				</ModalDialog>
			) : null}
		</main>,
	);
}
