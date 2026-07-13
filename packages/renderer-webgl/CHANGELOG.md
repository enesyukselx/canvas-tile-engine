# @canvas-tile-engine/renderer-webgl

## 0.3.0

### Minor Changes

- 153eacc: Add `ImageItem.opacity` (0..1, default 1) for per-item image transparency - ghost/preview placements in editor-style apps no longer need a custom draw function that duplicates the engine's aspect-fit math.

  Applies in all four renderers, including the static image cache paths (`drawStaticImage`) and spritesheet frames. On the WebGL renderer, items with different opacities split the texture batch - keep same-opacity items grouped for best performance.

- fafe337: Non-square rectangles: `Rect` gains `width` / `height` (world units, both default to `size`, so existing square rects are unchanged). One 4x2 zone floor no longer needs thousands of one-cell rects or a custom draw function.

  - Origin anchoring works per axis (cell mode centers the box on the anchor cell, self mode anchors to the box itself); rotation spins around the box center; `radius` corner rounding works as before.
  - Viewport culling uses the `max(width, height)` extent and spatial-index bounding boxes account for the per-axis dimensions, so wide/tall bars are not culled while still reaching into view.
  - Static caches (`drawStaticRect`) compute their offscreen bounds from the per-axis dimensions.
  - Applies identically in all four renderers. `width`/`height` are Rect-only: Circle keeps `size` as diameter, Image keeps its aspect-fit `size` box.

- 1be475c: Text sizing: `size` now means true world-unit height, and a new `fontPx` mode renders zoom-independent labels.

  **Breaking:** text drawn with `size` renders ~3.3x larger than before. The previous implementation applied an undocumented `* 0.3` factor (`px = size * scale * 0.3`); pixel height is now exactly `size * scale`, matching the documented contract ("font size in world units"). To keep the old visual size, multiply existing `size` values by `0.3`.

  **New:** `Text.fontPx` renders text at a fixed pixel size regardless of zoom, for labels that must stay readable at any zoom level (map labels, names). Takes precedence over `size` when both are set. Viewport culling accounts for the fixed-size label's world-space extent (`fontPx / scale`).

### Patch Changes

- Updated dependencies [ff94c7a]
- Updated dependencies [153eacc]
- Updated dependencies [fafe337]
- Updated dependencies [38a5d18]
- Updated dependencies [1be475c]
  - @canvas-tile-engine/core@0.7.0

## 0.2.0

### Minor Changes

- 79db244: Adapt scale limits to the container in responsive modes so the camera never lands outside the gesture-reachable zoom range after a resize.

  - `ICamera` gains `setScaleLimits(minScale, maxScale)`; `Camera` limits are now mutable and setting them clamps the current scale into the new range.
  - `"preserve-viewport"` rescales `minScale` with the base scale (it acts as a zoom-out factor of the configured `scale`), while `maxScale` keeps its configured px value as a zoom-in quality cap — lifted only when the base scale itself exceeds it. The wrapper no longer gets CSS `min-width`/`max-width` derived from the scale limits, so the canvas can shrink and grow with any container instead of overflowing narrow layouts.
  - `"preserve-scale"` lowers the minimum zoom limit to track the scale at which finite `bounds` fit the viewport, keeping intents like "minScale shows the whole board" valid at every container width. The limit is never raised above the current scale, and configs without finite bounds keep their limits unchanged.
  - Responsive resizes now update the viewport size before mutating the camera, so bounds clamping during a resize uses the new dimensions.
  - `"preserve-viewport"` resizes that change the scale now fire `onZoom` with the new value (matching wheel/pinch and programmatic zoom changes), so scale-dependent app logic keeps working across container resizes. The initial responsive sizing runs during engine construction before callbacks attach; read the starting value with `getScale()` after mount.

### Patch Changes

- Updated dependencies [79db244]
  - @canvas-tile-engine/core@0.6.0

## 0.1.1

### Patch Changes

- Updated dependencies [35f9532]
  - @canvas-tile-engine/core@0.5.0
