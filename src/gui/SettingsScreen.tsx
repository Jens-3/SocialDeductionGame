import { useId, useRef, useState } from "react";
import agplLicenseText from "../../LICENSE?raw";
import thirdPartyLicenseText from "../../THIRD_PARTY_LICENSES.txt?raw";
import { appMetadata } from "../application/appMetadata";
import type {
	AppSettings,
	TextSize,
	ThemePreference,
} from "../application/appSettings";
import type {
	LibraryBackupService,
	LibraryRestorePreview,
} from "../application/libraryUseCases";
import { guiErrorText } from "./applicationFailurePresentation";
import { applicationObjectSuccessText } from "./applicationSuccessPresentation";
import { supportedGuiLanguageTags } from "./i18n/registry";
import { createGuiTranslator } from "./i18n/translate";
import { ModalDialog } from "./ModalDialog";

export type SettingsScreenProps = {
	onBack: () => void;
	settings: AppSettings;
	translationLanguage?: string;
	onSettingsChange: (settings: AppSettings) => void;
	libraryBackupService?: LibraryBackupService;
	isSaving?: boolean;
	saveError?: string;
	canShare?: boolean;
};

const languageDisplayNameOverrides: Readonly<Record<string, string>> = {
	as: "Assamese",
	ay: "Aymara",
	bm: "Bambara",
	bo: "Tibetan",
	bs: "Bosnian",
	bt: "Tibetan",
	cop: "Coptic",
	crs: "Seychellois Creole",
	cy: "Welsh",
	dsb: "Lower Sorbian",
	dv: "Dhivehi",
	dz: "Dzongkha",
	ee: "Ewe",
	ems: "Alutiiq / Sugpiaq",
	eo: "Esperanto",
	ff: "Fulfulde",
	fj: "Fijian",
	fy: "West Frisian",
	ga: "Irish",
	gd: "Scottish Gaelic",
	gn: "Guarani",
	ha: "Hausa",
	hsb: "Upper Sorbian",
	ht: "Haitian Creole",
	ig: "Igbo",
	"iu-Cans": "Inuktitut (Syllabics)",
	"iu-Latn": "Inuktitut (Latin)",
	jbn: "Nafusi",
	jv: "Javanese",
	kg: "Kikongo / Kongo",
	kl: "Kalaallisut / Greenlandic",
	km: "Khmer",
	ku: "Kurdish (Kurmanji)",
	ktu: "Kituba",
	la: "Latin",
	lb: "Luxembourgish",
	lg: "Luganda",
	ln: "Lingala",
	lua: "Tshiluba / Luba-Lulua",
	mg: "Malagasy",
	mh: "Marshallese",
	ml: "Malayalam",
	mt: "Maltese",
	nds: "Low German",
	ne: "Nepali",
	nn: "Norwegian Nynorsk",
	nr: "Southern Ndebele",
	nso: "Sepedi / Nord-Sotho",
	ny: "Chichewa",
	om: "Oromo",
	or: "Odia",
	ps: "Pashto",
	qu: "Quechua",
	rmo: "Sintitikes / Sinte Romani",
	rn: "Kirundi",
	rw: "Kinyarwanda",
	sd: "Sindhi",
	sg: "Sango",
	sm: "Samoan",
	sn: "Shona",
	so: "Somali",
	ss: "Swati",
	st: "Southern Sotho",
	su: "Sundanese",
	syr: "Syriac",
	tet: "Tetum",
	tg: "Tajik",
	thv: "Tahaggart-Tamahaq",
	ti: "Tigrinya",
	tk: "Turkmen",
	tn: "Tswana",
	to: "Tongan",
	tpi: "Tok Pisin",
	ts: "Tsonga",
	tw: "Twi",
	ug: "Uyghur",
	ve: "Venda",
	wo: "Wolof",
	xh: "Xhosa",
	yi: "Yiddish",
	yo: "Yoruba",
	ynk: "Naukan-Yupik",
	zgh: "Standard Moroccan Tamazight",
};

