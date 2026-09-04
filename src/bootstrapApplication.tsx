import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppearanceService } from "./application/appearanceService";
import {
	type AppSettings,
	defaultAppSettings,
	type LocaleIdentifier,
} from "./application/appSettings";
import { createGameUseCases } from "./application/gameUseCases";
import { ImageResourceService } from "./application/imageResourceService";
import { createLibraryUseCases } from "./application/libraryUseCases";
import { MotionPreferenceService } from "./application/motionPreferenceService";
import { PersistenceActivityService } from "./application/persistenceActivityService";
import { RuleSetExportService } from "./application/ruleSetExportService";
import { SettingsService } from "./application/settingsService";
import { App } from "./gui/App";
import { ApplicationErrorBoundary } from "./gui/ApplicationErrorBoundary";
import { BackNavigationProvider } from "./gui/backNavigation";
import type { GuiTranslationKey } from "./gui/i18n/de";
import {
	createGuiTranslator,
	type GuiTranslator,
	loadGuiLanguage,
} from "./gui/i18n/translate";
import { createObjectPersistence } from "./persistence/objectPersistence";
import { trackDataFileStorageWrites } from "./persistence/trackedDataFileStorage";
import { createBrowserPreferenceAdapters } from "./platform/browserPreferenceAdapters";
import { CapacitorApplicationLifecycleAdapter } from "./platform/capacitorApplicationLifecycleAdapter";
import { CapacitorHapticFeedbackAdapter } from "./platform/capacitorHapticFeedbackAdapter";
import { CapacitorScreenOrientationAdapter } from "./platform/capacitorScreenOrientationAdapter";
import { CapacitorScreenWakeLockAdapter } from "./platform/capacitorScreenWakeLockAdapter";
import { SystemClock } from "./platform/systemClock";
import { SystemIdGenerator } from "./platform/systemIdGenerator";
import { getSystemLanguage } from "./platform/systemLanguage";
import { BrowserDataFileStorage } from "./storage/browserDataFileStorage";
import { BrowserImageResourceStorage } from "./storage/browserImageResourceStorage";
import { BrowserSettingsStorage } from "./storage/browserSettingsStorage";
import { CapacitorDataFileStorage } from "./storage/capacitorDataFileStorage";
import { CapacitorImageResourceStorage } from "./storage/capacitorImageResourceStorage";
import { CapacitorSettingsStorage } from "./storage/capacitorSettingsStorage";

export type BootstrapRenderState = Readonly<{
	effectiveLanguage: string;
	initialError?: string;
	initialSettings: AppSettings;
}>;

export type BootstrapApplicationServices = Readonly<{
	platformErrors: readonly string[];
	initializeDataFiles?: () => Promise<void>;
	repairInternalDataFileNames: () => Promise<unknown>;
	settingsService: Readonly<{
		load: () => Promise<AppSettings>;
		getEffectiveLocale: (preference: string) => LocaleIdentifier;
	}>;
	motionPreferenceService: Readonly<{
		setAppReduceMotion: (reduceMotion: boolean) => void;
	}>;
	render: (rootElement: HTMLElement, state: BootstrapRenderState) => void;
}>;

export type BootstrapApplicationOptions = Readonly<{
	rootElement?: HTMLElement | null;
	services?: BootstrapApplicationServices;
	getSystemLanguage?: () => Promise<string | undefined>;
	loadGuiLanguage?: (language: string) => Promise<void>;
	createGuiTranslator?: (language: string) => GuiTranslator;
	setDocumentLanguage?: (language: string) => void;
}>;

