import { useMemo, useState } from "react";

import {
	createRoleDistributionModel,
	type GameState,
	type RoleDistributionMode,
} from "../application/gamePreparationPresentation";
import { guiErrorText } from "./applicationFailurePresentation";
import { useBackHandler } from "./backNavigation";
import { createGuiTranslator, type GuiTranslator } from "./i18n/translate";
import { ModalDialog } from "./ModalDialog";

export function RoleDistributionFlow({
	game,
	onBack,
	onManual,
	onDistribute,
	initializeFromAssignments = false,
	confirmOverwrite = false,
	title,
	language = "de",
}: {
	game: GameState;
	onBack: () => void;
	onManual?: () => void;
	onDistribute: (
		mode: RoleDistributionMode,
		counts: Record<string, number>,
	) => void;
	initializeFromAssignments?: boolean;
	confirmOverwrite?: boolean;
	title?: string;
	language?: string;
}) {
	const t = createGuiTranslator(language);
	const resolvedTitle = title ?? t("roleDistribution.title");
	const model = useMemo(
		() => createRoleDistributionModel(game, language),
		[game, language],
	);
	const [step, setStep] = useState<"distribution" | RoleDistributionMode>(
		"distribution",
	);
	const [teamCounts, setTeamCounts] = useState<Record<string, number>>(() =>
		initializeFromAssignments ? model.currentTeamCounts : {},
	);
	const [roleCounts, setRoleCounts] = useState<Record<string, number>>(() =>
		initializeFromAssignments ? model.currentRoleCounts : {},
	);
	const [error, setError] = useState<string>();
	const [pendingDistribution, setPendingDistribution] =
		useState<RoleDistributionMode>();
	useBackHandler(
		() => (step === "distribution" ? onBack() : setStep("distribution")),
		true,
		20,
	);
	const distribute = (mode: RoleDistributionMode) => {
		if (confirmOverwrite && model.hasAssignedRoles) {
			setPendingDistribution(mode);
			return;
		}
		performDistribution(mode);
	};
	const performDistribution = (mode: RoleDistributionMode) => {
		setError(undefined);
		try {
			onDistribute(mode, mode === "teams" ? teamCounts : roleCounts);
			setPendingDistribution(undefined);
		} catch (cause) {
			setError(guiErrorText(cause, t));
		}
	};

	if (step === "teams") {
		return (
			<CountSelectionScreen
				title={t("roleDistribution.teamDistribution")}
				t={t}
				onBack={() => setStep("distribution")}
				playerCount={model.playerCount}
				counts={teamCounts}
				error={error}
				items={model.teams}
				onChange={setTeamCounts}
				onDistribute={() => distribute("teams")}
				confirmation={renderConfirmation()}
			/>
		);
	}

	if (step === "roles") {
		return (
			<CountSelectionScreen
				title={t("roleDistribution.roleSelection")}
				t={t}
				onBack={() => setStep("distribution")}
				playerCount={model.playerCount}
				counts={roleCounts}
				error={error}
				items={model.roles.map((role) => ({
					id: role.id,
					name: `${role.unicodeSymbol ?? "◆"} ${role.name}`,
					group: role.group,
					warn: role.isUnique && (roleCounts[role.id] ?? 0) > 1,
				}))}
				onChange={setRoleCounts}
				onDistribute={() => distribute("roles")}
				confirmation={renderConfirmation()}
			/>
		);
	}

	return (
		<PreparationShell title={resolvedTitle} onBack={onBack} t={t}>
			<nav
				className="preparation-options"
				aria-label={t("roleDistribution.type")}
			>
				<PreparationOption
					title={t("roleDistribution.random.title")}
					detail={t("roleDistribution.random.detail")}
					onClick={() => setStep("teams")}
				/>
				<PreparationOption
					title={t("roleDistribution.selected.title")}
					detail={t("roleDistribution.selected.detail")}
					onClick={() => setStep("roles")}
				/>
				{onManual ? (
					<PreparationOption
						testId="role-distribution-manual"
						title={t("roleDistribution.manual.title")}
						detail={t("roleDistribution.manual.detail")}
						onClick={onManual}
					/>
				) : null}
			</nav>
		</PreparationShell>
	);

	function renderConfirmation() {
		return pendingDistribution ? (
			<ModalDialog
				open
				onClose={() => setPendingDistribution(undefined)}
				className="scenario-exit-dialog"
				role="alertdialog"
				labelledBy="role-distribution-warning-title"
			>
				<p id="role-distribution-warning-title">
					{model.isRunning
						? t("roleDistribution.overwriteRunning")
						: t("roleDistribution.overwriteAssigned")}
				</p>
				<div>
					<button
						type="button"
						onClick={() => performDistribution(pendingDistribution)}
					>
						{t("roleDistribution.redistribute")}
					</button>
					<button
						type="button"
						data-modal-initial-focus
						onClick={() => setPendingDistribution(undefined)}
					>
						{t("common.cancel")}
					</button>
				</div>
			</ModalDialog>
		) : null;
	}
}

