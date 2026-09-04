import type { DomainServices } from "../domain/domainServices";
import { createGameFromRuleSet, type GameState } from "../domain/gameFactory";
import {
	assignRandomRolesByRoleCounts,
	assignRandomRolesByTeamCounts,
} from "../domain/roleDistribution";
import type { RuleSet } from "../domain/ruleSet";
import type { RoleDistributionMode } from "./gamePreparationPresentation";
import { executeApplicationOperationSync } from "./internal/applicationErrorMapping";

/** Application-Einstieg für die Vorbereitung eines noch nicht aktiven Spiels. */
export class GamePreparationService {
	constructor(private readonly domainServices: DomainServices) {}

	createGameFromRuleSet(params: {
		ruleSet: RuleSet;
		playerCount: number;
		name?: string;
	}): GameState {
		return executeApplicationOperationSync(
			() =>
				createGameFromRuleSet({
					...params,
					services: this.domainServices,
				}),
			"validate",
		);
	}

	distributeRoles(
		game: GameState,
		mode: RoleDistributionMode,
		counts: Record<string, number>,
		language = "de",
	): GameState {
		return executeApplicationOperationSync(
			() =>
				mode === "teams"
					? assignRandomRolesByTeamCounts(game, counts, this.domainServices, {
							language,
						}).game
					: assignRandomRolesByRoleCounts(game, counts, this.domainServices, {
							language,
						}).game,
			"resolve",
		);
	}
}
