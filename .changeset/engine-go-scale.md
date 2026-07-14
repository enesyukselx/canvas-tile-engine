---
"@canvas-tile-engine/core": minor
---

Add `engine.goScale(targetScale, durationMs?, onComplete?)` - animated zoom, the `goCoords` counterpart for scale.

- Smoothly animates the scale to the target value (default 500ms, `0` = instant), anchored at the viewport center like `zoomIn`/`zoomOut`.
- Interpolation is geometric (log-space), so the zoom speed feels uniform across the whole range instead of front-loading the zoomed-in half.
- The target is clamped to `minScale`/`maxScale` up front, so the animation runs toward the effective value instead of saturating at the limit partway through.
- Fires `onZoom` on every frame that changes the scale and `onCoordsChange`/render per frame; composes with a concurrent `goCoords` animation for fly-to effects.
- Completes instantly in headless environments (no `requestAnimationFrame`), matching `goCoords`.