export function SettingsScreen({
	onBack,
	settings,
	translationLanguage = settings.language,
	onSettingsChange,
	libraryBackupService,
	isSaving = false,
	saveError,
	canShare = false,
}: SettingsScreenProps) {
	const {
		language,
		theme,
		textSize,
		reduceMotion,
		hideExpiredStatuses,
		unlockSeatOrderByDefault,
		seatCircleFirstSeatAtTop,
		seatCircleClockwise,
		showRoleSymbols,
		keepScreenAwake,
		hapticFeedback,
		autoRotate,
	} = settings;
	const t = createGuiTranslator(translationLanguage);
	const languageOptions: ReadonlyArray<readonly [string, string]> = [
		["system", t("settings.language.system")],
		...supportedGuiLanguageTags
			.map(
				(languageTag) =>
					[languageTag, displayLanguageName(languageTag)] as const,
			)
			.sort(([leftTag], [rightTag]) => compareLanguageTags(leftTag, rightTag)),
	];
	const restoreInputRef = useRef<HTMLInputElement>(null);
	const [restoreFile, setRestoreFile] = useState<File>();
	const [restorePreview, setRestorePreview] = useState<LibraryRestorePreview>();
	const [libraryMessage, setLibraryMessage] = useState<string>();
	const [libraryError, setLibraryError] = useState<string>();
	const [isResolvingRestore, setIsResolvingRestore] = useState(false);
	const [isLicenseOpen, setIsLicenseOpen] = useState(false);
	const [isThirdPartyLicensesOpen, setIsThirdPartyLicensesOpen] =
		useState(false);
	const resolvingRestoreRef = useRef(false);
	const exportBackup = async () => {
		if (!libraryBackupService) return;
		setLibraryError(undefined);
		try {
			await libraryBackupService.exportLibraryBackup();
			setLibraryMessage(t("settings.backupCreated"));
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") return;
			setLibraryError(guiErrorText(error, t));
		}
	};
	const shareBackup = async () => {
		if (!libraryBackupService) return;
		setLibraryError(undefined);
		try {
			await libraryBackupService.shareLibraryBackup();
			setLibraryMessage(t("settings.backupShared"));
		} catch (error) {
			setLibraryError(guiErrorText(error, t));
		}
	};
	const restoreBackup = async (
		resolution: "replace" | "repair" | "importValidObjects",
	) => {
		if (!libraryBackupService || !restorePreview || resolvingRestoreRef.current)
			return;
		resolvingRestoreRef.current = true;
		setIsResolvingRestore(true);
		setLibraryError(undefined);
		try {
			const result = await libraryBackupService.resolveLibraryBackupRestore(
				restorePreview.commandId,
				resolution,
			);
			const discarded =
				resolution === "importValidObjects"
					? (result?.preview.discardedObjectCount ?? 0)
					: 0;
			setLibraryMessage(
				discarded > 0
					? t("settings.restoreDiscarded", { count: discarded })
					: result
						? applicationObjectSuccessText(result, t)
						: t("settings.restoreComplete"),
			);
			setRestoreFile(undefined);
			setRestorePreview(undefined);
		} catch (error) {
			setLibraryError(guiErrorText(error, t));
		} finally {
			resolvingRestoreRef.current = false;
			setIsResolvingRestore(false);
		}
	};
	const cancelRestore = async () => {
		if (!libraryBackupService || !restorePreview || resolvingRestoreRef.current)
			return;
		resolvingRestoreRef.current = true;
		setIsResolvingRestore(true);
		setLibraryError(undefined);
		try {
			await libraryBackupService.resolveLibraryBackupRestore(
				restorePreview.commandId,
				"cancel",
			);
		} catch (error) {
			setLibraryError(guiErrorText(error, t));
		} finally {
			resolvingRestoreRef.current = false;
			setIsResolvingRestore(false);
			setRestoreFile(undefined);
			setRestorePreview(undefined);
		}
	};

	return (
		<main className="app-shell settings-shell">
			<section className="settings-screen" aria-labelledby="settings-title">
				<header className="screen-header settings-header">
					<button
						type="button"
						data-testid="settings-back"
						className={isSaving ? "icon-button button-disabled" : "icon-button"}
						disabled={isSaving}
						onClick={onBack}
					>
						<span aria-hidden="true">‹</span>
						<span className="visually-hidden">{t("common.back")}</span>
					</button>
					<h1 id="settings-title">{t("settings.title")}</h1>
				</header>

				<SettingsGroup title={t("settings.general")}>
					<LanguageSelect
						testId="settings-language"
						label={t("settings.language")}
						closeLabel={t("common.close")}
						value={language}
						disabled={isSaving}
						onChange={(value) => {
							onSettingsChange({ ...settings, language: value });
						}}
						options={languageOptions}
					/>
					<SettingSelect
						testId="settings-theme"
						label={t("settings.appearance")}
						value={theme}
						disabled={isSaving}
						onChange={(value) =>
							onSettingsChange({
								...settings,
								theme: value as ThemePreference,
							})
						}
						options={[
							["system", t("settings.theme.system")],
							["light", t("settings.theme.light")],
							["dark", t("settings.theme.dark")],
						]}
					/>
				</SettingsGroup>

				<SettingsGroup title={t("settings.duringGame")}>
					<label className="setting-row">
						<span>{t("game.unlockSeatOrder")}</span>
						<input
							data-testid="settings-keep-awake"
							type="checkbox"
							className="switch-input"
							checked={unlockSeatOrderByDefault}
							disabled={isSaving}
							onChange={(event) =>
								onSettingsChange({
									...settings,
									unlockSeatOrderByDefault: event.target.checked,
								})
							}
						/>
					</label>
					<label className="setting-row">
						<span>
							{t(
								seatCircleFirstSeatAtTop
									? "settings.seatCircleNorthFirst"
									: "settings.seatCircleNorthLast",
							)}
						</span>
						<input
							data-testid="settings-haptics"
							type="checkbox"
							className="switch-input"
							checked={seatCircleFirstSeatAtTop}
							disabled={isSaving}
							onChange={(event) =>
								onSettingsChange({
									...settings,
									seatCircleFirstSeatAtTop: event.target.checked,
								})
							}
						/>
					</label>
					<label className="setting-row">
						<span>
							{t(
								seatCircleClockwise
									? "settings.seatCircleClockwise"
									: "settings.seatCircleCounterClockwise",
							)}
						</span>
						<input
							data-testid="settings-auto-rotate"
							type="checkbox"
							className="switch-input"
							checked={seatCircleClockwise}
							disabled={isSaving}
							onChange={(event) =>
								onSettingsChange({
									...settings,
									seatCircleClockwise: event.target.checked,
								})
							}
						/>
					</label>
					<label className="setting-row">
						<span>{t("settings.hideExpiredStatuses")}</span>
						<input
							type="checkbox"
							className="switch-input"
							checked={hideExpiredStatuses}
							disabled={isSaving}
							onChange={(event) =>
								onSettingsChange({
									...settings,
									hideExpiredStatuses: event.target.checked,
								})
							}
						/>
					</label>
					<label className="setting-row">
						<span>{t("rolesForShowing.showSymbol")}</span>
						<input
							type="checkbox"
							className="switch-input"
							checked={showRoleSymbols}
							disabled={isSaving}
							onChange={(event) =>
								onSettingsChange({
									...settings,
									showRoleSymbols: event.target.checked,
								})
							}
						/>
					</label>
					<label className="setting-row">
						<span>{t("settings.keepScreenAwake")}</span>
						<input
							type="checkbox"
							className="switch-input"
							checked={keepScreenAwake}
							disabled={isSaving}
							onChange={(event) =>
								onSettingsChange({
									...settings,
									keepScreenAwake: event.target.checked,
								})
							}
						/>
					</label>
					<label className="setting-row">
						<span>{t("settings.hapticFeedback")}</span>
						<input
							type="checkbox"
							className="switch-input"
							checked={hapticFeedback}
							disabled={isSaving}
							onChange={(event) =>
								onSettingsChange({
									...settings,
									hapticFeedback: event.target.checked,
								})
							}
						/>
					</label>
					<label className="setting-row">
						<span>{t("settings.autoRotate")}</span>
						<input
							type="checkbox"
							className="switch-input"
							checked={autoRotate}
							disabled={isSaving}
							onChange={(event) =>
								onSettingsChange({
									...settings,
									autoRotate: event.target.checked,
								})
							}
						/>
					</label>
				</SettingsGroup>

				<SettingsGroup title={t("settings.accessibility")}>
					<SettingSelect
						label={t("settings.textSize")}
						value={textSize}
						disabled={isSaving}
						onChange={(value) =>
							onSettingsChange({
								...settings,
								textSize: value as TextSize,
							})
						}
						options={[
							["small", t("settings.textSize.small")],
							["standard", t("settings.textSize.standard")],
							["large", t("settings.textSize.large")],
						]}
					/>
					<label className="setting-row">
						<span>{t("settings.reduceMotion")}</span>
						<input
							type="checkbox"
							className="switch-input"
							checked={reduceMotion}
							disabled={isSaving}
							onChange={(event) =>
								onSettingsChange({
									...settings,
									reduceMotion: event.target.checked,
								})
							}
						/>
					</label>
				</SettingsGroup>

				<SettingsGroup title={t("settings.data")}>
					<button
						data-testid="settings-export"
						type="button"
						className="setting-row setting-action-button"
						onClick={() => void exportBackup()}
						disabled={!libraryBackupService || isSaving}
					>
						<span>{t("settings.createBackup")}</span>
						<small>{t("settings.exportLibrary")}</small>
					</button>
					{canShare ? (
						<button
							data-testid="settings-share"
							type="button"
							className="setting-row setting-action-button"
							onClick={() => void shareBackup()}
							disabled={!libraryBackupService || isSaving}
						>
							<span>{t("settings.shareBackup")}</span>
							<small>{t("settings.shareLibrary")}</small>
						</button>
					) : null}
					<button
						data-testid="settings-restore"
						type="button"
						className="setting-row setting-action-button"
						onClick={() => restoreInputRef.current?.click()}
						disabled={!libraryBackupService || isSaving}
					>
						<span>{t("settings.restoreLibrary")}</span>
						<small>{t("settings.replaceLibrary")}</small>
					</button>
					<input
						data-testid="settings-restore-input"
						ref={restoreInputRef}
						type="file"
						accept=".json,application/json"
						className="visually-hidden"
						aria-label={t("settings.restoreLibrary")}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (file && libraryBackupService) {
								setLibraryError(undefined);
								void libraryBackupService
									.prepareLibraryBackupRestore(file)
									.then((preview) => {
										setRestoreFile(file);
										setRestorePreview(preview);
									})
									.catch((error: unknown) =>
										setLibraryError(guiErrorText(error, t)),
									);
							}
							event.target.value = "";
						}}
					/>
				</SettingsGroup>
				{libraryMessage ? (
					<p className="prototype-note" role="status">
						{libraryMessage}
					</p>
				) : null}
				{libraryError ? (
					<p className="load-error" role="alert">
						{libraryError}
					</p>
				) : null}
				{saveError ? (
					<p className="load-error" role="alert">
						{saveError}
					</p>
				) : null}
				{restoreFile && restorePreview ? (
					<ModalDialog
						open
						onClose={() => void cancelRestore()}
						className="library-restore-dialog"
						role="alertdialog"
						labelledBy="library-restore-title"
					>
						<h2 id="library-restore-title">{t("settings.replaceQuestion")}</h2>
						<p>
							{t("settings.replaceDescription", {
								fileName: restoreFile.name,
							})}
							<br />
							{t("settings.currentStorageVersion")}:{" "}
							{restorePreview.currentStorageVersion ?? t("settings.unknown")}
							<br />
							{t("settings.importedStorageVersion")}:{" "}
							{restorePreview.importedStorageVersion}
							<br />
							{t("settings.validRuleSets")}: {restorePreview.validObjectCount}
							<br />
							{t("settings.discardedRuleSets")}:{" "}
							{restorePreview.discardedObjectCount}
							{restorePreview.discardedRuleSetIds.length > 0 ? (
								<>
									<br />
									{t("settings.invalidRuleSetsDiscarded", {
										ids: restorePreview.discardedRuleSetIds.join(", "),
									})}
								</>
							) : null}
						</p>
						<div>
							<button
								type="button"
								data-modal-initial-focus
								disabled={isResolvingRestore}
								onClick={() => void cancelRestore()}
							>
								{t("common.cancel")}
							</button>
							{hasRestoreDecision(restorePreview, "importValidObjects") ? (
								<>
									<button
										type="button"
										disabled={isResolvingRestore}
										onClick={() => void restoreBackup("importValidObjects")}
									>
										{t("settings.importValidOnly")}
									</button>
									<button
										type="button"
										disabled={isResolvingRestore}
										onClick={() => void restoreBackup("repair")}
									>
										{t("settings.tryRepair")}
									</button>
								</>
							) : hasRestoreDecision(restorePreview, "repair") ? (
								<button
									data-testid="settings-restore-confirm"
									type="button"
									disabled={isResolvingRestore}
									onClick={() => void restoreBackup("repair")}
								>
									{t("settings.tryRepair")}
								</button>
							) : (
								<button
									data-testid="settings-restore-confirm"
									type="button"
									disabled={isResolvingRestore}
									onClick={() => void restoreBackup("replace")}
								>
									{t("settings.restoreLibrary")}
								</button>
							)}
						</div>
					</ModalDialog>
				) : null}

				<SettingsGroup title={t("settings.about")}>
					<PlannedSetting
						label={t("settings.version")}
						value={appMetadata.version}
					/>
					<PlannedSetting
						label={t("settings.softwareLicense")}
						value={appMetadata.softwareLicenseName}
					/>
					<PlannedSetting
						label={t("settings.copyrightHolder")}
						value={appMetadata.author}
					/>
					<p className="license-notice">{t("settings.licenseNotice")}</p>
					<p className="license-notice">
						{t("settings.licenseSummaryDisclaimer")}
					</p>
					<button
						type="button"
						className="setting-row setting-action-button"
						onClick={() => setIsLicenseOpen(true)}
					>
						<span>{t("settings.viewLicense")}</span>
						<small>{appMetadata.licenseSpdx}</small>
					</button>
					<button
						type="button"
						className="setting-row setting-action-button"
						onClick={() => setIsThirdPartyLicensesOpen(true)}
					>
						<span>{t("settings.openSourceLicenses")}</span>
						<small>THIRD_PARTY_LICENSES.txt</small>
					</button>
				</SettingsGroup>
				{isLicenseOpen ? (
					<ModalDialog
						open
						onClose={() => setIsLicenseOpen(false)}
						className="license-dialog action-sheet"
						labelledBy="software-license-title"
					>
						<header>
							<h2 id="software-license-title">{t("settings.viewLicense")}</h2>
							<button
								type="button"
								className="sheet-close-button"
								data-modal-initial-focus
								onClick={() => setIsLicenseOpen(false)}
							>
								<span aria-hidden="true">×</span>
								<span className="visually-hidden">{t("common.close")}</span>
							</button>
						</header>
						<p className="license-dialog__copyright">
							{appMetadata.copyrightNotice}
						</p>
						<pre className="license-dialog__text">{agplLicenseText}</pre>
					</ModalDialog>
				) : null}
				{isThirdPartyLicensesOpen ? (
					<ModalDialog
						open
						onClose={() => setIsThirdPartyLicensesOpen(false)}
						className="license-dialog action-sheet"
						labelledBy="third-party-licenses-title"
					>
						<header>
							<h2 id="third-party-licenses-title">
								{t("settings.openSourceLicenses")}
							</h2>
							<button
								type="button"
								className="sheet-close-button"
								data-modal-initial-focus
								onClick={() => setIsThirdPartyLicensesOpen(false)}
							>
								<span aria-hidden="true">×</span>
								<span className="visually-hidden">{t("common.close")}</span>
							</button>
						</header>
						<pre className="license-dialog__text">{thirdPartyLicenseText}</pre>
					</ModalDialog>
				) : null}
			</section>
		</main>
	);
}

