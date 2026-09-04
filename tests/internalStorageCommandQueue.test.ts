import { describe, expect, it } from "vitest";

import { RecoverableStorageWriteError } from "../src/persistence/ports/dataFileStorage";
import { InternalStorageCommandQueue } from "../src/storage/internalStorageCommandQueue";

describe("InternalStorageCommandQueue", () => {
	it("arbeitet interne Befehle strikt in FIFO-Reihenfolge ab", async () => {
		const queue = new InternalStorageCommandQueue();
		const order: string[] = [];
		let releaseFirst: (() => void) | undefined;
		const first = queue.enqueue({
			key: "first",
			execute: async () => {
				order.push("first:start");
				await new Promise<void>((resolve) => {
					releaseFirst = resolve;
				});
				order.push("first:end");
			},
		});
		const second = queue.enqueue({
			key: "second",
			execute: () => {
				order.push("second");
				return Promise.resolve();
			},
		});

		await Promise.resolve();
		expect(order).toEqual(["first:start"]);
		releaseFirst?.();
		await Promise.all([first, second]);
		expect(order).toEqual(["first:start", "first:end", "second"]);
	});

	it("hält bei einem Recovery-Fehler an und setzt denselben Befehl erneut fort", async () => {
		const queue = new InternalStorageCommandQueue();
		let attempts = 0;
		let followingRan = false;
		const failed = queue.enqueue({
			key: "game:write:game_test",
			execute: () => {
				attempts += 1;
				if (attempts === 1)
					return Promise.reject(new RecoverableStorageWriteError());
				return Promise.resolve();
			},
		});
		const following = queue.enqueue({
			key: "following",
			execute: () => {
				followingRan = true;
				return Promise.resolve();
			},
		});

		const error = await failed.catch((value: unknown) => value);
		expect(error).toBeInstanceOf(RecoverableStorageWriteError);
		expect(followingRan).toBe(false);
		await queue.continue(
			(error as RecoverableStorageWriteError).commandId as string,
			"retry",
		);
		await following;
		expect(attempts).toBe(2);
		expect(followingRan).toBe(true);
	});

	it("gibt die Queue bei 'Später entscheiden' frei", async () => {
		const queue = new InternalStorageCommandQueue();
		const failed = queue.enqueue({
			key: "library:write",
			execute: () => Promise.reject(new RecoverableStorageWriteError()),
		});
		let followingRan = false;
		const following = queue.enqueue({
			key: "following",
			execute: () => {
				followingRan = true;
				return Promise.resolve();
			},
		});
		const error = (await failed.catch(
			(value: unknown) => value,
		)) as RecoverableStorageWriteError;

		await queue.continue(error.commandId as string, "finishLater");
		await following;
		expect(followingRan).toBe(true);
	});

	it("behandelt einen neuen Befehl mit gleichem Schlüssel nicht als Retry", async () => {
		const queue = new InternalStorageCommandQueue();
		const executions: string[] = [];
		const failed = queue.enqueue({
			key: "game:write:game_test",
			execute: () => {
				executions.push("old");
				return Promise.reject(new RecoverableStorageWriteError());
			},
		});
		const error = (await failed.catch(
			(value: unknown) => value,
		)) as RecoverableStorageWriteError;
		const next = queue.enqueue({
			key: "game:write:game_test",
			execute: () => {
				executions.push("new");
				return Promise.resolve();
			},
		});

		await queue.continue(error.commandId as string, "finishLater");
		await next;
		expect(executions).toEqual(["old", "new"]);
	});

	it("führt nur eine Recovery-Entscheidung gleichzeitig aus", async () => {
		const queue = new InternalStorageCommandQueue();
		let releaseRecovery: (() => void) | undefined;
		const failed = queue.enqueue({
			key: "game:write:game_test",
			recoveryKey: "game_test",
			execute: () => Promise.reject(new RecoverableStorageWriteError()),
			recover: () =>
				new Promise<void>((resolve) => {
					releaseRecovery = resolve;
				}),
		});
		const error = (await failed.catch(
			(value: unknown) => value,
		)) as RecoverableStorageWriteError;
		let followingRan = false;
		const following = queue.enqueue({
			key: "following",
			execute: () => {
				followingRan = true;
				return Promise.resolve();
			},
		});
		const firstDecision = queue.continue(error.commandId as string, "keepOld");

		await expect(
			queue.continue(error.commandId as string, "keepNew"),
		).resolves.toBe(false);
		expect(followingRan).toBe(false);
		releaseRecovery?.();
		await firstDecision;
		await following;
		expect(followingRan).toBe(true);
	});
});
