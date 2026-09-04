import { describe, expect, it } from "vitest";
import { normalizeId } from "../src/domain/stringSanitizer";
import { createTemplateFromGame } from "../src/domain/templateFactory";
import { createObjectPersistence } from "../src/persistence/objectPersistence";
import { ObjectStorageError } from "../src/persistence/objectPersistenceError";
import type {
	DataFileReference,
	DataFileStorage,
	DataFileWriteOptions,
} from "../src/persistence/ports/dataFileStorage";
import { fixedDomainServices } from "./fixedClock";
import { createTestGame, createTestRuleSet } from "./fixtures";
import { missingRead } from "./storageReadResult";

const decoding = { ansiFallbackLocale: "de" } as const;

describe("ObjectPersistence-Löschung", () => {
	it.each([
		{
			kind: "game" as const,
			id: "game_delete_contract",
			storageVariant: "restored_2",
			fileName: "game_delete_contract.restored_2.json",
		},
		{
			kind: "template" as const,
			id: "template_delete_contract",
			storageVariant: undefined,
			fileName: "template_delete_contract.json",
		},
	])(
		"löscht $kind über eine intern erzeugte Dateireferenz",
		async ({ kind, id, storageVariant, fileName }) => {
			const deletions: Array<{
				file: DataFileReference;
				options: unknown;
			}> = [];
			const persistence = createObjectPersistence(
				{
					readInternal: (file) => Promise.resolve(missingRead(file)),
					deleteInternal: (file, options) => {
						deletions.push({ file, options });
						return Promise.resolve();
					},
				},
				fixedDomainServices,
			);

			await persistence.write.deleteObject(
				{
					kind,
					id,
					...(storageVariant ? { storageVariant } : {}),
				},
				decoding,
			);

			expect(deletions).toEqual([
				{
					file: { category: kind, fileName },
					options: { includeBackup: true, includeRecovery: true },
				},
			]);
		},
	);

	it("ersetzt eine Dateivariante durch das kanonische neue Domainobjekt", async () => {
		const operations: unknown[] = [];
		const persistence = createObjectPersistence(
			{
				readInternal: (file) => Promise.resolve(missingRead(file)),
				writeInternal: (file, _bytes, options) => {
					operations.push({ type: "write", file, options });
					return Promise.resolve();
				},
				deleteInternal: (file, options) => {
					operations.push({ type: "delete", file, options });
					return Promise.resolve();
				},
			},
			fixedDomainServices,
		);
		const template = createTemplateFromGame({
			services: fixedDomainServices,
			game: createTestGame(),
			name: "Neu",
		}).template;

		const replaced = await persistence.write.replaceObject(
			normalizeId("template_alt", "template"),
			template,
			decoding,
			"restored_2",
		);
		expect(replaced).toMatchObject({
			document: { id: "template_neu" },
			reference: {
				kind: "template",
				id: "template_neu",
				storageKey: "template_neu",
			},
		});

		expect(operations).toEqual([
			{
				type: "write",
				file: { category: "template", fileName: "template_neu.json" },
				options: { backup: true, createOnly: true },
			},
			{
				type: "delete",
				file: {
					category: "template",
					fileName: "template_alt.restored_2.json",
				},
				options: { includeBackup: true, includeRecovery: true },
			},
		]);
	});

	it("entfernt ein RuleSet innerhalb der gemeinsam gespeicherten Library", async () => {
		const ruleSet = createTestRuleSet();
		let written:
			| {
					file: DataFileReference;
					value: Record<string, unknown>;
					options: DataFileWriteOptions;
			  }
			| undefined;
		const storage: DataFileStorage = {
			readInternal: () =>
				Promise.resolve({
					status: "success",
					bytes: encodeJson({
						storageType: "social-deduction-app-library",
						storageVersion: 1,
						ruleSetsById: { [ruleSet.id]: ruleSet },
					}),
				}),
			writeInternal: (file, bytes, options) => {
				written = {
					file,
					value: JSON.parse(new TextDecoder().decode(bytes)) as Record<
						string,
						unknown
					>,
					options,
				};
				return Promise.resolve();
			},
		};

		await createObjectPersistence(
			storage,
			fixedDomainServices,
		).write.deleteObject(
			{
				kind: "ruleSet",
				id: ruleSet.id,
			},
			decoding,
		);

		expect(written).toMatchObject({
			file: { category: "library", fileName: "library.json" },
			options: { backup: true },
			value: { ruleSetsById: {} },
		});
	});

	it("meldet ein nicht vorhandenes RuleSet", async () => {
		const persistence = createObjectPersistence(
			{
				readInternal: () =>
					Promise.resolve({
						status: "success",
						bytes: encodeJson({
							storageType: "social-deduction-app-library",
							storageVersion: 1,
							ruleSetsById: {},
						}),
					}),
			},
			fixedDomainServices,
		);

		const error = await persistence.write
			.deleteObject(
				{
					kind: "ruleSet",
					id: "ruleset_missing",
				},
				decoding,
			)
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(ObjectStorageError);
		expect(error).toMatchObject({
			operation: "delete",
			diagnostic: undefined,
		});
	});

	it("ergänzt einen typisierten Storage-Fehler um den Objektkontext", async () => {
		const persistence = createObjectPersistence(
			{
				readInternal: (file) => Promise.resolve(missingRead(file)),
				deleteInternal: (file) =>
					Promise.resolve({
						status: "error",
						error: {
							source: "storage",
							operation: "delete",
							reason: "storageUnavailable",
							retryable: true,
							repairable: false,
							category: file.category,
							file,
							diagnostic: "Datenträger nicht erreichbar",
						},
					}),
			},
			fixedDomainServices,
		);

		const error = await persistence.write
			.deleteObject(
				{
					kind: "template",
					id: "template_delete_failure",
					storageVariant: "backup",
				},
				decoding,
			)
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(ObjectStorageError);
		expect(error).toMatchObject({
			operation: "delete",
			diagnostic: "Datenträger nicht erreichbar",
			storageFailure: {
				category: "template",
				file: {
					category: "template",
					fileName: "template_delete_failure.backup.json",
				},
			},
			context: {
				kind: "template",
				id: "template_delete_failure",
				storageKey: "template_delete_failure.backup",
			},
		});
	});
});

function encodeJson(value: unknown): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(value));
}
