import { describe, expect, it, vi } from "vitest";
import { PersistenceActivityService } from "../src/application/persistenceActivityService";
import type { DataFileStorage } from "../src/persistence/ports/dataFileStorage";
import { trackDataFileStorageWrites } from "../src/persistence/trackedDataFileStorage";

describe("PersistenceActivityService", () => {
	it("zählt Storage-Schreibaufrufe bis zu ihrem tatsächlichen Abschluss", async () => {
		let finishWrite!: () => void;
		const writeFinished = new Promise<void>((resolve) => {
			finishWrite = resolve;
		});
		const storage: DataFileStorage = {
			readInternal: vi.fn(),
			writeInternal: vi.fn(() => writeFinished),
		};
		const activity = new PersistenceActivityService();
		const listener = vi.fn();
		activity.subscribe(listener);
		const trackedStorage = trackDataFileStorageWrites(storage, activity);

		const write = trackedStorage.writeInternal?.(
			{ category: "game", fileName: "game_test.json" },
			new Uint8Array(),
			{},
		);
		expect(activity.getActiveWriteCount()).toBe(1);
		finishWrite();
		await write;
		expect(activity.getActiveWriteCount()).toBe(0);
		expect(listener).toHaveBeenCalledTimes(2);
	});
});
