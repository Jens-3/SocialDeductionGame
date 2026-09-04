export function normalizeLegalTextForComparison(text) {
	return text.replace(/\r\n?|\u2028|\u2029/gu, "\n").trim();
}

export function ensureTrailingLineBreak(text) {
	return /(?:\r\n|[\n\r\u2028\u2029])$/u.test(text) ? text : `${text}\n`;
}

export function renderNormalizedLegalText(text) {
	return ensureTrailingLineBreak(normalizeLegalTextForComparison(text));
}

export function convertToAndroidLineEndings(text) {
	return text.replace(/\r\n?|\u2028|\u2029/gu, "\n");
}

export function isCompleteApache20License(text) {
	const normalized = normalizeLegalTextForComparison(text);
	return (
		/Apache License\s+Version 2\.0/iu.test(normalized) &&
		/[\n\r]\s*1\. Definitions\./iu.test(normalized) &&
		/[\n\r]\s*2\. Grant of Copyright License\./iu.test(normalized) &&
		/[\n\r]\s*3\. Grant of Patent License\./iu.test(normalized) &&
		/[\n\r]\s*4\. Redistribution\./iu.test(normalized) &&
		/[\n\r]\s*5\. Submission of Contributions\./iu.test(normalized) &&
		/[\n\r]\s*6\. Trademarks\./iu.test(normalized) &&
		/[\n\r]\s*7\. Disclaimer of Warranty\./iu.test(normalized) &&
		/[\n\r]\s*8\. Limitation of Liability\./iu.test(normalized) &&
		/[\n\r]\s*9\. Accepting Warranty or Additional Liability\./iu.test(normalized) &&
		/END OF TERMS AND CONDITIONS/iu.test(normalized)
	);
}

export function selectApache20LicenseFiles(legalFiles, canonicalFile) {
	const completeOfflineFiles = legalFiles.filter(
		({ kind, text }) => kind === "license" && isCompleteApache20License(text),
	);
	const canonicalText = normalizeLegalTextForComparison(canonicalFile.text);
	const differingFiles = completeOfflineFiles.filter(
		({ text }) => normalizeLegalTextForComparison(text) !== canonicalText,
	);
	if (differingFiles.length === 0) return [canonicalFile];

	const distinctFiles = new Map();
	for (const file of differingFiles) {
		const normalized = normalizeLegalTextForComparison(file.text);
		if (!distinctFiles.has(normalized)) distinctFiles.set(normalized, file);
	}
	return [...distinctFiles.values()];
}
