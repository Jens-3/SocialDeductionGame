import { isObjectSaveInterruptedError } from "../../persistence/objectSaveInterruptedError";

export type PersistenceOperationStatus = "idle" | "running";

type RunningOperation = {
	lastResult: Promise<unknown>;
	activeCall?: Promise<unknown>;
	commandId?: string;
};

type PersistenceOperationOptions<Result> = {
	decisionCommandId?: (result: Result) => string | undefined;
};

/**
 * Fasst identische Application-Aufträge zu einem laufenden Persistence-Ablauf
 * zusammen. Ein behebbarer Schreibfehler beendet den Ablauf nicht, sondern
 * verknüpft ihn bis zur abschließenden Recovery-Entscheidung mit der Command-ID.
 */
export class PersistenceOperationRegistry {
	readonly #operations = new Map<string, RunningOperation>();
	readonly #operationByCommandId = new Map<string, string>();
	readonly #argumentIds = new WeakMap<object, number>();
	#nextArgumentId = 1;

	status(operationKey: string): PersistenceOperationStatus {
		return this.#operations.has(operationKey) ? "running" : "idle";
	}

	argumentKey(value: unknown): string {
		if (
			(typeof value !== "object" || value === null) &&
			typeof value !== "function"
		)
			return `${typeof value}:${String(value)}`;
		const object = value;
		let id = this.#argumentIds.get(object);
		if (id === undefined) {
			id = this.#nextArgumentId++;
			this.#argumentIds.set(object, id);
		}
		return `object:${id}`;
	}

	run<Result>(
		operationKey: string,
		operation: () => Promise<Result>,
		options: PersistenceOperationOptions<Result> = {},
	): Promise<Result> {
		const running = this.#operations.get(operationKey);
		if (running) return running.lastResult as Promise<Result>;

		const result = Promise.resolve().then(operation);
		const entry: RunningOperation = { lastResult: result, activeCall: result };
		this.#operations.set(operationKey, entry);
		result.then(
			(value) => {
				const commandId = options.decisionCommandId?.(value);
				if (commandId) this.#awaitDecision(operationKey, entry, commandId);
				else this.#finish(operationKey, entry);
			},
			(error: unknown) => {
				const commandId = interruptedCommandId(error);
				if (!commandId) {
					this.#finish(operationKey, entry);
					return;
				}
				this.#awaitDecision(operationKey, entry, commandId);
			},
		);
		return result;
	}

	continue<Result>(
		commandId: string,
		operation: () => Promise<Result>,
		options: PersistenceOperationOptions<Result> = {},
	): Promise<Result> {
		const operationKey =
			this.#operationByCommandId.get(commandId) ?? `recovery:${commandId}`;
		let entry = this.#operations.get(operationKey);
		if (entry?.activeCall) return entry.activeCall as Promise<Result>;
		if (!entry) {
			const placeholder = Promise.resolve(undefined);
			entry = { lastResult: placeholder, commandId };
			this.#operations.set(operationKey, entry);
			this.#operationByCommandId.set(commandId, operationKey);
		}

		const result = Promise.resolve().then(operation);
		entry.lastResult = result;
		entry.activeCall = result;
		const continuedEntry = entry;
		result.then(
			(value) => {
				const nextCommandId = options.decisionCommandId?.(value);
				if (nextCommandId)
					this.#replaceAwaitedCommand(
						operationKey,
						continuedEntry,
						nextCommandId,
					);
				else this.#finish(operationKey, continuedEntry);
			},
			(error: unknown) => {
				const nextCommandId = interruptedCommandId(error);
				if (!nextCommandId) {
					this.#finish(operationKey, continuedEntry);
					return;
				}
				this.#replaceAwaitedCommand(
					operationKey,
					continuedEntry,
					nextCommandId,
				);
			},
		);
		return result;
	}

	#finish(operationKey: string, entry: RunningOperation): void {
		if (this.#operations.get(operationKey) !== entry) return;
		this.#operations.delete(operationKey);
		if (entry.commandId) this.#operationByCommandId.delete(entry.commandId);
	}

	#awaitDecision(
		operationKey: string,
		entry: RunningOperation,
		commandId: string,
	): void {
		entry.activeCall = undefined;
		entry.commandId = commandId;
		this.#operationByCommandId.set(commandId, operationKey);
	}

	#replaceAwaitedCommand(
		operationKey: string,
		entry: RunningOperation,
		commandId: string,
	): void {
		if (entry.commandId && entry.commandId !== commandId)
			this.#operationByCommandId.delete(entry.commandId);
		this.#awaitDecision(operationKey, entry, commandId);
	}
}

function interruptedCommandId(error: unknown): string | undefined {
	let current = error;
	const visited = new Set<unknown>();
	while (current !== undefined && current !== null && !visited.has(current)) {
		visited.add(current);
		if (isObjectSaveInterruptedError(current)) return current.commandId;
		current =
			typeof current === "object" && "cause" in current
				? current.cause
				: undefined;
	}
	return undefined;
}
