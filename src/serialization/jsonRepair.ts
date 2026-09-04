import { sanitizeParsedText, sanitizeText } from "../shared/textSanitizer";
import { decodeJsonBytes } from "./jsonEncoding";

export type JsonRepairOperation =
	| {
			type: "insertedMissingQuote";
			/** UTF-16-Offset im sanitisierten JSON-Text vor dem Einfügen. */
			position: number;
	  }
	| {
			type: "addedClosingBraces";
			count: number;
	  }
	| {
			type: "addedOpeningBraces";
			count: number;
	  };

export type JsonParseReport = {
	message: string;
	position?: number;
	line?: number;
	column?: number;
};

export type JsonRepairResult =
	| {
			status: "successful";
			value: unknown;
			text: string;
			operations: JsonRepairOperation[];
	  }
	| {
			status: "failed";
			operations: JsonRepairOperation[];
			jsonParseReport: JsonParseReport;
	  };

export function parseRepairableJsonBytes(
	bytes: Uint8Array,
	locale: string,
): JsonRepairResult {
	const { text } = decodeJsonBytes(bytes, locale);
	return parseRepairableJsonText(text);
}

export function parseRepairableJsonText(input: string): JsonRepairResult {
	let text = sanitizeText(input, { preserveLineBreaks: true });
	const operations: JsonRepairOperation[] = [];
	let parsed = tryParseJson(text);
	if (parsed.success)
		return {
			status: "successful",
			value: parsed.value,
			text,
			operations,
		};

	const quoteInsertionIndex = findMissingQuoteInsertionIndex(text);
	if (quoteInsertionIndex !== undefined) {
		text = `${text.slice(0, quoteInsertionIndex)}"${text.slice(
			quoteInsertionIndex,
		)}`;
		operations.push({
			type: "insertedMissingQuote",
			position: quoteInsertionIndex,
		});
		parsed = tryParseJson(text);
		if (parsed.success)
			return {
				status: "successful",
				value: parsed.value,
				text,
				operations,
			};
	}

	const balance = countStructuralCurlyBraces(text);
	if (balance.open > balance.close) {
		const count = balance.open - balance.close;
		text += "}".repeat(count);
		operations.push({ type: "addedClosingBraces", count });
	} else if (balance.close > balance.open) {
		const count = balance.close - balance.open;
		text = `${"{".repeat(count)}${text}`;
		operations.push({ type: "addedOpeningBraces", count });
	}

	parsed = tryParseJson(text);
	if (parsed.success)
		return {
			status: "successful",
			value: parsed.value,
			text,
			operations,
		};
	return {
		status: "failed",
		operations,
		jsonParseReport: parsed.report,
	};
}

function tryParseJson(
	text: string,
):
	| { success: true; value: unknown }
	| { success: false; report: JsonParseReport } {
	let value: unknown;
	try {
		value = JSON.parse(text) as unknown;
	} catch (error) {
		if (!(error instanceof SyntaxError)) throw error;
		return {
			success: false,
			report: createJsonParseReport(
				text,
				error instanceof Error ? error.message : String(error),
			),
		};
	}
	return { success: true, value: sanitizeParsedText(value) };
}

function createJsonParseReport(text: string, message: string): JsonParseReport {
	const explicitLocation = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
	if (explicitLocation)
		return {
			message,
			line: Number(explicitLocation[1]),
			column: Number(explicitLocation[2]),
		};

	const positionMatch = message.match(/position\s+(\d+)/i);
	if (!positionMatch) return { message };
	const position = Math.min(Number(positionMatch[1]), text.length);
	const lines = text.slice(0, position).split(/\r\n|\r|\n/);
	return {
		message,
		position,
		line: lines.length,
		column: (lines.at(-1)?.length ?? 0) + 1,
	};
}

function findMissingQuoteInsertionIndex(text: string): number | undefined {
	const unescapedQuoteIndexes: number[] = [];
	for (let index = 0; index < text.length; index += 1) {
		if (text[index] === '"' && !isEscaped(text, index))
			unescapedQuoteIndexes.push(index);
	}
	if (unescapedQuoteIndexes.length % 2 === 0) return undefined;
	const lastQuoteIndex = unescapedQuoteIndexes.at(-1) as number;
	for (let index = lastQuoteIndex + 1; index < text.length; index += 1) {
		if (text[index] === "," || text[index] === "}") return index;
	}
	return text.length;
}

function countStructuralCurlyBraces(text: string): {
	open: number;
	close: number;
} {
	let inString = false;
	let open = 0;
	let close = 0;
	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];
		if (character === '"' && !isEscaped(text, index)) {
			inString = !inString;
			continue;
		}
		if (inString) continue;
		if (character === "{") open += 1;
		else if (character === "}") close += 1;
	}
	return { open, close };
}

function isEscaped(text: string, index: number): boolean {
	let backslashCount = 0;
	for (
		let cursor = index - 1;
		cursor >= 0 && text[cursor] === "\\";
		cursor -= 1
	)
		backslashCount += 1;
	return backslashCount % 2 === 1;
}
