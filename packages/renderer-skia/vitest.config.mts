import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            // The real module needs React Native's native bindings; tests run
            // against a minimal mock instead.
            "@shopify/react-native-skia": fileURLToPath(new URL("./tests/mocks/react-native-skia.ts", import.meta.url)),
            "react-native": fileURLToPath(new URL("./tests/mocks/react-native.ts", import.meta.url)),
            "@canvas-tile-engine/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
        },
    },
    test: {
        environment: "node",
        include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
        passWithNoTests: true,
        coverage: {
            provider: "v8",
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["src/**/*.d.ts", "src/**/*.{test,spec}.{ts,tsx}"],
        },
    },
});
