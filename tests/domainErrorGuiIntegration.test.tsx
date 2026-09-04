// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultAppSettings } from "../src/application/appSettings";
import { GamePreparationService } from "../src/application/gamePreparationService";
import type { GameUseCases } from "../src/application/gameUseCases";
import { ScenarioEditorFactory } from "../src/application/scenarioEditor";
import type { GameDraft } from "../src/domain/gameDraft";
import { type AppProps, App as ProductionApp } from "../src/gui/App";
import type { DataFileStorage } from "../src/persistence/ports/dataFileStorage";
import { createGameExportDocument } from "../src/serialization/gameExport";
import { fixedDomainServices } from "./fixedClock";
import { createTestGame } from "./fixtures";
import { GameTestFacade } from "./gameTestFacade";

const domainMock = vi.hoisted(() => ({
	unexpectedGameId: undefined as string | undefined,
	unexpectedError: undefined as Error | undefined,
}));

vi.mock("../src/domain/gameValidation", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../src/domain/gameValidation")>();
	return {
		...actual,
		hydrateGameState: (
			source: Parameters<typeof actual.hydrateGameState>[0],
		) => {
			if (
				source.id === domainMock.unexpectedGameId &&
				domainMock.unexpectedError
			)
				throw domainMock.unexpectedError;
			return actual.hydrateGameState(source);
		},
	};
});

class DomainErrorGameService extends GameTestFacade {}

const germanTestSettings = { ...defaultAppSettings, language: "de" };

function App({ initialSettings = germanTestSettings, ...props }: AppProps) {
	return <ProductionApp {...props} initialSettings={initialSettings} />;
}

afterEach(() => {
	domainMock.unexpectedGameId = undefined;
	domainMock.unexpectedError = undefined;
	cleanup();
	localStorage.clear();
});

describe("Domainfehler an der Application-/GUI-Grenze", () => {
	it.each([
		{
			label: "eine ungültige eingebettete Rollen-ID",
			id: "game_invalid_role_id",
			mutate: (draft: GameDraft) => {
				const role = draft.ruleSetSnapshot.roles[0];
				if (!role) throw new Error("Testrolle fehlt.");
				role.id = "Ungültige Rollen-ID";
			},
			repairable: true,
			componentKind: "ruleSet" as const,
			expectedText: "Das gespeicherte Regelwerk hat keine gültige Struktur.",
		},
		{
			label: "eine verwaiste Sitzordnungsreferenz",
			id: "game_orphaned_seat_reference",
			mutate: (draft: GameDraft) => {
				draft.seatOrder = ["p_missing"];
			},
			repairable: true,
			componentKind: undefined,
			expectedText: "Das gespeicherte Objekt ist fachlich ungültig.",
		},
		{
			label: "eine unbekannte Spielphase",
			id: "game_invalid_phase",
			mutate: (draft: GameDraft) => {
				draft.time.phase = "dämmerung";
			},
			repairable: false,
			componentKind: undefined,
			expectedText: "Das gespeicherte Objekt ist fachlich ungültig.",
		},
	])(
		"reicht $label strukturiert bis zur GUI weiter",
		async ({ id, mutate, repairable, componentKind, expectedText }) => {
			const draft = createDraft(id);
			mutate(draft);
			const service = new DomainErrorGameService(storageFor(draft));

			const result = await service.listObjects("game");
			expect(result.status).toBe("loaded");
			if (result.status !== "loaded")
				throw new Error("Der erwartete Listensnapshot fehlt.");
			expect(result.problems).toHaveLength(1);
			const problem = result.problems[0];
			expect(problem).toMatchObject({
				category: "domain",
				reason: "invalidObject",
				repairable,
			});
			if (componentKind)
				expect(problem).toHaveProperty("componentKind", componentKind);
			else expect(problem).not.toHaveProperty("componentKind");
			expect(problem?.availableActions.includes("repair")).toBe(repairable);

			render(<App gameUseCases={asGameUseCases(service)} />);
			fireEvent.click(screen.getByRole("button", { name: "Spielstand laden" }));

			const dialog = await screen.findByRole("alertdialog", {
				name: "Fehlerhaftes gespeichertes Objekt erkannt",
			});
			expect(dialog.textContent).toContain(id);
			expect(dialog.textContent).toContain(expectedText);
			if (repairable)
				expect(
					within(dialog).getByRole("button", { name: "Objekt reparieren" }),
				).toBeDefined();
			else
				expect(
					within(dialog).queryByRole("button", {
						name: "Objekt reparieren",
					}),
				).toBeNull();
		},
	);

	it("begrenzt einen unbekannten Domainfehler an der technischen GUI-Fehleranzeige", async () => {
		const id = "game_unexpected_domain_error";
		const unexpected = new Error("Unerwarteter Fehler im Domaincode.");
		domainMock.unexpectedGameId = id;
		domainMock.unexpectedError = unexpected;
		const service = new DomainErrorGameService(storageFor(createDraft(id)));

		const applicationError = await service
			.listObjects("game")
			.catch((error: unknown) => error);
		expect(applicationError).toMatchObject({
			name: "ApplicationOperationError",
			code: "APPLICATION_UNEXPECTED_ERROR",
			source: "unknown",
			expectation: "unexpected",
			severity: "critical",
			reason: "unexpectedFailure",
			diagnostic: unexpected.message,
			cause: unexpected,
		});

		render(<App gameUseCases={asGameUseCases(service)} />);
		fireEvent.click(screen.getByRole("button", { name: "Spielstand laden" }));

		const bannerText = await screen.findByText(
			"Dateien konnten nicht geprüft werden. Unerwarteter Anwendungsfehler. Bitte melden Sie diesen Fehler.",
		);
		expect(bannerText.textContent).not.toContain(unexpected.message);
		expect(bannerText.closest('[role="alert"]')).not.toBeNull();
		expect(
			screen.queryByRole("alertdialog", {
				name: "Fehlerhaftes gespeichertes Objekt erkannt",
			}),
		).toBeNull();
	});
});

function createDraft(id: string): GameDraft {
	const draft = createGameExportDocument(createTestGame(1));
	draft.id = id;
	return draft;
}

function storageFor(draft: GameDraft): DataFileStorage {
	const bytes = new TextEncoder().encode(JSON.stringify(draft));
	return {
		readAllInternal: (category) =>
			Promise.resolve(
				category === "game"
					? [
							{
								category,
								fileName: `${draft.id}.json`,
								bytes,
							},
						]
					: [],
			),
		readInternal: () => Promise.resolve({ status: "success", bytes }),
	};
}

function asGameUseCases(service: DomainErrorGameService): GameUseCases {
	return {
		editor: new ScenarioEditorFactory(),
		objectProblems: service.objectProblems,
		preparation: new GamePreparationService(fixedDomainServices),
		session: service,
		persistence: service,
	};
}
