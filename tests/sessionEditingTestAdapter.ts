import type { GameState } from "../src/domain/gameFactory";
import {
	type CreatePlayerParams,
	type CreateRoleParams,
	type CreateTeamParams,
	createPlayer as createPlayerInDomain,
	createRole as createRoleInDomain,
	createTeam as createTeamInDomain,
	type EditPlayerParams,
	type EditRoleParams,
	type EditTeamParams,
	editPlayer as editPlayerInDomain,
	editRole as editRoleInDomain,
	editTeam as editTeamInDomain,
} from "../src/domain/sessionEditing";

export const createTeam = (
	game: GameState,
	params: CreateTeamParams,
	language = "de",
) => createTeamInDomain(game, params, language);

export const editTeam = (
	game: GameState,
	params: EditTeamParams,
	language = "de",
) => editTeamInDomain(game, params, language);

export const createRole = (
	game: GameState,
	params: CreateRoleParams,
	language = "de",
) => createRoleInDomain(game, params, language);

export const editRole = (
	game: GameState,
	params: EditRoleParams,
	language = "de",
) => editRoleInDomain(game, params, language);

export const createPlayer = (
	game: GameState,
	params: CreatePlayerParams,
	language = "de",
) => createPlayerInDomain(game, params, language);

export const editPlayer = (
	game: GameState,
	params: EditPlayerParams,
	language = "de",
) => editPlayerInDomain(game, params, language);
