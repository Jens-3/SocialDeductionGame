import type { GameDraft } from "../domain/gameDraft";
import type { GameState } from "../domain/gameFactory";
import {
	type GameDocumentVersion,
	withCurrentGameDocumentVersion,
} from "./gameDocumentFormat";
import { encodeUtf8 } from "./jsonEncoding";
import { createRuleSetDocumentEmbedded } from "./ruleSetExport";

export type GameExportDocument = GameDraft & GameDocumentVersion;

/** Ergänzt ausschließlich Formatmetadaten; fachliche Prüfung ist Aufgabe der Domain. */
export function createGameExportDocument(
	document: GameDraft | GameState,
): GameExportDocument {
	return withCurrentGameDocumentVersion(toGameDraft(document));
}

/** Serialisiert einen bereits strukturell und fachlich geprüften Spielstand. */
export function createGameExportJsonText(
	document: GameDraft | GameState,
): string {
	return JSON.stringify(createGameExportDocument(document), null, 2);
}

/** Erzeugt die kanonischen UTF-8-Bytes ohne BOM und ohne abschließenden Umbruch. */
export function encodeGameExportDocument(
	document: GameDraft | GameState,
): Uint8Array {
	return encodeUtf8(createGameExportJsonText(document));
}

function toGameDraft(document: GameDraft | GameState): GameDraft {
	const players =
		"players" in document
			? [...document.players]
			: Object.values(document.playersById);
	return {
		id: document.id,
		name: document.name,
		isTemplate: document.isTemplate,
		...(document.createdAt === undefined
			? {}
			: { createdAt: document.createdAt }),
		ruleSetSnapshot: createRuleSetDocumentEmbedded(document.ruleSetSnapshot),
		...(document.names === undefined ? {} : { names: { ...document.names } }),
		players,
		seatOrder: [...document.seatOrder],
		time: { ...document.time },
		log: [...document.log],
		rolesForShowing: document.rolesForShowing,
	};
}
