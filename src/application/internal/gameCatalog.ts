import { language } from "../../config";
import type { PersistedGameObjectKind } from "../../persistence/objectPersistenceTypes";
import type { ObjectPersistenceCapabilities } from "../../persistence/ports/objectPersistenceCapabilities";
import type { StoredGameReference } from "../gameTypes";
import {
	ApplicationObjectListError,
	type ApplicationObjectListResult,
} from "../objectList";
import { executeApplicationOperation } from "./applicationErrorMapping";
import { createApplicationObjectListResult } from "./applicationObjectListMapper";

/** Verwaltet den Katalog gespeicherter Spiele und Vorlagen samt ID-Cache. */
export class GameCatalog {
	readonly #persistence: ObjectPersistenceCapabilities;
	readonly #loadedBrowseScopes = new Set<string>();
	readonly #browseDocumentIds = new Map<string, Set<string>>();
	readonly #loadingBrowseScopes = new Map<string, Promise<void>>();
	#browseCacheGeneration = 0;

	constructor(persistence: ObjectPersistenceCapabilities) {
		this.#persistence = persistence;
	}

	findLatestStoredGame(): Promise<StoredGameReference | undefined> {
		return executeApplicationOperation(
			() => this.#persistence.read.findLatestStoredGame(),
			"load",
		);
	}

	async listObjects<K extends PersistedGameObjectKind>(
		kind: K,
	): Promise<ApplicationObjectListResult<K>> {
		const generation = this.#browseCacheGeneration;
		const result = createApplicationObjectListResult(
			await executeApplicationOperation(
				() =>
					this.#persistence.read.readAllObjectsOfType(kind, {
						ansiFallbackLocale: language,
					}),
				"list",
			),
			language,
		);
		if (
			result.status === "loaded" &&
			generation === this.#browseCacheGeneration
		)
			this.cacheObjectIds(kind, result);
		return result;
	}

	clearBrowseCache(): void {
		this.#browseCacheGeneration++;
		this.#loadedBrowseScopes.clear();
		this.#browseDocumentIds.clear();
		this.#loadingBrowseScopes.clear();
	}

	async getStoredDocumentIds(): Promise<Set<string>> {
		await this.ensureBrowseScope();
		return new Set(
			[...this.#browseDocumentIds.entries()]
				.filter(([scope]) => scope.startsWith(`${language}:`))
				.flatMap(([, ids]) => [...ids]),
		);
	}

	private async ensureBrowseScope(
		category?: "game" | "template",
	): Promise<void> {
		if (!category) {
			await Promise.all([
				this.ensureBrowseScope("game"),
				this.ensureBrowseScope("template"),
			]);
			return;
		}
		const scope = this.browseScope(category);
		if (this.#loadedBrowseScopes.has(scope)) return;
		const pending = this.#loadingBrowseScopes.get(scope);
		if (pending) return pending;
		const generation = this.#browseCacheGeneration;
		const loading = (async () => {
			const snapshot = await this.listObjects(category);
			if (snapshot.status === "expectedFailure")
				throw new ApplicationObjectListError(snapshot.problem);
			if (generation !== this.#browseCacheGeneration) return;
		})();
		this.#loadingBrowseScopes.set(scope, loading);
		try {
			await loading;
		} finally {
			if (this.#loadingBrowseScopes.get(scope) === loading)
				this.#loadingBrowseScopes.delete(scope);
		}
	}

	private cacheObjectIds<K extends PersistedGameObjectKind>(
		kind: K,
		result: Extract<ApplicationObjectListResult<K>, { status: "loaded" }>,
	): void {
		const scope = this.browseScope(kind);
		this.#browseDocumentIds.set(scope, new Set(result.ids));
		this.#loadedBrowseScopes.add(scope);
	}

	private browseScope(category?: "game" | "template"): string {
		return category ? `${language}:${category}` : language;
	}
}
