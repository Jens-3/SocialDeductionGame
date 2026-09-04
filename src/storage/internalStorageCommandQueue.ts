import {
	isRecoverableStorageWriteError,
	RecoverableStorageWriteError,
} from "../persistence/ports/dataFileStorage";
import type {
	StorageCommandContinuation,
	StorageCommandDecision,
} from "../persistence/ports/storageCommand";

type QueuedCommand<T> = {
	id: string;
	key: string;
	recoveryKey?: string;
	execute: () => Promise<T>;
	recover?: (
		decision: Exclude<StorageCommandDecision, "retry" | "finishLater">,
		continuation?: StorageCommandContinuation,
	) => Promise<unknown>;
	resolve: (value: T) => void;
	reject: (error: unknown) => void;
	awaitingDecision: boolean;
	continuationInProgress: boolean;
};

export type EnqueueInternalCommandOptions<T> = {
	key: string;
	recoveryKey?: string;
	execute: () => Promise<T>;
	recover?: QueuedCommand<T>["recover"];
};

export class InternalStorageCommandQueue {
	readonly #queued: QueuedCommand<unknown>[] = [];
	#active?: QueuedCommand<unknown>;

	enqueue<T>(options: EnqueueInternalCommandOptions<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.#queued.push({
				id: createStorageCommandId(),
				...options,
				resolve: resolve as (value: unknown) => void,
				reject,
				awaitingDecision: false,
				continuationInProgress: false,
			});
			this.#startNext();
		});
	}

	async continue(
		commandId: string,
		decision: StorageCommandDecision,
		continuation?: StorageCommandContinuation,
	): Promise<boolean> {
		const active = this.#active;
		if (
			!active ||
			active.id !== commandId ||
			!active.awaitingDecision ||
			active.continuationInProgress
		)
			return false;
		if (decision === "retry") {
			await this.#retryActive();
			return true;
		}
		active.awaitingDecision = false;
		active.continuationInProgress = true;
		try {
			if (decision !== "finishLater") {
				if (!active.recover)
					throw new Error("Dieser Storage-Befehl unterstützt kein Recovery.");
				const action = await active.recover(decision, continuation);
				if (action === "retry") {
					await this.#executeContinuation(active);
					return true;
				}
			}
			this.#completeActive();
			return true;
		} catch (error) {
			active.awaitingDecision = true;
			active.continuationInProgress = false;
			throw error;
		}
	}

	async #executeContinuation(active: QueuedCommand<unknown>): Promise<void> {
		try {
			await active.execute();
			this.#completeActive();
		} catch (error) {
			if (isRecoverableStorageWriteError(error)) {
				active.awaitingDecision = true;
				active.continuationInProgress = false;
				throw new RecoverableStorageWriteError(
					error.message,
					active.id,
					error.reason,
					error.file,
					error.diagnostic,
				);
			}
			this.#completeActive();
			throw error;
		}
	}

	#startNext(): void {
		if (this.#active || this.#queued.length === 0) return;
		this.#active = this.#queued.shift();
		void this.#executeActive();
	}

	async #executeActive(): Promise<unknown> {
		const active = this.#active;
		if (!active) return;
		try {
			const value = await active.execute();
			active.resolve(value);
			this.#completeActive();
			return value;
		} catch (error) {
			if (!isRecoverableStorageWriteError(error)) {
				active.reject(error);
				this.#completeActive();
				return;
			}
			active.awaitingDecision = true;
			active.continuationInProgress = false;
			const queuedError = new RecoverableStorageWriteError(
				error.message,
				active.id,
				error.reason,
				error.file,
				error.diagnostic,
			);
			active.reject(queuedError);
			return;
		}
	}

	async #retryActive(): Promise<unknown> {
		const active = this.#active;
		if (!active?.awaitingDecision || active.continuationInProgress)
			throw new Error("Es gibt keinen wartenden Storage-Befehl.");
		active.awaitingDecision = false;
		active.continuationInProgress = true;
		try {
			const value = await active.execute();
			this.#completeActive();
			return value;
		} catch (error) {
			if (isRecoverableStorageWriteError(error)) {
				active.awaitingDecision = true;
				active.continuationInProgress = false;
				throw new RecoverableStorageWriteError(
					error.message,
					active.id,
					error.reason,
					error.file,
					error.diagnostic,
				);
			}
			this.#completeActive();
			throw error;
		}
	}

	#completeActive(): void {
		this.#active = undefined;
		this.#startNext();
	}
}

export const internalStorageCommandQueue = new InternalStorageCommandQueue();

export function createStorageCommandId(): string {
	if (typeof globalThis.crypto?.randomUUID === "function")
		return globalThis.crypto.randomUUID();
	if (typeof globalThis.crypto?.getRandomValues === "function") {
		const values = new Uint32Array(4);
		globalThis.crypto.getRandomValues(values);
		return [...values]
			.map((value) => value.toString(16).padStart(8, "0"))
			.join("-");
	}
	throw new Error("Die Plattform stellt keine sichere Zufallsquelle bereit.");
}
