// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LibraryLoadProblem } from "../src/application/libraryUseCases";
import type { ApplicationObjectReadProblem } from "../src/application/objectList";
import type { StorageRecoverySummary } from "../src/application/storageRecovery";
import { createGuiTranslator } from "../src/gui/i18n/translate";
import {
	LibraryLoadProblemDialog,
	LibraryRepairReportDialog,
	ObjectReadProblemDialog,
	WriteRecoveryDialog,
} from "../src/gui/LoadProblemDialogs";

afterEach(cleanup);

const t = createGuiTranslator("de");

const objectProblem = {
	problemId: "object:game:broken",
	source: "serialization",
	operation: "load",
	subject: "game",
	reference: { kind: "game", storageKey: "game_broken", id: "game_broken" },
	scope: "object",
	category: "serialization",
	kind: "game",
	storageKey: "game_broken",
	id: "game_broken",
	reason: "invalidJson",
	retryable: false,
	repairable: true,
	canExport: true,
	availableActions: ["repair", "export", "later"],
} as ApplicationObjectReadProblem;

describe("LoadProblemDialogs", () => {
	it("zeigt nur verfügbare Objektaktionen und reicht die Merken-Auswahl weiter", () => {
		const onResolve = vi.fn();
		render(
			<ObjectReadProblemDialog
				t={t}
				problem={objectProblem}
				busy={false}
				remainingCount={2}
				matchingCount={2}
				onResolve={onResolve}
			/>,
		);

		expect(
			screen.getByRole("button", { name: t("recovery.repairObject") }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: t("recovery.exportObject") }),
		).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: t("recovery.deleteObject") }),
		).toBeNull();
		fireEvent.click(screen.getByRole("checkbox"));
		fireEvent.click(
			screen.getByRole("button", { name: t("recovery.repairObject") }),
		);

		expect(onResolve).toHaveBeenCalledWith("repair", true);
	});

	it("zeigt einen Fehler an und sperrt Objektaktionen während der Verarbeitung", () => {
		render(
			<ObjectReadProblemDialog
				t={t}
				problem={objectProblem}
				busy
				error="Reparatur fehlgeschlagen"
				remainingCount={1}
				matchingCount={1}
				onResolve={vi.fn()}
			/>,
		);

		expect(screen.getByRole("alert").textContent).toBe(
			"Reparatur fehlgeschlagen",
		);
		expect(
			screen
				.getAllByRole("button")
				.every((button) => button.hasAttribute("disabled")),
		).toBe(true);
		expect(screen.queryByRole("checkbox")).toBeNull();
	});

	it("deaktiviert nicht mögliche Schreib-Recovery-Aktionen", () => {
		const recovery = {
			status: "decisionRequired",
			decisionKind: "writeRecovery",
			commandId: "command-1",
			recoveryKey: "game:broken",
			id: "broken",
			kind: "game",
			hasNew: false,
			canKeepNew: false,
			availableActions: ["keepOld", "later"],
			reason: "orphanedRecovery",
			recoverySource: "backup",
		} as StorageRecoverySummary;
		const onLater = vi.fn();
		render(
			<WriteRecoveryDialog
				t={t}
				recovery={recovery}
				remainingCount={1}
				matchingCount={1}
				onResolve={vi.fn()}
				onExport={vi.fn()}
				onLater={onLater}
			/>,
		);

		expect(
			screen.getByRole("button", { name: t("recovery.keepNew") }),
		).toHaveProperty("disabled", true);
		expect(
			screen.getByRole("button", { name: t("recovery.keepBothFiles") }),
		).toHaveProperty("disabled", true);
		expect(
			screen.getByRole("button", { name: t("recovery.exportBrokenFile") }),
		).toHaveProperty("disabled", true);
		fireEvent.click(
			screen.getByRole("button", { name: t("recovery.decideLater") }),
		);
		expect(onLater).toHaveBeenCalledWith(false);
	});

	it("deaktiviert nicht mögliche Library-Aktionen und lässt später entscheiden", () => {
		const problem = {
			problemId: "library:broken",
			source: "serialization",
			operation: "load",
			subject: "library",
			reference: { kind: "library" },
			reason: "invalidJson",
			hasReadableOriginal: false,
			hasReadableBackup: false,
			canRestoreBackup: false,
			canRepair: false,
			canExport: false,
			availableActions: ["createEmpty", "later"],
		} as LibraryLoadProblem;
		const onResolve = vi.fn();
		render(
			<LibraryLoadProblemDialog
				t={t}
				problem={problem}
				busy={false}
				remainingCount={1}
				matchingCount={1}
				onResolve={onResolve}
				onExport={vi.fn()}
			/>,
		);

		expect(
			screen.getByRole("button", { name: t("recovery.library.restoreBackup") }),
		).toHaveProperty("disabled", true);
		expect(
			screen.getByRole("button", { name: t("recovery.library.repair") }),
		).toHaveProperty("disabled", true);
		expect(
			screen.getByRole("button", { name: t("recovery.library.export") }),
		).toHaveProperty("disabled", true);
		fireEvent.click(
			screen.getByRole("button", { name: t("recovery.decideLater") }),
		);
		expect(onResolve).toHaveBeenCalledWith("later", false);
	});

	it("stellt Reparaturänderungen und entfernte Regelwerke dar", () => {
		const onClose = vi.fn();
		render(
			<LibraryRepairReportDialog
				t={t}
				report={{
					repairedRuleSetCount: 1,
					changes: [{ kind: "addedClosingBraces", count: 2 }],
					removedRuleSets: [
						{ storedId: "broken", name: "Defekt", reason: "repairFailed" },
					],
				}}
				onClose={onClose}
			/>,
		);

		expect(screen.getByText("Defekt")).toBeTruthy();
		expect(screen.getAllByRole("listitem")).toHaveLength(2);
		fireEvent.click(screen.getByRole("button", { name: t("common.close") }));
		expect(onClose).toHaveBeenCalledOnce();
	});
});
