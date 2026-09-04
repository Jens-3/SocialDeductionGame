import { isIdForArea } from "../domain/stringSanitizer";
import type {
	DataFileCategory,
	StandaloneDataFileCategory,
} from "./ports/dataFileTypes";

export type InternalDocumentFileName = {
	id: string;
	storageKey: string;
	storageVariant?: string;
	restoredIndex: number;
};

export function parseInternalDocumentFileName(
	category: StandaloneDataFileCategory,
	fileName: string,
): InternalDocumentFileName | undefined {
	if (!fileName.endsWith(".json")) return undefined;
	const storageKey = fileName.slice(0, -".json".length);
	const separator = storageKey.indexOf(".");
	const id = separator < 0 ? storageKey : storageKey.slice(0, separator);
	const storageVariant =
		separator < 0 ? undefined : storageKey.slice(separator + 1);
	if (!id || !isIdForArea(id, category) || storageVariant === "")
		return undefined;
	const restoredMatch = storageVariant?.match(/^restored(?:_([1-9]\d*))?$/);
	return {
		id,
		storageKey,
		...(storageVariant ? { storageVariant } : {}),
		restoredIndex: restoredMatch ? Number(restoredMatch[1] ?? 1) : 0,
	};
}

export function internalDocumentFileName(
	id: string,
	storageVariant?: string,
): string {
	return `${id}${storageVariant ? `.${storageVariant}` : ""}.json`;
}

export function internalFileReference<Category extends DataFileCategory>(
	category: Category,
	id: string,
	storageVariant?: string,
): { category: Category; fileName: string } {
	return {
		category,
		fileName:
			category === "library"
				? "library.json"
				: internalDocumentFileName(id, storageVariant),
	};
}

export function documentIdFromStorageKey(storageKey: string): string {
	return storageKey.split(".", 1)[0] ?? storageKey;
}

export function fileReferenceFromStorageKey(storageKey: string): {
	category: StandaloneDataFileCategory;
	fileName: string;
} {
	const id = documentIdFromStorageKey(storageKey);
	return {
		category: id.startsWith("template_") ? "template" : "game",
		fileName: `${storageKey}.json`,
	};
}
