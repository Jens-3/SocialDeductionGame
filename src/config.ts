export let language = "de";

export function setLanguage(nextLanguage: string): void {
	const trimmedLanguage = nextLanguage.trim();
	if (!trimmedLanguage) {
		throw new Error("language darf nicht leer sein.");
	}

	language = trimmedLanguage;
}
