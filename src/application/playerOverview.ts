// src/application/playerOverview.ts

import type { GameState } from "../domain/gameFactory";
import { getDisplayName } from "../domain/localizedNames";
import type { PlayerStatus } from "../domain/models";
import { isPlayerStatusActiveAtNight } from "../domain/playerStatus";
import { ApplicationInvariantError } from "./applicationError";

export type PlayerOverviewSortOrder =
	| "Sitzplatz"
	| "Name/Sitzplatz"
	| "Rolle/Sitzplatz"
	| "Team/Rolle/Sitzplatz"
	| "Nachtreihenfolge/Sitzplatz";

export type NightActivityFilter =
	| "beides"
	| "nur_nachtaktiv"
	| "nur_nicht_nachtaktiv";

export type LifeStateFilter = "beides" | "nur_lebend" | "nur_tot";

export type StatusFilter =
	| "beides"
	| "nur_mit_zustaenden"
	| "nur_ohne_zustaende";

export type DeletionFilter =
	| "nur_aktive_personen"
	| "nur_geloeschte_personen"
	| "beides";

export type PlayerOverviewOptions = {
	language?: string;
	sortOrder?: PlayerOverviewSortOrder;
	hideExpiredStatuses?: boolean;

	nightActivityFilter?: NightActivityFilter;
	lifeStateFilter?: LifeStateFilter;

	/**
	 * undefined oder "all" bedeutet: alle Teams.
	 * Sonst konkrete teamId, z. B. "townsfolk".
	 */
	teamFilter?: string;

	statusFilter?: StatusFilter;
	deletionFilter?: DeletionFilter;
};

export type OverviewRoleInfo = {
	roleId: string | null;
	roleName: string | null;
	teamId: string | null;
	teamName: string | null;
	teamOrder: number | null;
	missingDefinition: boolean;
};

export type OverviewStatusInfo = {
	id: string;
	statusId: string;
	name: string;
	fromNight: number;
	untilNight: number | null;
	note?: string;
};

export type PlayerOverviewEntry = {
	playerId: string;
	playerName: string;

	/**
	 * null, wenn die Person archiviert/gelöscht ist und nicht mehr in seatOrder steht.
	 */
	seatNumber: number | null;

	isDeleted: boolean;

	lifeState:
		| "alive"
		| "dead_vote_available"
		| "dead_vote_spent"
		| "doubledead_vote_available"
		| "doubledead_vote_spent";

	actualRole: OverviewRoleInfo;

	/**
	 * Nur gesetzt, wenn shownRoleId von actualRoleId abweicht.
	 */
	shownRole?: OverviewRoleInfo;

	/**
	 * Nur gesetzt, wenn nightRoleId von shownRoleId abweicht.
	 */
	nightRole?: OverviewRoleInfo;

	/**
	 * Nachtaktivität der Nachtrolle für die aktuelle relevante Nacht.
	 */
	isNightActive: boolean;

	/**
	 * order der Nachtrolle, falls nachtaktiv.
	 * Wird für Sortierung "Nachtreihenfolge/Sitzplatz" genutzt.
	 */
	nightOrder: number | null;

	activeStatuses: OverviewStatusInfo[];
};

export function createPlayerOverview(
	game: GameState,
	options: PlayerOverviewOptions = {},
): PlayerOverviewEntry[] {
	validateGameForOverview(game);

	const normalizedOptions = normalizeOptions(options);

	const allEntries = Object.values(game.playersById).map((player) => {
		const seatNumber = getSeatNumber(game, player.id);
		const isDeleted = player.removed !== undefined || seatNumber === null;

		const actualRole = getRoleInfo(
			game,
			player.roles.actualRoleId,
			normalizedOptions.language,
		);
		const primaryShownRoleId = player.roles.shownRoleIds[0] ?? null;
		const shownRoleRaw = getRoleInfo(
			game,
			primaryShownRoleId,
			normalizedOptions.language,
		);
		const nightRoleRaw = getRoleInfo(
			game,
			player.roles.nightRoleId,
			normalizedOptions.language,
		);

		const shouldShowShownRole =
			player.roles.actualRoleId !== null &&
			(primaryShownRoleId !== player.roles.actualRoleId ||
				player.roles.shownRoleIds.length > 1);

		const shouldShowNightRole =
			primaryShownRoleId !== null &&
			player.roles.nightRoleId !== primaryShownRoleId;

		const nightActivity = getNightActivityInfo(game, player.roles.nightRoleId);

		return {
			playerId: player.id,
			playerName: getDisplayName(player, normalizedOptions.language),
			seatNumber,
			isDeleted,
			lifeState: player.lifeState,
			actualRole,
			shownRole: shouldShowShownRole ? shownRoleRaw : undefined,
			nightRole: shouldShowNightRole ? nightRoleRaw : undefined,
			isNightActive: nightActivity.isNightActive,
			nightOrder: nightActivity.nightOrder,
			activeStatuses: getVisibleStatusesForPlayer(
				game,
				player.statuses,
				normalizedOptions.language,
				normalizedOptions.hideExpiredStatuses,
			),
		};
	});

	return allEntries
		.filter((entry) =>
			matchesDeletionFilter(entry, normalizedOptions.deletionFilter),
		)
		.filter((entry) =>
			matchesLifeStateFilter(entry, normalizedOptions.lifeStateFilter),
		)
		.filter((entry) =>
			matchesNightActivityFilter(entry, normalizedOptions.nightActivityFilter),
		)
		.filter((entry) => matchesTeamFilter(entry, normalizedOptions.teamFilter))
		.filter((entry) =>
			matchesStatusFilter(entry, normalizedOptions.statusFilter),
		)
		.sort((a, b) => compareOverviewEntries(a, b, normalizedOptions.sortOrder));
}