export async function bootstrapApplication(
	options: BootstrapApplicationOptions = {},
): Promise<void> {
	const rootElement = Object.hasOwn(options, "rootElement")
		? options.rootElement
		: document.getElementById("root");
	const resolveSystemLanguage = options.getSystemLanguage ?? getSystemLanguage;
	const loadLanguage = options.loadGuiLanguage ?? loadGuiLanguage;
	const translatorFor = options.createGuiTranslator ?? createGuiTranslator;
	if (!rootElement) {
		const systemLanguage = (await resolveSystemLanguage()) ?? "en";
		await loadLanguage(systemLanguage);
		throw new Error(translatorFor(systemLanguage)("startup.rootMissing"));
	}

	const services = options.services ?? createProductionBootstrapServices();
	let initialError = services.platformErrors.length
		? services.platformErrors.join(" ")
		: undefined;
	const startupErrors: Array<{ key: GuiTranslationKey; cause: unknown }> = [];
	if (services.initializeDataFiles) {
		try {
			await services.initializeDataFiles();
		} catch (error) {
			startupErrors.push({ key: "startup.initializeFiles", cause: error });
		}
	}
	try {
		await services.repairInternalDataFileNames();
	} catch (error) {
		startupErrors.push({ key: "startup.repairFileNames", cause: error });
	}
	let initialSettings = defaultAppSettings;
	try {
		initialSettings = await services.settingsService.load();
	} catch (error) {
		startupErrors.push({ key: "startup.loadSettings", cause: error });
	}
	const effectiveLocale = services.settingsService.getEffectiveLocale(
		initialSettings.language,
	);
	const effectiveLanguage = effectiveLocale.languageTag;
	await loadLanguage(effectiveLanguage);
	(options.setDocumentLanguage ?? setDocumentLanguage)(effectiveLanguage);
	const startupT = translatorFor(effectiveLanguage);
	for (const failure of startupErrors)
		initialError = appendError(
			initialError,
			`${startupT(failure.key)} ${toErrorMessage(failure.cause, startupT("error.unknown"))}`,
		);
	services.motionPreferenceService.setAppReduceMotion(
		initialSettings.reduceMotion,
	);
	services.render(rootElement, {
		effectiveLanguage,
		initialError,
		initialSettings,
	});
}

export function createProductionBootstrapServices(): BootstrapApplicationServices {
	const applicationLifecycle = new CapacitorApplicationLifecycleAdapter();
	const isNative = applicationLifecycle.isNativePlatform();
	const hapticFeedback = new CapacitorHapticFeedbackAdapter();
	const screenOrientation = new CapacitorScreenOrientationAdapter();
	const screenWakeLock = new CapacitorScreenWakeLockAdapter();
	const {
		systemThemeAdapter,
		motionPreferenceAdapter,
		errors: platformErrors,
	} = createBrowserPreferenceAdapters();
	const appearanceService = new AppearanceService(systemThemeAdapter);
	const motionPreferenceService = new MotionPreferenceService(
		motionPreferenceAdapter,
	);
	const settingsService = new SettingsService(
		isNative ? new CapacitorSettingsStorage() : new BrowserSettingsStorage(),
		appearanceService,
		{ getSystemLanguage },
	);
	const persistenceActivity = new PersistenceActivityService();
	const rawDataFileStorage = isNative
		? new CapacitorDataFileStorage()
		: new BrowserDataFileStorage();
	const domainServices = {
		clock: new SystemClock(),
		idGenerator: new SystemIdGenerator(),
	};
	const dataFileStorage = trackDataFileStorageWrites(
		rawDataFileStorage,
		persistenceActivity,
	);
	const objectPersistence = createObjectPersistence(
		dataFileStorage,
		domainServices,
	);
	const gameUseCases = createGameUseCases(objectPersistence, domainServices);
	const libraryUseCases = createLibraryUseCases(
		objectPersistence,
		domainServices,
	);
	const ruleSetExportService = new RuleSetExportService(
		objectPersistence.transfer,
	);
	const imageResourceService = new ImageResourceService(
		isNative
			? new CapacitorImageResourceStorage()
			: new BrowserImageResourceStorage(),
		appearanceService,
	);

	return {
		platformErrors,
		...(rawDataFileStorage instanceof CapacitorDataFileStorage
			? {
					initializeDataFiles: () => rawDataFileStorage.initializeFromBundle(),
				}
			: {}),
		repairInternalDataFileNames: () =>
			objectPersistence.maintenance.repairInternalDataFileNames(),
		settingsService,
		motionPreferenceService,
		render: (rootElement, state) => {
			createRoot(rootElement).render(
				<StrictMode>
					<ApplicationErrorBoundary language={state.effectiveLanguage}>
						<BackNavigationProvider applicationLifecycle={applicationLifecycle}>
							<App
								gameUseCases={gameUseCases}
								libraryUseCases={libraryUseCases}
								ruleSetExportService={ruleSetExportService}
								imageResourceService={imageResourceService}
								appearanceService={appearanceService}
								motionPreferenceService={motionPreferenceService}
								initialError={state.initialError}
								initialSettings={state.initialSettings}
								settingsService={settingsService}
								applicationLifecycle={applicationLifecycle}
								persistenceActivity={persistenceActivity}
								hapticFeedback={hapticFeedback}
								screenOrientation={screenOrientation}
								screenWakeLock={screenWakeLock}
							/>
						</BackNavigationProvider>
					</ApplicationErrorBoundary>
				</StrictMode>,
			);
		},
	};
}

function setDocumentLanguage(language: string): void {
	document.documentElement.lang = language;
}

function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

function appendError(current: string | undefined, next: string): string {
	return current ? `${current} ${next}` : next;
}
