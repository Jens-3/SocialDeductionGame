import type { LibraryRepairReport } from "../domain/libraryContainerRepair";
import type { ObjectRecoverySource } from "../persistence/objectPersistenceTypes";

export type ApplicationObjectKind = "game" | "template" | "ruleSet" | "library";

export type RenameObjectSuccess = {
	id: string;
	storageKey: string;
	name: string;
};

export type NamedObjectImportSuccess<
	K extends "game" | "template" | "ruleSet" = "game" | "template" | "ruleSet",
> = {
	status: "imported";
	kind: K;
	id: string;
	name: string;
};

export type ObjectImportSuccess =
	| NamedObjectImportSuccess
	| {
			status: "imported";
			kind: "library";
	  };

export type ObjectRecoverySuccess =
	| {
			status: "recovered";
			kind: "game" | "template" | "ruleSet";
			id: string;
			name?: string;
			recoverySource?: ObjectRecoverySource;
	  }
	| {
			status: "recovered";
			kind: "library";
			recoverySource?: ObjectRecoverySource;
	  };

export type ObjectRestoreSuccess = {
	status: "restored";
	kind: "library";
	source: "backup";
};

export type ObjectRepairSuccess =
	| {
			status: "repaired";
			kind: "game" | "template" | "ruleSet";
			id: string;
			name?: string;
			report?: LibraryRepairReport;
	  }
	| {
			status: "repaired";
			kind: "library";
			report: LibraryRepairReport;
	  };

export type ApplicationObjectSuccess =
	| ObjectImportSuccess
	| ObjectRecoverySuccess
	| ObjectRestoreSuccess
	| ObjectRepairSuccess;

export type LibraryRepairSuccess = Extract<
	ObjectRepairSuccess,
	{ kind: "library" }
>;
