---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-skia": patch
"@canvas-tile-engine/renderer-webgl": patch
---

Internal refactor: the world-space geometry every renderer's draw pipeline duplicated now comes from one place.

- Per-item path culling bounds (control-point hull for command paths, vertex box for polylines) was a byte-identical block in all three draw pipelines. They now call core's `pathItemBounds`.
- `getViewportBounds` / `isVisible` were identical private methods in each pipeline; they move to a new `geometry` entry point in the private `@canvas-tile-engine/renderer-shared` package, so the viewport-plus-tile-buffer formula is stated once instead of six times. Renderer-only helpers stay out of core's public API.
- `renderer-skia` now consumes `renderer-shared` like the other three renderers (bundled source, nothing new on npm).

No behavior change.