// Optionen normalisieren
function normalizeOptions(
	options: PlayerOverviewOptions,
): Required<PlayerOverviewOptions> {
	return {
		language: options.language?.trim() || "de",
		sortOrder: options.sortOrder ?? "Sitzplatz",
		hideExpiredStatuses: options.hideExpiredStatuses ?? false,
		nightActivityFilter: options.nightActivityFilter ?? "beides",
		lifeStateFilter: options.lifeStateFilter ?? "beides",
		teamFilter: options.teamFilter ?? "all",
		statusFilter: options.statusFilter ?? "beides",
		deletionFilter: options.deletionFilter ?? "nur_aktive_personen",
	};
}

// Rolleninformationen auflösen
function getRoleInfo(
	game: GameState,
	roleId: string | null | undefined,
	language: string,
): OverviewRoleInfo {
	if (!roleId) {
		return {
			roleId: null,
			roleName: null,
			teamId: null,
			teamName: null,
			teamOrder: null,
			missingDefinition: false,
		};
	}

	const role = game.ruleSetSnapshot.roles.find(
		(candidate) => candidate.id === roleId,
	);

	if (!role) {
		return {
			roleId,
			roleName: roleId,
			teamId: null,
			teamName: null,
			teamOrder: null,
			missingDefinition: true,
		};
	}

	const team = game.ruleSetSnapshot.teams.find(
		(candidate) => candidate.id === role.teamId,
	);

	return {
		roleId: role.id,
		roleName: getDisplayName(role, language),
		teamId: role.teamId,
		teamName: team ? getDisplayName(team, language) : role.teamId,
		teamOrder: team?.teamOrder ?? null,
		missingDefinition: false,
	};
}

// Nachtaktivität bestimmen
// Wenn das Spiel noch im Setup ist, wird für die Übersicht die erste Nacht angenommen.
function getNightActivityInfo(
	game: GameState,
	nightRoleId: string | null | undefined,
): {
	isNightActive: boolean;
	nightOrder: number | null;
} {
	if (!nightRoleId) {
		return {
			isNightActive: false,
			nightOrder: null,
		};
	}

	const role = game.ruleSetSnapshot.roles.find(
		(candidate) => candidate.id === nightRoleId,
	);

	if (!role?.night) {
		return {
			isNightActive: false,
			nightOrder: null,
		};
	}

	const nightKind = getRelevantNightKind(game);
	const nightAction =
		nightKind === "first" ? role.night.first : role.night.other;

	if (!nightAction || nightAction.order <= 0) {
		return {
			isNightActive: false,
			nightOrder: null,
		};
	}

	return {
		isNightActive: true,
		nightOrder: nightAction.order,
	};
}

function getRelevantNightKind(game: GameState): "first" | "other" {
	if (game.time.currentNight <= 1) {
		return "first";
	}

	return "other";
}

// Sichtbare Zustände auflösen. Auf Wunsch zählen nur die in der aktuellen
// Nacht aktiven Zustände; die Phase ist dafür unerheblich.
function getVisibleStatusesForPlayer(
	game: GameState,
	statuses: PlayerStatus[],
	language: string,
	hideExpiredStatuses: boolean,
): OverviewStatusInfo[] {
	return statuses
		.filter(
			(status) =>
				!hideExpiredStatuses ||
				isPlayerStatusActiveAtNight(status, game.time.currentNight),
		)
		.map((status) => {
			const definition = game.statusDefinitionsById[status.statusId];

			return {
				id: status.id,
				statusId: status.statusId,
				name: definition
					? getDisplayName(definition, language)
					: status.statusId,
				fromNight: status.fromNight,
				untilNight: status.untilNight,
				note: status.note,
			};
		});
}

// Sitznummer bestimmen
function getSeatNumber(game: GameState, playerId: string): number | null {
	const index = game.seatOrder.indexOf(playerId);

	if (index === -1) {
		return null;
	}

	return index + 1;
}

// Filter
function matchesDeletionFilter(
	entry: PlayerOverviewEntry,
	filter: DeletionFilter,
): boolean {
	switch (filter) {
		case "beides":
			return true;

		case "nur_aktive_personen":
			return !entry.isDeleted;

		case "nur_geloeschte_personen":
			return entry.isDeleted;
	}
}

