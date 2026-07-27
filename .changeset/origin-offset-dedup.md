---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/renderer-skia": patch
---

refactor: dedupe origin-offset math into `resolveOrigin`/`computeOriginOffset`, newly exported from `@canvas-tile-engine/core` and shared by all renderers and hit testing. No behavior change.
