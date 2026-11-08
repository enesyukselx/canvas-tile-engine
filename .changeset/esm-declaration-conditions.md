---
"@canvas-tile-engine/core": patch
"@canvas-tile-engine/react": patch
"@canvas-tile-engine/react-native": patch
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/renderer-skia": patch
"@canvas-tile-engine/renderer-server": patch
---

Give each `exports` condition a type declaration of its own module format: `import` now resolves to `dist/index.d.mts` (ESM) and `require` to `dist/index.d.ts` (CommonJS). Before, TypeScript read the CommonJS declaration for ESM imports too (flagged as "Masquerading as CJS" by arethetypeswrong and by publint), so with `moduleResolution` set to `NodeNext` or `bundler` it accepted a default import such as `import engine from "@canvas-tile-engine/core"`. No package has a default export, so that import then failed in Node or in the bundler. TypeScript now reports it at compile time; use named imports. The JavaScript entry points, the top-level `types` field and the declarations' contents are unchanged.
