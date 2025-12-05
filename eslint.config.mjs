import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

const rules = [
    globalIgnores(["**/dist/**", "**/build/**", "**/node_modules/**", "docs/.docusaurus/**", "docs/build/**"]),
    {
        files: ["./packages/core/**/*.ts"],
        languageOptions: {
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                project: "./packages/core/tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.browser,
            },
        },
        extends: [tseslint.configs.recommendedTypeChecked],
    },
    {
        files: ["./examples/**/*.ts"],
        languageOptions: {
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                project: true,
            },
            globals: {
                ...globals.browser,
            },
        },
        extends: [tseslint.configs.recommendedTypeChecked],
    },
];

export default defineConfig(rules);
