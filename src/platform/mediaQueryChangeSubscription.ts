type MediaQueryChangeListener = (matches: boolean) => void;

export function subscribeToMediaQueryChanges(
	mediaQuery: MediaQueryList,
	listener: MediaQueryChangeListener,
): () => void {
	const handleChange = (event: MediaQueryListEvent) => listener(event.matches);
	if (supportsModernListeners(mediaQuery)) {
		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}
	if (supportsCompatibleListeners(mediaQuery)) {
		mediaQuery.addListener(handleChange);
		return () => mediaQuery.removeListener(handleChange);
	}
	return () => undefined;
}

function supportsModernListeners(mediaQuery: MediaQueryList): boolean {
	return (
		typeof mediaQuery.addEventListener === "function" &&
		typeof mediaQuery.removeEventListener === "function"
	);
}

function supportsCompatibleListeners(mediaQuery: MediaQueryList): boolean {
	return (
		typeof mediaQuery.addListener === "function" &&
		typeof mediaQuery.removeListener === "function"
	);
}
