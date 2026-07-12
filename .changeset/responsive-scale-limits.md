---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
---

Adapt scale limits to the container in responsive modes so the camera never lands outside the gesture-reachable zoom range after a resize.

- `ICamera` gains `setScaleLimits(minScale, maxScale)`; `Camera` limits are now mutable and setting them clamps the current scale into the new range.
- `"preserve-viewport"` rescales `minScale` with the base scale (it acts as a zoom-out factor of the configured `scale`), while `maxScale` keeps its configured px value as a zoom-in quality cap — lifted only when the base scale itself exceeds it. The wrapper no longer gets CSS `min-width`/`max-width` derived from the scale limits, so the canvas can shrink and grow with any container instead of overflowing narrow layouts.
- `"preserve-scale"` lowers the minimum zoom limit to track the scale at which finite `bounds` fit the viewport, keeping intents like "minScale shows the whole board" valid at every container width. The limit is never raised above the current scale, and configs without finite bounds keep their limits unchanged.
- Responsive resizes now update the viewport size before mutating the camera, so bounds clamping during a resize uses the new dimensions.
- `"preserve-viewport"` resizes that change the scale now fire `onZoom` with the new value (matching wheel/pinch and programmatic zoom changes), so scale-dependent app logic keeps working across container resizes. The initial responsive sizing runs during engine construction before callbacks attach; read the starting value with `getScale()` after mount.
