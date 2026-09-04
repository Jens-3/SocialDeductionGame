import type { GamePlayerDraft } from "../domain/gameDraft";
import type { GameState } from "../domain/gameFactory";
import { getDisplayName } from "../domain/localizedNames";
import {
	changePlayerRoleState,
	decodeUnicodeEscaped,
	type EditablePlayerRoleField,
	type Player,
	type PlayerRoleState,
} from "../domain/models";
import { isPlayerStatusActiveAtNight } from "../domain/playerStatus";
import { EMPTY_PLAYER_ID } from "../domain/reservedIds";

export const SEAT_SYMBOLS = {
	empty: "○",
	playerWithoutRole: "◇",
	alivePlayerFallback: "◆",
	deadPlayer: "☠",
	hasStatus: "✦",
	shownRoleDiffers: "◐",
} as const;

export const EMPTY_SEAT_PLAYER_ID = EMPTY_PLAYER_ID;

export type GameDetailRow = {
	field:
		| "seat"
		| "player"
		| "id"
		| "role"
		| "lifeState"
		| "shownRole"
		| "status";
	value: string;
};

export type EditorOption = { value: string; label: string };
export type EditorOptionGroup = {
	kind: "team" | "unassigned";
	label?: string;
	options: EditorOption[];
};
export type EmptySeatPlayerOption = EditorOption & { player: GamePlayerDraft };
export type EmptySeatEditorModel = {
	seatNumber: number;
	playerOptions: EmptySeatPlayerOption[];
	newPlayer: GamePlayerDraft;
};
export type GameRoleEditorField = {
	field: Exclude<EditablePlayerRoleField, "shownRoleId">;
	value: string;
	optionGroups: EditorOptionGroup[];
};
export type GameShownRoleEditorItem = EditorOption & {
	optionGroups: EditorOptionGroup[];
};
export type GameStatusEditorItem = {
	id: string;
	statusId: string;
	name: string;
	fromNight: number;
	untilNight: number | null;
	note: string;
};
export type GameSeatEditorModel = {
	originalPlayerId: string;
	player: GamePlayerDraft;
	playerName: string;
	seatNumber: number;
	seatOptions: number[];
	roleFields: GameRoleEditorField[];
	shownRoles: GameShownRoleEditorItem[];
	shownRoleOptionGroups: EditorOptionGroup[];
	statuses: GameStatusEditorItem[];
	statusOptions: EditorOption[];
};

export type GameSeatEditorOptions = {
	hideExpiredStatuses?: boolean;
};

export type RoleRevealStep = {
	playerName: string;
	seatNumber: number;
	shownRoleNames: string[];
};

export type RoleRevealPresentation = {
	steps: RoleRevealStep[];
};

export type NightListEntry = {
	playerId: string;
	seatNumber: number;
	playerName: string;
	shownRoleName: string | null;
	actualRoleName: string | null;
	actualRoleDiffers: boolean;
	abilityOptions: NightAbilityOption[];
	isDead: boolean;
	nightOrder: number;
};

export type NightAbilityOption = {
	key: string;
	action: "kill" | "resurrect" | "apply_status";
	statusId?: string;
	statusName?: string;
};

export type NightAbilityTarget = {
	playerId: string;
	seatNumber: number;
	playerName: string;
	isDead: boolean;
};

export type GameTimePresentation = {
	currentNight: number;
	phase: "setup" | "day" | "night";
};

export type GameSeatColorLayers = {
	teamColor?: string;
	roleColor?: string;
	playerColor?: string;
};

export function createGameTimePresentation(
	document: GameState,
): GameTimePresentation {
	const time = readRecord(readRecord(document)?.time);
	const currentNight = readNumber(time?.currentNight) ?? 0;
	return {
		currentNight,
		phase:
			currentNight === 0 || time?.phase === "setup"
				? "setup"
				: time?.phase === "day"
					? "day"
					: "night",
	};
}

