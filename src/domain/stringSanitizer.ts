// src/domain/stringSanitizer.ts

import { transliterate } from "transliteration";
import { sanitizeText } from "../shared/textSanitizer";

export type IdArea =
	| "team"
	| "role"
	| "player"
	| "statusDefinition"
	| "statusInstance"
	| "game"
	| "template"
	| "log"
	| "ruleSet"
	| "generic";

const ID_PREFIXES: Record<IdArea, string> = {
	team: "t_",
	role: "r_",
	player: "p_",
	statusDefinition: "d_",
	statusInstance: "s_",
	game: "game_",
	template: "template_",
	log: "log_",
	ruleSet: "ruleset_",
	generic: "x_",
};

declare const validIdBrand: unique symbol;
export type ValidId = string & { readonly [validIdBrand]: true };

export type AvailableId = {
	id: ValidId;
	collisionSuffix?: number;
};

export type FindAvailableIdOptions = {
	firstSuffix?: number;
	forceSuffix?: boolean;
	ignoredId?: string;
};

/** Erzeugt aus einem Namen den normalisierten, noch bereichslosen ID-Kandidaten. */
export function createIdCandidateFromName(input: string): string {
	if (typeof input !== "string") {
		throw new Error("createIdCandidateFromName erwartet einen String.");
	}
	return prepareIdText(input);
}

function prepareIdText(input: string): string {
	// Whitespace vor dem allgemeinen Sanitizing sichern, da dieses sonst einige
	// Cc-Zeichen wie Vertical Tab und Form Feed vollständig entfernen würde.
	let text = sanitizeText(input.replace(/\s+/gu, "_"));

	// Ausgewählte Unicode-Bindestriche und Gedankenstriche sind Worttrenner.
	text = text.replace(/[\u002D\u058A\u05BE\u1806\u2010-\u2014\u2043]/gu, "_");

	text = transliterate(text);
	text = replaceLatinCharacters(text);
	return sanitizeText(text);
}

function normalizeIdBase(input: string): string {
	let text = prepareIdText(input)
		.replace(/\s+/gu, "_")
		.replace(/[^a-zA-Z0-9_]/g, "")
		.replace(/_+/g, "_")
		.replace(/^_+|_+$/g, "")
		.toLowerCase();

	if (!/^[a-z]/.test(text)) {
		text = `x${text}`;
	}

	return text || "x";
}

/**
 * Normalisiert einen beliebigen ID-Kandidaten und versieht ihn mit dem
 * Präfix des gewünschten Bereichs.
 */
export function normalizeId(input: string, area: IdArea = "generic"): ValidId {
	if (typeof input !== "string") {
		throw new Error("normalizeId erwartet einen String.");
	}
	const text = normalizeIdBase(input);
	const prefix = ID_PREFIXES[area];
	const existingPrefix = Object.values(ID_PREFIXES)
		.sort((a, b) => b.length - a.length)
		.find((candidate) => text.startsWith(candidate));
	const base = existingPrefix ? text.slice(existingPrefix.length) : text;
	return `${prefix}${base || "x"}` as ValidId;
}

/**
 * Ermittelt zu einer bereits gültigen ID die erste nicht belegte ID.
 * Die Eingabemenge wird nicht verändert.
 */
export function findAvailableId(
	baseId: ValidId,
	unavailableIds: ReadonlySet<string>,
	options: FindAvailableIdOptions = {},
): AvailableId {
	const firstSuffix = options.firstSuffix ?? 1;
	if (!Number.isInteger(firstSuffix) || firstSuffix < 1)
		throw new Error("firstSuffix muss eine positive ganze Zahl sein.");
	const isUnavailable = (id: string) =>
		id !== options.ignoredId && unavailableIds.has(id);
	if (!options.forceSuffix && !isUnavailable(baseId)) return { id: baseId };

	for (let suffix = firstSuffix; ; suffix += 1) {
		const candidate = `${baseId}_${suffix}` as ValidId;
		if (!isUnavailable(candidate))
			return { id: candidate, collisionSuffix: suffix };
	}
}

