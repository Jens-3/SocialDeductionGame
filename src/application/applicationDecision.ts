import type {
	ApplicationErrorOperation,
	ApplicationErrorReason,
	ApplicationErrorSource,
	ApplicationErrorSubject,
} from "./applicationError";

/** Ein noch laufender Application-Vorgang, der auf eine Auswahl wartet. */
export type ApplicationDecisionRequired<
	Kind extends string,
	Action extends string,
	Context extends object = Record<never, never>,
> = {
	status: "decisionRequired";
	decisionKind: Kind;
	commandId: string;
	reason: ApplicationErrorReason;
	availableActions: readonly Action[];
} & Context;

export type ApplicationProblemReference =
	| {
			kind: "game" | "template";
			storageKey: string;
			id?: string;
	  }
	| { kind: "ruleSet"; id: string }
	| { kind: "library" }
	| {
			kind: "file";
			file: { category: "library" | "template" | "game"; fileName: string };
			targetFile?: {
				category: "library" | "template" | "game";
				fileName: string;
			};
	  };

/** Eine beendete Operation mit einem erwartbaren, separat behandelbaren Problem. */
export type ApplicationExpectedProblem<Action extends string> = {
	problemId: string;
	source: ApplicationErrorSource;
	operation: ApplicationErrorOperation;
	subject: ApplicationErrorSubject;
	reason: ApplicationErrorReason;
	reference?: ApplicationProblemReference;
	diagnostic?: string;
	availableActions: readonly Action[];
};

export type ApplicationExpectedFailure<Action extends string> = {
	status: "expectedFailure";
	problem: ApplicationExpectedProblem<Action>;
};