/** Erstellt die nachtaktiven Personen in fachlicher Nachtreihenfolge. */
export function createNightListPresentation(
	document: GameState,
	language = "de",
): NightListEntry[] {
	const root = readRecord(document);
	const game = readGame(document);
	const time = readRecord(root?.time);
	if (!game || !time) return [];
	const currentNight = readNumber(time.currentNight) ?? 0;
	const roles = readArray(game.ruleSetSnapshot?.roles)
		.map(readRecord)
		.filter((role): role is Record<string, unknown> => role !== undefined);
	const rolesById = new Map(
		roles.flatMap((role) => {
			const id = readText(role.id);
			return id ? [[id, role] as const] : [];
		}),
	);
	const statusDefinitions = readRecord(game.statusDefinitionsById) ?? {};

	return game.seatOrder
		.flatMap((playerId, index) => {
			if (playerId === EMPTY_PLAYER_ID) return [];
			const player = readRecord(game.playersById[playerId]);
			const playerRoles = readRecord(player?.roles);
			const nightRoleId = readNullableString(playerRoles?.nightRoleId);
			const nightRole = nightRoleId ? rolesById.get(nightRoleId) : undefined;
			const night = readRecord(nightRole?.night);
			const action = readRecord(
				currentNight <= 1 ? night?.first : night?.other,
			);
			const nightOrder = readNumber(action?.order);
			if (!player || nightOrder === undefined || nightOrder <= 0) return [];

			const shownRoleId = readStringArray(playerRoles?.shownRoleIds)[0] ?? null;
			const actualRoleId = readNullableString(playerRoles?.actualRoleId);
			const roleName = (roleId: string | null) =>
				roleId
					? (readDisplayName(rolesById.get(roleId), language) ?? roleId)
					: null;
			const shownRoleName = roleName(shownRoleId);
			const actualRole = actualRoleId ? rolesById.get(actualRoleId) : undefined;
			const abilityOptions: NightAbilityOption[] = [];
			if (actualRole?.kills_someone === true)
				abilityOptions.push({
					key: "kill",
					action: "kill",
				});
			if (actualRole?.resurrect_someone === true)
				abilityOptions.push({
					key: "resurrect",
					action: "resurrect",
				});
			for (const statusId of readArray(actualRole?.apply_status_effect)
				.map(readText)
				.filter((id): id is string => id !== undefined)) {
				abilityOptions.push({
					key: `status:${statusId}`,
					action: "apply_status",
					statusId,
					statusName:
						readDisplayName(
							readRecord(statusDefinitions[statusId]),
							language,
						) ?? statusId,
				});
			}
			return [
				{
					playerId,
					seatNumber: index + 1,
					playerName: readDisplayName(player, language) ?? playerId,
					shownRoleName,
					actualRoleName: roleName(actualRoleId),
					actualRoleDiffers: actualRoleId !== shownRoleId,
					abilityOptions,
					isDead:
						readText(player.lifeState) !== undefined &&
						readText(player.lifeState) !== "alive",
					nightOrder,
				},
			];
		})
		.sort(
			(left, right) =>
				left.nightOrder - right.nightOrder ||
				left.seatNumber - right.seatNumber,
		);
}

export function createNightAbilityTargets(
	document: GameState,
	language = "de",
): NightAbilityTarget[] {
	const game = readGame(document);
	if (!game) return [];
	return game.seatOrder.flatMap((playerId, index) => {
		if (playerId === EMPTY_PLAYER_ID) return [];
		const player = readRecord(game.playersById[playerId]);
		if (!player) return [];
		const dead =
			readText(player.lifeState) !== undefined &&
			readText(player.lifeState) !== "alive";
		return [
			{
				playerId,
				seatNumber: index + 1,
				playerName: readDisplayName(player, language) ?? playerId,
				isDead: dead,
			},
		];
	});
}

