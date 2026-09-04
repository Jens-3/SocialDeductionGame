import { domainFailure } from "./domainFailure";
import type { GameDraft } from "./gameDraft";
import type { GameState } from "./gameFactory";
import { repairIds } from "./gameIdRepair";
import { hydrateGameState, repairGameDraft } from "./gameValidation";

export type GameDocumentKind = "game" | "template";

export type GameRepairReport = {
	kind: GameDocumentKind;
	changeCount: number;
};

export type GameRepairResult = {
	document: GameState;
	report: GameRepairReport;
};

export function repairGameDocument(
	value: GameDraft,
	expectedKind?: GameDocumentKind,
): GameRepairResult {
	const repaired = repairGameDraft(value);
	if (typeof repaired === "string")
		throw domainFailure(
			"repair",
			"repairFailed",
			false,
			`IDs konnten nicht repariert werden: ${repaired}`,
		);
	const document = hydrateGameState(repaired.draft);
	const kind = gameKind(document);
	assertExpectedKind(kind, expectedKind);
	return {
		document,
		report: {
			kind,
			changeCount: countMaterialChanges(
				value,
				repaired.draft,
				repaired.changeCount,
			),
		},
	};
}

export function repairGameState(
	value: GameState,
	expectedKind?: GameDocumentKind,
): GameRepairResult {
	const document = structuredClone(value);
	const original = comparableGameJson(document);
	const repaired = repairIds(document);
	if (typeof repaired === "string")
		throw domainFailure(
			"repair",
			"repairFailed",
			false,
			`IDs konnten nicht repariert werden: ${repaired}`,
		);
	const hydrated = hydrateGameState(document);
	const kind = gameKind(hydrated);
	assertExpectedKind(kind, expectedKind);
	return {
		document: hydrated,
		report: {
			kind,
			changeCount:
				original === comparableGameJson(hydrated) ? 0 : Math.max(repaired, 1),
		},
	};
}

function countMaterialChanges(
	before: GameDraft | GameState,
	after: GameDraft | GameState,
	domainCount: number,
): number {
	return comparableGameJson(before) === comparableGameJson(after)
		? 0
		: Math.max(domainCount, 1);
}

function comparableGameJson(value: GameDraft | GameState): string {
	if ("players" in value) return JSON.stringify(sortJsonValue(value));
	const {
		playersById,
		statusDefinitionsById: _derivedStatuses,
		...document
	} = value;
	void _derivedStatuses;
	return JSON.stringify(
		sortJsonValue({ ...document, players: Object.values(playersById) }),
	);
}

function sortJsonValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortJsonValue);
	if (typeof value !== "object" || value === null) return value;
	return Object.fromEntries(
		Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => [key, sortJsonValue(entry)]),
	);
}

function gameKind(document: GameState): GameDocumentKind {
	return document.isTemplate ? "template" : "game";
}

function assertExpectedKind(
	actual: GameDocumentKind,
	expected: GameDocumentKind | undefined,
): void {
	if (expected === undefined || actual === expected) return;
	throw domainFailure(
		"repair",
		"repairFailed",
		false,
		expected === "template"
			? "Das Dokument ist ein Spielstand, keine Vorlage."
			: "Das Dokument ist eine Vorlage, kein Spielstand.",
	);
}
