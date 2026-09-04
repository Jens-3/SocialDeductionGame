// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { BackNavigationProvider } from "../src/gui/backNavigation";
import { ColorField } from "../src/gui/ColorField";

afterEach(cleanup);

function TestColorField({ initialColor }: { initialColor?: string }) {
	const [color, setColor] = useState<string | undefined>(initialColor);
	return (
		<ColorField
			color={color}
			onChange={setColor}
			labels={{
				useColor: "Farbe verwenden",
				editColor: "Farbe bearbeiten",
				pickerTitle: "Farbe auswählen",
				colorCode: "RGB-Hexcode",
				preview: "Farbdarstellung",
				close: "Schließen",
				ok: "OK",
				cancel: "Abbrechen",
			}}
		/>
	);
}

describe("ColorField", () => {
	it("aktiviert eine gültige Standardfarbe und öffnet die Farbauswahl", () => {
		render(<TestColorField />);
		fireEvent.click(screen.getByLabelText("Farbe verwenden"));

		expect(screen.getByText("#808080")).toBeDefined();
		expect(
			screen.getByLabelText("Farbdarstellung").getAttribute("style"),
		).toContain("background-color");
		fireEvent.click(screen.getByRole("button", { name: "Farbe bearbeiten" }));
		expect(
			screen.getByRole("dialog", { name: "Farbe auswählen" }),
		).toBeDefined();
	});

	it("entfernt die Farbe beim Deaktivieren", () => {
		render(<TestColorField />);
		const checkbox = screen.getByLabelText("Farbe verwenden");
		fireEvent.click(checkbox);
		fireEvent.click(checkbox);

		expect(screen.queryByText("#808080")).toBeNull();
	});

	it("übernimmt eine Änderung nur mit OK", () => {
		render(<TestColorField initialColor="112233" />);

		fireEvent.click(screen.getByRole("button", { name: "Farbe bearbeiten" }));
		fireEvent.change(screen.getByLabelText("RGB-Hexcode"), {
			target: { value: "#aabbcc" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
		expect(screen.getByText("#112233")).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: "Farbe bearbeiten" }));
		fireEvent.change(screen.getByLabelText("RGB-Hexcode"), {
			target: { value: "#aabbcc" },
		});
		fireEvent.click(screen.getByRole("button", { name: "OK" }));
		expect(screen.getByText("#AABBCC")).toBeDefined();
	});

	it("verwirft eine Änderung beim Schließen des Dialogs", () => {
		render(<TestColorField initialColor="112233" />);
		fireEvent.click(screen.getByRole("button", { name: "Farbe bearbeiten" }));
		fireEvent.change(screen.getByLabelText("RGB-Hexcode"), {
			target: { value: "#abcdef" },
		});
		fireEvent(
			screen.getByRole("dialog", { name: "Farbe auswählen" }),
			new Event("cancel", { bubbles: false, cancelable: true }),
		);

		expect(screen.getByText("#112233")).toBeDefined();
	});

	it("behandelt den nativen Zurück-Button wie Abbrechen", async () => {
		let pressBack: (() => void) | undefined;
		render(
			<BackNavigationProvider
				applicationLifecycle={{
					isNativePlatform: () => true,
					exitApplication: () => undefined,
					addBackButtonListener: (handler) => {
						pressBack = handler;
						return Promise.resolve(() => undefined);
					},
				}}
			>
				<TestColorField initialColor="112233" />
			</BackNavigationProvider>,
		);
		await waitFor(() => expect(pressBack).toBeDefined());
		fireEvent.click(screen.getByRole("button", { name: "Farbe bearbeiten" }));
		fireEvent.change(screen.getByLabelText("RGB-Hexcode"), {
			target: { value: "#abcdef" },
		});

		act(() => pressBack?.());
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Farbe auswählen" }),
			).toBeNull(),
		);
		expect(screen.getByText("#112233")).toBeDefined();
	});
});