/** Liefert den vollständigen Rollen-Zeigeablauf ausschließlich im Setup. */
export function createRoleRevealPresentation(
	document: GameState,
	language = "de",
	showRoleSymbols = false,
): RoleRevealPresentation | undefined {
	const root = readRecord(document);
	const time = readRecord(root?.time);
	const game = readGame(document);
	if (!root || !game || time?.phase !== "setup") return undefined;
	const roleNames = showRoleSymbols
		? readRoleLabels(game.ruleSetSnapshot, language)
		: readRoleNames(game.ruleSetSnapshot, language);
	const steps = game.seatOrder.flatMap((playerId, index) => {
		if (playerId === EMPTY_PLAYER_ID) return [];
		const player = readRecord(game.playersById[playerId]);
		if (!player) return [];
		const playerName = readDisplayName(player, language) ?? playerId;
		const shownRoleNames = readStringArray(
			readRecord(player.roles)?.shownRoleIds,
		).map((roleId) => roleNames.get(roleId) ?? roleId);
		return [
			{
				playerName,
				seatNumber: index + 1,
				shownRoleNames,
			},
		];
	});
	return steps.length > 0 ? { steps } : undefined;
}

export function createGameSeatEditorModel(
	document: GameState,
	seatNumber: number,
	language = "de",
	options: GameSeatEditorOptions = {},
): GameSeatEditorModel | undefined {
	const context = readSeatPlayer(document, seatNumber);
	if (!context) return undefined;
	const roles = readPlayerRoleState(context.player.roles);
	const roleOptionGroups = readRoleOptionGroups(
		context.game.ruleSetSnapshot,
		language,
		true,
	);
	const statusOptions = readStatusOptions(context.game, language);
	const statusNames = new Map(
		statusOptions.map((option) => [option.value, option.label]),
	);
	return {
		originalPlayerId: context.playerId,
		player: toPlayerDraft(document.playersById[context.playerId]),
		playerName: readDisplayName(context.player, language) ?? context.playerId,
		seatNumber,
		seatOptions: Array.from(
			{ length: context.game.seatOrder.length },
			(_, index) => index + 1,
		),
		roleFields: [
			{
				field: "actualRoleId",
				value: roles.actualRoleId ?? "",
				optionGroups: roleOptionGroups,
			},
			{
				field: "nightRoleId",
				value: roles.nightRoleId ?? "",
				optionGroups: roleOptionGroups,
			},
			{
				field: "claimedRoleId",
				value: roles.claimedRoleId ?? "",
				optionGroups: roleOptionGroups,
			},
		],
		shownRoles: roles.shownRoleIds.map((roleId) => ({
			value: roleId,
			label:
				roleOptionGroups
					.flatMap((group) => group.options)
					.find((option) => option.value === roleId)?.label ?? roleId,
			optionGroups: roleOptionGroups.map((group) => ({
				...group,
				options: group.options.filter(
					(option) =>
						option.value === roleId ||
						!roles.shownRoleIds.includes(option.value),
				),
			})),
		})),
		shownRoleOptionGroups: roleOptionGroups.map((group) => ({
			...group,
			options: group.options.filter(
				(option) => !roles.shownRoleIds.includes(option.value),
			),
		})),
		statuses: (Array.isArray(context.player.statuses)
			? context.player.statuses
			: []
		)
			.map((entry) => readRecord(entry))
			.filter((entry): entry is Record<string, unknown> => entry !== undefined)
			.map((entry) => {
				const statusId = readText(entry.statusId) ?? "";
				return {
					id: readText(entry.id) ?? "",
					statusId,
					name: statusNames.get(statusId) ?? statusId,
					fromNight: typeof entry.fromNight === "number" ? entry.fromNight : 0,
					untilNight:
						typeof entry.untilNight === "number" ? entry.untilNight : null,
					note: readText(entry.note) ?? "",
				};
			})
			.filter(
				(status) =>
					!options.hideExpiredStatuses ||
					isPlayerStatusActiveAtNight(status, document.time.currentNight),
			),
		statusOptions,
	};
}