function displayLanguageName(languageTag: string): string {
	const override = languageDisplayNameOverrides[languageTag];
	if (override) return override;
	try {
		return (
			new Intl.DisplayNames([languageTag], { type: "language" }).of(
				languageTag,
			) ?? languageTag
		);
	} catch {
		return languageTag;
	}
}

function compareLanguageTags(left: string, right: string): number {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}

function hasRestoreDecision(
	preview: LibraryRestorePreview,
	decision: string,
): boolean {
	return (preview.availableDecisions as readonly string[]).includes(decision);
}

function SettingsGroup({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="settings-group">
			<h2>{title}</h2>
			<div className="settings-group__content">{children}</div>
		</section>
	);
}

function SettingSelect({
	testId,
	label,
	value,
	options,
	onChange,
	disabled = false,
}: {
	testId?: string;
	label: string;
	value: string;
	options: ReadonlyArray<readonly [string, string]>;
	onChange: (value: string) => void;
	disabled?: boolean;
}) {
	return (
		<label className="setting-row">
			<span>{label}</span>
			<select
				data-testid={testId}
				value={value}
				disabled={disabled}
				onChange={(event) => onChange(event.target.value)}
			>
				{options.map(([optionValue, optionLabel]) => (
					<option value={optionValue} key={optionValue}>
						{optionLabel}
					</option>
				))}
			</select>
		</label>
	);
}

