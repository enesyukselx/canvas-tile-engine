import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    // resolve: inline react-shared's types into the bundled d.ts — the dts
    // step does not follow `noExternal`, and the public handle/props types
    // extend types from that private package.
    dts: { resolve: ["@canvas-tile-engine/react-shared"] },
    sourcemap: true,
    minify: true,
    clean: true,
    external: ["react", "react-dom"],
    // Emit .cjs/.mjs so the output matches package.json's `exports` map
    // (default tsup output is index.js/index.mjs, leaving `require` pointing
    // at a non-existent dist/index.cjs).
    outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".mjs" }),
    // react-shared is a private workspace package: bundle its TypeScript
    // source into dist so it never appears as a published dependency.
    noExternal: [/^@canvas-tile-engine\/react-shared/],
});
