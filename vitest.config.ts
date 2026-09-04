import { defineConfig } from "vitest/config";

export default defineConfig({
	define: {
		__DEV__: "true",
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
