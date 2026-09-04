import type { DataFileStorage } from "./ports/dataFileStorage";

type WriteActivityTracker = {
	trackWrite<Result>(operation: () => Promise<Result>): Promise<Result>;
};

const writeMethods = new Set<PropertyKey>([
	"writeInternal",
	"writeExternal",
	"deleteInternal",
	"renameInternal",
	"continueInternalCommand",
]);

/** Erfasst tatsächliche Storage-Schreibaufrufe, ohne den Adapter zu verändern. */
export function trackDataFileStorageWrites<Storage extends DataFileStorage>(
	storage: Storage,
	activity: WriteActivityTracker,
): Storage {
	return new Proxy(storage, {
		get(target, property) {
			const value = Reflect.get(target, property, target) as unknown;
			if (typeof value !== "function") return value;
			const method = value as (...args: unknown[]) => unknown;
			if (!writeMethods.has(property))
				return (...args: unknown[]) => method.apply(target, args);
			return (...args: unknown[]) =>
				activity.trackWrite(() => Promise.resolve(method.apply(target, args)));
		},
	});
}
