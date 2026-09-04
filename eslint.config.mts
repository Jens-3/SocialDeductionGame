import css from "@eslint/css";
import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import eslintReact from "@eslint-react/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const typedFiles = [
	"src/**/*.ts",
	"src/**/*.tsx",
	"tests/**/*.ts",
	"tests/**/*.tsx",
	"vite.config.mts",
	"vitest.config.ts",
	"capacitor.config.ts",
];

export default defineConfig([
	globalIgnores([
		"node_modules/**",
		"dist/**",
		"coverage/**",
		"android/**",
		".git/**",
		".agents/**",
		".codex/**",
		"_extern/**",
		"archive/**",
		"dev-data/**",
		"pnpm-lock.yaml",
	]),
	{
		files: ["**/*.{js,mjs,cjs}"],
		...js.configs.recommended,
		languageOptions: { globals: globals.node },
	},
	...tseslint.configs.recommendedTypeChecked.map((config) => ({
		...config,
		files: typedFiles,
	})),
	{
		files: typedFiles,
		languageOptions: {
			parserOptions: {
				project: [
					"./tsconfig.json",
					"./tsconfig.gui.json",
					"./tsconfig.tests.json",
				],
				tsconfigRootDir: import.meta.dirname,
			},
			globals: globals.node,
		},
		rules: {
			"no-constant-condition": "warn",
		},
	},
	...tseslint.configs.recommended.map((config) => ({
		...config,
		files: ["eslint.config.mts"],
	})),
	{
		files: ["eslint.config.mts"],
		languageOptions: { globals: globals.node },
	},
	{
		files: ["src/gui/**/*.tsx"],
		extends: [eslintReact.configs["recommended-typescript"]],
		languageOptions: { globals: globals.browser },
		plugins: {
			"react-hooks": reactHooks,
			"react-refresh": reactRefresh,
		},
		rules: {
			...reactHooks.configs.flat.recommended.rules,
			...reactRefresh.configs.vite.rules,
			"@eslint-react/error-boundaries": "off",
			"@eslint-react/exhaustive-deps": "off",
			"@eslint-react/purity": "off",
			"@eslint-react/rules-of-hooks": "off",
			"@eslint-react/set-state-in-effect": "off",
			"@eslint-react/set-state-in-render": "off",
			"@eslint-react/static-components": "off",
			"@eslint-react/unsupported-syntax": "off",
			"@eslint-react/use-memo": "off",
		},
	},
	{
		files: ["**/*.json"],
		plugins: { json },
		language: "json/json",
		extends: ["json/recommended"],
	},
	{
		files: ["**/*.jsonc"],
		plugins: { json },
		language: "json/jsonc",
		extends: ["json/recommended"],
	},
	{
		files: ["**/*.json5"],
		plugins: { json },
		language: "json/json5",
		extends: ["json/recommended"],
	},
	{
		files: ["**/*.md"],
		plugins: { markdown },
		language: "markdown/gfm",
		extends: ["markdown/recommended"],
	},
	{
		files: ["**/*.css"],
		plugins: { css },
		language: "css/css",
		extends: ["css/recommended"],
		rules: {
			"css/use-baseline": ["error", { allowProperties: ["user-select"] }],
		},
	},
]);
