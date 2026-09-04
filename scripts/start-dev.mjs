import { spawn } from "node:child_process";
import path from "node:path";

const RESET_LIBRARY_ARGUMENT = "--reset-library";
const resetLibrary = process.argv.slice(2).includes(RESET_LIBRARY_ARGUMENT);
const viteArguments = process.argv
	.slice(2)
	.filter(
		(argument) => argument !== RESET_LIBRARY_ARGUMENT && argument !== "--",
	);
const viteCli = path.resolve("node_modules/vite/bin/vite.js");

const child = spawn(
	process.execPath,
	[viteCli, "--configLoader", "runner", ...viteArguments],
	{
		stdio: "inherit",
		env: {
			...process.env,
			...(resetLibrary ? { SDG_DEV_RESET_LIBRARY: "1" } : {}),
		},
	},
);

child.on("error", (error) => {
	console.error(
		`Der Entwicklungsserver konnte nicht gestartet werden: ${error.message}`,
	);
	process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
	process.on(signal, () => {
		if (child.exitCode === null && child.signalCode === null)
			child.kill(signal);
	});
}

child.on("exit", (code) => {
	process.exitCode = code ?? 1;
});
