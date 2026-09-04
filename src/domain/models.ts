// src/domain/models.ts

import { type HexColor, toHexColor } from "./color";
import { createIdFromText, createUniqueId } from "./stringSanitizer";
import { normalizeUnicodeRepresentation } from "./unicodeSymbol";

export { decodeUnicodeEscaped } from "./unicodeSymbol";

export type LifeState =
	| "alive"
	| "dead_vote_available"
	| "dead_vote_spent"
	| "doubledead_vote_available"
	| "doubledead_vote_spent";

export type RoleSourceType = "actual" | "shown" | "night" | "none";

export type PlayerStatusSource = {
	playerId: string;
	roleSourceType?: RoleSourceType;
	roleIdAtTime?: string;
	roleNameAtTime?: string;
};

export type PlayerStatus = {
	id: string;
	statusId: string;
	fromNight: number;
	untilNight: number | null;
	source?: PlayerStatusSource;
	note?: string;
};

export type RemovedInfo = {
	night: number;
	phase: "setup" | "night" | "day";
};

export type PlayerRoleState = {
	actualRoleId: string | null;
	shownRoleIds: string[];
	nightRoleId: string | null;
	claimedRoleId?: string;
};

export type EditablePlayerRoleField =
	| "actualRoleId"
	| "shownRoleId"
	| "nightRoleId"
	| "claimedRoleId";

/** Wendet eine Rollenänderung samt fachlicher Kaskade auf den Rollenstatus an. */
export function changePlayerRoleState(
	roles: PlayerRoleState,
	field: EditablePlayerRoleField,
	value: string | null,
): PlayerRoleState {
	const next = { ...roles };
	if (field === "actualRoleId") {
		const oldActual = next.actualRoleId;
		const oldPrimaryShown = next.shownRoleIds[0] ?? null;
		const shouldUpdateShown =
			oldPrimaryShown === oldActual || oldPrimaryShown === null;
		next.actualRoleId = value;
		if (shouldUpdateShown) {
			return changePlayerRoleState(next, "shownRoleId", value);
		}
		return next;
	}
	if (field === "shownRoleId") {
		const oldShown = next.shownRoleIds[0] ?? null;
		const shouldUpdateNight =
			next.nightRoleId === oldShown || next.nightRoleId === null;
		next.shownRoleIds = value
			? [
					value,
					...next.shownRoleIds.slice(1).filter((roleId) => roleId !== value),
				]
			: next.shownRoleIds.slice(1);
		if (shouldUpdateNight) next.nightRoleId = next.shownRoleIds[0] ?? null;
		return next;
	}
	if (field === "nightRoleId") {
		next.nightRoleId = value;
		return next;
	}
	next.claimedRoleId = value ?? undefined;
	return next;
}

export type NightAction = {
	order: number;
	note?: string;
};

export type RoleNightInfo = {
	first?: NightAction;
	other?: NightAction;
};

export type ResolvedRoleIdChange = {
	id: string;
	baseId: string;
	idChanged: boolean;
	collisionResolved: boolean;
};

export type LocalizedNames = Record<string, string>;

function cloneLocalizedNames(
	names: LocalizedNames | undefined,
): LocalizedNames | undefined {
	return names ? { ...names } : undefined;
}

function isValidEntityId(id: string): boolean {
	return /^[a-z][a-z0-9_]*$/.test(id);
}

function assertValidEntityId(id: string, label: string): void {
	if (!isValidEntityId(id)) {
		throw new Error(
			`${label} must start with a lowercase ASCII letter and may only contain lowercase ASCII letters, numbers and underscores. Received: "${id}"`,
		);
	}
}

function assertWholeNumber(value: number, label: string): void {
	if (!Number.isInteger(value)) {
		throw new Error(`${label} must be a whole number. Received: ${value}`);
	}
}

