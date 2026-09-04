import type { IdGenerator } from "../domain/idGenerator";
import { PlatformOperationError } from "./platformOperationError";

/** Erzeugt technisch eindeutige IDs mit der Zufallsquelle der Plattform. */
export class SystemIdGenerator implements IdGenerator {
	createId(prefix: string): string {
		const cleanPrefix = prefix.trim();
		if (!cleanPrefix) throw new Error("Der ID-Präfix darf nicht leer sein.");
		return `${cleanPrefix}_${createRandomIdPart()}`;
	}
}

function createRandomIdPart(): string {
	if (typeof globalThis.crypto?.randomUUID === "function") {
		return globalThis.crypto.randomUUID().replaceAll("-", "_");
	}
	if (typeof globalThis.crypto?.getRandomValues === "function") {
		const values = new Uint32Array(4);
		globalThis.crypto.getRandomValues(values);
		return [...values]
			.map((value) => value.toString(16).padStart(8, "0"))
			.join("_");
	}
	throw new PlatformOperationError(
		"Die Plattform stellt keine sichere Zufallsquelle bereit.",
	);
}