/** Normalisiert eine ID-Eingabe und ermittelt anschließend eine freie ID. */
export function createUniqueId(
	input: string,
	area: IdArea,
	unavailableIds: ReadonlySet<string>,
	options: FindAvailableIdOptions = {},
): AvailableId {
	const validId = normalizeId(input, area);
	return findAvailableId(validId, unavailableIds, options);
}

/** Erzeugt über die drei ID-Basisschritte eine eindeutige ID aus einem Namen. */
export function createUniqueIdFromName(
	name: string,
	area: IdArea,
	unavailableIds: ReadonlySet<string>,
	options: FindAvailableIdOptions = {},
): AvailableId {
	const candidate = createIdCandidateFromName(name);
	return createUniqueId(candidate, area, unavailableIds, options);
}

/**
 * Hält einen Anzeigenamen mit einer kollisionsbedingt nummerierten ID
 * synchron. Kann die Beziehung nicht erhalten werden, wird ein lesbarer Name
 * aus der ID abgeleitet.
 */
export function createNameFromNameAndId(
	name: string,
	result: AvailableId,
	area: IdArea,
): string {
	if (createIdFromText(name, area) === result.id) return name;
	const suffix = result.collisionSuffix;
	if (suffix !== undefined) {
		const appendedName = `${name} (${suffix})`;
		if (createIdFromText(appendedName, area) === result.id) return appendedName;

		const baseName = name.replace(/\s+\(\d+\)$/u, "").trim();
		const replacedName = `${baseName} (${suffix})`;
		if (createIdFromText(replacedName, area) === result.id) return replacedName;
	}
	return createNameFromId(result.id, area);
}

/** Erzeugt einen lesbaren Fallback-Namen aus einer gültigen Bereichs-ID. */
export function createNameFromId(id: ValidId, area: IdArea): string {
	const prefix = ID_PREFIXES[area];
	const withoutPrefix = id.startsWith(prefix) ? id.slice(prefix.length) : id;
	return withoutPrefix.replaceAll("_", " ");
}

/** Erzeugt einen zueinander passenden eindeutigen Namen und eine eindeutige ID. */
export function createUniqueNameAndId(
	name: string,
	area: IdArea,
	unavailableIds: ReadonlySet<string>,
	options: FindAvailableIdOptions = {},
): { name: string; id: ValidId } {
	const result = createUniqueIdFromName(name, area, unavailableIds, options);
	return {
		name: createNameFromNameAndId(name, result, area),
		id: result.id,
	};
}

/**
 * Erzeugt aus beliebigem Text eine grundsätzlich gültige App-ID.
 * Kompatibler Einstieg für bestehende Aufrufer; Eindeutigkeit wird hier nicht
 * geprüft.
 */
export function createIdFromText(
	input: string,
	area: IdArea = "generic",
): ValidId {
	return normalizeId(createIdCandidateFromName(input), area);
}

export function getIdPrefix(area: IdArea): string {
	return ID_PREFIXES[area];
}

export function isIdForArea(value: string, area: IdArea): boolean {
	const prefix = ID_PREFIXES[area];
	return value.startsWith(prefix) && /^[a-z][a-z0-9_]*$/.test(value);
}

function replaceLatinCharacters(input: string): string {
	return input
		.replace(/[äáàâ]/g, "a")
		.replace(/[ÄÁÀÂ]/g, "A")
		.replace(/[éèê]/g, "e")
		.replace(/[ÉÈÊ]/g, "E")
		.replace(/[ıíìî]/g, "i")
		.replace(/[İÍÌÎ]/g, "I")
		.replace(/[öóòô]/g, "o")
		.replace(/[ÖÓÒÔ]/g, "O")
		.replace(/[üúùû]/g, "u")
		.replace(/[ÜÚÙÛ]/g, "U");
}
