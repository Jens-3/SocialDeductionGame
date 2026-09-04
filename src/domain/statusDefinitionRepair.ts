import { sanitizeText } from "../shared/textSanitizer";
import type { GameState } from "./gameState";
import {
	createMissingStatusDefinitionsFromRoles,
	normalizeRoleApplyStatusEffectIds,
} from "./roleStatusDefinitions";
import type { StatusDefinition } from "./statusDefinition";
import { createStatusDefinitionForRepair } from "./statusDefinitions";
import { createIdFromText } from "./stringSanitizer";

/**
 * Synchronisiert die beiden Statusdefinitionssammlungen und ergänzt fehlende
 * Definitionen, auf die Rollen oder konkrete Spielerzustände verweisen.
 *
 * Bei unterschiedlichen Inhalten ist ruleSetSnapshot.statuses maßgeblich;
 * statusDefinitionsById ist ausschließlich der daraus abgeleitete Laufzeitindex.
 * Der übergebene Spielstand wird mutiert.
 *
 * @returns Anzahl synchronisierter oder erstellter Definitionen und
 * geänderter Referenzen.
 */
export function repairStatusDefinitionsAndReferences(game: GameState): number {
	let changedCount = synchronizeStatusDefinitionCollections(game);

	changedCount += createMissingStatusDefinitionsFromRoles(game);
	changedCount += normalizeRoleApplyStatusEffectIds(game);
	changedCount += repairPlayerStatusDefinitionReferences(game);

	return changedCount;
}

function synchronizeStatusDefinitionCollections(game: GameState): number {
	let changedCount = 0;
	const snapshotStatuses = game.ruleSetSnapshot.statuses ?? [];
	const nextRuntimeDefinitions: Record<string, StatusDefinition> = {};
	const snapshotIds = new Set(snapshotStatuses.map(({ id }) => id));

	for (const snapshotDefinition of snapshotStatuses) {
		const runtimeDefinition = game.statusDefinitionsById[snapshotDefinition.id];
		if (
			!runtimeDefinition ||
			!areStatusDefinitionsEqual(snapshotDefinition, runtimeDefinition)
		)
			changedCount++;
		nextRuntimeDefinitions[snapshotDefinition.id] =
			cloneStatusDefinition(snapshotDefinition);
	}

	for (const runtimeId of Object.keys(game.statusDefinitionsById))
		if (!snapshotIds.has(runtimeId)) changedCount++;

	game.statusDefinitionsById = nextRuntimeDefinitions;
	return changedCount;
}

function repairPlayerStatusDefinitionReferences(game: GameState): number {
	let changedCount = 0;

	for (const player of Object.values(game.playersById)) {
		for (const status of player.statuses) {
			let definition = findStatusDefinition(game, status.statusId);

			if (!definition) {
				const result = createStatusDefinitionForRepair(game, {
					name: status.statusId,
				});
				game.ruleSetSnapshot = result.game.ruleSetSnapshot;
				game.statusDefinitionsById = result.game.statusDefinitionsById;
				definition = result.statusDefinition;
				changedCount++;
			}

			if (status.statusId !== definition.id) {
				status.statusId = definition.id;
				changedCount++;
			}
		}
	}

	return changedCount;
}

function findStatusDefinition(
	game: GameState,
	statusText: string,
): StatusDefinition | undefined {
	const candidateId = createIdFromText(statusText, "statusDefinition");
	const normalizedText = normalizeStatusName(statusText);

	return (
		game.statusDefinitionsById[statusText] ??
		game.statusDefinitionsById[candidateId] ??
		Object.values(game.statusDefinitionsById).find(
			(definition) => normalizeStatusName(definition.name) === normalizedText,
		)
	);
}

function normalizeStatusName(value: string): string {
	return sanitizeText(value).trim().toLocaleLowerCase();
}

function cloneStatusDefinition(definition: StatusDefinition): StatusDefinition {
	return {
		...definition,
		names: definition.names ? { ...definition.names } : undefined,
	};
}

function areStatusDefinitionsEqual(
	left: StatusDefinition,
	right: StatusDefinition,
): boolean {
	return (
		left.id === right.id &&
		left.name === right.name &&
		left.unicodeEscaped === right.unicodeEscaped &&
		left.unicodeSymbol === right.unicodeSymbol &&
		left.defaultDuration === right.defaultDuration &&
		areLocalizedNamesEqual(left.names, right.names)
	);
}

function areLocalizedNamesEqual(
	left: Record<string, string> | undefined,
	right: Record<string, string> | undefined,
): boolean {
	if (left === undefined || right === undefined) return left === right;
	const leftKeys = Object.keys(left).sort();
	const rightKeys = Object.keys(right).sort();
	return (
		leftKeys.length === rightKeys.length &&
		leftKeys.every(
			(key, index) => key === rightKeys[index] && left[key] === right[key],
		)
	);
}
