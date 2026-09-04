import { language } from "../../config";
import type { GameState } from "../../domain/gameFactory";
import { convertTemplateToGame } from "../../domain/gameValidation";
import { getDisplayName } from "../../domain/localizedNames";
import { renameGame } from "../../domain/scenarioRenaming";
import type { ObjectPersistenceCapabilities } from "../../persistence/ports/objectPersistenceCapabilities";
import { expectedApplicationError } from "../applicationError";
import type { LoadedGameDocument } from "../gameTypes";
import { executeApplicationOperation } from "./applicationErrorMapping";
import type { LoadedGameSession } from "./loadedGameSession";
import type { PersistenceOperationRegistry } from "./persistenceOperationRegistry";

/** Lädt Spiele und Vorlagen und übernimmt geladene Spiele in die Session. */
export class DefaultGameLoadService {
	readonly #persistence: ObjectPersistenceCapabilities;
	readonly #session: LoadedGameSession;
	readonly #operations: PersistenceOperationRegistry;

	constructor(
		persistence: ObjectPersistenceCapabilities,
		session: LoadedGameSession,
		operations: PersistenceOperationRegistry,
	) {
		this.#persistence = persistence;
		this.#session = session;
		this.#operations = operations;
	}

	async createGameFromTemplate(
		storageKey: string,
		name?: string,
	): Promise<LoadedGameDocument> {
		return this.#operations.run(
			`load:template-as-game:${storageKey}:${JSON.stringify(name)}`,
			async () => {
				const { document: template } = await executeApplicationOperation(
					() =>
						this.#persistence.read.loadObject("template", storageKey, {
							ansiFallbackLocale: language,
						}),
					"load",
				);
				const game = convertTemplateToGame(template);
				return this.#session.setPreparedGame(
					name === undefined ? game : renameGame(game, name),
				);
			},
		);
	}

	async loadTemplateDocument(storageKey: string): Promise<GameState> {
		return this.#operations.run(`load:template:${storageKey}`, async () => {
			return (
				await executeApplicationOperation(
					() =>
						this.#persistence.read.loadObject("template", storageKey, {
							ansiFallbackLocale: language,
						}),
					"load",
				)
			).document;
		});
	}

	async loadGame(storageKey: string): Promise<LoadedGameDocument> {
		return this.#operations.run(`load:game:${storageKey}`, async () => {
			const loaded = await executeApplicationOperation(
				() =>
					this.#persistence.read.loadObject("game", storageKey, {
						ansiFallbackLocale: language,
					}),
				"load",
			);
			const { document } = loaded;
			if (!document.name.trim())
				throw expectedApplicationError(
					"load",
					"game",
					"invalidDocument",
					"field=name",
				);

			return this.#session.openLoadedGame({
				storageKey,
				id: loaded.id,
				name: document.name.trim(),
				displayName: displayName(document),
				document,
				...(loaded.restoredIndex > 0
					? { restored: true, restoredIndex: loaded.restoredIndex }
					: {}),
				...(loaded.storageVariant
					? { storageVariant: loaded.storageVariant }
					: {}),
			});
		});
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function displayName(value: Record<string, unknown>): string {
	const name = typeof value.name === "string" ? value.name : "";
	const names = isRecord(value.names)
		? Object.fromEntries(
				Object.entries(value.names).filter(
					(entry): entry is [string, string] => typeof entry[1] === "string",
				),
			)
		: undefined;
	return getDisplayName({ name, names }, language).trim();
}