/** Liefert für einen freien Sitz ausschließlich noch ungesetzte Spieler. */
export function createEmptySeatEditorModel(
	document: GameState,
	seatNumber: number,
	language = "de",
): EmptySeatEditorModel | undefined {
	const game = readGame(document);
	if (
		!game ||
		!Number.isInteger(seatNumber) ||
		seatNumber < 1 ||
		game.seatOrder[seatNumber - 1] !== EMPTY_PLAYER_ID
	)
		return undefined;
	const seatedPlayerIds = new Set(
		game.seatOrder.filter((playerId) => playerId !== EMPTY_PLAYER_ID),
	);
	return {
		seatNumber,
		newPlayer: {
			id: "",
			name: `Player ${Object.keys(document.playersById).length + 1}`,
			lifeState: "alive",
			roles: {
				actualRoleId: null,
				shownRoleIds: [],
				nightRoleId: null,
			},
			statuses: [],
		},
		playerOptions: Object.entries(game.playersById)
			.flatMap(([recordId, entry]) => {
				const player = readRecord(entry);
				const id = readText(player?.id) ?? recordId;
				if (!player || seatedPlayerIds.has(id)) return [];
				const domainPlayer = document.playersById[id];
				return domainPlayer
					? [
							{
								value: id,
								label: readDisplayName(player, language) ?? id,
								player: toPlayerDraft(domainPlayer),
							},
						]
					: [];
			})
			.sort(
				(left, right) =>
					left.label.localeCompare(right.label, language, {
						sensitivity: "base",
					}) || left.value.localeCompare(right.value),
			),
	};
}

/** Ändert ausschließlich den lokalen Player-Draft samt Rollenkaskade. */
export function changePlayerDraftRole(
	player: GamePlayerDraft,
	field: EditablePlayerRoleField,
	value: string | null,
): GamePlayerDraft {
	return {
		...player,
		roles: changePlayerRoleState(player.roles, field, value),
	};
}

/** Erzeugt die vollständige, fachlich ausgewertete Symbolfolge der Sitzplätze. */
export function createGameSeatSymbols(
	document: GameState,
	options: GameSeatEditorOptions = {},
): string[] {
	const game = readGame(document);
	if (!game) return [];
	const roleSymbols = readRoleSymbols(game.ruleSetSnapshot);

	return game.seatOrder.map((playerId) => {
		if (playerId === EMPTY_PLAYER_ID) return SEAT_SYMBOLS.empty;
		const player = readRecord(game.playersById[playerId]);
		if (!player) return SEAT_SYMBOLS.empty;

		const roles = readRecord(player.roles);
		const actualRoleId = readNullableString(roles?.actualRoleId);
		const shownRoleIds = readStringArray(roles?.shownRoleIds);
		const shownRoleId = shownRoleIds[0] ?? null;
		const symbols: string[] = [
			actualRoleId === null
				? SEAT_SYMBOLS.playerWithoutRole
				: player.lifeState === "alive"
					? (roleSymbols.get(actualRoleId) ?? SEAT_SYMBOLS.alivePlayerFallback)
					: SEAT_SYMBOLS.deadPlayer,
		];

		const statuses = document.playersById[playerId]?.statuses ?? [];
		const hasVisibleStatus = statuses.some(
			(status) =>
				!options.hideExpiredStatuses ||
				isPlayerStatusActiveAtNight(status, document.time.currentNight),
		);
		if (hasVisibleStatus) {
			symbols.push(SEAT_SYMBOLS.hasStatus);
		}
		if (actualRoleId !== shownRoleId || shownRoleIds.length > 1) {
			symbols.push(SEAT_SYMBOLS.shownRoleDiffers);
		}
		return symbols.join(" ");
	});
}

