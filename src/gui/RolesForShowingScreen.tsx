import { useState } from "react";
import type {
	RolesForShowingDraft,
	RolesForShowingEditorModel,
	RolesForShowingPresentation,
} from "../application/rolesForShowing";
import { sanitizeText } from "../shared/textSanitizer";
import { useBackHandler } from "./backNavigation";
import { createGuiTranslator } from "./i18n/translate";
import { ModalDialog } from "./ModalDialog";

export function RolesForShowingScreen({
	model,
	language = "de",
	onSave,
	onCancel,
	onCreatePresentation,
}: {
	model: RolesForShowingEditorModel;
	language?: string;
	onSave: (draft: RolesForShowingDraft) => void;
	onCancel: () => void;
	onCreatePresentation: (
		draft: RolesForShowingDraft,
	) => RolesForShowingPresentation;
}) {
	const t = createGuiTranslator(language);
	const [notice, setNotice] = useState(model.notice);
	const [roles, setRoles] = useState(model.roles);
	const [showRoleSymbols, setShowRoleSymbols] = useState(model.showRoleSymbols);
	const [isRoleSelectionOpen, setIsRoleSelectionOpen] = useState(false);
	const [presentation, setPresentation] =
		useState<RolesForShowingPresentation>();
	useBackHandler(
		() => (presentation ? setPresentation(undefined) : onCancel()),
		true,
		20,
	);
	const roleOptionsById = new Map(
		model.roleOptions.map((role) => [role.id, role]),
	);
	const roleOccurrences = new Map<string, number>();
	const draft = (): RolesForShowingDraft => ({
		notice,
		roles,
		showRoleSymbols,
	});
	const roleLabel = (
		role: { displayName: string; unicodeSymbol: string } | undefined,
		fallbackId: string,
	) => {
		const displayName = role?.displayName ?? fallbackId;
		return showRoleSymbols
			? `${role?.unicodeSymbol ?? "◆"} ${displayName}`
			: displayName;
	};

	if (presentation) {
		const rolesText = presentation.roleNames.join(", ");
		const presentationText = presentation.notice
			? `${presentation.notice}:\n${rolesText}`
			: rolesText;
		return (
			<main className="role-reveal-screen roles-for-showing-preview">
				<header className="roles-for-showing-preview__header">
					<button
						type="button"
						className="icon-button"
						onClick={() => setPresentation(undefined)}
						aria-label={t("common.back")}
					>
						‹
					</button>
				</header>
				<button
					type="button"
					className="role-reveal-content"
					onClick={() => setPresentation(undefined)}
					aria-label={t("rolesForShowing.closePreview")}
				>
					<p className="role-reveal-value">{presentationText}</p>
				</button>
			</main>
		);
	}

	return (
		<main className="app-shell form-shell">
			<section
				className="form-screen roles-for-showing-editor"
				aria-labelledby="roles-for-showing-title"
			>
				<header className="screen-header settings-header">
					<button
						type="button"
						className="icon-button"
						onClick={onCancel}
						aria-label={t("common.back")}
					>
						‹
					</button>
					<h1 id="roles-for-showing-title">{t("rolesForShowing.title")}</h1>
				</header>
				<label className="form-field">
					<span>{t("rolesForShowing.freeText")}</span>
					<textarea
						value={notice}
						onChange={(event) => setNotice(sanitizeText(event.target.value))}
					/>
				</label>
				<section aria-labelledby="selected-showing-roles-title">
					<h2 id="selected-showing-roles-title">
						{t("rolesForShowing.roles")}
					</h2>
					{roles.length > 0 ? (
						<ul className="roles-for-showing-list">
							{roles.map((roleId, index) => {
								const role = roleOptionsById.get(roleId);
								const displayName = roleLabel(role, roleId);
								const occurrence = (roleOccurrences.get(roleId) ?? 0) + 1;
								roleOccurrences.set(roleId, occurrence);
								return (
									<li
										key={`${roleId}-${occurrence}`}
										className="roles-for-showing-list__item"
									>
										<span>{displayName}</span>
										<button
											type="button"
											className="danger-action"
											aria-label={t("rolesForShowing.removeRole", {
												name: displayName,
											})}
											onClick={() =>
												setRoles((current) =>
													current.filter(
														(_, currentIndex) => currentIndex !== index,
													),
												)
											}
										>
											<span aria-hidden="true">🗑</span>
										</button>
									</li>
								);
							})}
						</ul>
					) : (
						<p className="empty-state">{t("rolesForShowing.empty")}</p>
					)}
					<button type="button" onClick={() => setIsRoleSelectionOpen(true)}>
						{t("rolesForShowing.addRole")}
					</button>
					<label className="setting-row roles-for-showing-symbol-toggle">
						<span>{t("rolesForShowing.showSymbol")}</span>
						<span className="roles-for-showing-symbol-toggle__control">
							<small>{t(showRoleSymbols ? "common.yes" : "common.no")}</small>
							<input
								type="checkbox"
								className="switch-input"
								aria-label={t("rolesForShowing.showSymbol")}
								checked={showRoleSymbols}
								onChange={(event) => setShowRoleSymbols(event.target.checked)}
							/>
						</span>
					</label>
				</section>
				<div className="roles-for-showing-actions">
					<div>
						<button type="button" onClick={() => onSave(draft())}>
							{t("common.save")}
						</button>
						<button type="button" onClick={onCancel}>
							{t("common.cancel")}
						</button>
					</div>
					<button
						type="button"
						className="primary-form-button"
						onClick={() => setPresentation(onCreatePresentation(draft()))}
					>
						{t("rolesForShowing.preview")}
					</button>
				</div>
				{isRoleSelectionOpen ? (
					<ModalDialog
						open
						onClose={() => setIsRoleSelectionOpen(false)}
						className="action-sheet roles-for-showing-selection"
						labelledBy="roles-for-showing-selection-title"
					>
						<header>
							<h2 id="roles-for-showing-selection-title">
								{t("rolesForShowing.addRoleTitle")}
							</h2>
							<button
								type="button"
								className="sheet-close-button"
								onClick={() => setIsRoleSelectionOpen(false)}
								aria-label={t("common.close")}
							>
								×
							</button>
						</header>
						<div className="roles-for-showing-options">
							{model.roleOptions.map((role, index) => (
								<div key={role.id}>
									{role.teamName &&
									(index === 0 ||
										model.roleOptions[index - 1]?.teamName !==
											role.teamName) ? (
										<h3>{role.teamName}</h3>
									) : null}
									<button
										type="button"
										onClick={() => {
											setRoles((current) => [...current, role.id]);
											setIsRoleSelectionOpen(false);
										}}
									>
										{roleLabel(role, role.id)}
									</button>
								</div>
							))}
						</div>
					</ModalDialog>
				) : null}
			</section>
		</main>
	);
}
