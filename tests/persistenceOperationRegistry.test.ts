import { expect, it, vi } from "vitest";
import { PersistenceOperationRegistry } from "../src/application/internal/persistenceOperationRegistry";
import { ObjectSaveInterruptedError } from "../src/persistence/objectSaveInterruptedError";

it("teilt Promise und Ergebnis eines identischen laufenden Befehls", async () => {
	const operations = new PersistenceOperationRegistry();
	let finish: ((value: { id: string }) => void) | undefined;
	const persistenceResult = new Promise<{ id: string }>((resolve) => {
		finish = resolve;
	});
	const persistenceCall = vi.fn(() => persistenceResult);

	const first = operations.run("load:game:game_1", persistenceCall);
	const second = operations.run("load:game:game_1", persistenceCall);

	expect(first).toBe(second);
	expect(operations.status("load:game:game_1")).toBe("running");
	await Promise.resolve();
	expect(persistenceCall).toHaveBeenCalledTimes(1);
	const result = { id: "game_1" };
	finish?.(result);
	expect(await first).toBe(result);
	expect(await second).toBe(result);
	expect(operations.status("load:game:game_1")).toBe("idle");
});

it("bleibt während einer Recovery-Rückfrage running und teilt die Fortsetzung", async () => {
	const operations = new PersistenceOperationRegistry();
	const interrupted = operations.run("save:game:1:2", () =>
		Promise.reject(
			new ObjectSaveInterruptedError(
				"Rückfrage erforderlich",
				"command-1",
				"writeFailure",
			),
		),
	);
	await expect(interrupted).rejects.toMatchObject({ commandId: "command-1" });
	expect(operations.status("save:game:1:2")).toBe("running");
	expect(
		operations.run("save:game:1:2", () => Promise.resolve({ ignored: true })),
	).toBe(interrupted);

	let finish: ((value: { saved: true }) => void) | undefined;
	const persistenceResult = new Promise<{ saved: true }>((resolve) => {
		finish = resolve;
	});
	const persistenceCall = vi.fn(() => persistenceResult);
	const firstContinuation = operations.continue("command-1", persistenceCall);
	const secondContinuation = operations.continue("command-1", persistenceCall);

	expect(firstContinuation).toBe(secondContinuation);
	await Promise.resolve();
	expect(persistenceCall).toHaveBeenCalledTimes(1);
	const result = { saved: true as const };
	finish?.(result);
	expect(await firstContinuation).toBe(result);
	expect(await secondContinuation).toBe(result);
	expect(operations.status("save:game:1:2")).toBe("idle");
});

it("kehrt nach einem endgültigen Fehler zu idle zurück", async () => {
	const operations = new PersistenceOperationRegistry();
	const failed = operations.run("load:game:game_1", () =>
		Promise.reject(new Error("endgültig fehlgeschlagen")),
	);

	await expect(failed).rejects.toThrow("endgültig fehlgeschlagen");
	expect(operations.status("load:game:game_1")).toBe("idle");
});
