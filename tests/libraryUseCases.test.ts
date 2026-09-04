import { describe, expect, it } from "vitest";
import { createLibraryUseCases } from "../src/application/libraryUseCases";
import type { DataFileStorage } from "../src/persistence/ports/dataFileStorage";
import { createTestObjectPersistence } from "./createTestObjectPersistence";
import { fixedClock } from "./fixedClock";
import { createTestGame, createTestRuleSet } from "./fixtures";
import { missingRead } from "./storageReadResult";

describe("Library-Anwendungsfälle", () => {
	it("teilen Cache und Schreibzustand, aber nicht ihre öffentlichen Methoden", async () => {
		const initialRuleSet = createTestRuleSet();
		let storedBytes = new TextEncoder().encode(
			JSON.stringify({
				storageType: "social-deduction-app-library",
				storageVersion: 1,
				ruleSetsById: { [initialRuleSet.id]: initialRuleSet },
			}),
		);
		const storage: DataFileStorage = {
			readInternal: () =>
				Promise.resolve({ status: "success", bytes: storedBytes }),
			writeInternal: (_file, bytes) => {
				storedBytes = Uint8Array.from(bytes);
				return Promise.resolve();
			},
		};
		const services = createLibraryUseCases(
			createTestObjectPersistence(storage, fixedClock),
			fixedClock,
		);

		await expect(services.browse.listObjects("ruleSet")).resolves.toMatchObject(
			{
				status: "loaded",
				metadata: [expect.objectContaining({ id: initialRuleSet.id })],
			},
		);
		await services.management.saveRuleSet({
			...initialRuleSet,
			name: "Geänderter Name",
		});

		await expect(
			services.browse.loadRuleSet(initialRuleSet.id),
		).resolves.toMatchObject({ name: "Geänderter Name" });
		expect("saveRuleSet" in services.browse).toBe(false);
		expect("listObjects" in services.management).toBe(false);
	});

	it("lehnt beschädigte RuleSets vor dem Speichern strikt ab", async () => {
		const initialRuleSet = createTestRuleSet();
		const storedBytes = new TextEncoder().encode(
			JSON.stringify({
				storageType: "social-deduction-app-library",
				storageVersion: 1,
				ruleSetsById: { [initialRuleSet.id]: initialRuleSet },
			}),
		);
		let writes = 0;
		const services = createLibraryUseCases(
			createTestObjectPersistence(
				{
					readInternal: () =>
						Promise.resolve({ status: "success", bytes: storedBytes }),
					writeInternal: () => {
						writes += 1;
						return Promise.resolve();
					},
				},
				fixedClock,
			),
			fixedClock,
		);

		await expect(
			services.management.saveRuleSet({
				...initialRuleSet,
				id: "wrong",
			}),
		).rejects.toMatchObject({ reason: "invalidObject" });
		expect(writes).toBe(0);
	});

	it("verändert eine Library bei einem fehlgeschlagenen Speicherversuch nicht", async () => {
		const ruleSet = createTestRuleSet();
		const storedBytes = new TextEncoder().encode(
			JSON.stringify({
				storageType: "social-deduction-app-library",
				storageVersion: 1,
				ruleSetsById: { [ruleSet.id]: ruleSet },
			}),
		);
		let exported: Uint8Array | undefined;
		const services = createLibraryUseCases(
			createTestObjectPersistence(
				{
					readInternal: () =>
						Promise.resolve({ status: "success", bytes: storedBytes }),
					writeInternal: () => Promise.reject(new Error("Datenträger voll")),
					writeExternal: (bytes) => {
						exported = bytes;
						return Promise.resolve();
					},
				},
				fixedClock,
			),
			fixedClock,
		);

		await expect(
			services.management.saveRuleSet(ruleSet),
		).rejects.toMatchObject({ reason: "unexpectedFailure" });
		await services.backup.exportLibraryBackup();
		expect(JSON.parse(new TextDecoder().decode(exported))).toEqual(
			JSON.parse(new TextDecoder().decode(storedBytes)),
		);
	});

	it("verändert das Template bei einem fehlgeschlagenen Speicherversuch nicht", async () => {
		const template = {
			...createTestGame(),
			id: "template_test",
			isTemplate: true,
		};
		const before = structuredClone(template);
		const services = createLibraryUseCases(
			createTestObjectPersistence(
				{
					readInternal: (file) => Promise.resolve(missingRead(file)),
					writeInternal: () => Promise.reject(new Error("Datenträger voll")),
				},
				fixedClock,
			),
			fixedClock,
		);

		await expect(
			services.management.saveTemplate(template),
		).rejects.toMatchObject({ reason: "unexpectedFailure" });
		expect(template).toEqual(before);
	});
});
