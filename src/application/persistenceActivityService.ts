export type PersistenceActivityListener = () => void;

/** Beobachtet laufende Storage-Schreibaufrufe über alle Persistence-Bereiche. */
export class PersistenceActivityService {
	readonly #listeners = new Set<PersistenceActivityListener>();
	#activeWriteCount = 0;

	getActiveWriteCount(): number {
		return this.#activeWriteCount;
	}

	subscribe(listener: PersistenceActivityListener): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	async trackWrite<Result>(operation: () => Promise<Result>): Promise<Result> {
		this.#activeWriteCount++;
		this.#notify();
		try {
			return await operation();
		} finally {
			this.#activeWriteCount--;
			this.#notify();
		}
	}

	#notify(): void {
		for (const listener of this.#listeners) listener();
	}
}
