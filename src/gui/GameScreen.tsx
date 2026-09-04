import {
	Fragment,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	EditorOptionGroup,
	GameShownRoleEditorItem,
} from "../application/gameScreenPresentation";
import {
	changePlayerDraftRole,
	createEmptySeatEditorModel,
	createGameSeatColorLayers,
	createGameSeatEditorModel,
	createGameSeatLabels,
	createGameSeatSymbols,
	createGameTimePresentation,
	createNightAbilityTargets,
	createNightListPresentation,
	createRoleRevealPresentation,
	EMPTY_SEAT_PLAYER_ID,
	SEAT_SYMBOLS,
} from "../application/gameScreenPresentation";
import type {
	ChangeShownRoleCommand,
	LoadedGameDocument,
	MoveSeatCommand,
	MoveShownRoleCommand,
	PlayerAbilityAction,
	PlayerActionResult,
	PlayerDraft,
	SavePlayerCommand,
} from "../application/gameUseCases";
import {
	createPlayerOverview,
	type PlayerOverviewEntry,
} from "../application/playerOverview";
import type { ResolvedTheme } from "../application/ports/systemThemePort";
import { isObjectSaveInterruptedError } from "../application/storageRecovery";
import { sanitizeText } from "../shared/textSanitizer";
import {
	GuiDisplayError,
	guiErrorText,
} from "./applicationFailurePresentation";
import { useBackHandler } from "./backNavigation";
import { createGuiTranslator } from "./i18n/translate";
import { ModalDialog } from "./ModalDialog";
import { playerActionWarningText } from "./playerActionWarningPresentation";

const MIN_SEAT_ZOOM = 1;
const MAX_SEAT_ZOOM = 2;
const SEAT_ZOOM_STEP = 0.25;
const SEAT_COLOR_OPACITY = 0.4;
const SEAT_DRAG_RETURN_FALLBACK_MS = 240;
const INITIAL_NORTH_ANGLE = -Math.PI / 2;
const NORTH_MARKER_RADIUS_PERCENT = 47;
const SHOWN_ROLE_LONG_PRESS_MS = 450;
const SHOWN_ROLE_POINTER_MOVE_THRESHOLD_PX = 6;

type RgbColor = readonly [red: number, green: number, blue: number];
type SeatPan = Readonly<{ x: number; y: number }>;
type ViewportSize = Readonly<{ width: number; height: number }>;
type SeatDragVisual = Readonly<{
	key: string;
	offsetX: number;
	offsetY: number;
	returning: boolean;
}>;

const seatBaseColors: Record<ResolvedTheme, RgbColor> = {
	dark: [0x29, 0x2c, 0x33],
	light: [0xff, 0xff, 0xff],
};
const seatTextColors = {
	dark: { css: "var(--seat-text-dark)", rgb: [0x25, 0x22, 0x1e] },
	light: { css: "var(--seat-text-light)", rgb: [0xf6, 0xf1, 0xe7] },
} as const satisfies Record<"dark" | "light", { css: string; rgb: RgbColor }>;

function clampSeatZoom(zoom: number): number {
	return Math.min(MAX_SEAT_ZOOM, Math.max(MIN_SEAT_ZOOM, zoom));
}

function clampSeatPan(
	pan: SeatPan,
	zoom: number,
	viewport: ViewportSize,
): SeatPan {
	const maxX = (viewport.width * (zoom - 1)) / 2;
	const maxY = (viewport.height * (zoom - 1)) / 2;
	return {
		x: Math.min(maxX, Math.max(-maxX, pan.x)),
		y: Math.min(maxY, Math.max(-maxY, pan.y)),
	};
}

function selectSeatTextColor(
	colors: ReadonlyArray<string | undefined>,
	theme: ResolvedTheme,
): string | undefined {
	const definedColors = colors.filter(
		(color): color is string => color !== undefined,
	);
	if (definedColors.length === 0) return undefined;

	const background = definedColors.reduce(
		(current, color) => compositeRgb(current, parseHexRgb(color)),
		seatBaseColors[theme],
	);
	const backgroundLuminance = relativeLuminance(background);
	const darkContrast = contrastRatio(
		backgroundLuminance,
		relativeLuminance(seatTextColors.dark.rgb),
	);
	const lightContrast = contrastRatio(
		backgroundLuminance,
		relativeLuminance(seatTextColors.light.rgb),
	);
	return darkContrast >= lightContrast
		? seatTextColors.dark.css
		: seatTextColors.light.css;
}

function parseHexRgb(color: string): RgbColor {
	return [
		Number.parseInt(color.slice(0, 2), 16),
		Number.parseInt(color.slice(2, 4), 16),
		Number.parseInt(color.slice(4, 6), 16),
	];
}

function compositeRgb(background: RgbColor, foreground: RgbColor): RgbColor {
	return [
		compositeChannel(background[0], foreground[0]),
		compositeChannel(background[1], foreground[1]),
		compositeChannel(background[2], foreground[2]),
	];
}

function compositeChannel(background: number, foreground: number): number {
	return (
		background * (1 - SEAT_COLOR_OPACITY) + foreground * SEAT_COLOR_OPACITY
	);
}

