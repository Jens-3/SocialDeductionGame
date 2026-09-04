// src/domain/statusDefinitions.ts

import { sanitizeText } from "../shared/textSanitizer";
import { replaceGameEntityIdReferences } from "./gameEntityIdReferences";
import {
	createUniqueGameEntityIdFromId,
	createUniqueGameEntityIdFromName,
} from "./gameEntityIds";
import type { GameState } from "./gameState";
import { getDisplayName } from "./localizedNames";
import { type LocalizedNames, Player, Role } from "./models";
import type { StatusDefinition } from "./statusDefinition";
import { createIdFromText } from "./stringSanitizer";

export type GameStatusDefinition = StatusDefinition & {
	/**
	 * Dauer in Nächten. 0 bedeutet unbegrenzt.
	 * Default beim Anlegen: 1 Nacht.
	 */
	defaultDuration: number;
};

export type StatusDefinitionWarning = {
	code: string;
	message: string;
};

export type StatusDefinitionEditResult = {
	game: GameState;
	statusDefinition: GameStatusDefinition;
	warnings: StatusDefinitionWarning[];
	message: string;
};

export type StatusDefinitionDeleteResult = {
	game: GameState;
	message: string;
};

export type CreateStatusDefinitionParams = {
	name: string;
	names?: LocalizedNames;
	defaultDuration?: number;
};

export type EditStatusDefinitionParams = {
	statusId: string;
	name?: string;
	names?: LocalizedNames | null;
	defaultDuration?: number;
};

const MAX_STATUS_NAME_LENGTH = 64;

export function createStatusDefinition(
	game: GameState,
	params: CreateStatusDefinitionParams,
): StatusDefinitionEditResult {
	return createStatusDefinitionResult(game, params);
}

/** Reparaturvariante: erzeugt die Definition, ohne einen Zeitpunkt zu erfinden. */
export function createStatusDefinitionForRepair(
	game: GameState,
	params: CreateStatusDefinitionParams,
): StatusDefinitionEditResult {
	return createStatusDefinitionResult(game, params);
}

function createStatusDefinitionResult(
	game: GameState,
	params: CreateStatusDefinitionParams,
): StatusDefinitionEditResult {
	validateGameForStatusDefinitions(game);

	const warnings: StatusDefinitionWarning[] = [];

	const name = normalizeStatusName(params.name);

	const baseId = createIdFromText(name, "statusDefinition");

	const id = createUniqueGameEntityIdFromId(baseId, game, "statusDefinition");
	if (id !== baseId) {
		warnings.push({
			code: "DUPLICATE_STATUS_ID_RENUMBERED",
			message: `Zustands-ID "${baseId}" existiert bereits und wurde zu "${id}" geändert.`,
		});
	}

	const defaultDuration =
		params.defaultDuration === undefined
			? 1
			: normalizeDuration(params.defaultDuration);

	const statusDefinition: GameStatusDefinition = {
		id,
		name,
		names: params.names ? { ...params.names } : undefined,
		defaultDuration,
	};

	const nextGame: GameState = {
		...game,
		ruleSetSnapshot: {
			...game.ruleSetSnapshot,
			statuses: [...(game.ruleSetSnapshot.statuses ?? []), statusDefinition],
		},
		statusDefinitionsById: {
			...game.statusDefinitionsById,
			[id]: statusDefinition,
		},
	};

	return {
		game: nextGame,
		statusDefinition,
		warnings,
		message: `Zustand ${name} erstellt.`,
	};
}