/** Liefert die Farbebenen pro Sitz in fachlicher Reihenfolge. */
export function createGameSeatColorLayers(
	document: GameState,
): GameSeatColorLayers[] {
	const game = readGame(document);
	if (!game) return [];
	const roles = readArray(game.ruleSetSnapshot?.roles)
		.map(readRecord)
		.filter((role): role is Record<string, unknown> => role !== undefined);
	const teams = readArray(game.ruleSetSnapshot?.teams)
		.map(readRecord)
		.filter((team): team is Record<string, unknown> => team !== undefined);
	const rolesById = new Map(
		roles.flatMap((role) => {
			const id = readText(role.id);
			return id ? [[id, role] as const] : [];
		}),
	);
	const teamsById = new Map(
		teams.flatMap((team) => {
			const id = readText(team.id);
			return id ? [[id, team] as const] : [];
		}),
	);

	return game.seatOrder.map((playerId) => {
		if (playerId === EMPTY_PLAYER_ID) return {};
		const player = readRecord(game.playersById[playerId]);
		const playerRoles = readRecord(player?.roles);
		const actualRoleId = readNullableString(playerRoles?.actualRoleId);
		const role = actualRoleId ? rolesById.get(actualRoleId) : undefined;
		const teamId = readText(role?.teamId);
		const team = teamId ? teamsById.get(teamId) : undefined;
		return {
			teamColor: readHexColor(team?.color),
			roleColor: readHexColor(role?.color),
			playerColor: readHexColor(player?.color),
		};
	});
}

/** Liefert pro Sitz ausschließlich den oberhalb des Symbols anzuzeigenden Text. */
export function createGameSeatLabels(
	document: GameState,
	language = "de",
): string[] {
	const game = readGame(document);
	if (!game) return [];
	return game.seatOrder.map((playerId) => {
		if (playerId === EMPTY_PLAYER_ID) return "";
		const player = readRecord(game.playersById[playerId]);
		const name = readDisplayName(player, language);
		return name ? [...name].slice(0, 6).join("") : "";
	});
}

/**
 * Erzeugt die von der GUI unverändert darzustellende Detailtabelle für einen
 * 1-basierten Sitzplatz. Ein freier oder ungültiger Sitz liefert keine Zeilen.
 */
export function createGameSeatDetailRows(
	document: GameState,
	seatNumber: number,
	language = "de",
): GameDetailRow[] {
	const game = readGame(document);
	if (!game || !Number.isInteger(seatNumber) || seatNumber < 1) return [];
	const playerId = game.seatOrder[seatNumber - 1];
	if (!playerId || playerId === EMPTY_PLAYER_ID) return [];
	const player = readRecord(game.playersById[playerId]);
	if (!player) return [];

	const roles = readRecord(player.roles);
	const actualRoleId = readNullableString(roles?.actualRoleId);
	const shownRoleIds = readStringArray(roles?.shownRoleIds);
	const shownRoleId = shownRoleIds[0] ?? null;
	const roleNames = readRoleNames(game.ruleSetSnapshot, language);
	const statuses = Array.isArray(player.statuses) ? player.statuses : [];
	const statusNames = readStatusNames(game, language);

	const rows: GameDetailRow[] = [
		{ field: "seat", value: String(seatNumber) },
		{ field: "player", value: readDisplayName(player, language) ?? playerId },
		{ field: "id", value: playerId },
		{
			field: "role",
			value: actualRoleId ? (roleNames.get(actualRoleId) ?? actualRoleId) : "–",
		},
		{ field: "lifeState", value: readText(player.lifeState) ?? "–" },
	];

	if (shownRoleId !== actualRoleId || shownRoleIds.length > 1) {
		rows.push({
			field: "shownRole",
			value:
				shownRoleIds
					.map((roleId) => roleNames.get(roleId) ?? roleId)
					.join(", ") || "–",
		});
	}
	if (statuses.length > 0) {
		rows.push({
			field: "status",
			value:
				statuses
					.map((status) => {
						const statusId = readText(readRecord(status)?.statusId);
						return statusId
							? (statusNames.get(statusId) ?? statusId)
							: undefined;
					})
					.filter((value): value is string => value !== undefined)
					.join(", ") || "–",
		});
	}

	return rows;
}

function readGame(document: unknown):
	| {
			seatOrder: string[];
			playersById: Record<string, unknown>;
			ruleSetSnapshot?: Record<string, unknown>;
			statusDefinitionsById?: Record<string, unknown>;
	  }
	| undefined {
	const value = readRecord(document);
	if (!value || !Array.isArray(value.seatOrder)) return undefined;
	const playersById = readRecord(value.playersById) ?? {};
	return {
		seatOrder: value.seatOrder.filter(
			(playerId): playerId is string => typeof playerId === "string",
		),
		playersById,
		ruleSetSnapshot: readRecord(value.ruleSetSnapshot),
		statusDefinitionsById: readRecord(value.statusDefinitionsById),
	};
}

