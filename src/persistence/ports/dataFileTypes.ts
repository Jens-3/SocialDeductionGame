export const DATA_FILE_CATEGORIES = ["library", "template", "game"] as const;
export type DataFileCategory = (typeof DATA_FILE_CATEGORIES)[number];

export const STANDALONE_DATA_FILE_CATEGORIES = ["game", "template"] as const;
export type StandaloneDataFileCategory =
	(typeof STANDALONE_DATA_FILE_CATEGORIES)[number];

export type DataFileReference = {
	category: DataFileCategory;
	fileName: string;
};
