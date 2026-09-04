import { language } from "../../config";
import type { GameState } from "../../domain/gameFactory";
import type { RuleSet } from "../../domain/ruleSet";
import { isObjectStorageError } from "../../persistence/objectPersistenceError";
import type {
	GameObjectSaveOptions,
	RuleSetSaveOptions,
	SavedStoredGameObject,
} from "../../persistence/objectPersistenceTypes";
import { isObjectSaveInterruptedError } from "../../persistence/objectSaveInterruptedError";
import type { ObjectWritePort } from "../../persistence/ports/objectWritePort";
import { createContextualApplicationOperationError } from "./applicationErrorMapping";

/** Gemeinsamer technischer Application-Pfad für das Speichern von Domainobjekten. */
export class ApplicationObjectWriter {
	readonly #write: ObjectWritePort;
	readonly #afterSuccessfulSave: () => void;

	constructor(write: ObjectWritePort, afterSuccessfulSave: () => void = noop) {
		this.#write = write;
		this.#afterSuccessfulSave = afterSuccessfulSave;
	}

	async saveObject(
		object: GameState,
		options?: GameObjectSaveOptions,
	): Promise<SavedStoredGameObject>;
	async saveObject(
		object: RuleSet,
		options?: RuleSetSaveOptions,
	): Promise<RuleSet>;
	async saveObject(
		object: GameState | RuleSet,
		options?: GameObjectSaveOptions | RuleSetSaveOptions,
	): Promise<SavedStoredGameObject | RuleSet> {
		try {
			const saved = isGameState(object)
				? await this.#write.saveObject(
						object,
						{ ansiFallbackLocale: language },
						options,
					)
				: await this.#write.saveObject(
						object,
						{ ansiFallbackLocale: language },
						options,
					);
			this.#afterSuccessfulSave();
			return saved;
		} catch (cause) {
			if (isSaveWorkflowDecision(cause)) throw cause;
			throw createContextualApplicationOperationError(cause, "save");
		}
	}
}

function isGameState(object: GameState | RuleSet): object is GameState {
	return "playersById" in object && "seatOrder" in object;
}

/**
 * Diese Fehler sind keine anzuzeigenden technischen Meldungen, sondern
 * strukturierte Zwischenergebnisse für Recovery- und Konflikt-Use-Cases.
 */
function isSaveWorkflowDecision(error: unknown): boolean {
	return (
		isObjectSaveInterruptedError(error) ||
		(isObjectStorageError(error) && error.reason === "targetExists")
	);
}

function noop(): void {}