function readRoleNames(
	ruleSet: Record<string, unknown> | undefined,
	language: string,
): Map<string, string> {
	const result = new Map<string, string>();
	for (const role of Array.isArray(ruleSet?.roles) ? ruleSet.roles : []) {
		const value = readRecord(role);
		const id = readText(value?.id);
		const name = readDisplayName(value, language);
		if (id && name) result.set(id, name);
	}
	return result;
}

function readRoleLabels(
	ruleSet: Record<string, unknown> | undefined,
	language: string,
): Map<string, string> {
	const result = new Map<string, string>();
	for (const role of Array.isArray(ruleSet?.roles) ? ruleSet.roles : []) {
		const value = readRecord(role);
		const id = readText(value?.id);
		const name = readDisplayName(value, language);
		if (!id || !name) continue;
		const symbol = readRoleSymbol(value) ?? SEAT_SYMBOLS.alivePlayerFallback;
		result.set(id, `${symbol} ${name}`);
	}
	return result;
}

function readRoleSymbols(
	ruleSet: Record<string, unknown> | undefined,
): Map<string, string> {
	const result = new Map<string, string>();
	for (const role of readArray(ruleSet?.roles)) {
		const value = readRecord(role);
		const id = readText(value?.id);
		const symbol = readRoleSymbol(value);
		if (id && symbol) result.set(id, symbol);
	}
	return result;
}

function readRoleSymbol(
	role: Record<string, unknown> | undefined,
): string | undefined {
	return (
		readText(role?.unicodeSymbol) ??
		decodeUnicodeEscaped(readText(role?.unicodeEscaped))
	);
}

function readHexColor(value: unknown): string | undefined {
	return typeof value === "string" && /^[0-9A-F]{6}$/.test(value)
		? value
		: undefined;
}

function readStatusNames(
	game: ReturnType<typeof readGame> & {},
	language: string,
): Map<string, string> {
	const result = new Map<string, string>();
	for (const [id, definition] of Object.entries(
		game.statusDefinitionsById ?? {},
	)) {
		result.set(id, readDisplayName(readRecord(definition), language) ?? id);
	}
	for (const definition of Array.isArray(game.ruleSetSnapshot?.statuses)
		? game.ruleSetSnapshot.statuses
		: []) {
		const value = readRecord(definition);
		const id = readText(value?.id);
		if (id) result.set(id, readDisplayName(value, language) ?? id);
	}
	return result;
}

function readRoleOptionGroups(
	ruleSet: Record<string, unknown> | undefined,
	language: string,
	includeSymbols: boolean,
): EditorOptionGroup[] {
	const roles = readArray(ruleSet?.roles)
		.map((role) => readRecord(role))
		.filter((role): role is Record<string, unknown> => role !== undefined);
	const teams = readArray(ruleSet?.teams)
		.map((team) => readRecord(team))
		.filter((team): team is Record<string, unknown> => team !== undefined)
		.sort((left, right) => {
			const leftOrder =
				typeof left.teamOrder === "number"
					? left.teamOrder
					: Number.MAX_SAFE_INTEGER;
			const rightOrder =
				typeof right.teamOrder === "number"
					? right.teamOrder
					: Number.MAX_SAFE_INTEGER;
			return leftOrder - rightOrder;
		});
	const knownTeamIds = new Set(teams.map((team) => readText(team.id)));
	const createOptions = (teamId: string | undefined): EditorOption[] =>
		roles
			.filter((role) => readText(role.teamId) === teamId)
			.map((role) => createRoleOption(role, language, includeSymbols))
			.filter((option): option is EditorOption & { name: string } =>
				Boolean(option.value),
			)
			.sort((left, right) => left.name.localeCompare(right.name))
			.map(({ value, label }) => ({ value, label }));
	const groups: EditorOptionGroup[] = teams
		.map((team) => ({
			kind: "team" as const,
			label: readDisplayName(team, language) ?? readText(team.id),
			options: createOptions(readText(team.id)),
		}))
		.filter((group) => group.options.length > 0);
	const orphanedOptions = roles
		.filter((role) => !knownTeamIds.has(readText(role.teamId)))
		.map((role) => createRoleOption(role, language, includeSymbols))
		.filter((option): option is EditorOption & { name: string } =>
			Boolean(option.value),
		)
		.sort((left, right) => left.name.localeCompare(right.name))
		.map(({ value, label }) => ({ value, label }));
	if (orphanedOptions.length > 0) {
		groups.push({ kind: "unassigned", options: orphanedOptions });
	}
	return groups;
}

