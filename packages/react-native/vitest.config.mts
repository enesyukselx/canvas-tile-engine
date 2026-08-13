import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const mock = (name: string) => fileURLToPath(new URL(`./tests/mocks/${name}.ts`, import.meta.url));

export default defineConfig({
    resolve: {
        // react-shared is consumed as SOURCE (its `exports` points at src/), and
        // pnpm links its own React copy under that package. Without dedupe the
        // shared hooks/draw components would call into react@18 while react-dom
        // renders react@19 — "Invalid hook call" at the first useRef.
        dedupe: ["react", "react-dom"],
        alias: {
            // Order matters: Vite matches string aliases by prefix, so the
            // gesture-handler entry must come before "react-native".
            "react-native-gesture-handler": mock("react-native-gesture-handler"),
            "@shopify/react-native-skia": mock("react-native-skia"),
            "react-native": mock("react-native"),
            // Run the real engine from source (same trick as renderer-skia's
            // suite) so tests never depend on a built dist.
            "@canvas-tile-engine/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
        },
    },
    test: {
        // Nothing DOM is asserted: jsdom only supplies React's host substrate
        // (react-dom + rAF). Every native module is aliased to a mock.
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
