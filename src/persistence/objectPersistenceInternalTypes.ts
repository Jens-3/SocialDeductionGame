import type { DomainFailureReason } from "../domain/domainFailure";
import type { LibraryDocumentMetadata } from "../serialization/libraryDocument";
import type { LibraryRuleSetJson } from "../serialization/librarySerializer";
import type { ObjectSerializationErrorReason } from "./objectPersistenceError";
import type {
	ObjectReadProblemForKind,
	RuleSetObjectMetadata,
} from "./objectPersistenceTypes";

/** Ausschließlich innerhalb der Persistence-Implementierung verwendete Typen. */
export type InternalFileNameRepairResult = {
	renamedFiles: number;
	repairedIds: number;
};

export type CachedRuleSet =
	| {
			status: "valid";
			raw: unknown;
			json: LibraryRuleSetJson;
			summary: RuleSetObjectMetadata;
	  }
	| {
			status: "invalid";
			raw: unknown;
			category: "serialization";
			reason: ObjectSerializationErrorReason;
			repairable: boolean;
			diagnostic?: string;
			details?: string;
	  }
	| {
			status: "invalid";
			raw: unknown;
			category: "domain";
			reason: DomainFailureReason;
			repairable: boolean;
			diagnostic?: string;
			details?: string;
	  };

export type RuleSetLibraryCache = {
	metadata: LibraryDocumentMetadata;
	ruleSetsById: Map<string, CachedRuleSet>;
};

export type ImportedRuleSetLibrary = {
	cache: RuleSetLibraryCache;
	storageVersion: 1;
	totalObjectCount: number;
	discardedRuleSetIds: string[];
	problems: ObjectReadProblemForKind<"ruleSet">[];
};

export type RuleSetLibraryRecoverySources = {
	original?: Uint8Array;
	backup?: Uint8Array;
};
