import { useState } from "react";
import type { ApplicationObjectReadProblem } from "../application/gameUseCases";
import type {
	LibraryLoadProblem,
	LibraryRepairReport,
} from "../application/libraryUseCases";
import type {
	ObjectRecoveryResolution,
	StorageRecoverySummary,
} from "../application/storageRecovery";
import {
	contentProblemText,
	libraryLoadProblemText,
	objectReadProblemText,
} from "./applicationFailurePresentation";
import type { GuiTranslator } from "./i18n/translate";
import { libraryRepairChangeText } from "./libraryRepairPresentation";
import { ModalDialog } from "./ModalDialog";

export function WriteRecoveryDialog({
	t,
	recovery,
	remainingCount,
	matchingCount,
	onResolve,
	onExport,
	onLater,
}: {
	t: GuiTranslator;
	recovery: StorageRecoverySummary;
	remainingCount: number;
	matchingCount: number;
	onResolve: (resolution: ObjectRecoveryResolution, remember: boolean) => void;
	onExport: () => void;
	onLater: (remember: boolean) => void;
}) {
	const [remember, setRemember] = useState(false);
	const kindLabel = t(`recovery.kind.${recovery.kind}`);
	const recoveryFileLabel =
		recovery.recoverySource === "backup"
			? t("recovery.backupFile")
			: t("recovery.temporaryFile");
	return (
		<ModalDialog
			open
			onClose={() => onLater(remember)}
			className="action-sheet"
			role="alertdialog"
			labelledBy="write-recovery-title"
		>
			<h2 id="write-recovery-title">
				{t("recovery.incompleteSave")}
				{remainingCount > 1
					? t("recovery.openCount", { count: remainingCount })
					: ""}
			</h2>
			{recovery.reason === "orphanedRecovery" ? (
				<p>
					{t("recovery.orphanedFile", {
						recoveryFile: recoveryFileLabel,
						kind: kindLabel,
					})}
				</p>
			) : (
				<p>{t("recovery.twoFiles", { kind: kindLabel, id: recovery.id })}</p>
			)}
			{recovery.validationProblem ? (
				<p className="load-error">
					{contentProblemText(recovery.validationProblem, t)}
				</p>
			) : null}
			<RememberDecisionCheckbox
				t={t}
				visible={matchingCount > 1}
				checked={remember}
				onChange={setRemember}
			/>
			<div className="exit-dialog-actions">
				<button
					type="button"
					data-modal-initial-focus
					onClick={() => onResolve("keepOld", remember)}
				>
					{t("recovery.keepOld")}
				</button>
				<button
					type="button"
					disabled={!recovery.canKeepNew}
					className={!recovery.canKeepNew ? "button-disabled" : undefined}
					onClick={() => onResolve("keepNew", remember)}
				>
					{t("recovery.keepNew")}
				</button>
				<button
					type="button"
					disabled={!recovery.canKeepNew}
					className={!recovery.canKeepNew ? "button-disabled" : undefined}
					onClick={() => onResolve("keepBoth", remember)}
				>
					{t("recovery.keepBothFiles")}
				</button>
				<button
					type="button"
					disabled={!recovery.hasNew}
					className={!recovery.hasNew ? "button-disabled" : undefined}
					onClick={onExport}
				>
					{t("recovery.exportBrokenFile")}
				</button>
				<button type="button" onClick={() => onLater(remember)}>
					{t("recovery.decideLater")}
				</button>
			</div>
		</ModalDialog>
	);
}