/** Validiert eine gewünschte Rollen-ID und löst mögliche Kollisionen auf. */
export function resolveRoleIdChange(params: {
	currentId: string;
	desiredId: string;
	unavailableIds?: ReadonlySet<string>;
}): ResolvedRoleIdChange {
	const baseId = createIdFromText(params.desiredId, "role");
	const id = createUniqueId(
		params.desiredId,
		"role",
		params.unavailableIds ?? new Set(),
		{ ignoredId: params.currentId },
	).id;
	assertValidEntityId(id, "Role id");

	return {
		id,
		baseId,
		idChanged: id !== params.currentId,
		collisionResolved: id !== baseId,
	};
}

export class Team {
	public readonly id: string;
	public name: string;
	public names?: LocalizedNames;
	public color?: HexColor;
	public teamOrder: number;
	public readonly isSystem: boolean;

	public constructor(params: {
		id: string;
		name: string;
		names?: LocalizedNames;
		color?: string;
		teamOrder: number;
		isSystem?: boolean;
	}) {
		assertValidEntityId(params.id, "Team id");
		assertWholeNumber(params.teamOrder, "teamOrder");

		this.id = params.id;
		this.name = params.name.trim();
		this.names = cloneLocalizedNames(params.names);
		this.color = toHexColor(params.color, "Team color");
		this.teamOrder = params.teamOrder;
		this.isSystem = params.isSystem ?? false;
	}

	public static create(params: {
		name: string;
		names?: LocalizedNames;
		color?: string;
		teamOrder?: number;
	}): Team {
		const trimmedName = params.name.trim();

		if (!trimmedName) {
			throw new Error("Team name must not be empty.");
		}

		const id = createIdFromText(trimmedName, "team");

		if (id === "t_unknown") {
			throw new Error(`Team id "t_unknown" is reserved for the system team.`);
		}

		return new Team({
			id,
			name: trimmedName,
			names: params.names,
			color: params.color,
			teamOrder: params.teamOrder ?? 0,
			isSystem: false,
		});
	}

	public static createUnknown(): Team {
		return new Team({
			id: "t_unknown",
			name: "Unbekannt",
			teamOrder: 99,
			isSystem: true,
		});
	}

	public withRenamedTeam(newName: string): Team {
		if (this.isSystem) {
			const trimmedName = newName.trim();
			if (!trimmedName) {
				throw new Error("Team name must not be empty.");
			}

			return new Team({
				id: this.id,
				name: trimmedName,
				names: this.names,
				color: this.color,
				teamOrder: this.teamOrder,
				isSystem: true,
			});
		}

		const renamed = Team.create({
			name: newName,
			names: this.names,
			color: this.color,
			teamOrder: this.teamOrder,
		});

		return renamed;
	}

	public setTeamOrder(teamOrder: number): void {
		assertWholeNumber(teamOrder, "teamOrder");
		this.teamOrder = teamOrder;
	}

	public toJSON() {
		return {
			id: this.id,
			name: this.name,
			names: this.names,
			color: this.color,
			teamOrder: this.teamOrder,
			isSystem: this.isSystem || undefined,
		};
	}
}

export class Role {
	public id: string;
	public name: string;
	public names?: LocalizedNames;
	public color?: HexColor;
	public teamId: string;
	public night?: RoleNightInfo;
	public expectsVisual: boolean;

	/**
	 * true  = Rolle sollte normalerweise nur einmal vorkommen.
	 * false = Rolle darf mehrfach vergeben werden.
	 */
	public isUnique: boolean;

	/**
	 * Unicode-Symbol als ASCII-Escape-String.
	 *
	 * Beispiele:
	 * "\\u2620"        // Totenkopf
	 * "\\u2620\\ufe0f" // Totenkopf mit Variation Selector
	 *
	 * Wichtig: Hier steht nicht das echte Symbol, sondern nur ASCII-Text.
	 */
	public unicodeEscaped?: string;
	public unicodeSymbol?: string;
	public kills_someone?: boolean;
	public resurrect_someone?: boolean;
	public apply_status_effect?: string[];

