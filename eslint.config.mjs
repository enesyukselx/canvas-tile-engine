import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import eslintPluginReact from "eslint-plugin-react";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";

const rules = [
    globalIgnores([
        "**/dist/**",
        "**/build/**",
        "**/node_modules/**",
        "docs/.docusaurus/**",
        "docs/build/**",
        "packages/*/coverage/**",
    ]),
    {
        files: ["./packages/core/src/**/*.ts", "./packages/core/tsup.config.ts"],
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
        files: ["./packages/core/tests/**/*.ts"],
        languageOptions: {
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                project: "./packages/core/tsconfig.vitest.json",
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.node,
                ...globals.vitest,
            },
        },
        extends: [tseslint.configs.recommendedTypeChecked],
    },
    {
        files: ["./packages/renderer-canvas/src/**/*.ts", "./packages/renderer-canvas/tsup.config.ts"],
        languageOptions: {
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                project: "./packages/renderer-canvas/tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.browser,
            },
        },
        extends: [tseslint.configs.recommendedTypeChecked],
    },
    {
        files: ["./packages/renderer-canvas/tests/**/*.ts"],
        languageOptions: {
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                project: "./packages/renderer-canvas/tsconfig.vitest.json",
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.node,
                ...globals.vitest,
            },
        },
        extends: [tseslint.configs.recommendedTypeChecked],
    },
    {
        files: ["./packages/react/src/**/*.ts", "./packages/react/src/**/*.tsx", "./packages/react/tsup.config.ts"],
        languageOptions: {
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                project: "./packages/react/tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.browser,
            },
        },
        plugins: {
            react: eslintPluginReact,
            "react-hooks": eslintPluginReactHooks,
        },
        rules: {
            ...eslintPluginReact.configs.recommended.rules,
            ...eslintPluginReact.configs["jsx-runtime"].rules,
            ...eslintPluginReactHooks.configs["recommended-latest"].rules,
        },
        settings: {
            react: {
                version: "detect",
            },
        },
        extends: [tseslint.configs.recommendedTypeChecked],
    },
    {
        files: ["./examples/vanilla-js-examples/**/*.ts"],
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
    {
        files: ["./examples/react/**/*.tsx", "./examples/react/**/*.ts"],
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
        plugins: {
            react: eslintPluginReact,
            "react-hooks": eslintPluginReactHooks,
        },
        rules: {
            ...eslintPluginReact.configs.recommended.rules,
            ...eslintPluginReact.configs["jsx-runtime"].rules,
            ...eslintPluginReactHooks.configs["recommended-latest"].rules,
        },
        settings: {
            react: {
                version: "detect",
            },
        },
        extends: [tseslint.configs.recommendedTypeChecked],
    },
];

export default defineConfig(rules);
