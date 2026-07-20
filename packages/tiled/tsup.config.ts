import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    minify: true,
    clean: true,
    external: ["@canvas-tile-engine/core", "fflate"],
    // Emit .cjs/.mjs so the output matches package.json's `exports` map.
    outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".mjs" }),
});
