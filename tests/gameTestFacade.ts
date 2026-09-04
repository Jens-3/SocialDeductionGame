import {
	createGameUseCases,
	type GamePersistenceService,
	type GameSessionService,
} from "../src/application/gameUseCases";
import type { DomainServices } from "../src/domain/domainServices";
import type { DataFileStorage } from "../src/persistence/ports/dataFileStorage";
import { createTestObjectPersistence } from "./createTestObjectPersistence";
import { fixedDomainServices } from "./fixedClock";

type GameTestFacadeShape = GameSessionService &
	GamePersistenceService & {
		readonly objectProblems: ReturnType<
			typeof createGameUseCases
		>["objectProblems"];
	};

/**
 * Flache Testhilfe für ältere Charakterisierungstests.
 * Produktiver Code verwendet ausschließlich die getrennten Use-Case-Fassaden.
 */
const GameTestFacadeBase = class {
	readonly objectProblems;

	constructor(
		storage: DataFileStorage,
		domainServices: DomainServices = fixedDomainServices,
	) {
		const useCases = createGameUseCases(
			createTestObjectPersistence(storage, domainServices),
			domainServices,
		);
		this.objectProblems = useCases.objectProblems;
		Object.assign(this, useCases.session, useCases.persistence);
	}
} as new (
	storage: DataFileStorage,
	domainServices?: DomainServices,
) => GameTestFacadeShape;

export class GameTestFacade extends GameTestFacadeBase {}