export function ObjectReadProblemDialog({
	t,
	problem,
	busy,
	error,
	remainingCount,
	matchingCount,
	onResolve,
}: {
	t: GuiTranslator;
	problem: ApplicationObjectReadProblem;
	busy: boolean;
	error?: string;
	remainingCount: number;
	matchingCount: number;
	onResolve: (
		action:
			| "retry"
			| "export"
			| "delete"
			| "repair"
			| "repairFileName"
			| "keepBoth"
			| "later",
		remember: boolean,
	) => void;
}) {
	const [remember, setRemember] = useState(false);
	const canRetry = problem.availableActions.includes("retry");
	const canRepair = problem.availableActions.includes("repair");
	const canRepairFileName = problem.availableActions.includes("repairFileName");
	const canKeepBoth = problem.availableActions.includes("keepBoth");
	const canExport = problem.availableActions.includes("export");
	const canDelete = problem.availableActions.includes("delete");
	const canDefer = problem.availableActions.includes("later");
	const objectReference =
		"storageKey" in problem ? problem.storageKey : problem.id;
	const kindLabel = t(`recovery.kind.${problem.kind}`);
	return (
		<ModalDialog
			open
			onClose={() => {
				if (!busy && canDefer) onResolve("later", remember);
			}}
			className="action-sheet"
			role="alertdialog"
			labelledBy="object-read-problem-title"
		>
			<h2 id="object-read-problem-title">
				{t("recovery.invalidObjectTitle")}
				{remainingCount > 1
					? t("recovery.openCount", { count: remainingCount })
					: ""}
			</h2>
			<p>{objectReadProblemReason(problem, t)}</p>
			<p>
				{t("recovery.affectedObject", {
					kind: kindLabel,
					reference: objectReference,
				})}
			</p>
			<p className="text-secondary">{objectReadProblemText(problem, t)}</p>
			{problem.kind !== "ruleSet" && problem.reason === "invalidFileName" ? (
				<p>
					{t("recovery.file")}: <code>{problem.storageKey}.json</code>
					{problem.suggestedFileName ? (
						<>
							<br />
							{t("recovery.suggestedFileName")}:{" "}
							<code>{problem.suggestedFileName}</code>
						</>
					) : null}
				</p>
			) : null}
			<RememberDecisionCheckbox
				t={t}
				visible={matchingCount > 1}
				checked={remember}
				onChange={setRemember}
			/>
			<div className="exit-dialog-actions">
				{canRetry ? (
					<button
						type="button"
						data-modal-initial-focus
						disabled={busy}
						onClick={() => onResolve("retry", remember)}
					>
						{t("common.retry")}
					</button>
				) : null}
				{canRepair ? (
					<button
						type="button"
						data-modal-initial-focus
						disabled={busy}
						onClick={() => onResolve("repair", remember)}
					>
						{t("recovery.repairObject")}
					</button>
				) : null}
				{canRepairFileName ? (
					<button
						type="button"
						data-modal-initial-focus
						disabled={busy}
						onClick={() => onResolve("repairFileName", remember)}
					>
						{t("recovery.repairFileName")}
					</button>
				) : null}
				{canKeepBoth ? (
					<button
						type="button"
						data-modal-initial-focus
						disabled={busy}
						onClick={() => onResolve("keepBoth", remember)}
					>
						{t("common.keepBoth")}
					</button>
				) : null}
				{canExport ? (
					<button
						type="button"
						{...(!canRepair && !canRepairFileName && !canKeepBoth
							? { "data-modal-initial-focus": true }
							: {})}
						disabled={busy}
						onClick={() => onResolve("export", remember)}
					>
						{t("recovery.exportObject")}
					</button>
				) : null}
				{canDelete ? (
					<button
						type="button"
						disabled={busy}
						className="danger-action"
						onClick={() => onResolve("delete", remember)}
					>
						{t("recovery.deleteObject")}
					</button>
				) : null}
				{canDefer ? (
					<button
						type="button"
						disabled={busy}
						onClick={() => onResolve("later", remember)}
					>
						{t("recovery.decideLater")}
					</button>
				) : null}
			</div>
			{error ? (
				<p className="load-error" role="alert">
					{error}
				</p>
			) : null}
		</ModalDialog>
	);
}

function objectReadProblemReason(
	problem: ApplicationObjectReadProblem,
	t: GuiTranslator,
): string {
	if (problem.kind === "ruleSet") return t("recovery.reason.invalidRuleSet");
	if (problem.reason === "invalidFileName")
		return t("recovery.reason.invalidFileName");
	if (problem.reason === "decodeFailed")
		return t("recovery.reason.decodeFailed");
	if (problem.reason === "invalidJson") return t("recovery.reason.invalidJson");
	return problem.kind === "template"
		? t("recovery.reason.invalidTemplate")
		: t("recovery.reason.invalidGame");
}

function RememberDecisionCheckbox({
	t,
	visible,
	checked,
	onChange,
}: {
	t: GuiTranslator;
	visible: boolean;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	if (!visible) return null;
	return (
		<label className="remember-decision-option">
			<input
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.currentTarget.checked)}
			/>
			<span>{t("recovery.rememberDecision")}</span>
		</label>
	);
}

function libraryProblemReason(
	problem: LibraryLoadProblem,
	t: GuiTranslator,
): string {
	if (problem.reason === "missingLibrary") return t("recovery.library.missing");
	if (problem.reason === "orphanedRecovery")
		return problem.recoverySource === "temporary"
			? t("recovery.library.orphanedTemporary")
			: t("recovery.library.orphanedBackup");
	if (problem.reason === "decodeFailed")
		return t("recovery.library.decodeFailed");
	if (problem.reason === "invalidJson")
		return t("recovery.library.invalidJson");
	if (problem.invalidDocumentKind === "ruleSet")
		return t("recovery.library.invalidRuleSet");
	return t("recovery.library.invalidDocument");
}

