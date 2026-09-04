import {
	createUniqueGameEntityIdFromId,
	createUniquePlayerStatusId,
} from "./gameEntityIds";
import type { GameState } from "./gameState";
import { Player, type PlayerStatus, type Team } from "./models";
import type { StatusDefinition } from "./statusDefinition";
import { createUniqueId } from "./stringSanitizer";

/**
 * Repariert doppelte IDs im gemeinsamen Namensraum von Teams, Rollen,
 * Spielern, Statusdefinitionen und Statusinstanzen sowie separat im
 * Namensraum der Logeinträge. Das jeweils erste Vorkommen bleibt erhalten;
 * spätere Vorkommen werden fortlaufend umbenannt. Die Prüfungsreihenfolge ist
 * Teams, Rollen, Spieler, Statusdefinitionen, Statusinstanzen, Logeinträge.
 *
 * Team-Referenzen in Rollen und Rollen-Referenzen in Spielern werden bewusst
 * nicht geändert, weil bei einem Duplikat keine eindeutige Zuordnung möglich
 * ist. Bei Spielern werden nur Referenzen auf den eindeutigen Record-Schlüssel
 * des umbenannten Spielers mitgeführt.
 *
 * Für die besondere Auswahl des System-Teams "t_unknown" sollte zuvor
 * repairInconsistentUnknownTeams() ausgeführt werden.
 *
 * @returns Anzahl der Entitäten, deren ID geändert wurde.
 */
export function repairDuplicateGameEntityIds(game: GameState): number {
	const seenIds = new Set<string>();
	let changedCount = 0;

	for (const team of game.ruleSetSnapshot.teams) {
		if (!seenIds.has(team.id)) {
			seenIds.add(team.id);
			continue;
		}

		const newId = createUniqueGameEntityIdFromId(team.id, game, "team");
		setTeamId(team, newId);
		seenIds.add(newId);
		changedCount++;
	}

	for (const role of game.ruleSetSnapshot.roles) {
		if (!seenIds.has(role.id)) {
			seenIds.add(role.id);
			continue;
		}

		const newId = createUniqueGameEntityIdFromId(role.id, game, "role");
		role.id = newId;
		seenIds.add(newId);
		changedCount++;
	}

	for (const [recordId, player] of Object.entries(game.playersById)) {
		if (!seenIds.has(player.id)) {
			seenIds.add(player.id);
			continue;
		}

		const newId = createUniqueGameEntityIdFromId(player.id, game, "player");
		delete game.playersById[recordId];
		game.playersById[newId] = clonePlayerWithId(player, newId);
		game.seatOrder = game.seatOrder.map((playerId) =>
			playerId === recordId ? newId : playerId,
		);
		replaceStatusSourceRecordId(game.playersById, recordId, newId);
		seenIds.add(newId);
		changedCount++;
	}

	for (const definition of game.ruleSetSnapshot.statuses ?? []) {
		if (!seenIds.has(definition.id)) {
			seenIds.add(definition.id);
			continue;
		}

		const newId = createUniqueGameEntityIdFromId(
			definition.id,
			game,
			"statusDefinition",
		);
		definition.id = newId;
		game.statusDefinitionsById[newId] = cloneStatusDefinition(definition);
		seenIds.add(newId);
		changedCount++;
	}

	for (const player of Object.values(game.playersById)) {
		for (const status of player.statuses) {
			seenIds.add(status.statusId);
		}
	}

	for (const player of Object.values(game.playersById)) {
		for (const status of player.statuses) {
			if (!seenIds.has(status.id)) {
				seenIds.add(status.id);
				continue;
			}

			const newId = createUniquePlayerStatusId(status.statusId, game);
			status.id = newId;
			seenIds.add(newId);
			changedCount++;
		}
	}

	const seenLogIds = new Set<string>();
	for (const entry of game.log) {
		if (!seenLogIds.has(entry.id)) {
			seenLogIds.add(entry.id);
			continue;
		}

		const newId = createUniqueLogId(entry.id, game);
		entry.id = newId;
		seenLogIds.add(newId);
		changedCount++;
	}

	return changedCount;
}

function createUniqueLogId(id: string, game: GameState): string {
	return createUniqueId(id, "log", new Set(game.log.map((entry) => entry.id)))
		.id;
}

function cloneStatusDefinition(definition: StatusDefinition): StatusDefinition {
	return {
		...definition,
		names: definition.names ? { ...definition.names } : undefined,
	};
}

function setTeamId(team: Team, id: string): void {
	(team as unknown as { id: string }).id = id;
}

function clonePlayerWithId(player: Player, id: string): Player {
	return new Player({
		id,
		name: player.name,
		names: player.names,
		color: player.color,
		lifeState: player.lifeState,
		roles: { ...player.roles },
		statuses: cloneStatuses(player.statuses),
		note: player.note,
		removed: player.removed ? { ...player.removed } : undefined,
	});
}

function replaceStatusSourceRecordId(
	playersById: Record<string, Player>,
	oldRecordId: string,
	newPlayerId: string,
): void {
	for (const player of Object.values(playersById)) {
		player.statuses = player.statuses.map((status) => ({
			...status,
			source:
				status.source?.playerId === oldRecordId
					? { ...status.source, playerId: newPlayerId }
					: status.source
						? { ...status.source }
						: undefined,
		}));
	}
}

function cloneStatuses(statuses: PlayerStatus[]): PlayerStatus[] {
	return statuses.map((status) => ({
		...status,
		source: status.source ? { ...status.source } : undefined,
	}));
}
