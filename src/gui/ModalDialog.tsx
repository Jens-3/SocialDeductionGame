import { type ReactNode, useEffect, useRef } from "react";
import { useBackHandler } from "./backNavigation";

export type ModalDialogProps = {
	open: boolean;
	onClose: () => void;
	onBack?: () => void;
	children: ReactNode;
	className?: string;
	label?: string;
	labelledBy?: string;
	role?: "dialog" | "alertdialog";
};

const focusableSelector = [
	"button:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	"[href]",
	'[tabindex]:not([tabindex="-1"])',
].join(",");

export function ModalDialog({
	open,
	onClose,
	onBack = onClose,
	children,
	className,
	label,
	labelledBy,
	role = "dialog",
}: ModalDialogProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const backHandlerRef = useRef(onBack);
	useEffect(() => {
		backHandlerRef.current = onBack;
	}, [onBack]);
	useBackHandler(() => backHandlerRef.current(), open, 100);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog || !open) return;
		const previousFocus =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: undefined;

		if (typeof dialog.showModal === "function") dialog.showModal();
		else dialog.setAttribute("open", "");

		const initialFocus =
			dialog.querySelector<HTMLElement>("[data-modal-initial-focus]") ??
			dialog.querySelector<HTMLElement>(focusableSelector);
		(initialFocus ?? dialog).focus();

		return () => {
			if (dialog.open && typeof dialog.close === "function") dialog.close();
			else dialog.removeAttribute("open");
			if (previousFocus?.isConnected) previousFocus.focus();
		};
	}, [open]);

	return (
		<dialog
			ref={dialogRef}
			className={`modal-dialog${className ? ` ${className}` : ""}`}
			role={role}
			aria-modal="true"
			aria-label={label}
			aria-labelledby={labelledBy}
			tabIndex={-1}
			onCancel={(event) => {
				event.preventDefault();
				backHandlerRef.current();
			}}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					backHandlerRef.current();
				}
			}}
		>
			{children}
		</dialog>
	);
}
