import { language } from "../../config";
import type { GameState } from "../../domain/gameFactory";
import { getDisplayName } from "../../domain/localizedNames";
import { renameGame } from "../../domain/scenarioRenaming";
import type { SavedStoredGameObject } from "../../persistence/objectPersistenceTypes";
import { expectedApplicationError } from "../applicationError";
import type { LoadedGameDocument } from "../gameTypes";

export type LoadedGameSaveSnapshot = {
	game: LoadedGameDocument;
	sessionGeneration: number;
	documentRevision: number;
};

/** Hält das aktive Spiel und seinen Speicherzustand im Arbeitsspeicher. */
export class LoadedGameSession {
	#loadedGame?: LoadedGameDocument;
	#dirty = false;
	#sessionGeneration = 0;
	#documentRevision = 0;

	getLoadedGame(): LoadedGameDocument | undefined {
		return this.#loadedGame
			? cloneLoadedGameDocument(this.#loadedGame)
			: undefined;
	}

	requireLoadedGame(): LoadedGameDocument {
		if (!this.#loadedGame)
			throw expectedApplicationError("load", "game", "preconditionNotMet");
		return cloneLoadedGameDocument(this.#loadedGame);
	}

	setPreparedGame(game: GameState): LoadedGameDocument {
		return this.replaceLoadedGame(
			{
				storageKey: null,
				id: game.id,
				name: game.name,
				displayName: getDisplayName(game, language),
				document: game,
			},
			true,
		);
	}

	openLoadedGame(game: LoadedGameDocument): LoadedGameDocument {
		return this.replaceLoadedGame(game, false);
	}

	captureSaveSnapshot(): LoadedGameSaveSnapshot {
		return {
			game: this.requireLoadedGame(),
			sessionGeneration: this.#sessionGeneration,
			documentRevision: this.#documentRevision,
		};
	}

	commitSavedGame(
		saved: SavedStoredGameObject,
		snapshot: LoadedGameSaveSnapshot,
	): LoadedGameDocument {
		const current = this.requireLoadedGame();
		if (snapshot.sessionGeneration !== this.#sessionGeneration) return current;

		const identityWasNotEdited =
			current.document.id === snapshot.game.document.id &&
			current.document.name === snapshot.game.document.name;
		const document = identityWasNotEdited
			? renameGame(current.document, saved.document.name)
			: current.document;
		this.#loadedGame = cloneLoadedGameDocument({
			storageKey: saved.storageKey,
			id: document.id,
			name: document.name,
			displayName: getDisplayName(document, language),
			document,
			...(saved.restoredIndex > 0
				? {
						restored: true,
						restoredIndex: saved.restoredIndex,
					}
				: {}),
			...(saved.storageVariant ? { storageVariant: saved.storageVariant } : {}),
		});
		this.#dirty = this.#documentRevision !== snapshot.documentRevision;
		return this.requireLoadedGame();
	}

	isLoadedGameDirty(): boolean {
		return this.#dirty;
	}

	isCurrent(storageKey: string): boolean {
		return (
			(this.#loadedGame?.storageKey ?? this.#loadedGame?.id) === storageKey
		);
	}

	replaceDocument(document: GameState): LoadedGameDocument {
		const current = this.requireLoadedGame();
		this.#documentRevision += 1;
		return this.replaceLoadedGame(
			{
				...current,
				id: document.id,
				name: document.name,
				displayName: getDisplayName(document, language),
				document,
			},
			true,
			false,
		);
	}

	private replaceLoadedGame(
		game: LoadedGameDocument,
		dirty: boolean,
		startsNewSession = true,
	): LoadedGameDocument {
		if (startsNewSession) {
			this.#sessionGeneration += 1;
			this.#documentRevision = 0;
		}
		this.#loadedGame = cloneLoadedGameDocument(game);
		this.#dirty = dirty;
		return cloneLoadedGameDocument(this.#loadedGame);
	}
}

function cloneLoadedGameDocument(game: LoadedGameDocument): LoadedGameDocument {
	return clonePreservingPrototypes(game);
}

/**
 * Kopiert Session-Daten ohne sie erneut zu validieren. Die Domain-Objekte im
 * Spielzustand behalten dabei ihre Prototypen und damit ihr Verhalten.
 */
function clonePreservingPrototypes<T>(
	value: T,
	seen = new WeakMap<object, object>(),
): T {
	if (value === null || typeof value !== "object") return value;

	const knownCopy = seen.get(value);
	if (knownCopy) return knownCopy as T;

	if (Array.isArray(value)) {
		const copy: unknown[] = [];
		seen.set(value, copy);
		for (const entry of value)
			copy.push(clonePreservingPrototypes(entry, seen));
		return copy as T;
	}

	const copy = Object.create(Reflect.getPrototypeOf(value)) as object;
	seen.set(value, copy);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor) continue;
		if ("value" in descriptor) {
			const propertyValue = (value as Record<PropertyKey, unknown>)[key];
			descriptor.value = clonePreservingPrototypes(propertyValue, seen);
		}
		Object.defineProperty(copy, key, descriptor);
	}
	return copy as T;
}
