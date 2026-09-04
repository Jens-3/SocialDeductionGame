import { sanitizeText } from "../shared/textSanitizer";
import type { GameState } from "./gameState";
import type { StatusDefinition } from "./statusDefinition";
import { createStatusDefinitionForRepair } from "./statusDefinitions";
import { createIdFromText } from "./stringSanitizer";

/**
 * Erstellt für alle Einträge aus Role.apply_status_effect eine fehlende
 * Statusdefinition. Der ursprüngliche Eintrag wird zunächst als Name benutzt;
 * die ID-Erzeugung übernimmt createStatusDefinition().
 *
 * Der übergebene Spielstand wird mutiert.
 *
 * @returns Anzahl der neu erstellten Statusdefinitionen.
 */
export function createMissingStatusDefinitionsFromRoles(
	game: GameState,
): number {
	let createdCount = 0;

	for (const role of game.ruleSetSnapshot.roles) {
		for (const statusText of role.apply_status_effect ?? []) {
			if (findStatusDefinition(game, statusText)) {
				continue;
			}

			const result = createStatusDefinitionForRepair(game, {
				name: statusText,
			});
			game.ruleSetSnapshot = result.game.ruleSetSnapshot;
			game.statusDefinitionsById = result.game.statusDefinitionsById;
			createdCount++;
		}
	}

	return createdCount;
}

/**
 * Ersetzt alle Einträge aus Role.apply_status_effect durch IDs. Vorhandene
 * Definitionen werden über ihre ID oder ihren Namen aufgelöst. Gibt es keine
 * passende Definition, wird der String direkt mit createIdFromText()
 * normalisiert.
 *
 * Der übergebene Spielstand wird mutiert.
 *
 * @returns Anzahl der tatsächlich geänderten Listeneinträge.
 */
export function normalizeRoleApplyStatusEffectIds(game: GameState): number {
	let changedCount = 0;

	for (const role of game.ruleSetSnapshot.roles) {
		if (!role.apply_status_effect) {
			continue;
		}

		role.apply_status_effect = role.apply_status_effect.map((statusText) => {
			const normalizedId =
				findStatusDefinition(game, statusText)?.id ??
				createIdFromText(statusText, "statusDefinition");
			if (normalizedId !== statusText) {
				changedCount++;
			}
			return normalizedId;
		});
	}

	return changedCount;
}

function findStatusDefinition(
	game: GameState,
	statusText: string,
): StatusDefinition | undefined {
	const definitions = Object.values(game.statusDefinitionsById);
	const normalizedText = normalizeStatusName(statusText);
	const candidateId = createIdFromText(statusText, "statusDefinition");

	return (
		game.statusDefinitionsById[statusText] ??
		game.statusDefinitionsById[candidateId] ??
		definitions.find(
			(definition) => normalizeStatusName(definition.name) === normalizedText,
		)
	);
}

function normalizeStatusName(value: string): string {
	return sanitizeText(value).trim().toLocaleLowerCase();
}