	public constructor(params: {
		id: string;
		name: string;
		names?: LocalizedNames;
		color?: string;
		teamId?: string;
		night?: RoleNightInfo;
		expectsVisual?: boolean;
		isUnique?: boolean;
		unicodeEscaped?: string;
		unicodeSymbol?: string;
		kills_someone?: boolean;
		resurrect_someone?: boolean;
		apply_status_effect?: string[];
	}) {
		assertValidEntityId(params.id, "Role id");

		this.id = params.id;
		this.name = params.name.trim();
		this.names = cloneLocalizedNames(params.names);
		this.color = toHexColor(params.color, "Role color");
		this.teamId = params.teamId ?? "t_unknown";
		this.night = Role.normalizeNightInfo(params.night);
		this.expectsVisual = params.expectsVisual ?? false;
		this.isUnique = params.isUnique ?? false;
		const unicode = normalizeUnicodeRepresentation(
			params,
			`role "${params.id}"`,
		);
		this.unicodeEscaped = unicode.unicodeEscaped;
		this.unicodeSymbol = unicode.unicodeSymbol;
		this.kills_someone = params.kills_someone;
		this.resurrect_someone = params.resurrect_someone;
		this.apply_status_effect = params.apply_status_effect
			? [...params.apply_status_effect]
			: undefined;
	}

	public static create(params: {
		name: string;
		names?: LocalizedNames;
		color?: string;
		teamId?: string;
		firstNightOrder?: number;
		otherNightOrder?: number;
		expectsVisual?: boolean;
		isUnique?: boolean;
		unicodeEscaped?: string;
		unicodeSymbol?: string;
		kills_someone?: boolean;
		resurrect_someone?: boolean;
		apply_status_effect?: string[];
	}): Role {
		const trimmedName = params.name.trim();
		const id = Role.createIdFromName(trimmedName);

		return new Role({
			id,
			name: trimmedName,
			names: params.names,
			color: params.color,
			teamId: params.teamId ?? "t_unknown",
			night: {
				first:
					params.firstNightOrder && params.firstNightOrder > 0
						? { order: params.firstNightOrder }
						: undefined,
				other:
					params.otherNightOrder && params.otherNightOrder > 0
						? { order: params.otherNightOrder }
						: undefined,
			},
			expectsVisual: params.expectsVisual ?? false,
			isUnique: params.isUnique ?? false,
			unicodeEscaped: params.unicodeEscaped,
			unicodeSymbol: params.unicodeSymbol,
			kills_someone: params.kills_someone,
			resurrect_someone: params.resurrect_someone,
			apply_status_effect: params.apply_status_effect,
		});
	}

	public static createIdFromName(name: string): string {
		const trimmedName = name.trim();

		if (!trimmedName) {
			throw new Error("Role name must not be empty.");
		}

		return createIdFromText(trimmedName, "role");
	}

	private static normalizeNightAction(
		action: NightAction | undefined,
	): NightAction | undefined {
		if (!action) return undefined;

		assertWholeNumber(action.order, "Night action order");

		if (action.order <= 0) {
			return undefined;
		}

		return {
			order: action.order,
			note: action.note?.trim() || undefined,
		};
	}

	private static normalizeNightInfo(
		night: RoleNightInfo | undefined,
	): RoleNightInfo | undefined {
		if (!night) return undefined;

		const first = Role.normalizeNightAction(night.first);
		const other = Role.normalizeNightAction(night.other);

		if (!first && !other) {
			return undefined;
		}

		return { first, other };
	}

	public rename(
		newName: string,
		unavailableIds: ReadonlySet<string> = new Set(),
	): void {
		const name = newName.trim();
		if (!name) throw new Error("Role name must not be empty.");
		const oldGeneratedId = Role.createIdFromName(this.name);
		const id =
			this.id === oldGeneratedId
				? resolveRoleIdChange({
						currentId: this.id,
						desiredId: name,
						unavailableIds,
					}).id
				: this.id;
		assertValidEntityId(id, "Role id");
		this.name = name;
		this.id = id;
	}

