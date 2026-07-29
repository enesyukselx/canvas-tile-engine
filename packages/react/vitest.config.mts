import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
        passWithNoTests: true,
        coverage: {
            provider: "v8",
            include: ["src/**/*.{ts,tsx}"],
            // react-shared source is pulled in through the workspace symlink;
            // its coverage belongs to react-shared's own suite, not this one.
            exclude: ["src/**/*.d.ts", "src/**/*.{test,spec}.{ts,tsx}", "**/react-shared/**"],
        },
    },
});