function createRoleOption(
	role: Record<string, unknown>,
	language: string,
	includeSymbol: boolean,
): EditorOption & { name: string } {
	const value = readText(role.id) ?? "";
	const name = readDisplayName(role, language) ?? value;
	const symbol = readRoleSymbol(role) ?? SEAT_SYMBOLS.alivePlayerFallback;
	return {
		value,
		name,
		label: includeSymbol ? `${symbol} ${name}` : name,
	};
}

function readStatusOptions(
	game: NonNullable<ReturnType<typeof readGame>>,
	language: string,
): EditorOption[] {
	return Object.entries(game.statusDefinitionsById ?? {}).map(
		([id, definition]) => ({
			value: id,
			label: readDisplayName(readRecord(definition), language) ?? id,
		}),
	);
}

function readPlayerRoleState(value: unknown): PlayerRoleState {
	const roles = readRecord(value);
	return {
		actualRoleId: readNullableString(roles?.actualRoleId),
		shownRoleIds: readStringArray(roles?.shownRoleIds),
		nightRoleId: readNullableString(roles?.nightRoleId),
		claimedRoleId: readText(roles?.claimedRoleId),
	};
}

type SeatPlayerContext = {
	game: NonNullable<ReturnType<typeof readGame>>;
	playerId: string;
	player: Record<string, unknown>;
};

function readSeatPlayer(
	document: GameState,
	seatNumber: number,
): SeatPlayerContext | undefined {
	const game = readGame(document);
	if (!game || !Number.isInteger(seatNumber) || seatNumber < 1)
		return undefined;
	const playerId = game.seatOrder[seatNumber - 1];
	if (!playerId || playerId === EMPTY_PLAYER_ID) return undefined;
	const player = readRecord(game.playersById[playerId]);
	return player ? { game, playerId, player } : undefined;
}

function readNullableString(value: unknown): string | null {
	return typeof value === "string" && value ? value : null;
}

function toPlayerDraft(player: Player): GamePlayerDraft {
	const roles = readPlayerRoleState(player.roles);
	return {
		id: player.id,
		name: player.name,
		names: player.names ? { ...player.names } : undefined,
		lifeState: player.lifeState,
		roles: { ...roles, shownRoleIds: [...roles.shownRoleIds] },
		statuses: player.statuses.map((status) => ({
			...status,
			source: status.source ? { ...status.source } : undefined,
		})),
		note: player.note,
		removed: player.removed ? { ...player.removed } : undefined,
	};
}

function readNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

function readText(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readDisplayName(
	value: Record<string, unknown> | undefined,
	language: string,
): string | undefined {
	const name = readText(value?.name);
	if (!name) return undefined;
	const namesRecord = readRecord(value?.names);
	const names = namesRecord
		? Object.fromEntries(
				Object.entries(namesRecord).filter(
					(entry): entry is [string, string] => typeof entry[1] === "string",
				),
			)
		: undefined;
	return getDisplayName({ name, names }, language);
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function readArray(value: unknown): unknown[] {
	return Array.isArray(value) ? (value as unknown[]) : [];
}

function readStringArray(value: unknown): string[] {
	return readArray(value)
		.map(readText)
		.filter((entry): entry is string => entry !== undefined);
}
