window.__releaseSmokeResult = null;

void (async () => {
	const phase = window.__releaseSmokePhase || "beforeRestart";
	const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
	const el = (id) => document.querySelector(`[data-testid="${id}"]`);
	const waitFor = async (description, predicate, timeout = 15000) => {
		const deadline = Date.now() + timeout;
		while (Date.now() < deadline) {
			const value = predicate();
			if (value) return value;
			await sleep(50);
		}
		throw new Error(`Timeout: ${description}`);
	};
	const waitEl = (id) => waitFor(`[data-testid="${id}"]`, () => el(id));
	const click = async (id) => {
		const target = await waitEl(id);
		if (target.disabled) throw new Error(`${id} is disabled`);
		target.click();
	};
	const assert = (condition, message) => {
		if (!condition) throw new Error(message);
	};
	const setValue = (target, value) => {
		const prototype = target instanceof HTMLSelectElement
			? HTMLSelectElement.prototype
			: HTMLInputElement.prototype;
		Object.getOwnPropertyDescriptor(prototype, "value").set.call(target, value);
		target.dispatchEvent(new Event("input", { bubbles: true }));
		target.dispatchEvent(new Event("change", { bubbles: true }));
	};
	const setTestValue = async (id, value) => setValue(await waitEl(id), value);
	const setCheckbox = async (id, checked) => {
		const target = await waitEl(id);
		if (target.checked !== checked) target.click();
		await waitFor(`${id}=${checked}`, () => el(id)?.checked === checked);
	};
	const selectLanguage = async (language) => {
		await click("settings-language");
		await click(`settings-language-${language}`);
		await waitFor("language picker closes", () => !el(`settings-language-${language}`));
	};
	const plugin = (name) => {
		const value = window.Capacitor?.Plugins?.[name];
		assert(value, `Capacitor plugin ${name} is unavailable`);
		return value;
	};
	const editorContains = (name) =>
		[...document.querySelectorAll(".scenario-editor-list strong")].some(
			(node) => node.textContent.trim() === name,
		);
	const scenarioCard = (name) =>
		[...document.querySelectorAll(".scenario-card")].find((card) =>
			[...card.querySelectorAll("strong")].some(
				(node) => node.textContent.trim() === name,
			),
		);
	const finish = (message) => {
		window.__releaseSmokeResult = JSON.stringify({ ok: true, message });
	};
	const step = (name) => {
		window.__releaseSmokeProgress = name;
		console.info(`[release-smoke] ${name}`);
	};
	step(`${phase}: script started`);

	try {
		if (phase === "orientation") {
			const orientation = plugin("ScreenOrientation");
			assert((await orientation.orientation()).type, "screen orientation could not be read");
			await orientation.lock({ orientation: "landscape" });
			await orientation.unlock();
			finish("Screen orientation plugin accepted lock and unlock requests");
			return;
		}
		if (phase === "exportDialog") {
			void plugin("NativeDataFile").writeExternal({
				bytesBase64: btoa('{"releaseSmoke":true}'),
				suggestedFileName: "release-smoke-native.json",
			});
			finish("Native export document dialog opened");
			return;
		}
		if (phase === "shareDialog") {
			const filesystem = plugin("Filesystem");
			await filesystem.writeFile({
				path: "release-smoke-share.json",
				data: btoa('{"releaseSmokeShare":true}'),
				directory: "CACHE",
			});
			const shareUri = await filesystem.getUri({
				path: "release-smoke-share.json",
				directory: "CACHE",
			});
			void plugin("Share").share({ files: [shareUri.uri], dialogTitle: "Release smoke share" });
			finish("Native share chooser opened");
			return;
		}
		if (phase === "afterRestart") {
			step("after restart: waiting for saved game");
			await waitFor(
				"saved game restored after restart",
				() => !el("home-continue")?.disabled,
				30000,
			);
			step("after restart: checking persisted settings");
			await click("home-settings");
			await waitEl("settings-language");
			await waitFor(
				"German language preference after restart",
				() => document.querySelector("#settings-title")?.textContent.trim() === "Einstellungen",
				30000,
			);
			await waitFor("dark theme after restart", () => document.documentElement.dataset.theme === "dark", 30000);
			await waitFor("keep-awake after restart", () => el("settings-keep-awake")?.checked, 30000);
			step("after restart: restoring test settings");
			await selectLanguage("system");
			setValue(await waitEl("settings-theme"), "system");
			await setCheckbox("settings-keep-awake", false);
			await setCheckbox("settings-auto-rotate", true);
			step("after restart: opening persisted game");
			await click("settings-back");
			await waitFor(
				"persisted game remains available after restoring settings",
				() => !el("home-continue")?.disabled,
				30000,
			);
			await click("home-continue");
			await waitEl("game-menu-open");
			await waitFor(
				"persisted game title",
				() => document.querySelector(".game-header h1")?.textContent.trim() === "Release Smoke Game",
				30000,
			);
			assert(
				document.querySelectorAll(".seat-button[data-seat-number]").length === 3,
				"persisted game did not restore its three seats",
			);
			await click("game-menu-open");
			await waitEl("game-save");
			finish("Release smoke test opened and verified the persisted game after restart");
			return;
		}

		assert(window.Capacitor?.isNativePlatform?.(), "not running on native Capacitor");

		// Bundled start data must be visible to the real new-game flow.
		await click("home-newGame");
		const source = await waitEl("new-game-source");
		await waitFor("bundled seed rule set", () =>
			[...source.options].some((option) => option.value === "ruleset_standard_rule_set"),
		);
		await click("new-game-back");

		await click("home-settings");
		await waitEl("settings-language");
		await selectLanguage("en");
		await waitFor("English UI", () => document.querySelector("#settings-title")?.textContent.trim() === "Settings");
		await selectLanguage("de");
		await waitFor("German UI", () => document.querySelector("#settings-title")?.textContent.trim() === "Einstellungen");
		await selectLanguage("system");
		const theme = await waitEl("settings-theme");
		setValue(theme, "dark");
		await waitFor("dark theme", () => document.documentElement.dataset.theme === "dark");
		setValue(theme, "light");
		await waitFor("light theme", () => document.documentElement.dataset.theme === "light");
		setValue(theme, "system");
		await waitFor("system theme", () => el("settings-theme")?.value === "system");

		// Real native plugins inside the optimized target APK.
		const filesystem = plugin("Filesystem");
		const preferences = plugin("Preferences");
		const keepAwake = plugin("KeepAwake");
		const fileData = btoa("release-smoke-filesystem");
		await filesystem.writeFile({ path: "release-smoke/file.txt", data: fileData, directory: "DATA", recursive: true });
		assert(
			(await filesystem.readFile({ path: "release-smoke/file.txt", directory: "DATA" })).data === fileData,
			"Filesystem round trip failed",
		);
		await filesystem.deleteFile({ path: "release-smoke/file.txt", directory: "DATA" });
		await preferences.set({ key: "release-smoke", value: "preferences-ok" });
		assert((await preferences.get({ key: "release-smoke" })).value === "preferences-ok", "Preferences round trip failed");
		await preferences.remove({ key: "release-smoke" });
		assert((await keepAwake.isSupported()).isSupported, "KeepAwake is unsupported");
		await keepAwake.keepAwake();
		assert((await keepAwake.isKeptAwake()).isKeptAwake, "KeepAwake did not set the window flag");
		await keepAwake.allowSleep();
		await plugin("Haptics").impact({ style: "LIGHT" });
		// Import through the app UI; native export and share dialogs run in dedicated phases.
		step("settings import");
		const response = await fetch(new URL("native-seed/library.json", document.baseURI));
		assert(response.ok, "bundled library could not be read for import");
		const importFile = new File([await response.blob()], "release-smoke-library.json", { type: "application/json" });
		const transfer = new DataTransfer();
		transfer.items.add(importFile);
		const input = await waitEl("settings-restore-input");
		Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
		input.dispatchEvent(new Event("change", { bubbles: true }));
		await click("settings-restore-confirm");
		await waitFor("library import", () => !el("settings-restore-confirm"), 30000);
		// Create, save and delete a rule set with team colour, Unicode role and status.
		step("rule set flow");
		await click("settings-back");
		await click("home-scenarios");
		await click("scenarios-create");
		const ruleSetName = (await waitFor("rule-set editor", () => document.querySelector("#scenario-detail-title"))).textContent.trim();
		await click("scenario-object-create");
		await setTestValue("scenario-object-name", "Smoke Team");
		await click("scenario-object-use-color");
		await click("scenario-object-edit-color");
		await setTestValue("scenario-object-color-code", "3366CC");
		await click("scenario-object-color-ok");
		await click("scenario-object-apply");
		await waitFor("team created", () => editorContains("Smoke Team"));
		await click("scenario-tab-roles");
		await click("scenario-object-create");
		await setTestValue("scenario-object-name", "Smoke Role");
		await setTestValue("scenario-object-unicode", "\\u{1F50D}");
		await click("scenario-object-apply");
		await waitFor("role created", () => editorContains("Smoke Role"));
		await click("scenario-tab-statuses");
		await click("scenario-object-create");
		await setTestValue("scenario-object-name", "Smoke Status");
		await click("scenario-object-apply");
		await waitFor("status created", () => editorContains("Smoke Status"));
		await click("scenario-object-close");
		await click("scenario-save");
		await waitFor("rule set saved", () => document.querySelector(".scenario-detail [role='status']")?.textContent.trim(), 30000);
		await sleep(500);
		step("game flow");
		await click("scenario-detail-back");
		const card = await waitFor("saved rule-set card", () => scenarioCard(ruleSetName));
		card.querySelector(".more-button").click();
		await click("scenario-delete");
		await click("scenario-delete-confirm");
		await waitFor("rule set deleted", () => !scenarioCard(ruleSetName), 30000);

		// Create and save a game from the bundled rule set.
		await click("scenarios-back");
		await click("home-newGame");
		await waitFor("bundled game source loaded", () =>
			[...(el("new-game-source")?.options ?? [])].some(
				(option) => option.value === "ruleset_standard_rule_set",
			),
		);
		await setTestValue("new-game-source", "ruleset_standard_rule_set");
		await setTestValue("new-game-player-count", "3");
		await setTestValue("new-game-name", "Release Smoke Game");
		await waitFor("game can be prepared", () => !el("new-game-prepare")?.disabled);
		await click("new-game-prepare");
		await click("role-distribution-manual");
		await click("game-menu-open");
		await click("game-save");
		await waitFor("game save", () => !el("game-save"), 30000);
		await click("game-back");
		await waitEl("home-continue");

		// Persist unmistakable values for the activity restart phase.
		step("persist settings");
		await click("home-settings");
		await selectLanguage("de");
		setValue(await waitEl("settings-theme"), "dark");
		await waitFor("dark persisted theme", () => document.documentElement.dataset.theme === "dark");
		await setCheckbox("settings-keep-awake", true);
		await setCheckbox("settings-auto-rotate", false);
		await click("settings-back");
		await waitEl("home-continue");
		await sleep(750);
		finish("Release smoke phase before restart completed");
	} catch (error) {
		window.__releaseSmokeResult = JSON.stringify({
			ok: false,
			message: `${phase}: ${error?.message ?? error} (screen: ${document.querySelector("h1")?.textContent?.trim() ?? "unknown"})`,
		});
	}
})();
