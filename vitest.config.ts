import { defineConfig } from "vitest/config";
import pkg from "./package.json";

export default defineConfig({
	define: {
		__DEV__: "true",
		__APP_VERSION__: JSON.stringify(pkg.version),
	},
	test: {
		coverage: {
			provider: "v8",
			include: ["src/**/*.{ts,tsx}"],
			exclude: ["src/**/*.d.ts"],
			reporter: ["text", "html", "lcov"],
			reportsDirectory: "coverage",
		},
		fileParallelism: false,
		setupFiles: ["./tests/setup.ts"],
	},
});
