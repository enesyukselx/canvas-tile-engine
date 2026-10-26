import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: {
        // The DTS bundler widens external `export type` class re-exports to
        // values. Bundle the remaining API, then append the native type-only
        // facade verbatim. This also applies to watch builds and both formats.
        entry: { index: "src/exports.ts" },
        footer: 'export type { Image, Canvas, SKRSContext2D } from "@napi-rs/canvas";',
    },
    sourcemap: true,
    minify: true,
    clean: true,
    // Keep the native addon external so it is required at runtime, not bundled.
    external: ["@napi-rs/canvas", "@canvas-tile-engine/core"],
    // renderer-shared is a private workspace package: bundle its TypeScript
    // source into dist so it never appears as a published dependency.
    noExternal: [/^@canvas-tile-engine\/renderer-shared/],
    // Emit .cjs/.mjs so the output matches package.json's `exports` map.
    outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".mjs" }),
});