function relativeLuminance(color: RgbColor): number {
	const [red, green, blue] = color.map((channel) => {
		const normalized = channel / 255;
		return normalized <= 0.04045
			? normalized / 12.92
			: ((normalized + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: number, second: number): number {
	const lighter = Math.max(first, second);
	const darker = Math.min(first, second);
	return (lighter + 0.05) / (darker + 0.05);
}

function touchDistance(touches: TouchList): number {
	const first = touches.item(0);
	const second = touches.item(1);
	return first && second
		? Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
		: 0;
}

function normalizeNorthAngle(angle: number): number {
	let northAngle = angle;
	if (northAngle > Math.PI) northAngle -= 2 * Math.PI;
	if (northAngle === -Math.PI) northAngle = Math.PI;
	return northAngle;
}

export function GameScreen({
	game,
	active = true,
	onBack,
	onMoveSeat,
	onMoveShownRole,
	onChangeShownRole,
	onShownRoleLongPress = () => {},
	onSavePlayer,
	onDeleteEmptySeat,
	onDeletePlayer,
	onDeleteLogEntry = () => false,
	onClearLog = () => false,
	onUsePlayerAbility = () => ({ changed: false, logEntry: null }),
	onAdvanceTime,
	onRewindTime,
	isDirty = false,
	onSave,
	onRestorePreviousFile = async () => {},
	onRetryStorageCommand,
	onFinishStorageCommand = async () => {},
	onContinueCreatedStorageCommand,
	onSuggestSaveAsName,
	onSaveAs,
	onSuggestTemplateName,
	onSaveAsTemplate,
	onExit,
	onManageGameEntities,
	onRandomizeRoles,
	onShufflePlayers = () => false,
	onEditRolesForShowing,
	onOpenSettings,
	seatBoardBackgroundSource,
	theme = "dark",
	reduceMotion = false,
	hideExpiredStatuses = false,
	initialSeatOrderUnlocked = false,
	seatCircleFirstSeatAtTop = true,
	seatCircleClockwise = true,
	showRoleSymbols = false,
	language = "de",
}: {
	game: LoadedGameDocument;
	active?: boolean;
	onBack: () => void;
	onMoveSeat: (command: MoveSeatCommand) => boolean;
	onMoveShownRole: (command: MoveShownRoleCommand) => boolean;
	onChangeShownRole: (command: ChangeShownRoleCommand) => boolean;
	onShownRoleLongPress?: () => void;
	onSavePlayer: (command: SavePlayerCommand) => boolean;
	onDeleteEmptySeat: (seatNumber: number) => boolean;
	onDeletePlayer: (seatNumber: number) => boolean;
	onDeleteLogEntry?: (logEntryId: string) => boolean;
	onClearLog?: () => boolean;
	onUsePlayerAbility?: (
		actorPlayerId: string,
		targetPlayerId: string,
		action: PlayerAbilityAction,
		statusId?: string,
	) => PlayerActionResult;
	onAdvanceTime: () => void;
	onRewindTime: () => void;
	isDirty?: boolean;
	onSave: () => Promise<void>;
	onRestorePreviousFile?: (commandId: string) => Promise<void>;
	onRetryStorageCommand?: (commandId: string) => Promise<void>;
	onFinishStorageCommand?: (commandId: string) => Promise<void>;
	onContinueCreatedStorageCommand?: (
		commandId: string,
		decision: "retry" | "cancel" | "finishLater" | "overwrite" | "keepBoth",
	) => Promise<void>;
	/** @deprecated Nur für ältere Einbettungen; Recovery stellt jetzt die alte Datei wieder her. */
	onExportSaveRecovery?: () => Promise<void>;
	onSuggestSaveAsName?: () => Promise<string>;
	onSaveAs?: (name: string) => Promise<void>;
	onSuggestTemplateName?: () => Promise<string>;
	onSaveAsTemplate?: (name: string) => Promise<void>;
	onExit: () => void;
	onManageGameEntities: () => void;
	onRandomizeRoles: () => void;
	onShufflePlayers?: () => boolean;
	onEditRolesForShowing: () => void;
	onOpenSettings: () => void;
	seatBoardBackgroundSource?: string;
	theme?: ResolvedTheme;
	reduceMotion?: boolean;
	hideExpiredStatuses?: boolean;
	initialSeatOrderUnlocked?: boolean;
	seatCircleFirstSeatAtTop?: boolean;
	seatCircleClockwise?: boolean;
	showRoleSymbols?: boolean;
	language?: string;
}) {
	const t = createGuiTranslator(language);
	const symbols = useMemo(
		() => createGameSeatSymbols(game.document, { hideExpiredStatuses }),
		[game.document, hideExpiredStatuses],
	);
	const seatLabels = useMemo(
		() => createGameSeatLabels(game.document, language),
		[game.document, language],
	);
	const seatColorLayers = useMemo(
		() => createGameSeatColorLayers(game.document),
		[game.document],
	);
	const [seatVisuals, setSeatVisuals] = useState(() =>
		symbols.map((_, index) => ({ key: `seat-visual-${index}` })),
	);
	const nextSeatVisualKeyRef = useRef(symbols.length);
	const seatButtonElementsRef = useRef(new Map<string, HTMLButtonElement>());
	const previousSeatPositionsRef = useRef<Map<string, DOMRect> | undefined>(
		undefined,
	);
	const [selectedSeat, setSelectedSeat] = useState<number>();
	const [isSeatOrderLocked, setIsSeatOrderLocked] = useState(
		() => !initialSeatOrderUnlocked,
	);
	const [northAngle, setNorthAngle] = useState(INITIAL_NORTH_ANGLE);
	const [isNorthMarkerDragging, setIsNorthMarkerDragging] = useState(false);
	const northMarkerPointerRef = useRef<number | undefined>(undefined);
	const [seatDragVisual, setSeatDragVisual] = useState<SeatDragVisual>();
	const pointerDragRef = useRef<
		| {
				pointerId: number;
				seatNumber: number;
				startX: number;
				startY: number;
				moved: boolean;
		  }
		| undefined
	>(undefined);
	const suppressSeatClickRef = useRef(false);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isShuffleConfirmationOpen, setIsShuffleConfirmationOpen] =
		useState(false);
	const [isLogOpen, setIsLogOpen] = useState(false);
	const [editingStatusId, setEditingStatusId] = useState<string>();
	const [roleRevealIndex, setRoleRevealIndex] = useState<number>();
	const [isRoleRevealed, setIsRoleRevealed] = useState(false);
	const [isNightListOpen, setIsNightListOpen] = useState(false);
	const [isPlayerOverviewOpen, setIsPlayerOverviewOpen] = useState(false);
	const [seatZoom, setSeatZoom] = useState(MIN_SEAT_ZOOM);
	const [seatPan, setSeatPan] = useState({ x: 0, y: 0 });
	const [isSeatPanning, setIsSeatPanning] = useState(false);
	const seatZoomRef = useRef(seatZoom);
	const seatCircleViewportRef = useRef<HTMLDivElement>(null);
	const seatCircleContentRef = useRef<HTMLDivElement>(null);
	const pinchStartRef = useRef<{ distance: number; zoom: number } | undefined>(
		undefined,
	);
	const panStartRef = useRef<
		| {
				pointerId: number;
				clientX: number;
				clientY: number;
				panX: number;
				panY: number;
		  }
		| undefined
	>(undefined);
	const [checkedNightPlayers, setCheckedNightPlayers] = useState<Set<string>>(
		() => new Set(),
	);

	useEffect(() => {
		seatZoomRef.current = seatZoom;
	}, [seatZoom]);

	const updateNorthAngleFromPointer = (clientX: number, clientY: number) => {
		const content = seatCircleContentRef.current;
		if (!content) return;
		const bounds = content.getBoundingClientRect();
		const angle = Math.atan2(
			clientY - (bounds.top + bounds.height / 2),
			clientX - (bounds.left + bounds.width / 2),
		);
		setNorthAngle(normalizeNorthAngle(angle));
	};

	useEffect(() => {
		if (!seatDragVisual?.returning) return;
		const returningKey = seatDragVisual.key;
		const timer = window.setTimeout(() => {
			setSeatDragVisual((current) =>
				current?.returning && current.key === returningKey
					? undefined
					: current,
			);
		}, SEAT_DRAG_RETURN_FALLBACK_MS);
		return () => window.clearTimeout(timer);
	}, [seatDragVisual]);

	useLayoutEffect(() => {
		if (isPlayerOverviewOpen) return;
		const viewport = seatCircleViewportRef.current;
		if (!viewport) return;
		const clampToViewport = () => {
			const rect = viewport.getBoundingClientRect();
			setSeatPan((pan) => {
				const next = clampSeatPan(pan, seatZoom, rect);
				return next.x === pan.x && next.y === pan.y ? pan : next;
			});
		};
		clampToViewport();

		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", clampToViewport);
			return () => window.removeEventListener("resize", clampToViewport);
		}
		const resizeObserver = new ResizeObserver(clampToViewport);
		resizeObserver.observe(viewport);
		return () => resizeObserver.disconnect();
	}, [isPlayerOverviewOpen, seatZoom]);

	useEffect(() => {
		const viewport = seatCircleViewportRef.current;
		if (!viewport || isPlayerOverviewOpen) return;
		const zoomWithWheel = (event: WheelEvent) => {
			if (event.deltaY === 0) return;
			const currentZoom = seatZoomRef.current;
			const nextZoom = clampSeatZoom(
				currentZoom + (event.deltaY < 0 ? 0.1 : -0.1),
			);
			if (nextZoom === currentZoom) return;
			event.preventDefault();
			seatZoomRef.current = nextZoom;
			setSeatZoom(nextZoom);
		};
		const startPinch = (event: TouchEvent) => {
			if (event.touches.length !== 2) return;
			const distance = touchDistance(event.touches);
			if (distance <= 0) return;
			pinchStartRef.current = { distance, zoom: seatZoomRef.current };
		};
		const movePinch = (event: TouchEvent) => {
			const start = pinchStartRef.current;
			if (!start || event.touches.length !== 2) return;
			const nextZoom = clampSeatZoom(
				start.zoom * (touchDistance(event.touches) / start.distance),
			);
			if (nextZoom === seatZoomRef.current) return;
			event.preventDefault();
			seatZoomRef.current = nextZoom;
			setSeatZoom(nextZoom);
		};
		const endPinch = (event: TouchEvent) => {
			if (event.touches.length < 2) pinchStartRef.current = undefined;
		};
		viewport.addEventListener("wheel", zoomWithWheel, { passive: false });
		viewport.addEventListener("touchstart", startPinch, { passive: false });
		viewport.addEventListener("touchmove", movePinch, { passive: false });
		viewport.addEventListener("touchend", endPinch);
		viewport.addEventListener("touchcancel", endPinch);
		return () => {
			viewport.removeEventListener("wheel", zoomWithWheel);
			viewport.removeEventListener("touchstart", startPinch);
			viewport.removeEventListener("touchmove", movePinch);
			viewport.removeEventListener("touchend", endPinch);
			viewport.removeEventListener("touchcancel", endPinch);
		};
	}, [isPlayerOverviewOpen]);
	const [nightActionSelection, setNightActionSelection] = useState<{
		actorId: string;
		targetId: string;
		locked: boolean;
	}>();
	const [pendingSeatAction, setPendingSeatAction] = useState<{
		action: "delete" | "add";
		seatNumber: number;
		playerName: string;
	}>();
	const nightTargetSelectionRef = useRef<
		((playerId: string) => void) | undefined
	>(undefined);
	const [isDetailsFullscreen, setIsDetailsFullscreen] = useState(false);
	const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
	const [saveAsMode, setSaveAsMode] = useState<"game" | "template">();
	const [saveAsName, setSaveAsName] = useState("");
	const [isSavingAs, setIsSavingAs] = useState(false);
	const [saveError, setSaveError] = useState<string>();
	const [isSaveRecoveryOpen, setIsSaveRecoveryOpen] = useState(false);
	const [saveRecoveryCommandId, setSaveRecoveryCommandId] = useState<string>();
	const [saveRecoveryReason, setSaveRecoveryReason] = useState<
		"diskFull" | "writeFailure" | "targetExists"
	>("writeFailure");
	const [saveRecoveryContext, setSaveRecoveryContext] = useState<
		"regular" | "created"
	>("regular");
	const [isResolvingRecovery, setIsResolvingRecovery] = useState(false);
	const isResolvingSaveRecoveryRef = useRef(false);
	const saveGame = async () => {
		setSaveError(undefined);
		try {
			await onSave();
			setIsMenuOpen(false);
			return true;
		} catch (error) {
			if (isObjectSaveInterruptedError(error)) {
				setSaveRecoveryCommandId(error.commandId);
				setSaveRecoveryReason(error.reason);
				setSaveRecoveryContext("regular");
				setIsMenuOpen(false);
				setIsExitDialogOpen(false);
				setIsSaveRecoveryOpen(true);
				return false;
			}
			setSaveError(guiErrorText(error, t));
			return false;
		}
	};
	const requestSaveAs = async (mode: "game" | "template") => {
		const suggestName =
			mode === "game" ? onSuggestSaveAsName : onSuggestTemplateName;
		const saveAs = mode === "game" ? onSaveAs : onSaveAsTemplate;
		if (!suggestName || !saveAs) return;
		setSaveError(undefined);
		try {
			setSaveAsName(await suggestName());
			setIsMenuOpen(false);
			setSaveAsMode(mode);
		} catch (error) {
			setSaveError(guiErrorText(error, t));
		}
	};
	const saveGameAs = async () => {
		const saveAs = saveAsMode === "game" ? onSaveAs : onSaveAsTemplate;
		if (!saveAs) return;
		setSaveError(undefined);
		setIsSavingAs(true);
		try {
			await saveAs(saveAsName);
			setSaveAsMode(undefined);
		} catch (error) {
			if (isObjectSaveInterruptedError(error)) {
				setSaveRecoveryCommandId(error.commandId);
				setSaveRecoveryReason(error.reason);
				setSaveRecoveryContext("created");
				setSaveAsMode(undefined);
				setIsSaveRecoveryOpen(true);
			} else setSaveError(guiErrorText(error, t));
		} finally {
			setIsSavingAs(false);
		}
	};
	const requestExit = () => {
		setIsMenuOpen(false);
		if (isDirty) setIsExitDialogOpen(true);
		else onExit();
	};
	const requestBack = () => {
		if (isDirty) setIsExitDialogOpen(true);
		else onBack();
	};
	const stepBackRoleReveal = () => {
		if (isRoleRevealed) {
			setIsRoleRevealed(false);
			return;
		}
		setRoleRevealIndex((index) =>
			index === undefined || index === 0 ? undefined : index - 1,
		);
	};
	useBackHandler(
		() => {
			if (roleRevealIndex !== undefined) stepBackRoleReveal();
			else if (isLogOpen) setIsLogOpen(false);
			else if (isMenuOpen) setIsMenuOpen(false);
			else if (nightActionSelection) setNightActionSelection(undefined);
			else if (isPlayerOverviewOpen) setIsPlayerOverviewOpen(false);
			else if (isDetailsFullscreen) setIsDetailsFullscreen(false);
			else requestBack();
		},
		active,
		20,
	);
	const continueCreatedStorageCommand = async (
		decision: "retry" | "cancel" | "finishLater" | "overwrite" | "keepBoth",
	) => {
		const commandId = saveRecoveryCommandId;
		if (!commandId || !onContinueCreatedStorageCommand)
			throw new GuiDisplayError(t("game.storageCommandInactive"));
		await onContinueCreatedStorageCommand(commandId, decision);
		setIsSaveRecoveryOpen(false);
	};
	const resolveCreatedStorageCollision = async (
		decision: "overwrite" | "cancel" | "keepBoth",
	) => {
		if (isResolvingSaveRecoveryRef.current) return;
		isResolvingSaveRecoveryRef.current = true;
		setSaveError(undefined);
		setIsResolvingRecovery(true);
		try {
			await continueCreatedStorageCommand(decision);
		} catch (error) {
			setSaveError(guiErrorText(error, t));
		} finally {
			isResolvingSaveRecoveryRef.current = false;
			setIsResolvingRecovery(false);
		}
	};
	const finishSaveRecoveryLater = async () => {
		if (isResolvingSaveRecoveryRef.current) return;
		isResolvingSaveRecoveryRef.current = true;
		const commandId = saveRecoveryCommandId;
		if (!commandId) {
			setIsSaveRecoveryOpen(false);
			isResolvingSaveRecoveryRef.current = false;
			return;
		}
		setSaveError(undefined);
		setIsResolvingRecovery(true);
		try {
			if (saveRecoveryContext === "created")
				await continueCreatedStorageCommand("finishLater");
			else await onFinishStorageCommand(commandId);
			setIsSaveRecoveryOpen(false);
		} catch (error) {
			setSaveError(guiErrorText(error, t));
		} finally {
			isResolvingSaveRecoveryRef.current = false;
			setIsResolvingRecovery(false);
		}
	};

	const editorModel = useMemo(
		() =>
			selectedSeat === undefined
				? undefined
				: createGameSeatEditorModel(game.document, selectedSeat, language, {
						hideExpiredStatuses,
					}),
		[game.document, selectedSeat, language, hideExpiredStatuses],
	);
	const emptySeatEditorModel = useMemo(
		() =>
			selectedSeat === undefined
				? undefined
				: createEmptySeatEditorModel(game.document, selectedSeat, language),
		[game.document, selectedSeat, language],
	);
	const roleReveal = useMemo(
		() =>
			createRoleRevealPresentation(game.document, language, showRoleSymbols),
		[game.document, language, showRoleSymbols],
	);
	const nightList = useMemo(
		() => createNightListPresentation(game.document, language),
		[game.document, language],
	);
	const nightAbilityTargets = useMemo(
		() => createNightAbilityTargets(game.document, language),
		[game.document, language],
	);
	const playerOverview = useMemo(
		() =>
			isPlayerOverviewOpen
				? createPlayerOverview(game.document, {
						language,
						sortOrder: "Sitzplatz",
						deletionFilter: "nur_aktive_personen",
						hideExpiredStatuses,
					})
				: [],
		[game.document, isPlayerOverviewOpen, language, hideExpiredStatuses],
	);
	const timePresentation = useMemo(
		() => createGameTimePresentation(game.document),
		[game.document],
	);
	const timeLabel = gameTimePresentationText(timePresentation, t);
	const currentTime = readGameTime(game.document);
	const currentNight = currentTime.currentNight;
	const isSetupPhase =
		currentTime.currentNight === 0 && currentTime.phase === "setup";
	const canShufflePlayers =
		game.document.seatOrder.filter(
			(playerId) => playerId !== EMPTY_SEAT_PLAYER_ID,
		).length >= 2;
	const confirmShufflePlayers = () => {
		if (!onShufflePlayers()) return;
		setSelectedSeat(undefined);
		setIsShuffleConfirmationOpen(false);
	};
	const selectPlayer = (playerId: string, seatNumber: number | null) => {
		if (isNightListOpen && nightTargetSelectionRef.current) {
			nightTargetSelectionRef.current(playerId);
			return;
		}
		if (seatNumber !== null) setSelectedSeat(seatNumber);
	};
	const captureSeatPositions = () => {
		previousSeatPositionsRef.current = new Map(
			[...seatButtonElementsRef.current].map(([key, element]) => [
				key,
				element.getBoundingClientRect(),
			]),
		);
	};
	const returnDraggedSeat = () => {
		setSeatDragVisual((current) => {
			if (
				!current ||
				reduceMotion ||
				(Math.abs(current.offsetX) < 0.5 && Math.abs(current.offsetY) < 0.5)
			)
				return undefined;
			return { ...current, offsetX: 0, offsetY: 0, returning: true };
		});
	};
	const updateDraggedSeatPosition = (
		key: string,
		clientX: number,
		clientY: number,
		startX: number,
		startY: number,
	) => {
		if (
			![clientX, clientY, startX, startY, seatZoomRef.current].every(
				Number.isFinite,
			) ||
			seatZoomRef.current <= 0
		)
			return;
		setSeatDragVisual({
			key,
			offsetX: (clientX - startX) / seatZoomRef.current,
			offsetY: (clientY - startY) / seatZoomRef.current,
			returning: false,
		});
	};
	const findDropTargetSeat = (
		clientX: number,
		clientY: number,
	): number | undefined => {
		if (!Number.isFinite(clientX) || !Number.isFinite(clientY))
			return undefined;
		const draggedElement = seatDragVisual
			? seatButtonElementsRef.current.get(seatDragVisual.key)
			: undefined;
		const previousPointerEvents = draggedElement?.style.pointerEvents;
		if (draggedElement) draggedElement.style.pointerEvents = "none";
		try {
			const target = document
				.elementFromPoint(clientX, clientY)
				?.closest<HTMLElement>("[data-seat-number]");
			if (!target || target === draggedElement) return undefined;
			const seatNumber = Number(target.dataset.seatNumber);
			return Number.isInteger(seatNumber) ? seatNumber : undefined;
		} finally {
			if (draggedElement)
				draggedElement.style.pointerEvents = previousPointerEvents ?? "";
		}
	};
	const moveSeat = (
		movedSeatNumber: number,
		targetSeatNumber: number,
	): boolean => {
		if (
			isSeatOrderLocked ||
			!Number.isInteger(movedSeatNumber) ||
			!Number.isInteger(targetSeatNumber) ||
			movedSeatNumber < 1 ||
			targetSeatNumber < 1 ||
			movedSeatNumber > seatVisuals.length ||
			targetSeatNumber > seatVisuals.length ||
			movedSeatNumber === targetSeatNumber
		)
			return false;
		captureSeatPositions();
		const moved = onMoveSeat({
			fromSeatNumber: movedSeatNumber,
			toSeatNumber: targetSeatNumber,
		});
		if (moved === false) {
			previousSeatPositionsRef.current = undefined;
			return false;
		}
		const selectedVisualKey =
			selectedSeat === undefined
				? undefined
				: seatVisuals[selectedSeat - 1]?.key;
		const nextSeatVisuals = moveVisualToSeat(
			seatVisuals,
			movedSeatNumber,
			targetSeatNumber,
			symbols[movedSeatNumber - 1] !== SEAT_SYMBOLS.empty &&
				symbols[targetSeatNumber - 1] === SEAT_SYMBOLS.empty,
		);
		setSeatVisuals(nextSeatVisuals);
		if (selectedVisualKey) {
			const nextSelectedIndex = nextSeatVisuals.findIndex(
				(visual) => visual.key === selectedVisualKey,
			);
			setSelectedSeat(
				nextSelectedIndex < 0 ? undefined : nextSelectedIndex + 1,
			);
		}
		return true;
	};
	const finishSeatDrag = (
		movedSeatNumber: number,
		targetSeatNumber: number,
	) => {
		if (moveSeat(movedSeatNumber, targetSeatNumber))
			setSeatDragVisual(undefined);
		else returnDraggedSeat();
	};
	useLayoutEffect(() => {
		const previous = previousSeatPositionsRef.current;
		previousSeatPositionsRef.current = undefined;
		if (!previous || reduceMotion) return;
		for (const [key, element] of seatButtonElementsRef.current) {
			const oldRect = previous.get(key);
			if (!oldRect || typeof element.animate !== "function") continue;
			const newRect = element.getBoundingClientRect();
			const deltaX = oldRect.left - newRect.left;
			const deltaY = oldRect.top - newRect.top;
			if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) continue;
			element.animate(
				[
					{
						transform: `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`,
					},
					{ transform: "translate(-50%, -50%)" },
				],
				{ duration: 240, easing: "ease" },
			);
		}
	});
	const changeSelectedSeat = (targetSeatNumber: number) => {
		if (
			!editorModel ||
			selectedSeat === undefined ||
			!Number.isInteger(targetSeatNumber) ||
			targetSeatNumber < 1 ||
			targetSeatNumber > seatVisuals.length
		)
			return false;
		if (targetSeatNumber === selectedSeat) return true;
		captureSeatPositions();
		const saved = onSavePlayer({
			originalPlayerId: editorModel.originalPlayerId,
			player: editorModel.player,
			seatNumber: targetSeatNumber,
		});
		if (saved === false) {
			previousSeatPositionsRef.current = undefined;
			return false;
		}
		setSeatVisuals((current) =>
			moveVisualToSeat(
				current,
				selectedSeat,
				targetSeatNumber,
				symbols[selectedSeat - 1] !== SEAT_SYMBOLS.empty &&
					symbols[targetSeatNumber - 1] === SEAT_SYMBOLS.empty,
			),
		);
		setSelectedSeat(targetSeatNumber);
		return true;
	};
	const deleteSeat = (seatNumber: number) => {
		const deleted =
			symbols[seatNumber - 1] === SEAT_SYMBOLS.empty
				? onDeleteEmptySeat(seatNumber)
				: onDeletePlayer(seatNumber);
		if (!deleted) return false;
		captureSeatPositions();
		setSeatVisuals((current) =>
			current.filter((_, index) => index !== seatNumber - 1),
		);
		setSelectedSeat(undefined);
		return true;
	};
	const addPlayerAfterSeat = (seatNumber: number) => {
		const playerNumber = Object.keys(game.document.playersById).length + 1;
		captureSeatPositions();
		const saved = onSavePlayer({
			originalPlayerId: null,
			player: {
				id: "",
				name: `Player ${playerNumber}`,
				lifeState: "alive",
				roles: {
					actualRoleId: null,
					shownRoleIds: [],
					nightRoleId: null,
				},
				statuses: [],
			},
			seatNumber: seatNumber + 1,
		});
		if (saved === false) {
			previousSeatPositionsRef.current = undefined;
			return false;
		}
		setSeatVisuals((current) => {
			const next = [...current];
			next.splice(seatNumber, 0, {
				key: `seat-visual-${nextSeatVisualKeyRef.current++}`,
			});
			return next;
		});
		return true;
	};
	const requestSeatAction = (action: "delete" | "add", seatNumber: number) => {
		const playerId = game.document.seatOrder[seatNumber - 1];
		setPendingSeatAction({
			action,
			seatNumber,
			playerName: game.document.playersById[playerId]?.name ?? "–",
		});
	};
	const confirmSeatAction = () => {
		if (!pendingSeatAction) return;
		if (
			pendingSeatAction.action === "delete" &&
			!deleteSeat(pendingSeatAction.seatNumber)
		)
			return;
		if (
			pendingSeatAction.action === "add" &&
			!addPlayerAfterSeat(pendingSeatAction.seatNumber)
		)
			return;
		setPendingSeatAction(undefined);
	};

	if (roleRevealIndex !== undefined && roleReveal) {
		const step = roleReveal.steps[roleRevealIndex];
		if (step) {
			return (
				<RoleRevealScreen
					language={language}
					step={step}
					isRevealed={isRoleRevealed}
					onToggle={() => setIsRoleRevealed((revealed) => !revealed)}
					onBack={stepBackRoleReveal}
					onNext={() => {
						setIsRoleRevealed(false);
						setRoleRevealIndex((index) =>
							index === undefined || index >= roleReveal.steps.length - 1
								? undefined
								: index + 1,
						);
					}}
				/>
			);
		}
	}

	if (isLogOpen) {
		return (
			<GameLogScreen
				entries={game.document.log}
				language={language}
				onBack={() => setIsLogOpen(false)}
				onDeleteEntry={onDeleteLogEntry}
				onClear={onClearLog}
			/>
		);
	}

	return (
		<main className="app-shell game-shell">
			<section
				className={`game-screen${isDetailsFullscreen ? " game-screen--details-fullscreen" : ""}`}
			>
				<header className="screen-header game-header">
					<button
						data-testid="game-back"
						type="button"
						className="icon-button"
						onClick={requestBack}
						aria-label={t("common.back")}
					>
						‹
					</button>
					<div>
						<p className="eyebrow">{t("game.currentGame")}</p>
						<h1>{game.displayName}</h1>
					</div>
					<div className="game-header__actions">
						{!isPlayerOverviewOpen ? (
							<button
								type="button"
								className="icon-button interactive-surface"
								aria-label={
									isSeatOrderLocked
										? t("game.unlockSeatOrder")
										: t("game.lockSeatOrder")
								}
								aria-pressed={!isSeatOrderLocked}
								onClick={() => setIsSeatOrderLocked((locked) => !locked)}
							>
								<span aria-hidden="true">
									{isSeatOrderLocked ? "🔏" : "🔓"}
								</span>
							</button>
						) : null}
						<button
							data-testid="game-menu-open"
							type="button"
							className="icon-button interactive-surface"
							aria-label={t("game.menu.open")}
							onClick={() => setIsMenuOpen(true)}
						>
							<span aria-hidden="true">⋯</span>
						</button>
					</div>
				</header>

				<fieldset className="seat-board">
					<legend className="visually-hidden">
						{t(isPlayerOverviewOpen ? "game.playerOverview" : "game.seatOrder")}
					</legend>
					<button
						type="button"
						className="game-time-badge interactive-surface"
						aria-label={`${timeLabel}: ${
							isPlayerOverviewOpen
								? t("game.showSeatCircle")
								: t("game.showPlayerOverview")
						}`}
						aria-pressed={isPlayerOverviewOpen}
						onClick={() => setIsPlayerOverviewOpen((open) => !open)}
					>
						{timeLabel}
					</button>
					{isPlayerOverviewOpen ? (
						<PlayerOverviewTable
							language={language}
							entries={playerOverview}
							selectedSeat={selectedSeat}
							nightSelection={
								isNightListOpen ? nightActionSelection : undefined
							}
							onSelectPlayer={selectPlayer}
						/>
					) : (
						<>
							<fieldset className="seat-zoom-controls">
								<legend className="visually-hidden">
									{t("game.zoomControls")}
								</legend>
								<button
									type="button"
									className="interactive-surface"
									aria-label={t("game.zoomOut")}
									aria-controls="seat-circle-content"
									disabled={seatZoom <= MIN_SEAT_ZOOM}
									onClick={() =>
										setSeatZoom((zoom) => clampSeatZoom(zoom - SEAT_ZOOM_STEP))
									}
								>
									<span aria-hidden="true">−</span>
								</button>
								<output
									aria-label={t("game.zoomLevel", {
										percent: Math.round(seatZoom * 100),
									})}
								>
									{Math.round(seatZoom * 100)} %
								</output>
								<button
									type="button"
									className="interactive-surface"
									aria-label={t("game.zoomIn")}
									aria-controls="seat-circle-content"
									disabled={seatZoom >= MAX_SEAT_ZOOM}
									onClick={() =>
										setSeatZoom((zoom) => clampSeatZoom(zoom + SEAT_ZOOM_STEP))
									}
								>
									<span aria-hidden="true">+</span>
								</button>
							</fieldset>
							<div
								ref={seatCircleViewportRef}
								className={`seat-circle-viewport${seatZoom > MIN_SEAT_ZOOM ? " seat-circle-viewport--zoomed" : ""}`}
								style={{
									touchAction: seatZoom > MIN_SEAT_ZOOM ? "none" : "pan-y",
								}}
								onPointerDown={(event) => {
									if (
										seatZoom <= MIN_SEAT_ZOOM ||
										(event.target instanceof Element &&
											event.target.closest("button"))
									)
										return;
									panStartRef.current = {
										pointerId: event.pointerId,
										clientX: event.clientX,
										clientY: event.clientY,
										panX: seatPan.x,
										panY: seatPan.y,
									};
									event.currentTarget.setPointerCapture(event.pointerId);
									setIsSeatPanning(true);
								}}
								onPointerMove={(event) => {
									const start = panStartRef.current;
									if (!start || start.pointerId !== event.pointerId) return;
									const rect = event.currentTarget.getBoundingClientRect();
									setSeatPan(
										clampSeatPan(
											{
												x: start.panX + event.clientX - start.clientX,
												y: start.panY + event.clientY - start.clientY,
											},
											seatZoom,
											rect,
										),
									);
								}}
								onPointerUp={(event) => {
									if (panStartRef.current?.pointerId !== event.pointerId)
										return;
									panStartRef.current = undefined;
									setIsSeatPanning(false);
								}}
								onPointerCancel={() => {
									panStartRef.current = undefined;
									setIsSeatPanning(false);
								}}
							>
								<div
									ref={seatCircleContentRef}
									id="seat-circle-content"
									className={`seat-circle-content${seatBoardBackgroundSource ? " seat-circle-content--with-background" : ""}${reduceMotion || isSeatPanning ? " seat-circle-content--reduce-motion" : ""}`}
									style={{
										transform: `translate(${seatPan.x}px, ${seatPan.y}px) scale(${seatZoom})`,
										backgroundImage: seatBoardBackgroundSource
											? `url("${seatBoardBackgroundSource.replaceAll('"', "%22")}")`
											: undefined,
									}}
								>
									{isNorthMarkerDragging ? (
										<div
											aria-hidden="true"
											className="seat-north-guide-line"
											style={{ transform: `rotate(${northAngle}rad)` }}
										/>
									) : null}
									{seatVisuals.map((visual, index) => {
										const topSeatIndex = seatCircleFirstSeatAtTop
											? 0
											: seatVisuals.length - 1;
										const direction = seatCircleClockwise ? 1 : -1;
										const angle =
											northAngle +
											(direction * (index - topSeatIndex) * Math.PI * 2) /
												seatVisuals.length;
										const left = 50 + Math.cos(angle) * 40;
										const top = 50 + Math.sin(angle) * 40;
										const seatNumber = index + 1;
										const colors = seatColorLayers[index];
										const orderedColors = [
											colors?.teamColor,
											colors?.roleColor,
											colors?.playerColor,
										];
										const seatTextColor = selectSeatTextColor(
											orderedColors,
											theme,
										);
										const colorBackground = [
											colors?.playerColor,
											colors?.roleColor,
											colors?.teamColor,
										]
											.filter((color): color is string => color !== undefined)
											.map(
												(color) => `linear-gradient(#${color}66, #${color}66)`,
											)
											.join(", ");
										const seatTarget = nightAbilityTargets.find(
											(target) => target.seatNumber === seatNumber,
										);
										const isNightSource =
											isNightListOpen &&
											seatTarget?.playerId === nightActionSelection?.actorId;
										const isNightTarget =
											isNightListOpen &&
											seatTarget?.playerId === nightActionSelection?.targetId;
										const nightMarkerClass =
											isNightSource && isNightTarget
												? " seat-button--night-self-target"
												: `${isNightSource ? " seat-button--night-source" : ""}${isNightTarget ? " seat-button--night-target" : ""}`;
										const nightMarkerText =
											isNightSource && isNightTarget
												? `✦◎ ${t("game.sourceAndTarget")}`
												: isNightSource
													? `✦ ${t("game.source")}`
													: isNightTarget
														? `◎ ${t("game.target")}`
														: undefined;
										const activeDrag =
											seatDragVisual?.key === visual.key
												? seatDragVisual
												: undefined;
										return (
											<Fragment key={visual.key}>
												<button
													type="button"
													ref={(element) => {
														if (element)
															seatButtonElementsRef.current.set(
																visual.key,
																element,
															);
														else
															seatButtonElementsRef.current.delete(visual.key);
													}}
													className={`seat-button interactive-surface${isSeatOrderLocked ? "" : " seat-button--draggable"}${nightMarkerClass}${nightActionSelection?.locked && (isNightSource || isNightTarget) ? " seat-button--night-locked" : ""}${activeDrag ? (activeDrag.returning ? " seat-button--drag-returning" : " seat-button--dragging") : ""}`}
													aria-label={t("game.seatAccessible", {
														seat: seatNumber,
														marker:
															isNightSource && isNightTarget
																? t("game.sourceAndTargetSuffix")
																: isNightSource
																	? t("game.sourceSuffix")
																	: isNightTarget
																		? t("game.targetSuffix")
																		: "",
													})}
													aria-pressed={selectedSeat === seatNumber}
													data-seat-number={seatNumber}
													data-night-marker={nightMarkerText}
													draggable={false}
													style={{
														left: `${left}%`,
														top: `${top}%`,
														backgroundImage: colorBackground || undefined,
														color: seatTextColor,
														transform: activeDrag
															? `translate(calc(-50% + ${activeDrag.offsetX}px), calc(-50% + ${activeDrag.offsetY}px))`
															: undefined,
													}}
													onClick={() => {
														if (suppressSeatClickRef.current) {
															suppressSeatClickRef.current = false;
															return;
														}
														if (seatTarget) {
															selectPlayer(seatTarget.playerId, seatNumber);
															return;
														}
														setSelectedSeat(seatNumber);
													}}
													onPointerDown={(event) => {
														if (isSeatOrderLocked) return;
														pointerDragRef.current = {
															pointerId: event.pointerId,
															seatNumber,
															startX: event.clientX,
															startY: event.clientY,
															moved: false,
														};
														setSeatDragVisual({
															key: visual.key,
															offsetX: 0,
															offsetY: 0,
															returning: false,
														});
														event.currentTarget.setPointerCapture(
															event.pointerId,
														);
													}}
													onPointerMove={(event) => {
														const drag = pointerDragRef.current;
														if (!drag || drag.pointerId !== event.pointerId)
															return;
														if (
															Math.hypot(
																event.clientX - drag.startX,
																event.clientY - drag.startY,
															) >= 6
														)
															drag.moved = true;
														if (drag.moved)
															updateDraggedSeatPosition(
																visual.key,
																event.clientX,
																event.clientY,
																drag.startX,
																drag.startY,
															);
													}}
													onPointerUp={(event) => {
														const drag = pointerDragRef.current;
														if (!drag || drag.pointerId !== event.pointerId)
															return;
														pointerDragRef.current = undefined;
														if (!drag.moved) {
															setSeatDragVisual(undefined);
															return;
														}
														suppressSeatClickRef.current = true;
														window.setTimeout(() => {
															suppressSeatClickRef.current = false;
														}, 0);
														finishSeatDrag(
															drag.seatNumber,
															findDropTargetSeat(
																event.clientX,
																event.clientY,
															) ?? Number.NaN,
														);
													}}
													onPointerCancel={() => {
														pointerDragRef.current = undefined;
														returnDraggedSeat();
													}}
													onTransitionEnd={(event) => {
														if (
															event.propertyName === "transform" &&
															seatDragVisual?.key === visual.key &&
															seatDragVisual.returning
														)
															setSeatDragVisual(undefined);
													}}
												>
													{seatLabels[index] ? (
														<span
															className="seat-player-label"
															aria-hidden="true"
														>
															{seatLabels[index]}
														</span>
													) : null}
													<span className="seat-symbol" aria-hidden="true">
														{symbols[index]}
													</span>
													<small>{seatNumber}</small>
												</button>
												{isSetupPhase ? (
													<>
														<button
															type="button"
															className="setup-seat-action setup-seat-action--delete danger-action"
															aria-label={t("game.deleteSeat", {
																seat: seatNumber,
															})}
															style={{ left: `${left}%`, top: `${top}%` }}
															onClick={() =>
																requestSeatAction("delete", seatNumber)
															}
														>
															<span aria-hidden="true">🗑</span>
														</button>
														<button
															type="button"
															className="setup-seat-action setup-seat-action--add icon-button interactive-surface"
															aria-label={t("game.addPlayerAfterSeat", {
																seat: seatNumber,
															})}
															style={{ left: `${left}%`, top: `${top}%` }}
															onClick={() =>
																requestSeatAction("add", seatNumber)
															}
														>
															<span aria-hidden="true">+</span>
														</button>
													</>
												) : null}
											</Fragment>
										);
									})}
									<button
										type="button"
										className={`seat-north-marker${isNorthMarkerDragging ? " seat-north-marker--dragging" : ""}`}
										aria-label={t(
											seatCircleFirstSeatAtTop
												? "settings.seatCircleNorthFirst"
												: "settings.seatCircleNorthLast",
										)}
										disabled={isSeatOrderLocked}
										style={{
											left: `${50 + Math.cos(northAngle) * NORTH_MARKER_RADIUS_PERCENT}%`,
											top: `${50 + Math.sin(northAngle) * NORTH_MARKER_RADIUS_PERCENT}%`,
											transform: `translate(-50%, -50%) rotate(${northAngle + Math.PI / 2}rad)`,
										}}
										onPointerDown={(event) => {
											if (isSeatOrderLocked) return;
											northMarkerPointerRef.current = event.pointerId;
											event.currentTarget.setPointerCapture(event.pointerId);
											setIsNorthMarkerDragging(true);
											updateNorthAngleFromPointer(event.clientX, event.clientY);
										}}
										onPointerMove={(event) => {
											if (northMarkerPointerRef.current !== event.pointerId)
												return;
											updateNorthAngleFromPointer(event.clientX, event.clientY);
										}}
										onPointerUp={(event) => {
											if (northMarkerPointerRef.current !== event.pointerId)
												return;
											updateNorthAngleFromPointer(event.clientX, event.clientY);
											northMarkerPointerRef.current = undefined;
											setIsNorthMarkerDragging(false);
										}}
										onPointerCancel={() => {
											northMarkerPointerRef.current = undefined;
											setIsNorthMarkerDragging(false);
										}}
									>
										<span aria-hidden="true">▲</span>
									</button>
								</div>
							</div>
						</>
					)}
				</fieldset>
				<nav className="game-time-controls" aria-label={t("game.flow")}>
					{currentNight === 0 ? (
						<button
							type="button"
							className={!roleReveal ? "button-disabled" : undefined}
							disabled={!roleReveal}
							onClick={() => {
								setIsRoleRevealed(false);
								setRoleRevealIndex(0);
							}}
						>
							{t("game.showRoles")}
						</button>
					) : (
						<button type="button" onClick={onRewindTime}>
							{t("common.back")}
						</button>
					)}
					<button
						type="button"
						className={isNightListOpen ? "prominent-button-active" : undefined}
						aria-pressed={isNightListOpen}
						onClick={() =>
							setIsNightListOpen((open) => {
								if (open) setNightActionSelection(undefined);
								return !open;
							})
						}
					>
						{t("game.nightList")}
					</button>
					<button
						type="button"
						onClick={() => {
							if (
								currentTime.phase === "day" &&
								currentTime.currentNight + 1 > 1
							) {
								setCheckedNightPlayers(new Set());
								setNightActionSelection(undefined);
							}
							onAdvanceTime();
						}}
					>
						{t("common.next")}
					</button>
				</nav>

				<section className="seat-details" aria-live="polite">
					<header className="seat-details__header">
						<div className="seat-details__title">
							<h2>
								{isNightListOpen
									? t("game.nightList")
									: selectedSeat
										? t("game.seat", { seat: selectedSeat })
										: t("game.details")}
							</h2>
							{isSetupPhase && selectedSeat && !isNightListOpen ? (
								<fieldset className="seat-details__seat-actions">
									<legend className="visually-hidden">
										{t("game.actionsForSeat", { seat: selectedSeat })}
									</legend>
									<button
										type="button"
										className="icon-button interactive-surface danger-action"
										aria-label={t("game.deleteSelectedSeat", {
											seat: selectedSeat,
										})}
										onClick={() => requestSeatAction("delete", selectedSeat)}
									>
										<span aria-hidden="true">🗑</span>
									</button>
									<button
										type="button"
										className="icon-button interactive-surface"
										aria-label={t("game.addPlayerAfterSelectedSeat", {
											seat: selectedSeat,
										})}
										onClick={() => requestSeatAction("add", selectedSeat)}
									>
										<span aria-hidden="true">+</span>
									</button>
								</fieldset>
							) : null}
						</div>
						<button
							type="button"
							className="icon-button interactive-surface seat-details__fullscreen-button"
							aria-label={
								isDetailsFullscreen
									? t("game.restoreSplitView")
									: t("game.showDetailsFullscreen")
							}
							aria-pressed={isDetailsFullscreen}
							onClick={() =>
								setIsDetailsFullscreen((fullscreen) => !fullscreen)
							}
						>
							<span aria-hidden="true">{isDetailsFullscreen ? "↙" : "⛶"}</span>
						</button>
					</header>
					{isNightListOpen ? (
						<NightList
							language={language}
							entries={nightList}
							targets={nightAbilityTargets}
							checkedPlayers={checkedNightPlayers}
							targetSelectionRef={nightTargetSelectionRef}
							onSelectionChange={setNightActionSelection}
							onCheckedChange={(playerId, checked) =>
								setCheckedNightPlayers((current) => {
									const next = new Set(current);
									if (checked) next.add(playerId);
									else next.delete(playerId);
									return next;
								})
							}
							onUsePlayerAbility={onUsePlayerAbility}
						/>
					) : editorModel && selectedSeat ? (
						<div className="player-editor">
							<EditableNameField
								language={language}
								key={`${selectedSeat}:${editorModel.playerName}`}
								name={editorModel.playerName}
								onSave={(name) =>
									onSavePlayer({
										originalPlayerId: editorModel.originalPlayerId,
										player: { ...editorModel.player, name },
										seatNumber: selectedSeat,
									})
								}
							/>
							<div className="seat-number-editor">
								<ManualSeatInput
									key={`${editorModel.originalPlayerId}:${editorModel.seatNumber}`}
									label={t("game.manualSeat")}
									seatNumber={editorModel.seatNumber}
									seatCount={editorModel.seatOptions.length}
									onCommit={changeSelectedSeat}
								/>
								<label className="player-editor__field">
									<span>{t("game.selectSeat")}</span>
									<select
										value={editorModel.seatNumber}
										onChange={(event) =>
											changeSelectedSeat(Number(event.target.value))
										}
									>
										{editorModel.seatOptions.map((seat) => (
											<option value={seat} key={seat}>
												{seat}
											</option>
										))}
									</select>
								</label>
							</div>
							<label className="player-editor__field">
								<span>{t("game.lifeState")}</span>
								<select
									value={editorModel.player.lifeState}
									onChange={(event) =>
										onSavePlayer({
											originalPlayerId: editorModel.originalPlayerId,
											player: {
												...editorModel.player,
												lifeState: event.target.value,
											},
											seatNumber: selectedSeat,
										})
									}
								>
									<option value="alive">{t("game.life.alive")}</option>
									<option value="dead_vote_available">
										{t("game.life.deadVoteAvailable")}
									</option>
									<option value="dead_vote_spent">
										{t("game.life.deadVoteSpent")}
									</option>
									<option value="doubledead_vote_available">
										{t("game.life.doubleDeadVoteAvailable")}
									</option>
									<option value="doubledead_vote_spent">
										{t("game.life.doubleDeadVoteSpent")}
									</option>
								</select>
							</label>
							{editorModel.roleFields.map((roleField) => (
								<Fragment key={roleField.field}>
									<label className="player-editor__field">
										<span>{playerRoleFieldText(roleField.field, t)}</span>
										<select
											value={roleField.value}
											onChange={(event) =>
												onSavePlayer({
													originalPlayerId: editorModel.originalPlayerId,
													player: changePlayerDraftRole(
														editorModel.player,
														roleField.field,
														event.target.value || null,
													),
													seatNumber: selectedSeat,
												})
											}
										>
											<option value="">{t("game.noRole")}</option>
											{roleField.optionGroups.map((group, index) => (
												<optgroup
													label={
														group.kind === "unassigned"
															? t("game.rolesWithoutTeam")
															: (group.label ?? t("game.team"))
													}
													key={`${group.kind}-${group.label ?? index}`}
												>
													{group.options.map((option) => (
														<option value={option.value} key={option.value}>
															{option.label}
														</option>
													))}
												</optgroup>
											))}
										</select>
									</label>
									{roleField.field === "actualRoleId" ? (
										<ShownRoleEditor
											language={language}
											roles={editorModel.shownRoles}
											addOptionGroups={editorModel.shownRoleOptionGroups}
											reduceMotion={reduceMotion}
											onLongPress={onShownRoleLongPress}
											onMove={(fromIndex, toInsertionIndex) =>
												onMoveShownRole({
													playerId: editorModel.originalPlayerId,
													fromIndex,
													toInsertionIndex,
												})
											}
											onChange={(index, roleId) =>
												onChangeShownRole({
													playerId: editorModel.originalPlayerId,
													index,
													roleId,
												})
											}
											onDelete={(index) =>
												onSavePlayer({
													originalPlayerId: editorModel.originalPlayerId,
													player: {
														...editorModel.player,
														roles:
															index === 0
																? changePlayerDraftRole(
																		editorModel.player,
																		"shownRoleId",
																		null,
																	).roles
																: {
																		...editorModel.player.roles,
																		shownRoleIds:
																			editorModel.player.roles.shownRoleIds.filter(
																				(_, currentIndex) =>
																					currentIndex !== index,
																			),
																	},
													},
													seatNumber: selectedSeat,
												})
											}
											onAdd={(roleId) =>
												onSavePlayer({
													originalPlayerId: editorModel.originalPlayerId,
													player: {
														...editorModel.player,
														roles: {
															...editorModel.player.roles,
															shownRoleIds: [
																...editorModel.player.roles.shownRoleIds,
																roleId,
															],
														},
													},
													seatNumber: selectedSeat,
												})
											}
										/>
									) : null}
								</Fragment>
							))}
							<h3>{t("game.statuses")}</h3>
							<div className="status-editor-list">
								{editorModel.statuses.map((status) => (
									<button
										type="button"
										className="status-editor-card interactive-surface"
										key={status.id}
										onClick={() => setEditingStatusId(status.id)}
									>
										<strong>{status.name}</strong>
										<small>
											{t("game.statusDuration", {
												from: status.fromNight,
												until: status.untilNight ?? t("game.openEnded"),
											})}
										</small>
									</button>
								))}
								<label className="player-editor__field player-editor__new-status">
									<span>{t("game.newStatus")}</span>
									<select
										value=""
										onChange={(event) => {
											if (!event.target.value) return;
											onSavePlayer({
												originalPlayerId: editorModel.originalPlayerId,
												player: {
													...editorModel.player,
													statuses: [
														...editorModel.player.statuses,
														{
															id: "",
															statusId: event.target.value,
															fromNight: 0,
															untilNight: null,
														},
													],
												},
												seatNumber: selectedSeat,
											});
										}}
									>
										<option value="">{t("common.select")}</option>
										{editorModel.statusOptions.map((option) => (
											<option value={option.value} key={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</label>
							</div>
							<button
								type="button"
								className="danger-action player-editor__delete-button"
								onClick={() => requestSeatAction("delete", selectedSeat)}
							>
								{t("game.deletePlayer")}
							</button>
						</div>
					) : emptySeatEditorModel && selectedSeat ? (
						<div className="player-editor empty-seat-editor">
							<label className="player-editor__field">
								<span>{t("game.player")}</span>
								<select
									value=""
									onChange={(event) => {
										const option = emptySeatEditorModel.playerOptions.find(
											(candidate) => candidate.value === event.target.value,
										);
										if (!option) return;
										onSavePlayer({
											originalPlayerId: option.value,
											player: option.player,
											seatNumber: selectedSeat,
										});
									}}
								>
									<option value="">{t("game.selectPlayer")}</option>
									{emptySeatEditorModel.playerOptions.map((option) => (
										<option value={option.value} key={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</label>
							<button
								type="button"
								onClick={() =>
									onSavePlayer({
										originalPlayerId: null,
										player: emptySeatEditorModel.newPlayer,
										seatNumber: selectedSeat,
									})
								}
							>
								{t("game.addPlayer")}
							</button>
							<button
								type="button"
								className="danger-action"
								onClick={() => {
									if (!onDeleteEmptySeat(selectedSeat)) return;
									captureSeatPositions();
									setSeatVisuals((current) =>
										current.filter((_, index) => index !== selectedSeat - 1),
									);
									setSelectedSeat(undefined);
								}}
							>
								{t("game.deleteEmptySeat")}
							</button>
						</div>
					) : (
						<p>
							{selectedSeat ? t("game.emptySeat") : t("game.selectSeatPrompt")}
						</p>
					)}
				</section>
			</section>
			{isMenuOpen ? (
				<ModalDialog
					open
					onClose={() => setIsMenuOpen(false)}
					className="action-sheet"
					label={t("game.menu.title")}
				>
					<header>
						<h2>{t("game.menu.title")}</h2>
						<button
							type="button"
							className="sheet-close-button"
							aria-label={t("common.close")}
							onClick={() => setIsMenuOpen(false)}
						>
							×
						</button>
					</header>
					<nav
						className="action-sheet-action-list game-action-menu"
						aria-label={t("game.menu.actions")}
					>
						<button
							data-testid="game-save"
							type="button"
							className={game.restored ? "button-disabled" : undefined}
							disabled={game.restored}
							onClick={() => void saveGame()}
						>
							<span aria-hidden="true">💾</span> {t("game.menu.save")}
						</button>
						<button
							type="button"
							className={
								onSuggestSaveAsName && onSaveAs ? undefined : "button-disabled"
							}
							disabled={!onSuggestSaveAsName || !onSaveAs}
							onClick={() => void requestSaveAs("game")}
						>
							<span aria-hidden="true">📝</span> {t("game.menu.saveAs")}
						</button>
						<button
							type="button"
							className={
								onSuggestTemplateName && onSaveAsTemplate
									? undefined
									: "button-disabled"
							}
							disabled={!onSuggestTemplateName || !onSaveAsTemplate}
							onClick={() => void requestSaveAs("template")}
						>
							<span aria-hidden="true">📋</span> {t("game.menu.saveAsTemplate")}
						</button>
						<button
							type="button"
							className="danger-action"
							onClick={requestExit}
						>
							<span aria-hidden="true">🚪</span> {t("game.menu.exit")}
						</button>
						<hr />
						<button
							type="button"
							onClick={() => {
								setIsMenuOpen(false);
								onManageGameEntities();
							}}
						>
							<span aria-hidden="true">🧩</span> {t("game.menu.manageEntities")}
						</button>
						<button
							type="button"
							onClick={() => {
								setIsMenuOpen(false);
								onRandomizeRoles();
							}}
						>
							<span aria-hidden="true">🎲</span> {t("game.menu.randomizeRoles")}
						</button>
						<button
							type="button"
							disabled={!canShufflePlayers}
							className={!canShufflePlayers ? "button-disabled" : undefined}
							onClick={() => {
								setIsMenuOpen(false);
								setIsShuffleConfirmationOpen(true);
							}}
						>
							<span aria-hidden="true">🔀</span> {t("game.menu.shufflePlayers")}
						</button>
						<button
							type="button"
							onClick={() => {
								setIsMenuOpen(false);
								onEditRolesForShowing();
							}}
						>
							<span aria-hidden="true">👁</span> {t("game.menu.rolesForShowing")}
						</button>
						<hr />
						<button
							type="button"
							onClick={() => {
								setIsMenuOpen(false);
								setIsLogOpen(true);
							}}
						>
							<span aria-hidden="true">📜</span> {t("game.menu.showLog")}
						</button>
						<button
							type="button"
							onClick={() => {
								setIsMenuOpen(false);
								onOpenSettings();
							}}
						>
							<span aria-hidden="true">⚙</span> {t("game.menu.settings")}
						</button>
					</nav>
					{saveError ? <p className="load-error">{saveError}</p> : null}
				</ModalDialog>
			) : null}
			{isShuffleConfirmationOpen ? (
				<ModalDialog
					open
					onClose={() => setIsShuffleConfirmationOpen(false)}
					className="seat-action-confirmation"
					role="alertdialog"
					labelledBy="shuffle-players-confirmation-title"
				>
					<h2 id="shuffle-players-confirmation-title">
						{t("game.menu.shufflePlayers")}
					</h2>
					<div className="exit-dialog-actions centered-dialog-actions seat-action-confirmation__actions">
						<button type="button" onClick={confirmShufflePlayers}>
							{t("common.ok")}
						</button>
						<button
							type="button"
							data-modal-initial-focus
							onClick={() => setIsShuffleConfirmationOpen(false)}
						>
							{t("common.cancel")}
						</button>
					</div>
				</ModalDialog>
			) : null}
			{pendingSeatAction ? (
				<ModalDialog
					open
					onClose={() => setPendingSeatAction(undefined)}
					className="seat-action-confirmation"
					role="alertdialog"
					labelledBy="seat-action-confirmation-title"
				>
					<h2 id="seat-action-confirmation-title">
						{pendingSeatAction.action === "delete" ? (
							<>
								{t("game.seat", { seat: pendingSeatAction.seatNumber })}
								<br />
								{t("game.playerWithName", {
									name: pendingSeatAction.playerName,
								})}
								<br />
								{t("game.deleteQuestion")}
							</>
						) : (
							<>
								{t("game.newSeatAfter")}
								<br />
								{t("game.seat", { seat: pendingSeatAction.seatNumber })}
								<br />
								{t("game.playerWithName", {
									name: pendingSeatAction.playerName,
								})}
								<br />
								{t("game.addQuestion")}
							</>
						)}
					</h2>
					<div className="exit-dialog-actions centered-dialog-actions seat-action-confirmation__actions">
						<button
							type="button"
							className={
								pendingSeatAction.action === "delete"
									? "danger-action"
									: undefined
							}
							onClick={confirmSeatAction}
						>
							{t("common.ok")}
						</button>
						<button
							type="button"
							data-modal-initial-focus
							onClick={() => setPendingSeatAction(undefined)}
						>
							{t("game.seatActionCancel")}
						</button>
					</div>
				</ModalDialog>
			) : null}
			{saveAsMode ? (
				<ModalDialog
					open
					onClose={() => {
						if (!isSavingAs) setSaveAsMode(undefined);
					}}
					className="action-sheet"
					labelledBy="game-save-as-title"
				>
					<header>
						<h2 id="game-save-as-title">
							{t(
								saveAsMode === "game"
									? "game.menu.saveAs"
									: "game.menu.saveAsTemplate",
							)}
						</h2>
						<button
							type="button"
							className="sheet-close-button"
							aria-label={t("common.close")}
							disabled={isSavingAs}
							onClick={() => setSaveAsMode(undefined)}
						>
							×
						</button>
					</header>
					<form
						className="scenario-card-action-form"
						onSubmit={(event) => {
							event.preventDefault();
							void saveGameAs();
						}}
					>
						<label>
							{t("common.name")}
							<input
								data-modal-initial-focus
								required
								value={saveAsName}
								disabled={isSavingAs}
								onChange={(event) =>
									setSaveAsName(sanitizeText(event.target.value))
								}
							/>
						</label>
						{saveError ? <p className="load-error">{saveError}</p> : null}
						<div>
							<button
								type="button"
								disabled={isSavingAs}
								onClick={() => setSaveAsMode(undefined)}
							>
								{t("common.cancel")}
							</button>
							<button type="submit" disabled={isSavingAs}>
								{t(isSavingAs ? "common.saving" : "common.save")}
							</button>
						</div>
					</form>
				</ModalDialog>
			) : null}
			{isExitDialogOpen ? (
				<ModalDialog
					open
					onClose={() => setIsExitDialogOpen(false)}
					onBack={() => void saveGame().then((saved) => saved && onExit())}
					className="action-sheet"
					role="alertdialog"
					labelledBy="unsaved-title"
				>
					<h2 id="unsaved-title">{t("game.unsavedTitle")}</h2>
					<div className="exit-dialog-actions">
						<button
							type="button"
							className={game.restored ? "button-disabled" : undefined}
							disabled={game.restored}
							onClick={() => void saveGame().then((saved) => saved && onExit())}
						>
							{t("game.saveAndExit")}
						</button>
						<button type="button" className="danger-action" onClick={onExit}>
							{t("game.exitWithoutSaving")}
						</button>
						<button
							type="button"
							data-modal-initial-focus
							onClick={() => setIsExitDialogOpen(false)}
						>
							{t("common.cancel")}
						</button>
					</div>
					{saveError ? <p className="load-error">{saveError}</p> : null}
				</ModalDialog>
			) : null}
			{isSaveRecoveryOpen ? (
				<ModalDialog
					open
					onClose={() => void finishSaveRecoveryLater()}
					className="action-sheet"
					role="alertdialog"
					labelledBy="save-recovery-title"
				>
					<h2 id="save-recovery-title">{t("game.saveFailedTitle")}</h2>
					<p>
						{saveRecoveryReason === "targetExists"
							? t("game.targetExists")
							: saveRecoveryReason === "diskFull"
								? t("error.diskFull")
								: t("game.saveRecoveryQuestion")}
					</p>
					<div className="exit-dialog-actions">
						{saveRecoveryReason === "targetExists" ? (
							<>
								<button
									type="button"
									data-modal-initial-focus
									disabled={isResolvingRecovery}
									onClick={() =>
										void resolveCreatedStorageCollision("overwrite")
									}
								>
									{t("common.overwrite")}
								</button>
								<button
									type="button"
									disabled={isResolvingRecovery}
									onClick={() => void resolveCreatedStorageCollision("cancel")}
								>
									{t("common.cancel")}
								</button>
								<button
									type="button"
									disabled={isResolvingRecovery}
									onClick={() =>
										void resolveCreatedStorageCollision("keepBoth")
									}
								>
									{t("common.keepBoth")}
								</button>
							</>
						) : (
							<>
								<button
									type="button"
									data-modal-initial-focus
									disabled={isResolvingRecovery}
									onClick={() => {
										if (isResolvingSaveRecoveryRef.current) return;
										isResolvingSaveRecoveryRef.current = true;
										const commandId = saveRecoveryCommandId;
										if (!commandId || !onRetryStorageCommand) {
											isResolvingSaveRecoveryRef.current = false;
											setIsSaveRecoveryOpen(false);
											void saveGame();
											return;
										}
										setSaveError(undefined);
										setIsResolvingRecovery(true);
										void (
											saveRecoveryContext === "created"
												? continueCreatedStorageCommand("retry")
												: onRetryStorageCommand(commandId)
										)
											.then(() => setIsSaveRecoveryOpen(false))
											.catch((error: unknown) => {
												if (isObjectSaveInterruptedError(error))
													setSaveRecoveryCommandId(error.commandId);
												setSaveError(guiErrorText(error, t));
											})
											.finally(() => {
												isResolvingSaveRecoveryRef.current = false;
												setIsResolvingRecovery(false);
											});
									}}
								>
									{t("common.retry")}
								</button>
								<button
									type="button"
									disabled={isResolvingRecovery}
									onClick={() => {
										if (isResolvingSaveRecoveryRef.current) return;
										isResolvingSaveRecoveryRef.current = true;
										const commandId = saveRecoveryCommandId;
										if (!commandId) {
											isResolvingSaveRecoveryRef.current = false;
											setSaveError(t("game.storageCommandInactive"));
											return;
										}
										setSaveError(undefined);
										setIsResolvingRecovery(true);
										void (
											saveRecoveryContext === "created"
												? continueCreatedStorageCommand("cancel")
												: onRestorePreviousFile(commandId)
										)
											.then(() => setIsSaveRecoveryOpen(false))
											.catch((error: unknown) =>
												setSaveError(guiErrorText(error, t)),
											)
											.finally(() => {
												isResolvingSaveRecoveryRef.current = false;
												setIsResolvingRecovery(false);
											});
									}}
								>
									{t("common.cancel")}
								</button>
								<button
									type="button"
									disabled={isResolvingRecovery}
									onClick={() => void finishSaveRecoveryLater()}
								>
									{t("game.decideLater")}
								</button>
							</>
						)}
					</div>
					{saveError ? <p className="load-error">{saveError}</p> : null}
				</ModalDialog>
			) : null}
			{editingStatusId && editorModel && selectedSeat ? (
				<StatusEditorDialog
					language={language}
					status={editorModel.statuses.find(
						(status) => status.id === editingStatusId,
					)}
					statusOptions={editorModel.statusOptions}
					onClose={() => setEditingStatusId(undefined)}
					onSave={(changes) => {
						const saved = onSavePlayer({
							originalPlayerId: editorModel.originalPlayerId,
							player: updatePlayerDraftStatus(
								editorModel.player,
								editingStatusId,
								changes,
							),
							seatNumber: selectedSeat,
						});
						if (saved !== false) setEditingStatusId(undefined);
					}}
					onDelete={() => {
						const saved = onSavePlayer({
							originalPlayerId: editorModel.originalPlayerId,
							player: {
								...editorModel.player,
								statuses: editorModel.player.statuses.filter(
									(status) => status.id !== editingStatusId,
								),
							},
							seatNumber: selectedSeat,
						});
						if (saved !== false) setEditingStatusId(undefined);
					}}
				/>
			) : null}
		</main>
	);
}

function GameLogScreen({
	entries,
	language,
	onBack,
	onDeleteEntry,
	onClear,
}: {
	entries: Array<{
		id: string;
		night: number;
		phase: string;
		createdAt: string;
		type: string;
		text: string;
		payload?: Record<string, unknown>;
	}>;
	language: string;
	onBack: () => void;
	onDeleteEntry: (logEntryId: string) => boolean;
	onClear: () => boolean;
}) {
	const t = createGuiTranslator(language);
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			onBack();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onBack]);
	return (
		<main className="app-shell game-log-shell">
			<section className="game-log-screen">
				<header className="screen-header">
					<button
						type="button"
						className="icon-button"
						aria-label={t("game.backToGame")}
						onClick={onBack}
					>
						‹
					</button>
					<div>
						<p className="eyebrow">{t("game.currentGame")}</p>
						<h1>{t("game.log.title")}</h1>
					</div>
				</header>
				{entries.length > 0 ? (
					<ol className="game-log-list">
						{entries.map((entry) => (
							<li key={entry.id} className="game-log-entry">
								<header>
									<strong>{formatLogGameTime(entry, t)}</strong>
									<div className="game-log-entry__actions">
										<time dateTime={entry.createdAt}>
											{formatLogCreatedAt(entry.createdAt, language)}
										</time>
										<button
											type="button"
											className="icon-button interactive-surface danger-action game-log-entry__delete"
											aria-label={t("common.delete")}
											onClick={() => onDeleteEntry(entry.id)}
										>
											<span aria-hidden="true">🗑</span>
										</button>
									</div>
								</header>
								<p>{gameLogEntryText(entry, t)}</p>
							</li>
						))}
					</ol>
				) : (
					<p className="empty-state">{t("game.log.empty")}</p>
				)}
				<div className="exit-dialog-actions centered-dialog-actions game-log-actions">
					<button
						type="button"
						className="danger-action"
						disabled={entries.length === 0}
						onClick={onClear}
					>
						{t("common.delete")}
					</button>
					<button type="button" onClick={onBack}>
						{t("common.cancel")}
					</button>
				</div>
			</section>
		</main>
	);
}

function ManualSeatInput({
	label,
	seatNumber,
	seatCount,
	onCommit,
}: {
	label: string;
	seatNumber: number;
	seatCount: number;
	onCommit: (seatNumber: number) => boolean;
}) {
	const [draft, setDraft] = useState(String(seatNumber));
	const skipBlurCommitRef = useRef(false);

	const reset = () => setDraft(String(seatNumber));
	const commit = () => {
		const targetSeat = Number(draft);
		if (
			draft.trim() === "" ||
			!Number.isInteger(targetSeat) ||
			targetSeat < 1 ||
			targetSeat > seatCount ||
			!onCommit(targetSeat)
		) {
			reset();
			return;
		}
		setDraft(String(targetSeat));
	};

	return (
		<label className="player-editor__field">
			<span>{label}</span>
			<input
				type="number"
				min={1}
				max={seatCount}
				value={draft}
				onFocus={(event) => event.currentTarget.select()}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => {
					if (skipBlurCommitRef.current) {
						skipBlurCommitRef.current = false;
						return;
					}
					commit();
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						commit();
					}
					if (event.key === "Escape") {
						event.preventDefault();
						skipBlurCommitRef.current = true;
						reset();
						event.currentTarget.blur();
					}
				}}
			/>
		</label>
	);
}

function formatLogGameTime(
	entry: { night: number; phase: string },
	t: ReturnType<typeof createGuiTranslator>,
): string {
	if (entry.night === 0 || entry.phase === "setup") return t("game.setup");
	if (entry.phase === "night")
		return t("game.nightNumber", { number: entry.night });
	if (entry.phase === "day")
		return t("game.dayNumber", { number: entry.night });
	return `${entry.phase} ${entry.night}`;
}

function formatLogCreatedAt(value: string, language: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString(language);
}

function gameLogEntryText(
	entry: { type: string; text: string; payload?: Record<string, unknown> },
	t: ReturnType<typeof createGuiTranslator>,
): string {
	const payload = entry.payload ?? {};
	const text = (key: string) =>
		t(key as Parameters<typeof t>[0], {
			...Object.fromEntries(
				Object.entries(payload).map(([name, value]) => [
					name,
					logPayloadText(value),
				]),
			),
		});
	switch (entry.type) {
		case "time_advanced":
			if (!payload.oldTime || !payload.newTime) return entry.text;
			return t("game.log.timeAdvanced", {
				oldTime: logTimePayloadLabel(payload.oldTime, t),
				newTime: logTimePayloadLabel(payload.newTime, t),
			});
		case "time_rewound":
			if (!payload.oldTime || !payload.newTime) return entry.text;
			return t("game.log.timeRewound", {
				oldTime: logTimePayloadLabel(payload.oldTime, t),
				newTime: logTimePayloadLabel(payload.newTime, t),
			});
		case "player_life_state_changed":
			return t("game.log.lifeStateChanged", {
				player: logPayloadText(payload.playerName ?? payload.playerId),
				oldState: lifeStateLogLabel(payload.oldStatus, t),
				newState: lifeStateLogLabel(payload.newStatus, t),
			});
		case "player_status_applied": {
			const storedStatus =
				payload.status && typeof payload.status === "object"
					? (payload.status as Record<string, unknown>)
					: undefined;
			return t("game.log.statusApplied", {
				status: logPayloadText(payload.statusName ?? storedStatus?.statusId),
				player: logPayloadText(payload.playerName ?? payload.playerId),
			});
		}
		case "roles_randomly_distributed":
			return t("game.log.rolesDistributed", {
				count: Array.isArray(payload.assignments)
					? payload.assignments.length
					: 0,
			});
		case "selected_roles_randomly_distributed":
			return t("game.log.selectedRolesDistributed", {
				count: Array.isArray(payload.assignments)
					? payload.assignments.length
					: 0,
			});
		case "seat_order_changed":
			switch (payload.action) {
				case "move":
					return text("game.log.seatMoved");
				case "swap":
					return text("game.log.seatsSwapped");
				case "append":
					return text("game.log.playerAppended");
				case "insert":
					return text("game.log.playerInserted");
				case "remove":
					return text("game.log.playerRemoved");
				case "replace":
					return t("game.log.seatOrderChanged");
			}
	}
	return entry.text;
}

function logTimePayloadLabel(
	value: unknown,
	t: ReturnType<typeof createGuiTranslator>,
): string {
	if (!value || typeof value !== "object" || Array.isArray(value)) return "";
	const time = value as Record<string, unknown>;
	const number = typeof time.currentNight === "number" ? time.currentNight : 0;
	if (number === 0 || time.phase === "setup") return t("game.setup");
	return t(time.phase === "day" ? "game.dayNumber" : "game.nightNumber", {
		number,
	});
}

function lifeStateLogLabel(
	value: unknown,
	t: ReturnType<typeof createGuiTranslator>,
): string {
	switch (value) {
		case "alive":
			return t("game.life.alive");
		case "dead_vote_available":
			return t("game.life.deadVoteAvailable");
		case "dead_vote_spent":
			return t("game.life.deadVoteSpent");
		case "doubledead_vote_available":
			return t("game.life.doubleDeadVoteAvailable");
		case "doubledead_vote_spent":
			return t("game.life.doubleDeadVoteSpent");
		default:
			return logPayloadText(value);
	}
}

function logPayloadText(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	return "";
}

function ShownRoleEditor({
	language,
	roles,
	addOptionGroups,
	reduceMotion,
	onLongPress,
	onMove,
	onChange,
	onDelete,
	onAdd,
}: {
	language: string;
	roles: GameShownRoleEditorItem[];
	addOptionGroups: EditorOptionGroup[];
	reduceMotion: boolean;
	onLongPress: () => void;
	onMove: (fromIndex: number, toInsertionIndex: number) => boolean;
	onChange: (index: number, roleId: string) => boolean;
	onDelete: (index: number) => void;
	onAdd: (roleId: string) => void;
}) {
	const t = createGuiTranslator(language);
	const [selectedIndex, setSelectedIndex] = useState<number>();
	const [dragVisual, setDragVisual] = useState<{
		roleId: string;
		offsetX: number;
		offsetY: number;
		returning: boolean;
	}>();
	const [activeInsertionIndex, setActiveInsertionIndex] = useState<number>();
	const pointerRef = useRef<
		| {
				pointerId: number;
				index: number;
				startX: number;
				startY: number;
				longPressTimer: number;
				dragging: boolean;
				dragMoved: boolean;
				cancelledClick: boolean;
		  }
		| undefined
	>(undefined);
	const rowElementsRef = useRef(new Map<string, HTMLLIElement>());
	const roleButtonElementsRef = useRef(new Map<string, HTMLButtonElement>());
	const previousPositionsRef = useRef<Map<string, DOMRect> | undefined>(
		undefined,
	);
	const suppressClickRef = useRef(false);
	const roleOrder = roles.map((role) => role.value).join("\u0000");

	useEffect(
		() => () => {
			const pointer = pointerRef.current;
			if (pointer) window.clearTimeout(pointer.longPressTimer);
		},
		[],
	);

	const capturePositions = () => {
		previousPositionsRef.current = new Map(
			[...rowElementsRef.current].map(([roleId, element]) => [
				roleId,
				element.getBoundingClientRect(),
			]),
		);
	};
	useLayoutEffect(() => {
		void roleOrder;
		const previous = previousPositionsRef.current;
		previousPositionsRef.current = undefined;
		if (!previous || reduceMotion) return;
		for (const [roleId, element] of rowElementsRef.current) {
			const oldRect = previous.get(roleId);
			if (!oldRect || typeof element.animate !== "function") continue;
			const newRect = element.getBoundingClientRect();
			const deltaX = oldRect.left - newRect.left;
			const deltaY = oldRect.top - newRect.top;
			if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) continue;
			element.animate(
				[
					{ transform: `translate(${deltaX}px, ${deltaY}px)` },
					{ transform: "translate(0, 0)" },
				],
				{ duration: 240, easing: "ease" },
			);
		}
	}, [roleOrder, reduceMotion]);

	const findDropInsertionIndex = (clientX: number, clientY: number) => {
		if (!Number.isFinite(clientX) || !Number.isFinite(clientY))
			return undefined;
		const draggedButton = dragVisual
			? roleButtonElementsRef.current.get(dragVisual.roleId)
			: undefined;
		const previousPointerEvents = draggedButton?.style.pointerEvents;
		if (draggedButton) draggedButton.style.pointerEvents = "none";
		try {
			const element = document.elementFromPoint(clientX, clientY);
			const insertionTarget = element?.closest<HTMLElement>(
				"[data-shown-role-insertion-index]",
			);
			if (insertionTarget) {
				const insertionIndex = Number(
					insertionTarget.dataset.shownRoleInsertionIndex,
				);
				return Number.isInteger(insertionIndex) ? insertionIndex : undefined;
			}
			const row = element?.closest<HTMLElement>("[data-shown-role-index]");
			if (!row) return undefined;
			const rowIndex = Number(row.dataset.shownRoleIndex);
			if (!Number.isInteger(rowIndex)) return undefined;
			const rect = row.getBoundingClientRect();
			return clientY < rect.top + rect.height / 2 ? rowIndex : rowIndex + 1;
		} finally {
			if (draggedButton)
				draggedButton.style.pointerEvents = previousPointerEvents ?? "";
		}
	};
	const returnDraggedRole = () => {
		setActiveInsertionIndex(undefined);
		setDragVisual((current) =>
			!current || reduceMotion
				? undefined
				: { ...current, offsetX: 0, offsetY: 0, returning: true },
		);
	};
	const suppressNextClick = () => {
		suppressClickRef.current = true;
		window.setTimeout(() => {
			suppressClickRef.current = false;
		}, 0);
	};
	const moveWithArrow = (index: number, direction: -1 | 1) => {
		capturePositions();
		const insertionIndex = direction < 0 ? index - 1 : index + 2;
		if (!onMove(index, insertionIndex))
			previousPositionsRef.current = undefined;
	};
	const selectedRole =
		selectedIndex === undefined ? undefined : roles[selectedIndex];

	return (
		<section className="player-shown-role-editor">
			<h3>{t("game.role.shown")}</h3>
			{roles.length > 0 ? (
				<ul
					className={`roles-for-showing-list player-shown-role-list${dragVisual ? " player-shown-role-list--dragging" : ""}`}
				>
					{roles.map((role, index) => {
						const activeDrag =
							dragVisual?.roleId === role.value ? dragVisual : undefined;
						return (
							<Fragment key={role.value}>
								<li
									aria-hidden="true"
									className={`shown-role-insertion-target${activeInsertionIndex === index ? " shown-role-insertion-target--active" : ""}`}
									data-shown-role-insertion-index={index}
								/>
								<li
									className="roles-for-showing-list__item"
									data-shown-role-index={index}
									ref={(element) => {
										if (element)
											rowElementsRef.current.set(role.value, element);
										else rowElementsRef.current.delete(role.value);
									}}
								>
									<button
										type="button"
										className={`shown-role-button interactive-surface${roles.length > 1 ? " shown-role-button--draggable" : ""}${activeDrag ? (activeDrag.returning ? " shown-role-button--drag-returning" : " shown-role-button--dragging") : ""}`}
										ref={(element) => {
											if (element)
												roleButtonElementsRef.current.set(role.value, element);
											else roleButtonElementsRef.current.delete(role.value);
										}}
										style={{
											transform: activeDrag
												? `translate(${activeDrag.offsetX}px, ${activeDrag.offsetY}px)`
												: undefined,
										}}
										onClick={() => {
											if (suppressClickRef.current) {
												suppressClickRef.current = false;
												return;
											}
											setSelectedIndex(index);
										}}
										onPointerDown={(event) => {
											if (roles.length < 2) return;
											const button = event.currentTarget;
											const pointer = {
												pointerId: event.pointerId,
												index,
												startX: event.clientX,
												startY: event.clientY,
												longPressTimer: 0,
												dragging: false,
												dragMoved: false,
												cancelledClick: false,
											};
											pointer.longPressTimer = window.setTimeout(() => {
												if (pointerRef.current !== pointer) return;
												pointer.dragging = true;
												pointer.cancelledClick = true;
												setDragVisual({
													roleId: role.value,
													offsetX: 0,
													offsetY: 0,
													returning: false,
												});
												button.setPointerCapture(event.pointerId);
												onLongPress();
											}, SHOWN_ROLE_LONG_PRESS_MS);
											pointerRef.current = pointer;
										}}
										onPointerMove={(event) => {
											const pointer = pointerRef.current;
											if (!pointer || pointer.pointerId !== event.pointerId)
												return;
											const distance = Math.hypot(
												event.clientX - pointer.startX,
												event.clientY - pointer.startY,
											);
											if (!pointer.dragging) {
												if (distance >= SHOWN_ROLE_POINTER_MOVE_THRESHOLD_PX) {
													window.clearTimeout(pointer.longPressTimer);
													pointer.cancelledClick = true;
												}
												return;
											}
											event.preventDefault();
											if (distance >= SHOWN_ROLE_POINTER_MOVE_THRESHOLD_PX) {
												pointer.dragMoved = true;
												setDragVisual({
													roleId: role.value,
													offsetX: event.clientX - pointer.startX,
													offsetY: event.clientY - pointer.startY,
													returning: false,
												});
												setActiveInsertionIndex(
													findDropInsertionIndex(event.clientX, event.clientY),
												);
											}
										}}
										onPointerUp={(event) => {
											const pointer = pointerRef.current;
											if (!pointer || pointer.pointerId !== event.pointerId)
												return;
											window.clearTimeout(pointer.longPressTimer);
											pointerRef.current = undefined;
											if (!pointer.dragging) {
												if (pointer.cancelledClick) suppressNextClick();
												return;
											}
											suppressNextClick();
											if (!pointer.dragMoved) {
												setDragVisual(undefined);
												setActiveInsertionIndex(undefined);
												return;
											}
											const insertionIndex = findDropInsertionIndex(
												event.clientX,
												event.clientY,
											);
											if (insertionIndex === undefined) {
												returnDraggedRole();
												return;
											}
											if (
												insertionIndex === pointer.index ||
												insertionIndex === pointer.index + 1
											) {
												returnDraggedRole();
												return;
											}
											capturePositions();
											if (onMove(pointer.index, insertionIndex)) {
												setDragVisual(undefined);
												setActiveInsertionIndex(undefined);
											} else {
												previousPositionsRef.current = undefined;
												returnDraggedRole();
											}
										}}
										onPointerCancel={() => {
											const pointer = pointerRef.current;
											if (!pointer) return;
											window.clearTimeout(pointer.longPressTimer);
											pointerRef.current = undefined;
											if (pointer.dragging) returnDraggedRole();
										}}
										onTouchMove={(event) => {
											if (pointerRef.current?.dragging) event.preventDefault();
										}}
										onTransitionEnd={(event) => {
											if (
												event.propertyName === "transform" &&
												activeDrag?.returning
											)
												setDragVisual(undefined);
										}}
									>
										{role.label}
									</button>
									{roles.length > 1 ? (
										<div className="shown-role-move-actions">
											<button
												type="button"
												className="icon-button"
												aria-label={`${t("common.back")}: ${role.label}`}
												disabled={index === 0}
												onClick={() => moveWithArrow(index, -1)}
											>
												<span aria-hidden="true">↑</span>
											</button>
											<button
												type="button"
												className="icon-button"
												aria-label={`${t("common.next")}: ${role.label}`}
												disabled={index === roles.length - 1}
												onClick={() => moveWithArrow(index, 1)}
											>
												<span aria-hidden="true">↓</span>
											</button>
										</div>
									) : null}
									<button
										type="button"
										className="danger-action"
										aria-label={t("rolesForShowing.removeRole", {
											name: role.label,
										})}
										onClick={() => onDelete(index)}
									>
										<span aria-hidden="true">🗑</span>
									</button>
								</li>
							</Fragment>
						);
					})}
					<li
						aria-hidden="true"
						className={`shown-role-insertion-target${activeInsertionIndex === roles.length ? " shown-role-insertion-target--active" : ""}`}
						data-shown-role-insertion-index={roles.length}
					/>
				</ul>
			) : null}
			<label className="player-editor__field">
				<span>{t("common.select")}</span>
				<select
					value=""
					onChange={(event) => {
						if (event.target.value) onAdd(event.target.value);
					}}
				>
					<option value="">{t("common.select")}</option>
					<RoleOptionGroups groups={addOptionGroups} language={language} />
				</select>
			</label>
			{selectedRole && selectedIndex !== undefined ? (
				<ModalDialog
					open
					onClose={() => setSelectedIndex(undefined)}
					className="action-sheet shown-role-selection"
					labelledBy="shown-role-selection-title"
				>
					<header>
						<h2 id="shown-role-selection-title">{t("game.role.shown")}</h2>
						<button
							type="button"
							className="sheet-close-button"
							onClick={() => setSelectedIndex(undefined)}
							aria-label={t("common.close")}
						>
							×
						</button>
					</header>
					<div className="shown-role-selection__options">
						{selectedRole.optionGroups.flatMap((group) =>
							group.options.map((option) => (
								<button
									type="button"
									key={option.value}
									className={
										option.value === selectedRole.value
											? "prominent-button-active"
											: undefined
									}
									onClick={() => {
										if (onChange(selectedIndex, option.value))
											setSelectedIndex(undefined);
									}}
								>
									{option.label}
								</button>
							)),
						)}
					</div>
				</ModalDialog>
			) : null}
		</section>
	);
}

function RoleOptionGroups({
	groups,
	language,
}: {
	groups: EditorOptionGroup[];
	language: string;
}) {
	const t = createGuiTranslator(language);
	return groups.map((group, index) => (
		<optgroup
			label={
				group.kind === "unassigned"
					? t("game.rolesWithoutTeam")
					: (group.label ?? t("game.team"))
			}
			key={`${group.kind}-${group.label ?? index}`}
		>
			{group.options.map((option) => (
				<option value={option.value} key={option.value}>
					{option.label}
				</option>
			))}
		</optgroup>
	));
}

function RoleRevealScreen({
	language,
	step,
	isRevealed,
	onToggle,
	onBack,
	onNext,
}: {
	language: string;
	step: {
		playerName: string;
		seatNumber: number;
		shownRoleNames: string[];
	};
	isRevealed: boolean;
	onToggle: () => void;
	onBack: () => void;
	onNext: () => void;
}) {
	const t = createGuiTranslator(language);
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			onBack();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onBack]);
	return (
		<main className="role-reveal-screen">
			<button type="button" className="role-reveal-content" onClick={onToggle}>
				{isRevealed ? (
					<div className="role-reveal-value">
						<p>{step.playerName}:</p>
						<p>{step.shownRoleNames[0] ?? t("game.noRole")}</p>
						{step.shownRoleNames.length > 1 ? (
							<p className="role-reveal-additional-roles">
								{step.shownRoleNames.slice(1).join(", ")}
							</p>
						) : null}
					</div>
				) : (
					<p className="role-reveal-prompt">
						{t("game.roleReveal.prompt", {
							player: step.playerName,
							seat: step.seatNumber,
						})}
					</p>
				)}
			</button>
			{!isRevealed ? (
				<nav
					className="role-reveal-navigation"
					aria-label={t("game.roleReveal.navigation")}
				>
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation();
							onBack();
						}}
					>
						{t("common.back")}
					</button>
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation();
							onNext();
						}}
					>
						{t("common.next")}
					</button>
				</nav>
			) : null}
		</main>
	);
}

