import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    minify: true,
    clean: true,
    // rbush@4 is ESM-only, so leaving it external breaks the CJS build with
    // ERR_REQUIRE_ESM. Bundle it in so the CJS output is self-contained.
    noExternal: ["rbush"],
    // Emit .cjs/.mjs so the output matches package.json's `exports` map
    // (default tsup output is index.js/index.mjs, leaving `require` pointing
    // at a non-existent dist/index.cjs).
    outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".mjs" }),
});