export function editStatusDefinition(
	game: GameState,
	params: EditStatusDefinitionParams,
): StatusDefinitionEditResult {
	validateGameForStatusDefinitions(game);

	const existing = game.statusDefinitionsById[params.statusId];

	if (!existing) {
		throw new Error(`Zustand "${params.statusId}" existiert nicht.`);
	}

	const existingWithDefaults = normalizeExistingStatusDefinition(existing);

	const name =
		params.name === undefined
			? existingWithDefaults.name
			: normalizeStatusName(params.name);

	const defaultDuration =
		params.defaultDuration === undefined
			? existingWithDefaults.defaultDuration
			: normalizeDuration(params.defaultDuration);
	const id = createUniqueGameEntityIdFromName(
		name,
		game,
		"statusDefinition",
		existingWithDefaults.id,
	);
	const warnings: StatusDefinitionWarning[] = [];
	const baseId = createIdFromText(name, "statusDefinition");
	if (id !== baseId) {
		warnings.push({
			code: "DUPLICATE_ID_RENUMBERED",
			message: `Zustands-ID "${baseId}" ist bereits vergeben oder reserviert und wurde zu "${id}" geändert.`,
		});
	}

	const updatedStatusDefinition: GameStatusDefinition = {
		...existingWithDefaults,
		id,
		name,
		names:
			params.names === null
				? undefined
				: params.names
					? { ...params.names }
					: existingWithDefaults.names,
		defaultDuration,
	};
	const snapshotStatuses = game.ruleSetSnapshot.statuses ?? [];
	const updatedSnapshotStatuses = snapshotStatuses.some(
		(status) => status.id === existingWithDefaults.id,
	)
		? snapshotStatuses.map((status) =>
				status.id === existingWithDefaults.id
					? updatedStatusDefinition
					: status,
			)
		: [...snapshotStatuses, updatedStatusDefinition];
	const statusDefinitionsById = { ...game.statusDefinitionsById };
	delete statusDefinitionsById[params.statusId];
	statusDefinitionsById[id] = updatedStatusDefinition;

	const nextGame = replaceGameEntityIdReferences(
		{
			...game,
			ruleSetSnapshot: {
				...game.ruleSetSnapshot,
				statuses: updatedSnapshotStatuses,
			},
			statusDefinitionsById,
		},
		"statusDefinition",
		existingWithDefaults.id,
		id,
	);
	if (id !== existingWithDefaults.id) {
		warnings.push({
			code: "STATUS_ID_REFERENCES_UPDATED",
			message: `Zustands-ID "${existingWithDefaults.id}" wurde zu "${id}" geändert. Rollen- und Spielerreferenzen wurden aktualisiert.`,
		});
	}

	return {
		game: nextGame,
		statusDefinition: updatedStatusDefinition,
		warnings,
		message: `Zustand ${name} bearbeitet.`,
	};
}

export function deleteStatusDefinition(
	game: GameState,
	statusId: string,
	language = "de",
): StatusDefinitionDeleteResult {
	validateGameForStatusDefinitions(game);
	const existing = game.statusDefinitionsById[statusId];
	if (!existing) throw new Error(`Zustand "${statusId}" existiert nicht.`);

	const statusDefinitionsById = { ...game.statusDefinitionsById };
	delete statusDefinitionsById[statusId];
	return {
		game: {
			...game,
			ruleSetSnapshot: {
				...game.ruleSetSnapshot,
				statuses: (game.ruleSetSnapshot.statuses ?? []).filter(
					(status) => status.id !== statusId,
				),
				roles: game.ruleSetSnapshot.roles.map((role) => {
					if (!role.apply_status_effect?.includes(statusId)) return role;
					const next = role.toJSON();
					next.apply_status_effect = role.apply_status_effect.filter(
						(id) => id !== statusId,
					);
					return new Role(next);
				}),
			},
			statusDefinitionsById,
			playersById: Object.fromEntries(
				Object.entries(game.playersById).map(([playerId, player]) => {
					const clone = new Player({
						...player.toJSON(),
						statuses: player.statuses.filter(
							(status) => status.statusId !== statusId,
						),
					});
					return [playerId, clone];
				}),
			),
		},
		message: `Zustand ${getDisplayName(existing, language)} gelöscht.`,
	};
}

// Namens- und ID-Erzeugung
function normalizeStatusName(input: string): string {
	const sanitized = sanitizeText(input);
	const trimmed = sanitized.trim();

	if (!trimmed) {
		throw new Error("Name des Zustands darf nicht leer sein.");
	}

	return trimmed.slice(0, MAX_STATUS_NAME_LENGTH);
}

// Validierung
function normalizeDuration(value: number): number {
	if (!Number.isInteger(value)) {
		throw new Error("defaultDuration muss eine ganze Zahl sein.");
	}

	if (value < 0) {
		throw new Error("defaultDuration darf nicht negativ sein.");
	}

	return value;
}

function validateGameForStatusDefinitions(game: GameState): void {
	if (!game || typeof game !== "object") {
		throw new Error("game muss ein Objekt sein.");
	}

	if (!game.time || typeof game.time !== "object") {
		throw new Error("game.time fehlt.");
	}

	if (!Number.isInteger(game.time.currentNight)) {
		throw new Error("game.time.currentNight muss eine ganze Zahl sein.");
	}

	if (
		!game.statusDefinitionsById ||
		typeof game.statusDefinitionsById !== "object"
	) {
		throw new Error("game.statusDefinitionsById muss ein Objekt sein.");
	}
}

function normalizeExistingStatusDefinition(
	definition: StatusDefinition,
): GameStatusDefinition {
	return {
		id: definition.id,
		name: definition.name,
		names: definition.names ? { ...definition.names } : undefined,
		unicodeEscaped: definition.unicodeEscaped,
		unicodeSymbol: definition.unicodeSymbol,
		defaultDuration:
			typeof definition.defaultDuration === "number" &&
			Number.isInteger(definition.defaultDuration) &&
			definition.defaultDuration >= 0
				? definition.defaultDuration
				: 1,
	};
}
