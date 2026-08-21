---
"@canvas-tile-engine/core": patch
---

Fix: `onZoom` no longer fires on wheel and pinch gestures that leave the scale unchanged.

Every camera-mutating API on the engine — `setScale`, `goScale`, `zoomIn`, `zoomOut`, `setScaleLimits`, `fitBounds` — already compares the scale before and after and skips the callback when clamping made the change a no-op. The gesture path did not: `handleWheel` and the pinch branch of `handleTouchMove` called `onZoom(camera.scale)` unconditionally. A user sitting at `maxScale` and still scrolling got one `onZoom` with the same scale per wheel event, so anything non-idempotent behind it — a React `setState`, an analytics event, a fetch for a new tile level — fired repeatedly for a zoom that never happened. A pinch that held its finger distance did the same.

Both gesture paths now capture the scale before zooming and notify only on an actual change, matching the programmatic paths and the documented contract. `onWheel` is unaffected: it reports the input gesture, and is explicitly documented to fire at a limit.