function matchesLifeStateFilter(
	entry: PlayerOverviewEntry,
	filter: LifeStateFilter,
): boolean {
	switch (filter) {
		case "beides":
			return true;

		case "nur_lebend":
			return entry.lifeState === "alive";

		case "nur_tot":
			return entry.lifeState !== "alive";
	}
}

function matchesNightActivityFilter(
	entry: PlayerOverviewEntry,
	filter: NightActivityFilter,
): boolean {
	switch (filter) {
		case "beides":
			return true;

		case "nur_nachtaktiv":
			return entry.isNightActive;

		case "nur_nicht_nachtaktiv":
			return !entry.isNightActive;
	}
}

function matchesTeamFilter(
	entry: PlayerOverviewEntry,
	teamFilter: string,
): boolean {
	if (teamFilter === "all") {
		return true;
	}

	return entry.actualRole.teamId === teamFilter;
}

function matchesStatusFilter(
	entry: PlayerOverviewEntry,
	filter: StatusFilter,
): boolean {
	const hasStatuses = entry.activeStatuses.length > 0;

	switch (filter) {
		case "beides":
			return true;

		case "nur_mit_zustaenden":
			return hasStatuses;

		case "nur_ohne_zustaende":
			return !hasStatuses;
	}
}

// Sortierung
function compareOverviewEntries(
	a: PlayerOverviewEntry,
	b: PlayerOverviewEntry,
	sortOrder: PlayerOverviewSortOrder,
): number {
	switch (sortOrder) {
		case "Name/Sitzplatz":
			return compareByName(a, b) || compareBySeat(a, b);

		case "Rolle/Sitzplatz":
			return compareByActualRole(a, b) || compareBySeat(a, b);

		case "Team/Rolle/Sitzplatz":
			return (
				compareByTeam(a, b) || compareByActualRole(a, b) || compareBySeat(a, b)
			);

		case "Nachtreihenfolge/Sitzplatz":
			return compareByNightOrder(a, b) || compareBySeat(a, b);

		case "Sitzplatz":
			return compareBySeat(a, b);
	}
}

function compareBySeat(a: PlayerOverviewEntry, b: PlayerOverviewEntry): number {
	const seatA = a.seatNumber ?? Number.MAX_SAFE_INTEGER;
	const seatB = b.seatNumber ?? Number.MAX_SAFE_INTEGER;

	if (seatA !== seatB) {
		return seatA - seatB;
	}

	return naturalCompare(a.playerName, b.playerName);
}

function compareByName(a: PlayerOverviewEntry, b: PlayerOverviewEntry): number {
	return naturalCompare(a.playerName, b.playerName);
}

function compareByActualRole(
	a: PlayerOverviewEntry,
	b: PlayerOverviewEntry,
): number {
	return naturalCompare(
		a.actualRole.roleName ?? "",
		b.actualRole.roleName ?? "",
	);
}

function compareByTeam(a: PlayerOverviewEntry, b: PlayerOverviewEntry): number {
	const orderA = a.actualRole.teamOrder ?? Number.MAX_SAFE_INTEGER;
	const orderB = b.actualRole.teamOrder ?? Number.MAX_SAFE_INTEGER;

	if (orderA !== orderB) {
		return orderA - orderB;
	}

	return naturalCompare(
		a.actualRole.teamName ?? "",
		b.actualRole.teamName ?? "",
	);
}

function compareByNightOrder(
	a: PlayerOverviewEntry,
	b: PlayerOverviewEntry,
): number {
	const orderA = a.nightOrder ?? Number.MAX_SAFE_INTEGER;
	const orderB = b.nightOrder ?? Number.MAX_SAFE_INTEGER;

	if (orderA !== orderB) {
		return orderA - orderB;
	}

	return naturalCompare(
		a.actualRole.roleName ?? "",
		b.actualRole.roleName ?? "",
	);
}

// Validierung und kleine Hilfsfunktion
function validateGameForOverview(game: GameState): void {
	if (!game.playersById || typeof game.playersById !== "object") {
		throw new ApplicationInvariantError("playersById muss ein Objekt sein.");
	}

	if (!Array.isArray(game.seatOrder)) {
		throw new ApplicationInvariantError("seatOrder muss ein Array sein.");
	}

	if (!game.ruleSetSnapshot || typeof game.ruleSetSnapshot !== "object") {
		throw new ApplicationInvariantError("ruleSetSnapshot fehlt.");
	}

	if (!Array.isArray(game.ruleSetSnapshot.roles)) {
		throw new ApplicationInvariantError(
			"ruleSetSnapshot.roles muss ein Array sein.",
		);
	}

	if (!Array.isArray(game.ruleSetSnapshot.teams)) {
		throw new ApplicationInvariantError(
			"ruleSetSnapshot.teams muss ein Array sein.",
		);
	}

	if (
		!game.statusDefinitionsById ||
		typeof game.statusDefinitionsById !== "object"
	) {
		throw new ApplicationInvariantError(
			"statusDefinitionsById muss ein Objekt sein.",
		);
	}
}

function naturalCompare(a: string, b: string): number {
	return a.localeCompare(b, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}
