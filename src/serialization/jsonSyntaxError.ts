// src/serialization/jsonSyntaxError.ts

import { sanitizeParsedText, sanitizeText } from "../shared/textSanitizer";
import { SerializationOperationError } from "./serializationFailure";

export class JsonSyntaxError extends SerializationOperationError {
	public readonly details: string;

	public constructor(diagnostic: string, details: string) {
		super({
			source: "serialization",
			operation: "decode",
			reason: "invalidJson",
			repairable: true,
			diagnostic,
			details,
		});
		this.name = "JsonSyntaxError";
		this.details = details;
	}
}

export function parseJsonWithDetails(text: string): unknown {
	const sanitizedText = sanitizeText(text, { preserveLineBreaks: true });
	try {
		return sanitizeParsedText(JSON.parse(sanitizedText) as unknown);
	} catch (cause) {
		if (!(cause instanceof SyntaxError)) throw cause;
		const parserMessage =
			cause instanceof Error ? cause.message : String(cause);
		throw new JsonSyntaxError(
			parserMessage,
			createJsonSyntaxDetails(sanitizedText, parserMessage),
		);
	}
}

export function createJsonSyntaxDetails(
	text: string,
	parserMessage: string,
): string {
	const explicitLocation = parserMessage.match(
		/line\s+(\d+)\s+column\s+(\d+)/i,
	);
	if (explicitLocation) {
		return `Ungültiges JSON in Zeile ${explicitLocation[1]}, Spalte ${explicitLocation[2]}:\n${parserMessage}`;
	}

	const positionMatch = parserMessage.match(/position\s+(\d+)/i);
	if (positionMatch)
		return createLocatedJsonSyntaxDetails(
			text,
			Number(positionMatch[1]),
			parserMessage,
		);

	return `Ungültiges JSON:\n${parserMessage}`;
}

function createLocatedJsonSyntaxDetails(
	text: string,
	position: number,
	parserMessage: string,
): string {
	const boundedPosition = Math.min(position, text.length);
	const beforeError = text.slice(0, boundedPosition);
	const lines = beforeError.split(/\r\n|\r|\n/);
	return `Ungültiges JSON in Zeile ${lines.length}, Spalte ${(lines.at(-1)?.length ?? 0) + 1}:\n${parserMessage}`;
}
