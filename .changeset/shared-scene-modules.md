---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-skia": patch
"@canvas-tile-engine/renderer-webgl": patch
---

Internal refactor: the FPS loop, the debug HUD and the coordinate overlay are computed in one place instead of two.

- The rAF sampler behind `FPS: n`, the block that assembles the HUD strings from camera/viewport state, and the overlay's border geometry, font-size clamp and label loop were duplicated line for line between `renderer-shared` and `renderer-skia`. They move to a new `scene` entry point in the private `@canvas-tile-engine/renderer-shared` package; each renderer keeps only its paint calls (`fillRect`/`fillText` vs `drawRect`/`drawText`).
- Skia's HUD offset — the panel sits 50px lower so the status bar / notch does not hide it — is now the shared layout's `topOffset` argument rather than an undocumented divergence.
- `renderer-skia`'s `Layer` was a byte-for-byte reimplementation of the shared one; it now uses the shared manager, which restores Skia canvases to their save depth exactly as before. `DrawHandle` is re-exported from core (same shape) instead of from the deleted module.

No behavior change.