	public forceChangeId(newId: string): void {
		assertValidEntityId(newId, "Role id");
		this.id = newId;
	}

	public setTeam(teamId: string): void {
		assertValidEntityId(teamId, "Team id");
		this.teamId = teamId;
	}

	public setFirstNightAction(order: number, note?: string): void {
		assertWholeNumber(order, "First night order");

		const first =
			order > 0 ? { order, note: note?.trim() || undefined } : undefined;
		const other = this.night?.other;

		this.night = Role.normalizeNightInfo({ first, other });
	}

	public setOtherNightAction(order: number, note?: string): void {
		assertWholeNumber(order, "Other night order");

		const first = this.night?.first;
		const other =
			order > 0 ? { order, note: note?.trim() || undefined } : undefined;

		this.night = Role.normalizeNightInfo({ first, other });
	}

	public setExpectsVisual(expectsVisual: boolean): void {
		this.expectsVisual = expectsVisual;
	}

	public setIsUnique(isUnique: boolean): void {
		this.isUnique = isUnique;
	}

	public setUnicodeEscaped(unicodeEscaped: string | undefined): void {
		const unicode = normalizeUnicodeRepresentation(
			{ unicodeEscaped },
			`role "${this.id}"`,
		);
		this.unicodeEscaped = unicode.unicodeEscaped;
		this.unicodeSymbol = unicode.unicodeSymbol;
	}

	public toJSON() {
		return {
			id: this.id,
			name: this.name,
			names: this.names,
			color: this.color,
			teamId: this.teamId,
			night: this.night,
			expectsVisual: this.expectsVisual,
			isUnique: this.isUnique,
			unicodeEscaped: this.unicodeEscaped,
			unicodeSymbol: this.unicodeSymbol,
			kills_someone: this.kills_someone,
			resurrect_someone: this.resurrect_someone,
			apply_status_effect: this.apply_status_effect,
		};
	}
}

export class Player {
	public readonly id: string;
	public name: string;
	public names?: LocalizedNames;
	public color?: HexColor;
	public lifeState: LifeState;
	public roles: PlayerRoleState;
	public statuses: PlayerStatus[];
	public note?: string;
	public removed?: RemovedInfo;

	public constructor(params: {
		id: string;
		name: string;
		names?: LocalizedNames;
		color?: string;
		lifeState?: LifeState;
		roles?: PlayerRoleState;
		statuses?: PlayerStatus[];
		note?: string;
		removed?: RemovedInfo;
	}) {
		if (!params.id.trim()) {
			throw new Error("Player id must not be empty.");
		}

		this.id = params.id;
		this.name = params.name.trim();
		this.names = cloneLocalizedNames(params.names);
		this.color = toHexColor(params.color, "Player color");
		this.lifeState = params.lifeState ?? "alive";
		this.roles = params.roles
			? { ...params.roles, shownRoleIds: [...params.roles.shownRoleIds] }
			: {
					actualRoleId: null,
					shownRoleIds: [],
					nightRoleId: null,
				};
		this.statuses = params.statuses ?? [];
		this.note = params.note?.trim() || undefined;
		this.removed = params.removed;
	}

	public static create(params: {
		id: string;
		name: string;
		names?: LocalizedNames;
		color?: string;
	}): Player {
		return new Player({
			id: params.id,
			name: params.name,
			names: params.names,
			color: params.color,
			lifeState: "alive",
			roles: {
				actualRoleId: null,
				shownRoleIds: [],
				nightRoleId: null,
			},
			statuses: [],
		});
	}

	public rename(newName: string): void {
		const trimmedName = newName.trim();

		if (!trimmedName) {
			throw new Error("Player name must not be empty.");
		}

		this.name = trimmedName;
	}

