# @canvas-tile-engine/renderer-canvas

## 0.3.0

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

## 0.2.1

### Patch Changes

- Updated dependencies [35f9532]
  - @canvas-tile-engine/core@0.5.0

## 0.2.0

### Minor Changes

- 2068dac: Catch-up release: everything merged since 0.1.1.

  **Features**

  - Sprite rect support in `drawImage`/`drawStaticImage` (draws a sub-rectangle of a spritesheet via `ImageItem.sprite`) (#107)

  **Fixes**

  - Fix double render on init, `lineWidth` state leaking between draws, and static-cache rendering parity with the dynamic path (#98)

  **Compatibility**

  - Requires `@canvas-tile-engine/core` >= 0.4.0 (peer dependency raised)

### Patch Changes

- 2068dac: Publish internal `@canvas-tile-engine/core` dependency as a caret range (`^x.y.z`) instead of an exact pin, so core patch/minor updates flow to consumers without requiring a re-release of dependent packages.
- Updated dependencies [2068dac]
  - @canvas-tile-engine/core@0.4.0
