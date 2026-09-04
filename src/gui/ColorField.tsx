import { useState } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { ModalDialog } from "./ModalDialog";

const DEFAULT_COLOR = "808080";

export function ColorField({
	color,
	onChange,
	labels,
}: {
	color: string | undefined;
	onChange: (color: string | undefined) => void;
	labels: {
		useColor: string;
		editColor: string;
		pickerTitle: string;
		colorCode: string;
		preview: string;
		close: string;
		ok: string;
		cancel: string;
	};
}) {
	const [pickerOpen, setPickerOpen] = useState(false);
	const [draftColor, setDraftColor] = useState(color ?? DEFAULT_COLOR);
	const guiColor = `#${draftColor}`;
	const openPicker = () => {
		setDraftColor(color ?? DEFAULT_COLOR);
		setPickerOpen(true);
	};
	const cancelPicker = () => setPickerOpen(false);
	const applyPicker = () => {
		onChange(draftColor);
		setPickerOpen(false);
	};
	const updateColor = (value: string) => {
		const normalized = value.replace(/^#/u, "").toUpperCase();
		if (/^[0-9A-F]{6}$/u.test(normalized)) setDraftColor(normalized);
	};

	return (
		<fieldset className="scenario-color-field">
			<label className="scenario-checkbox-field">
				<input
					type="checkbox"
					data-testid="scenario-object-use-color"
					checked={color !== undefined}
					onChange={(event) =>
						onChange(event.target.checked ? DEFAULT_COLOR : undefined)
					}
				/>
				{labels.useColor}
			</label>
			{color ? (
				<button
					type="button"
					data-testid="scenario-object-edit-color"
					className="scenario-color-summary"
					onClick={openPicker}
					aria-label={labels.editColor}
				>
					<code>#{color}</code>
					<span
						className="scenario-color-swatch"
						style={{ backgroundColor: `#${color}` }}
						role="img"
						aria-label={labels.preview}
					/>
				</button>
			) : null}
			{pickerOpen && color ? (
				<ModalDialog
					open
					onClose={cancelPicker}
					className="scenario-color-dialog"
					labelledBy="scenario-color-picker-title"
				>
					<header>
						<h2 id="scenario-color-picker-title">{labels.pickerTitle}</h2>
						<button
							type="button"
							className="sheet-close-button"
							aria-label={labels.close}
							onClick={cancelPicker}
						>
							×
						</button>
					</header>
					<HexColorPicker color={guiColor} onChange={updateColor} />
					<div className="scenario-color-code-field">
						<span id="scenario-color-code-label">{labels.colorCode}</span>
						<HexColorInput
							data-modal-initial-focus
							data-testid="scenario-object-color-code"
							aria-labelledby="scenario-color-code-label"
							prefixed
							color={guiColor}
							onChange={updateColor}
						/>
					</div>
					<footer className="scenario-color-dialog__actions">
						<button type="button" onClick={cancelPicker}>
							{labels.cancel}
						</button>
						<button
							type="button"
							data-testid="scenario-object-color-ok"
							onClick={applyPicker}
						>
							{labels.ok}
						</button>
					</footer>
				</ModalDialog>
			) : null}
		</fieldset>
	);
}
