import type { GameState } from "./gameState";
import { EMPTY_PLAYER_ID } from "./reservedIds";
import { createIdFromText } from "./stringSanitizer";

/**
 * Normalisiert falsch geschriebene oder unpräfixierte Live-Referenzen, sofern
 * die daraus entstehende Ziel-ID im Spiel tatsächlich existiert. Nicht
 * auflösbare historische Referenzen bleiben unverändert.
 *
 * @returns Anzahl der geänderten Referenzfelder.
 */
export function repairResolvableGameEntityReferenceIds(
	game: GameState,
): number {
	const teamIds = new Set(game.ruleSetSnapshot.teams.map((team) => team.id));
	const roleIds = new Set(game.ruleSetSnapshot.roles.map((role) => role.id));
	const playerIds = new Set(Object.keys(game.playersById));
	let changedCount = 0;

	for (const role of game.ruleSetSnapshot.roles) {
		const normalizedTeamId = createIdFromText(role.teamId, "team");
		if (normalizedTeamId !== role.teamId && teamIds.has(normalizedTeamId)) {
			role.teamId = normalizedTeamId;
			changedCount++;
		}
	}

	for (const player of Object.values(game.playersById)) {
		const roleFields = [
			"actualRoleId",
			"nightRoleId",
			"claimedRoleId",
		] as const;

		for (const field of roleFields) {
			const roleId = player.roles[field];
			if (roleId === null || roleId === undefined) continue;
			const normalizedRoleId = createIdFromText(roleId, "role");
			if (normalizedRoleId !== roleId && roleIds.has(normalizedRoleId)) {
				player.roles[field] = normalizedRoleId;
				changedCount++;
			}
		}
		player.roles.shownRoleIds = player.roles.shownRoleIds.map((roleId) => {
			const normalizedRoleId = createIdFromText(roleId, "role");
			if (normalizedRoleId === roleId || !roleIds.has(normalizedRoleId))
				return roleId;
			changedCount++;
			return normalizedRoleId;
		});

		for (const status of player.statuses) {
			if (!status.source) continue;

			const normalizedPlayerId = createIdFromText(
				status.source.playerId,
				"player",
			);
			if (
				normalizedPlayerId !== status.source.playerId &&
				playerIds.has(normalizedPlayerId)
			) {
				status.source.playerId = normalizedPlayerId;
				changedCount++;
			}

			if (status.source.roleIdAtTime !== undefined) {
				const normalizedRoleId = createIdFromText(
					status.source.roleIdAtTime,
					"role",
				);
				if (
					normalizedRoleId !== status.source.roleIdAtTime &&
					roleIds.has(normalizedRoleId)
				) {
					status.source.roleIdAtTime = normalizedRoleId;
					changedCount++;
				}
			}
		}
	}

	if (game.rolesForShowing) {
		game.rolesForShowing.roles = game.rolesForShowing.roles.map((roleId) => {
			const normalizedRoleId = createIdFromText(roleId, "role");
			if (normalizedRoleId !== roleId && roleIds.has(normalizedRoleId)) {
				changedCount++;
				return normalizedRoleId;
			}
			return roleId;
		});
	}

	return changedCount;
}

/**
 * Entfernt doppelte Player-IDs aus der Platzreihenfolge. Das erste Vorkommen
 * und die Reihenfolge aller übrigen Einträge bleiben erhalten.
 *
 * @returns Anzahl der entfernten Vorkommen.
 */
export function repairDuplicatePlayerIdsInSeatOrder(game: GameState): number {
	const seenPlayerIds = new Set<string>();
	let removedCount = 0;

	game.seatOrder = game.seatOrder.filter((playerId) => {
		if (playerId === EMPTY_PLAYER_ID) return true;

		if (seenPlayerIds.has(playerId)) {
			removedCount++;
			return false;
		}

		seenPlayerIds.add(playerId);
		return true;
	});

	return removedCount;
}

/**
 * Entfernt Sitzordnungseinträge, die auf keinen vorhandenen Spieler-Record
 * verweisen. Die Reihenfolge aller übrigen Einträge bleibt erhalten.
 *
 * @returns Anzahl der entfernten Einträge.
 */
export function repairOrphanedPlayerIdsInSeatOrder(game: GameState): number {
	let removedCount = 0;

	game.seatOrder = game.seatOrder.filter((playerId) => {
		if (playerId === EMPTY_PLAYER_ID) return true;
		if (Object.hasOwn(game.playersById, playerId)) return true;
		removedCount++;
		return false;
	});

	return removedCount;
}

/**
 * Verschiebt Rollen mit fehlender oder unbekannter Team-Referenz zum Team
 * "t_unknown". Das entsprechende System-Team sollte zuvor sichergestellt sein.
 *
 * @returns Anzahl der geänderten Rollen.
 */
export function repairOrphanedRoleTeamIds(game: GameState): number {
	const teamIds = new Set(game.ruleSetSnapshot.teams.map((team) => team.id));
	let changedCount = 0;

	for (const role of game.ruleSetSnapshot.roles) {
		if (teamIds.has(role.teamId)) {
			continue;
		}

		role.teamId = "t_unknown";
		changedCount++;
	}

	return changedCount;
}

/**
 * Repariert Spielerrollen, die auf keine vorhandene Rolle verweisen. Die
 * Felder werden in ihrer Abhängigkeit actual -> shown -> night bearbeitet.
 *
 * @returns Anzahl der geänderten Rollenreferenzen.
 */
export function repairOrphanedPlayerRoleIds(game: GameState): number {
	const roleIds = new Set(game.ruleSetSnapshot.roles.map((role) => role.id));
	let changedCount = 0;

	for (const player of Object.values(game.playersById)) {
		if (
			player.roles.actualRoleId !== null &&
			!roleIds.has(player.roles.actualRoleId)
		) {
			player.roles.actualRoleId = null;
			changedCount++;
		}

		const repairedShownRoleIds = player.roles.shownRoleIds.filter((roleId) =>
			roleIds.has(roleId),
		);
		if (repairedShownRoleIds.length !== player.roles.shownRoleIds.length) {
			player.roles.shownRoleIds = repairedShownRoleIds;
			changedCount++;
		}
		if (
			player.roles.shownRoleIds.length === 0 &&
			player.roles.actualRoleId !== null
		)
			player.roles.shownRoleIds = [player.roles.actualRoleId];

		if (
			player.roles.nightRoleId !== null &&
			!roleIds.has(player.roles.nightRoleId)
		) {
			player.roles.nightRoleId = player.roles.shownRoleIds[0] ?? null;
			changedCount++;
		}

		if (
			player.roles.claimedRoleId !== undefined &&
			!roleIds.has(player.roles.claimedRoleId)
		) {
			player.roles.claimedRoleId = undefined;
			changedCount++;
		}
	}

	return changedCount;
}

/**
 * Entfernt Rollenreferenzen aus der Zeigeliste, für die keine Rolle mehr
 * existiert. Reihenfolge und Mehrfachnennungen gültiger Rollen bleiben erhalten.
 *
 * @returns Anzahl der entfernten Vorkommen.
 */
export function repairOrphanedRolesForShowingRoleIds(game: GameState): number {
	if (!game.rolesForShowing) return 0;

	const roleIds = new Set(game.ruleSetSnapshot.roles.map((role) => role.id));
	let removedCount = 0;
	game.rolesForShowing.roles = game.rolesForShowing.roles.filter((roleId) => {
		if (roleIds.has(roleId)) return true;
		removedCount++;
		return false;
	});
	return removedCount;
}