export function LibraryLoadProblemDialog({
	t,
	problem,
	busy,
	error,
	remainingCount,
	matchingCount,
	onResolve,
	onExport,
}: {
	t: GuiTranslator;
	problem: LibraryLoadProblem;
	busy: boolean;
	error?: string;
	remainingCount: number;
	matchingCount: number;
	onResolve: (
		action: "restoreBackup" | "repair" | "createEmpty" | "later",
		remember: boolean,
	) => void;
	onExport: () => void;
}) {
	const [remember, setRemember] = useState(false);
	return (
		<ModalDialog
			open
			onClose={() => {
				if (!busy) onResolve("later", remember);
			}}
			className="action-sheet"
			role="alertdialog"
			labelledBy="library-load-problem-title"
		>
			<h2 id="library-load-problem-title">
				{t("recovery.library.title")}
				{remainingCount > 1
					? t("recovery.openCount", { count: remainingCount })
					: ""}
			</h2>
			<p>{libraryProblemReason(problem, t)}</p>
			<p className="text-secondary">{libraryLoadProblemText(problem, t)}</p>
			<RememberDecisionCheckbox
				t={t}
				visible={matchingCount > 1}
				checked={remember}
				onChange={setRemember}
			/>
			<div className="exit-dialog-actions">
				<button
					type="button"
					data-modal-initial-focus
					disabled={busy || !problem.canRestoreBackup}
					className={!problem.canRestoreBackup ? "button-disabled" : undefined}
					title={
						problem.backupProblem
							? contentProblemText(problem.backupProblem, t)
							: undefined
					}
					onClick={() => onResolve("restoreBackup", remember)}
				>
					{t("recovery.library.restoreBackup")}
				</button>
				<button
					type="button"
					disabled={busy || !problem.canRepair}
					className={!problem.canRepair ? "button-disabled" : undefined}
					title={
						problem.repairProblem
							? contentProblemText(problem.repairProblem, t)
							: undefined
					}
					onClick={() => onResolve("repair", remember)}
				>
					{t("recovery.library.repair")}
				</button>
				<button
					type="button"
					disabled={busy}
					onClick={() => onResolve("createEmpty", remember)}
				>
					{t("recovery.library.createEmpty")}
				</button>
				<button
					type="button"
					disabled={busy || !problem.canExport}
					className={!problem.canExport ? "button-disabled" : undefined}
					onClick={onExport}
				>
					{t("recovery.library.export")}
				</button>
				<button
					type="button"
					disabled={busy}
					onClick={() => onResolve("later", remember)}
				>
					{t("recovery.decideLater")}
				</button>
			</div>
			{error ? (
				<p className="load-error" role="alert">
					{error}
				</p>
			) : null}
		</ModalDialog>
	);
}

export function LibraryRepairReportDialog({
	report,
	t,
	onClose,
}: {
	report: LibraryRepairReport;
	t: GuiTranslator;
	onClose: () => void;
}) {
	return (
		<ModalDialog
			open
			onClose={onClose}
			className="action-sheet"
			labelledBy="library-repair-report-title"
		>
			<h2 id="library-repair-report-title">{t("repairReport.title")}</h2>
			<p>
				{t("repairReport.acceptedRuleSets", {
					count: report.repairedRuleSetCount,
				})}
			</p>
			{report.changes.length > 0 ? (
				<ul className="recovery-report-list">
					{report.changes.map((change) => (
						<li key={JSON.stringify(change)}>
							{libraryRepairChangeText(change, t)}
						</li>
					))}
				</ul>
			) : null}
			{report.removedRuleSets.length > 0 ? (
				<>
					<h3>{t("repairReport.removedRuleSets")}</h3>
					<ul className="recovery-report-list">
						{report.removedRuleSets.map((removed) => (
							<li key={removed.storedId}>
								<strong>{removed.name ?? removed.storedId}</strong>:{" "}
								{t(
									removed.reason === "notAnObject"
										? "repairReport.removed.notAnObject"
										: "repairReport.removed.repairFailed",
								)}
							</li>
						))}
					</ul>
				</>
			) : null}
			<button type="button" data-modal-initial-focus onClick={onClose}>
				{t("common.close")}
			</button>
		</ModalDialog>
	);
}
