import { useEffect, useMemo, useRef, useState } from "react";

import type {
	GamePersistenceService,
	GameSessionService,
	LoadedGameDocument,
	SavedGameImportResult,
	SavedGameSummary,
} from "../application/gameUseCases";
import { sanitizeText } from "../shared/textSanitizer";
import {
	applicationFailureReasonText,
	guiErrorText,
	objectStoreReadProblemText,
} from "./applicationFailurePresentation";
import { applicationObjectSuccessText } from "./applicationSuccessPresentation";
import {
	createGuiTranslator,
	type GuiTranslator,
	resolveGuiLocale,
} from "./i18n/translate";
import { ModalDialog } from "./ModalDialog";

export type LoadGameScreenProps = {
	gamePersistenceService?: GamePersistenceService;
	gameSessionService?: GameSessionService;
	onLoadGame: (gameId: string) => Promise<void>;
	onBack: () => void;
	currentGameStorageKey?: string;
	onLoadedGameChanged?: (game: LoadedGameDocument) => void;
	language?: string;
	canShare?: boolean;
};

export function LoadGameScreen({
	gamePersistenceService,
	gameSessionService,
	onLoadGame,
	onBack,
	currentGameStorageKey,
	onLoadedGameChanged,
	language = "de",
	canShare = false,
}: LoadGameScreenProps) {
	const t = useMemo(() => createGuiTranslator(language), [language]);
	const [searchText, setSearchText] = useState("");
	const [savedGames, setSavedGames] = useState<SavedGameSummary[]>([]);
	const [isLoadingList, setIsLoadingList] = useState(
		gamePersistenceService !== undefined,
	);
	const [loadingGameId, setLoadingGameId] = useState<string>();
	const [errorMessage, setErrorMessage] = useState<string>();
	const [activeGameStorageKey, setActiveGameStorageKey] = useState<string>();
	const [actionMode, setActionMode] = useState<
		"rename" | "duplicate" | "delete"
	>();
	const [actionName, setActionName] = useState("");
	const [isRunningAction, setIsRunningAction] = useState(false);
	const [importConflict, setImportConflict] =
		useState<Extract<SavedGameImportResult, { status: "decisionRequired" }>>();
	const [isResolvingImport, setIsResolvingImport] = useState(false);
	const resolvingImportRef = useRef(false);
	const [importMessage, setImportMessage] = useState<string>();
	const importInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		let isActive = true;
		if (!gamePersistenceService) return;

		void gamePersistenceService
			.listObjects("game")
			.then((result) => {
				if (!isActive) return;
				if (result.status === "expectedFailure") {
					setErrorMessage(objectStoreReadProblemText(result.problem, t));
					return;
				}
				setSavedGames(result.metadata);
			})
			.catch((error: unknown) => {
				if (isActive) setErrorMessage(toErrorMessage(error, t));
			})
			.finally(() => {
				if (isActive) setIsLoadingList(false);
			});
		return () => {
			isActive = false;
		};
	}, [gamePersistenceService, t]);

	const normalizedSearch = searchText.trim().toLocaleLowerCase();
	const visibleGames = savedGames.filter((game) =>
		`${game.name} ${game.ruleSetName}`
			.toLocaleLowerCase()
			.includes(normalizedSearch),
	);

	const loadGame = (gameId: string) => {
		setLoadingGameId(gameId);
		setErrorMessage(undefined);
		void onLoadGame(gameId)
			.catch((error: unknown) => setErrorMessage(toErrorMessage(error, t)))
			.finally(() => setLoadingGameId(undefined));
	};
	const activeGame = savedGames.find(
		(game) => (game.storageKey ?? game.id) === activeGameStorageKey,
	);
	const closeActionSheet = () => {
		setActiveGameStorageKey(undefined);
		setActionMode(undefined);
		setActionName("");
	};
	const refreshGames = async () => {
		if (!gamePersistenceService) return;
		const result = await gamePersistenceService.listObjects("game");
		if (result.status === "expectedFailure")
			throw new Error(objectStoreReadProblemText(result.problem, t));
		setSavedGames(result.metadata);
	};
	const beginDuplicate = async (game: SavedGameSummary) => {
		if (!gamePersistenceService) return;
		setErrorMessage(undefined);
		try {
			setActionName(
				await gamePersistenceService.suggestSavedGameCopyName(
					game.storageKey ?? game.id,
				),
			);
			setActionMode("duplicate");
		} catch (error) {
			setErrorMessage(toErrorMessage(error, t));
			closeActionSheet();
		}
	};
	const exportGame = async (game: SavedGameSummary) => {
		if (!gamePersistenceService) return;
		setErrorMessage(undefined);
		try {
			await gamePersistenceService.exportSavedGame(game.storageKey ?? game.id);
			closeActionSheet();
		} catch (error) {
			if (!(error instanceof DOMException && error.name === "AbortError"))
				setErrorMessage(toErrorMessage(error, t));
		}
	};
	const shareGame = async (game: SavedGameSummary) => {
		if (!gamePersistenceService) return;
		setErrorMessage(undefined);
		try {
			await gamePersistenceService.shareSavedGame(game.storageKey ?? game.id);
			closeActionSheet();
		} catch (error) {
			setErrorMessage(toErrorMessage(error, t));
		}
	};
	const submitAction = async (game: SavedGameSummary) => {
		if (!gamePersistenceService || !actionMode) return;
		setIsRunningAction(true);
		setErrorMessage(undefined);
		try {
			const storageKey = game.storageKey ?? game.id;
			if (actionMode === "rename") {
				await gamePersistenceService.renameSavedGame(storageKey, actionName);
				const current = gameSessionService?.getLoadedGame();
				if (current) onLoadedGameChanged?.(current);
			} else if (actionMode === "duplicate") {
				await gamePersistenceService.duplicateSavedGame(storageKey, actionName);
			} else {
				await gamePersistenceService.deleteSavedGame(storageKey);
			}
			await refreshGames();
			closeActionSheet();
		} catch (error) {
			setErrorMessage(toErrorMessage(error, t));
		} finally {
			setIsRunningAction(false);
		}
	};
	const importGame = async (file: File) => {
		if (!gamePersistenceService) return;
		setErrorMessage(undefined);
		const result = await gamePersistenceService.importSavedGame(file);
		if (result.status === "decisionRequired") {
			setImportConflict(result);
			return;
		}
		setImportMessage(applicationObjectSuccessText(result, t));
		await refreshGames();
	};
	const resolveImport = async (
		resolution: "overwrite" | "keepBoth" | "repair" | "cancel",
	) => {
		if (
			!gamePersistenceService ||
			!importConflict ||
			resolvingImportRef.current
		)
			return;
		resolvingImportRef.current = true;
		setIsResolvingImport(true);
		try {
			const result = await gamePersistenceService.resolveSavedGameImport(
				importConflict.commandId,
				resolution,
			);
			if (result) {
				if (result.status === "decisionRequired") {
					setImportConflict(result);
					return;
				}
				setImportConflict(undefined);
				setImportMessage(applicationObjectSuccessText(result, t));
				await refreshGames();
			}
		} catch (error) {
			setErrorMessage(toErrorMessage(error, t));
		} finally {
			resolvingImportRef.current = false;
			setIsResolvingImport(false);
			if (resolution === "cancel") setImportConflict(undefined);
		}
	};

	return (
		<main className="app-shell form-shell">
			<section className="form-screen" aria-labelledby="load-game-title">
				<header className="screen-header settings-header">
					<button type="button" className="icon-button" onClick={onBack}>
						<span aria-hidden="true">‹</span>
						<span className="visually-hidden">{t("common.back")}</span>
					</button>
					<h1 id="load-game-title">{t("loadGame.title")}</h1>
					<button
						type="button"
						className="text-button"
						disabled={!gamePersistenceService}
						onClick={() => importInputRef.current?.click()}
					>
						{t("common.import")}
					</button>
					<input
						ref={importInputRef}
						type="file"
						accept=".json,.txt,application/json,text/plain"
						className="visually-hidden"
						aria-label={t("common.import")}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (file)
								void importGame(file).catch((error: unknown) =>
									setErrorMessage(toErrorMessage(error, t)),
								);
							event.target.value = "";
						}}
					/>
				</header>

				<label className="search-field">
					<span className="visually-hidden">{t("loadGame.search")}</span>
					<input
						type="search"
						placeholder={t("loadGame.search")}
						value={searchText}
						onChange={(event) =>
							setSearchText(sanitizeText(event.target.value))
						}
					/>
				</label>

				{isLoadingList ? (
					<p className="empty-state">{t("loadGame.reading")}</p>
				) : null}
				{errorMessage ? (
					<p className="load-error" role="alert">
						{errorMessage}
					</p>
				) : null}
				{importMessage ? (
					<p className="prototype-note" role="status">
						{importMessage}
					</p>
				) : null}
				{importConflict ? (
					<ModalDialog
						open
						onClose={() => void resolveImport("cancel")}
						role="alertdialog"
						labelledBy="game-import-conflict-title"
					>
						<h2 id="game-import-conflict-title">
							{importConflict.decisionKind === "serializationRepair"
								? t("loadGame.repairImportQuestion")
								: t("loadGame.alreadyExists")}
						</h2>
						{importConflict.decisionKind === "serializationRepair" ? (
							<p>{applicationFailureReasonText(importConflict.reason, t)}</p>
						) : (
							<p>
								{t("loadGame.existingFile")}: {importConflict.existing.name} ·
								{t("common.schemaVersion")}{" "}
								{importConflict.existing.schemaVersion ?? t("common.unknown")}
								<br />
								{t("loadGame.importedFile")}: {importConflict.imported.name} ·
								{t("common.schemaVersion")}{" "}
								{importConflict.imported.schemaVersion ?? t("common.unknown")}
							</p>
						)}
						<div className="modal-actions">
							{importConflict.availableActions.includes("cancel") ? (
								<button
									type="button"
									data-modal-initial-focus
									disabled={isResolvingImport}
									onClick={() => void resolveImport("cancel")}
								>
									{t("common.cancelImport")}
								</button>
							) : null}
							{importConflict.availableActions
								.filter((action) => action !== "cancel")
								.map((action) => (
									<button
										type="button"
										key={action}
										disabled={isResolvingImport}
										onClick={() => void resolveImport(action)}
									>
										{action === "repair"
											? t("common.tryRepair")
											: action === "keepBoth"
												? t("common.keepBoth")
												: t("loadGame.overwriteExisting")}
									</button>
								))}
						</div>
					</ModalDialog>
				) : null}

				<ul className="saved-game-list scenario-list">
					{visibleGames.map((game) => {
						const storageKey = game.storageKey ?? game.id;
						return (
							<li key={storageKey}>
								<article className="scenario-card saved-game-card">
									<button
										type="button"
										className={`scenario-card__open interactive-surface${
											loadingGameId !== undefined ? " button-disabled" : ""
										}`}
										disabled={loadingGameId !== undefined}
										onClick={() => loadGame(storageKey)}
									>
										<span className="saved-game-card__heading">
											<strong>{game.name}</strong>
											<small>{formatStoredAt(game.storedAt, language)}</small>
										</span>
										<span>
											{game.ruleSetName} ·{" "}
											{t("loadGame.players", { count: game.playerCount })}
										</span>
									</button>
									<footer>
										<small>
											{game.restoredIndex
												? `${t("common.restored", { index: game.restoredIndex })} · `
												: ""}
											{loadingGameId === storageKey
												? t("loadGame.loading")
												: formatGameTime(game, t)}
										</small>
										<button
											type="button"
											className="more-button"
											aria-label={t("common.moreActionsFor", {
												name: game.name,
											})}
											aria-haspopup="dialog"
											aria-expanded={activeGameStorageKey === storageKey}
											onClick={() => setActiveGameStorageKey(storageKey)}
										>
											•••
										</button>
									</footer>
								</article>
							</li>
						);
					})}
				</ul>

				{!isLoadingList && !errorMessage && visibleGames.length === 0 ? (
					<p className="empty-state">{t("loadGame.noMatches")}</p>
				) : null}
				{activeGame ? (
					<ModalDialog
						open
						onClose={closeActionSheet}
						className="action-sheet"
						labelledBy="saved-game-actions-title"
					>
						<header>
							<div>
								<small>{t("common.actionsFor")}</small>
								<h2 id="saved-game-actions-title">{activeGame.name}</h2>
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
									void submitAction(activeGame);
								}}
							>
								{actionMode === "delete" ? (
									<p>
										{t("loadGame.deleteQuestion", { name: activeGame.name })}
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
										disabled={isRunningAction}
										onClick={() => setActionMode(undefined)}
									>
										{t("common.cancel")}
									</button>
									<button
										type="submit"
										disabled={isRunningAction}
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
									onClick={() => {
										setActionName(activeGame.name);
										setActionMode("rename");
									}}
								>
									{t("common.rename")}
								</button>
								<button
									type="button"
									onClick={() => void beginDuplicate(activeGame)}
								>
									{t("common.duplicate")}
								</button>
								<button
									type="button"
									onClick={() => void exportGame(activeGame)}
								>
									{t("common.export")}
								</button>
								{canShare ? (
									<button
										type="button"
										onClick={() => void shareGame(activeGame)}
									>
										{t("common.share")}
									</button>
								) : null}
								<button
									type="button"
									disabled={
										currentGameStorageKey ===
										(activeGame.storageKey ?? activeGame.id)
									}
									className={`danger-action${
										currentGameStorageKey ===
										(activeGame.storageKey ?? activeGame.id)
											? " button-disabled"
											: ""
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

function formatGameTime(game: SavedGameSummary, t: GuiTranslator): string {
	if (game.phase === "setup") return t("loadGame.setup");
	return t(game.phase === "night" ? "loadGame.night" : "loadGame.day", {
		number: game.currentNight,
	});
}

function formatStoredAt(value: string, language: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: date.toLocaleString(resolveGuiLocale(language).languageTag);
}

function toErrorMessage(error: unknown, t: GuiTranslator): string {
	return guiErrorText(error, t, t("loadGame.readError"));
}