function CountSelectionScreen({
	t,
	title,
	onBack,
	playerCount,
	counts,
	items,
	error,
	onChange,
	onDistribute,
	confirmation,
}: {
	t: GuiTranslator;
	title: string;
	onBack: () => void;
	playerCount: number;
	counts: Record<string, number>;
	items: Array<{ id: string; name: string; group?: string; warn?: boolean }>;
	error?: string;
	onChange: (counts: Record<string, number>) => void;
	onDistribute: () => void;
	confirmation?: React.ReactNode;
}) {
	const assigned = Object.values(counts).reduce((sum, count) => sum + count, 0);
	const free = playerCount - assigned;
	return (
		<PreparationShell title={title} onBack={onBack} t={t}>
			<div className="count-selection-list">
				{items.map((item, index) => (
					<div key={item.id}>
						{item.group &&
						(index === 0 || items[index - 1]?.group !== item.group) ? (
							<h2>{item.group}</h2>
						) : null}
						<div className="count-selection-row">
							<span>
								{item.name}{" "}
								{item.warn ? (
									<span
										role="img"
										aria-label={t("roleDistribution.uniqueRoleMultiple")}
									>
										⚠
									</span>
								) : null}
							</span>
							<div>
								<button
									type="button"
									aria-label={t("roleDistribution.decrease", {
										name: item.name,
									})}
									onClick={() =>
										onChange({
											...counts,
											[item.id]: Math.max(0, (counts[item.id] ?? 0) - 1),
										})
									}
								>
									−
								</button>
								<output
									aria-label={t("roleDistribution.count", { name: item.name })}
								>
									{counts[item.id] ?? 0}
								</output>
								<button
									type="button"
									aria-label={t("roleDistribution.increase", {
										name: item.name,
									})}
									onClick={() =>
										onChange({
											...counts,
											[item.id]: (counts[item.id] ?? 0) + 1,
										})
									}
								>
									+
								</button>
							</div>
						</div>
					</div>
				))}
			</div>
			<p
				className={`free-player-count free-player-count--${free === 0 ? "complete" : free < 0 ? "negative" : "positive"}`}
			>
				{t("roleDistribution.freePlayers")}: <strong>{free}</strong>
			</p>
			{error ? <p className="load-error">{error}</p> : null}
			<button
				type="button"
				className={`primary-form-button${free !== 0 ? " button-disabled" : ""}`}
				disabled={free !== 0}
				onClick={onDistribute}
			>
				{t("roleDistribution.distribute")}
			</button>
			{confirmation}
		</PreparationShell>
	);
}

function PreparationShell({
	t,
	title,
	onBack,
	children,
}: {
	t: GuiTranslator;
	title: string;
	onBack: () => void;
	children: React.ReactNode;
}) {
	return (
		<main className="app-shell form-shell">
			<section className="form-screen">
				<header className="screen-header settings-header">
					<button type="button" className="icon-button" onClick={onBack}>
						<span aria-hidden="true">‹</span>
						<span className="visually-hidden">{t("common.back")}</span>
					</button>
					<h1 id="preparation-title">{title}</h1>
				</header>
				{children}
			</section>
		</main>
	);
}

function PreparationOption({
	testId,
	title,
	detail,
	onClick,
}: {
	testId?: string;
	title: string;
	detail: string;
	onClick: () => void;
}) {
	return (
		<button
			data-testid={testId}
			type="button"
			className="choice-card preparation-option interactive-surface"
			onClick={onClick}
		>
			<span>
				<strong>{title}</strong>
				<small>{detail}</small>
			</span>
		</button>
	);
}