function LanguageSelect({
	testId,
	label,
	closeLabel,
	value,
	options,
	onChange,
	disabled = false,
}: {
	testId?: string;
	label: string;
	closeLabel: string;
	value: string;
	options: ReadonlyArray<readonly [string, string]>;
	onChange: (value: string) => void;
	disabled?: boolean;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");
	const titleId = useId();
	const listId = useId();
	const selectedLabel =
		options.find(([optionValue]) => optionValue === value)?.[1] ?? value;
	const normalizedQuery = normalizeLanguageSearch(query);
	const filteredOptions = options.filter(([optionValue, optionLabel]) =>
		normalizeLanguageSearch(`${optionLabel} ${optionValue}`).includes(
			normalizedQuery,
		),
	);
	const close = () => {
		setIsOpen(false);
		setQuery("");
	};

	return (
		<div className="setting-row language-select">
			<span>{label}</span>
			<button
				type="button"
				data-testid={testId}
				className="language-select__trigger"
				role="combobox"
				aria-label={label}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				aria-controls={listId}
				disabled={disabled}
				onClick={() => setIsOpen(true)}
				onKeyDown={(event) => {
					if (event.key !== "ArrowDown") return;
					event.preventDefault();
					setIsOpen(true);
				}}
			>
				<span>{selectedLabel}</span>
				<span aria-hidden="true">⌄</span>
			</button>

			{isOpen ? (
				<ModalDialog
					open
					onClose={close}
					className="language-picker action-sheet"
					labelledBy={titleId}
				>
					<header>
						<h2 id={titleId}>{label}</h2>
						<button
							type="button"
							className="sheet-close-button"
							data-modal-initial-focus
							onClick={close}
						>
							<span aria-hidden="true">×</span>
							<span className="visually-hidden">{closeLabel}</span>
						</button>
					</header>
					<label className="language-picker__search">
						<span className="language-picker__search-icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false">
								<title>{label}</title>
								<circle cx="11" cy="11" r="6" />
								<path d="m16 16 4 4" />
							</svg>
						</span>
						<span className="visually-hidden">{label}</span>
						<input
							type="search"
							value={query}
							placeholder={label}
							onChange={(event) => setQuery(event.target.value)}
						/>
					</label>
					<div
						id={listId}
						role="listbox"
						aria-label={label}
						className="language-picker__list"
					>
						{filteredOptions.map(([optionValue, optionLabel]) => (
							<button
								type="button"
								data-testid={testId ? `${testId}-${optionValue}` : undefined}
								role="option"
								aria-selected={optionValue === value}
								className="language-picker__option"
								key={optionValue}
								onClick={() => {
									onChange(optionValue);
									close();
								}}
							>
								<span>{optionLabel}</span>
								{optionValue === "system" ? null : <small>{optionValue}</small>}
							</button>
						))}
					</div>
				</ModalDialog>
			) : null}
		</div>
	);
}

function normalizeLanguageSearch(value: string): string {
	return value
		.normalize("NFKD")
		.replaceAll(/\p{Diacritic}/gu, "")
		.toLocaleLowerCase();
}

function PlannedSetting({ label, value }: { label: string; value: string }) {
	return (
		<div className="setting-row">
			<span>{label}</span>
			<small>{value}</small>
		</div>
	);
}
