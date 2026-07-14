---
"@canvas-tile-engine/renderer-webgl": patch
---

Emit `.cjs`/`.mjs` build output so dist files match the `exports` map in package.json. Previously `require` resolved to a non-existent `dist/index.cjs`.
