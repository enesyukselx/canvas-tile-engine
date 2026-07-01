import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    minify: true,
    clean: true,
    external: ["react", "react-dom"],
    // Emit .cjs/.mjs so the output matches package.json's `exports` map
    // (default tsup output is index.js/index.mjs, leaving `require` pointing
    // at a non-existent dist/index.cjs).
    outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".mjs" }),
});