	public setLifeState(lifeState: LifeState): void {
		this.lifeState = lifeState;
	}

	public assignActualRole(roleId: string): void {
		assertValidEntityId(roleId, "Role id");

		this.roles.actualRoleId = roleId;
		this.roles.shownRoleIds = [roleId];
		this.roles.nightRoleId = roleId;
	}

	public changeActualRole(newRoleId: string): void {
		assertValidEntityId(newRoleId, "Role id");
		this.roles = changePlayerRoleState(this.roles, "actualRoleId", newRoleId);
	}

	public changeShownRole(params: {
		newShownRoleId: string;
		updateNightRoleIfPreviouslyLinked?: boolean;
	}): void {
		assertValidEntityId(params.newShownRoleId, "Shown role id");

		if (!this.roles.actualRoleId) {
			throw new Error("Cannot set shownRoleId while actualRoleId is null.");
		}

		this.roles =
			params.updateNightRoleIfPreviouslyLinked === false
				? {
						...this.roles,
						shownRoleIds: [
							params.newShownRoleId,
							...this.roles.shownRoleIds
								.slice(1)
								.filter((roleId) => roleId !== params.newShownRoleId),
						],
					}
				: changePlayerRoleState(
						this.roles,
						"shownRoleId",
						params.newShownRoleId,
					);
	}

	public changeNightRole(newNightRoleId: string): void {
		assertValidEntityId(newNightRoleId, "Night role id");

		if (!this.roles.actualRoleId) {
			throw new Error("Cannot set nightRoleId while actualRoleId is null.");
		}

		this.roles = changePlayerRoleState(
			this.roles,
			"nightRoleId",
			newNightRoleId,
		);
	}

	public setClaimedRole(roleId: string | undefined): void {
		if (!roleId?.trim()) {
			this.roles = changePlayerRoleState(this.roles, "claimedRoleId", null);
			return;
		}

		assertValidEntityId(roleId, "Claimed role id");
		this.roles = changePlayerRoleState(this.roles, "claimedRoleId", roleId);
	}

	public clearActualRole(): void {
		this.roles.actualRoleId = null;
		this.roles.shownRoleIds = [];
		this.roles.nightRoleId = null;

		// claimedRoleId bleibt bewusst erhalten.
	}

	public addStatus(status: PlayerStatus): void {
		if (!status.id.trim()) {
			throw new Error("Status instance id must not be empty.");
		}

		if (!status.statusId.trim()) {
			throw new Error("Status id must not be empty.");
		}

		assertWholeNumber(status.fromNight, "fromNight");

		if (status.untilNight !== null) {
			assertWholeNumber(status.untilNight, "untilNight");
		}

		this.statuses.push(status);
	}

	public setNote(note: string | undefined): void {
		this.note = note?.trim() || undefined;
	}

	public markRemoved(info: RemovedInfo): void {
		this.removed = info;
	}

	public restore(): void {
		this.removed = undefined;
	}

	public hasMarker(): boolean {
		const hasActiveStatusPotentially = this.statuses.length > 0;

		const hasShownRoleDeviation =
			this.roles.actualRoleId !== null &&
			(this.roles.shownRoleIds[0] !== this.roles.actualRoleId ||
				this.roles.shownRoleIds.length > 1);

		const hasNightRoleDeviation =
			this.roles.shownRoleIds.length > 0 &&
			this.roles.nightRoleId !== this.roles.shownRoleIds[0];

		return (
			hasActiveStatusPotentially ||
			hasShownRoleDeviation ||
			hasNightRoleDeviation
		);
	}

	public toJSON() {
		return {
			id: this.id,
			name: this.name,
			names: this.names,
			color: this.color,
			lifeState: this.lifeState,
			roles: this.roles,
			statuses: this.statuses,
			note: this.note,
			removed: this.removed,
		};
	}
}