function PlayerOverviewTable({
	language,
	entries,
	selectedSeat,
	nightSelection,
	onSelectPlayer,
}: {
	language: string;
	entries: PlayerOverviewEntry[];
	selectedSeat?: number;
	nightSelection?: { actorId: string; targetId: string; locked: boolean };
	onSelectPlayer: (playerId: string, seatNumber: number | null) => void;
}) {
	const t = createGuiTranslator(language);
	return (
		<div className="player-overview-board">
			<table
				className="player-overview-table"
				aria-label={t("game.playerOverview")}
			>
				<thead>
					<tr>
						<th scope="col">{t("game.overview.seat")}</th>
						<th scope="col">{t("game.player")}</th>
						<th scope="col">{t("game.overview.role")}</th>
						<th scope="col">{t("game.statuses")}</th>
					</tr>
				</thead>
				<tbody>
					{entries.map((entry) => {
						const isSource = entry.playerId === nightSelection?.actorId;
						const isTarget = entry.playerId === nightSelection?.targetId;
						const nightMarker =
							isSource && isTarget
								? t("game.sourceAndTarget")
								: isSource
									? t("game.source")
									: isTarget
										? t("game.target")
										: undefined;
						return (
							<tr
								key={entry.playerId}
								className={`${selectedSeat === entry.seatNumber ? "player-overview-row--selected " : ""}${isSource ? "player-overview-row--night-source " : ""}${isTarget ? "player-overview-row--night-target " : ""}${nightSelection?.locked && (isSource || isTarget) ? "player-overview-row--night-locked" : ""}`}
								onClick={() => onSelectPlayer(entry.playerId, entry.seatNumber)}
							>
								<td>{entry.seatNumber ?? "–"}</td>
								<td>
									<button
										type="button"
										className="player-overview-row-action"
										aria-label={t("game.overview.playerAccessible", {
											name: entry.playerName,
											seat: entry.seatNumber ?? t("common.unknown"),
											marker: nightMarker ? `, ${nightMarker}` : "",
										})}
									>
										<span aria-hidden="true">
											{formatPlayerLifeState(entry.lifeState, t).icon}
										</span>{" "}
										{entry.playerName}
										{nightMarker ? (
											<small className="player-overview-night-marker">
												{nightMarker}
											</small>
										) : null}
									</button>
									<small>
										{formatPlayerLifeState(entry.lifeState, t).label}
									</small>
								</td>
								<td>
									<span>{entry.actualRole.roleName ?? "–"}</span>
									{entry.actualRole.teamName ? (
										<small>{entry.actualRole.teamName}</small>
									) : null}
									{entry.shownRole?.roleName ? (
										<small>
											{t("game.overview.shownRole", {
												role: entry.shownRole.roleName,
											})}
										</small>
									) : null}
									{entry.nightRole?.roleName ? (
										<small>
											{t("game.overview.nightRole", {
												role: entry.nightRole.roleName,
											})}
										</small>
									) : null}
								</td>
								<td>
									{entry.activeStatuses.length > 0
										? entry.activeStatuses
												.map((status) => status.name)
												.join(", ")
										: "–"}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function formatPlayerLifeState(
	lifeState: PlayerOverviewEntry["lifeState"],
	t: ReturnType<typeof createGuiTranslator>,
): {
	icon: string;
	label: string;
} {
	switch (lifeState) {
		case "alive":
			return { icon: "●", label: t("game.life.aliveShort") };
		case "dead_vote_available":
			return { icon: "✝", label: t("game.life.deadVoteAvailableShort") };
		case "dead_vote_spent":
			return { icon: "✝", label: t("game.life.deadVoteSpentShort") };
		case "doubledead_vote_available":
			return { icon: "✝✝", label: t("game.life.doubleDeadVoteAvailableShort") };
		case "doubledead_vote_spent":
			return { icon: "✝✝", label: t("game.life.doubleDeadVoteSpentShort") };
	}
}

function NightList({
	language,
	entries,
	targets,
	checkedPlayers,
	onCheckedChange,
	onUsePlayerAbility,
	targetSelectionRef,
	onSelectionChange,
}: {
	language: string;
	entries: ReturnType<typeof createNightListPresentation>;
	targets: ReturnType<typeof createNightAbilityTargets>;
	checkedPlayers: Set<string>;
	onCheckedChange: (playerId: string, checked: boolean) => void;
	onUsePlayerAbility: (
		actorPlayerId: string,
		targetPlayerId: string,
		action: PlayerAbilityAction,
		statusId?: string,
	) => PlayerActionResult;
	targetSelectionRef: {
		current: ((playerId: string) => void) | undefined;
	};
	onSelectionChange: (
		selection:
			| { actorId: string; targetId: string; locked: boolean }
			| undefined,
	) => void;
}) {
	const t = createGuiTranslator(language);
	const [actorId, setActorId] = useState<string>();
	const [abilityKey, setAbilityKey] = useState("");
	const [targetId, setTargetId] = useState("");
	const [executed, setExecuted] = useState(false);
	const [warning, setWarning] = useState<string>();
	const actor = entries.find((entry) => entry.playerId === actorId);
	const actorLabel = actor ? `${actor.seatNumber} ${actor.playerName}` : "";
	const selectedAbility = actor?.abilityOptions.find(
		(option) => option.key === abilityKey,
	);
	useEffect(() => {
		targetSelectionRef.current =
			actorId && !executed
				? (playerId) => {
						if (!targets.some((target) => target.playerId === playerId)) return;
						setTargetId(playerId);
						setWarning(undefined);
					}
				: undefined;
		return () => {
			targetSelectionRef.current = undefined;
		};
	}, [actorId, executed, targetSelectionRef, targets]);
	useEffect(() => {
		onSelectionChange(
			actorId && targetId ? { actorId, targetId, locked: executed } : undefined,
		);
	}, [actorId, executed, onSelectionChange, targetId]);
	const openActor = (playerId: string) => {
		const entry = entries.find((candidate) => candidate.playerId === playerId);
		setActorId(playerId);
		setAbilityKey(entry?.abilityOptions[0]?.key ?? "");
		setTargetId(targets[0]?.playerId ?? "");
		setExecuted(false);
		setWarning(undefined);
	};
	const closeActor = () => {
		setActorId(undefined);
		setWarning(undefined);
	};
	if (entries.length === 0) {
		return <p>{t("game.night.noActiveRoles")}</p>;
	}
	return (
		<div className="night-list-container">
			{actor ? (
				<section
					className="night-action"
					aria-label={t("game.night.actionFor", { player: actorLabel })}
				>
					<strong>
						{actorLabel} ({actor.actualRoleName ?? t("game.noRole")})
					</strong>
					<div className="night-action__fields">
						<select
							aria-label={t("game.night.action")}
							value={abilityKey}
							disabled={executed}
							onChange={(event) => setAbilityKey(event.target.value)}
						>
							{actor.abilityOptions.map((option) => (
								<option key={option.key} value={option.key}>
									{nightAbilityOptionText(option, t)}
								</option>
							))}
						</select>
						<span>{t("game.night.on")}</span>
						<select
							aria-label={t("game.night.targetPlayer")}
							value={targetId}
							disabled={executed}
							onChange={(event) => {
								setTargetId(event.target.value);
								setWarning(undefined);
							}}
						>
							{targets.map((target) => (
								<option key={target.playerId} value={target.playerId}>
									{`${target.seatNumber} – ${target.playerName}${target.isDead ? " ☠" : ""}`}
								</option>
							))}
						</select>
					</div>
					{warning ? (
						<p className="night-action__warning" role="alert">
							{warning}
						</p>
					) : null}
					<div className="night-action__buttons">
						{executed ? (
							<button type="button" onClick={closeActor}>
								{t("common.back")}
							</button>
						) : (
							<>
								<button
									type="button"
									disabled={!selectedAbility || !targetId}
									onClick={() => {
										if (!selectedAbility || !targetId) return;
										const result = onUsePlayerAbility(
											actor.playerId,
											targetId,
											selectedAbility.action,
											selectedAbility.statusId,
										);
										if (result.changed) {
											onCheckedChange(actor.playerId, true);
											setExecuted(true);
											setWarning(undefined);
										} else
											setWarning(
												result.warning
													? playerActionWarningText(result.warning, t)
													: t("game.night.noEffect"),
											);
									}}
								>
									{t("game.night.execute")}
								</button>
								<button type="button" onClick={closeActor}>
									{t("common.cancel")}
								</button>
							</>
						)}
					</div>
				</section>
			) : null}
			<ul className="night-list">
				{entries.map((entry) => (
					<li key={entry.playerId}>
						<label>
							<input
								type="checkbox"
								checked={checkedPlayers.has(entry.playerId)}
								onChange={(event) =>
									onCheckedChange(entry.playerId, event.target.checked)
								}
							/>
							<span>
								{entry.seatNumber} {entry.playerName}:{" "}
								{entry.actualRoleDiffers
									? `${entry.shownRoleName ?? t("game.noRole")} (`
									: null}
								{entry.abilityOptions.length > 0 ? (
									<button
										type="button"
										className="night-list__role-button"
										onClick={(event) => {
											event.preventDefault();
											openActor(entry.playerId);
										}}
									>
										{entry.actualRoleName ?? t("game.noRole")}
									</button>
								) : (
									(entry.actualRoleName ?? t("game.noRole"))
								)}
								{entry.actualRoleDiffers ? ")" : null}
							</span>
							{entry.isDead ? (
								<span role="img" aria-label={t("game.life.dead")}>
									☠
								</span>
							) : null}
						</label>
					</li>
				))}
			</ul>
		</div>
	);
}

function readGameTime(document: unknown): {
	currentNight: number;
	phase: "setup" | "night" | "day";
} {
	if (typeof document !== "object" || document === null)
		return { currentNight: 0, phase: "setup" };
	const time = (document as { time?: unknown }).time;
	if (typeof time !== "object" || time === null)
		return { currentNight: 0, phase: "setup" };
	const currentNight = (time as { currentNight?: unknown }).currentNight;
	const phase = (time as { phase?: unknown }).phase;
	return {
		currentNight: typeof currentNight === "number" ? currentNight : 0,
		phase:
			phase === "night" || phase === "day" || phase === "setup"
				? phase
				: "setup",
	};
}

function gameTimePresentationText(
	time: ReturnType<typeof createGameTimePresentation>,
	t: ReturnType<typeof createGuiTranslator>,
): string {
	switch (time.phase) {
		case "setup":
			return `📋 ${t("game.setup")}`;
		case "day":
			return `☀️ ${t("game.dayNumber", { number: time.currentNight })}`;
		case "night":
			return `🌙 ${t("game.nightNumber", { number: time.currentNight })}`;
	}
}

function playerRoleFieldText(
	field: "actualRoleId" | "shownRoleId" | "nightRoleId" | "claimedRoleId",
	t: ReturnType<typeof createGuiTranslator>,
): string {
	switch (field) {
		case "actualRoleId":
			return t("game.role.actual");
		case "shownRoleId":
			return t("game.role.shown");
		case "nightRoleId":
			return t("game.role.night");
		case "claimedRoleId":
			return t("game.role.claimed");
	}
}

function nightAbilityOptionText(
	option: {
		action: "kill" | "resurrect" | "apply_status";
		statusName?: string;
		statusId?: string;
	},
	t: ReturnType<typeof createGuiTranslator>,
): string {
	switch (option.action) {
		case "kill":
			return t("game.night.kill");
		case "resurrect":
			return t("game.night.resurrect");
		case "apply_status":
			return option.statusName ?? option.statusId ?? t("game.status");
	}
}

function StatusEditorDialog({
	language,
	status,
	statusOptions,
	onClose,
	onSave,
	onDelete,
}: {
	language: string;
	status:
		| {
				statusId: string;
				fromNight: number;
				untilNight: number | null;
				note: string;
		  }
		| undefined;
	statusOptions: { value: string; label: string }[];
	onClose: () => void;
	onSave: (changes: {
		statusId: string;
		fromNight: number;
		untilNight: number | null;
		note?: string;
	}) => void;
	onDelete: () => void;
}) {
	const t = createGuiTranslator(language);
	const [draft, setDraft] = useState(status);
	if (!draft) return null;
	return (
		<ModalDialog
			open
			onClose={onClose}
			className="action-sheet"
			labelledBy="status-editor-title"
		>
			<form
				className="status-edit-sheet"
				onSubmit={(event) => {
					event.preventDefault();
					onSave(draft);
				}}
			>
				<header>
					<h2 id="status-editor-title">{t("game.statusEditor.title")}</h2>
					<button
						type="button"
						className="sheet-close-button"
						aria-label={t("common.close")}
						onClick={onClose}
					>
						×
					</button>
				</header>
				<label className="player-editor__field">
					<span>{t("game.statusEditor.status")}</span>
					<select
						data-modal-initial-focus
						value={draft.statusId}
						onChange={(event) =>
							setDraft({ ...draft, statusId: event.target.value })
						}
					>
						{statusOptions.map((option) => (
							<option value={option.value} key={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</label>
				<label className="player-editor__field">
					<span>{t("game.statusEditor.fromNight")}</span>
					<input
						type="number"
						value={draft.fromNight}
						onChange={(event) =>
							setDraft({ ...draft, fromNight: Number(event.target.value) })
						}
					/>
				</label>
				<label className="player-editor__field">
					<span>{t("game.statusEditor.untilNight")}</span>
					<input
						type="number"
						value={draft.untilNight ?? ""}
						onChange={(event) =>
							setDraft({
								...draft,
								untilNight:
									event.target.value === "" ? null : Number(event.target.value),
							})
						}
					/>
				</label>
				<label className="player-editor__field">
					<span>{t("game.statusEditor.note")}</span>
					<input
						value={draft.note}
						onChange={(event) =>
							setDraft({ ...draft, note: sanitizeText(event.target.value) })
						}
					/>
				</label>
				<div className="exit-dialog-actions centered-dialog-actions status-edit-sheet__actions">
					<button type="submit">{t("common.save")}</button>
					<button type="button" onClick={onClose}>
						{t("common.cancel")}
					</button>
					<button type="button" className="danger-action" onClick={onDelete}>
						{t("common.delete")}
					</button>
				</div>
			</form>
		</ModalDialog>
	);
}

function EditableNameField({
	language,
	name,
	onSave,
}: {
	language: string;
	name: string;
	onSave: (name: string) => void;
}) {
	const t = createGuiTranslator(language);
	const [draft, setDraft] = useState(name);
	return (
		<label className="player-editor__field">
			<span>{t("game.playerName")}</span>
			<input
				value={draft}
				onChange={(event) => setDraft(sanitizeText(event.target.value))}
				onBlur={() => draft !== name && onSave(draft)}
				onKeyDown={(event) => {
					if (event.key === "Enter") event.currentTarget.blur();
				}}
			/>
		</label>
	);
}

function updatePlayerDraftStatus(
	player: PlayerDraft,
	statusInstanceId: string,
	changes: {
		statusId: string;
		fromNight: number;
		untilNight: number | null;
		note?: string;
	},
): PlayerDraft {
	return {
		...player,
		statuses: player.statuses.map((status) =>
			status.id === statusInstanceId ? { ...status, ...changes } : status,
		),
	};
}

function moveVisualToSeat<T>(
	items: T[],
	fromSeatNumber: number,
	targetSeatNumber: number,
	replaceEmptyTarget = false,
): T[] {
	const result = [...items];
	if (replaceEmptyTarget) {
		const fromIndex = fromSeatNumber - 1;
		const targetIndex = targetSeatNumber - 1;
		[result[fromIndex], result[targetIndex]] = [
			result[targetIndex],
			result[fromIndex],
		];
		return result;
	}
	const [moved] = result.splice(fromSeatNumber - 1, 1);
	result.splice(targetSeatNumber - 1, 0, moved);
	return result;
}
