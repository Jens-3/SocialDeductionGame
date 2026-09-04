export type ExportDecision = "overwrite" | "chooseAnotherTarget" | "cancel";

import type { ApplicationExpectedFailure } from "./applicationDecision";

export type ApplicationExportResult =
	| { status: "exported" }
	| (ApplicationExpectedFailure<ExportDecision> & {
			problem: ApplicationExpectedFailure<ExportDecision>["problem"] & {
				reason: "targetExists";
				availableActions: readonly [
					"overwrite",
					"chooseAnotherTarget",
					"cancel",
				];
			};
			continuation: "restart";
	  });
