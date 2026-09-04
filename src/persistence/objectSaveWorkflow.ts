import type { GameObjectPersistence } from "./gameObjectPersistence";

export type PreparedGameSave = ReturnType<
	GameObjectPersistence["prepareSaveObject"]
>;

/** Gemeinsamer Zustand eines unterbrochenen Save-Workflows. */
export class PendingGameSaveRegistry {
	readonly #entries = new Map<string, PreparedGameSave>();

	get(commandId: string): PreparedGameSave | undefined {
		return this.#entries.get(commandId);
	}

	set(commandId: string, prepared: PreparedGameSave): void {
		this.#entries.set(commandId, prepared);
	}

	delete(commandId: string): void {
		this.#entries.delete(commandId);
	}
}
