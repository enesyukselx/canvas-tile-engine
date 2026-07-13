# Changelog

## 0.7.0

### Minor Changes

- ff94c7a: Add `engine.hitTest(point)` and `engine.hitTestFirst(point)` - item-level hit testing for rect, circle, and image items (including the `drawStatic*` variants), answering "which item is under this pointer?" without hand-written lookup maps or manual 0.5-cell offset math.

  - Pass `coords.raw` from event callbacks; origin anchoring, non-square Rect `width`/`height`, image aspect-fit, and rotation are handled internally - the hit box is always the drawn box.
  - Results are `{ item, kind, layer, handle, index }`, ordered by visual priority: higher layer first, then later registration, then later item within a draw call. `index` maps back into the items array passed to the draw call.
  - Optional `{ layer }` filter; draw calls with 500+ items are queried through a spatial index, so hover-frequency hit testing stays cheap at scale.
  - Implemented entirely in core via a registry maintained by the draw delegations - no renderer changes, works identically on every platform.
  - Limitations (v1): Line, Path, and Text items are not hit-testable; like rendering, item position mutations require re-registration to be reflected.

- 153eacc: Add `ImageItem.opacity` (0..1, default 1) for per-item image transparency - ghost/preview placements in editor-style apps no longer need a custom draw function that duplicates the engine's aspect-fit math.

  Applies in all four renderers, including the static image cache paths (`drawStaticImage`) and spritesheet frames. On the WebGL renderer, items with different opacities split the texture batch - keep same-opacity items grouped for best performance.

- fafe337: Non-square rectangles: `Rect` gains `width` / `height` (world units, both default to `size`, so existing square rects are unchanged). One 4x2 zone floor no longer needs thousands of one-cell rects or a custom draw function.

  - Origin anchoring works per axis (cell mode centers the box on the anchor cell, self mode anchors to the box itself); rotation spins around the box center; `radius` corner rounding works as before.
  - Viewport culling uses the `max(width, height)` extent and spatial-index bounding boxes account for the per-axis dimensions, so wide/tall bars are not culled while still reaching into view.
  - Static caches (`drawStaticRect`) compute their offscreen bounds from the per-axis dimensions.
  - Applies identically in all four renderers. `width`/`height` are Rect-only: Circle keeps `size` as diameter, Image keeps its aspect-fit `size` box.

- 38a5d18: Remove the dead `config.cursor` option. It has not been applied by any renderer since the modular renderer architecture refactor - the engine never touches `canvas.style.cursor`, so the option silently did nothing while the docs claimed otherwise.

  Cursor styling is fully owned by the application: set `engine.canvas.style.cursor` from the event callbacks (`onMouseDown`/`onMouseUp`/`onMouseLeave`/`onHover`). See the new "Managing the Cursor" section in the events docs for the recommended pattern - in particular, always reset the cursor in `onMouseLeave` too, because releasing the mouse button outside the canvas never fires `onMouseUp`.

  Passing `cursor` in the config is now a type error; delete the field. Runtime behavior is unchanged (it was already ignored).

- 1be475c: Text sizing: `size` now means true world-unit height, and a new `fontPx` mode renders zoom-independent labels.

  **Breaking:** text drawn with `size` renders ~3.3x larger than before. The previous implementation applied an undocumented `* 0.3` factor (`px = size * scale * 0.3`); pixel height is now exactly `size * scale`, matching the documented contract ("font size in world units"). To keep the old visual size, multiply existing `size` values by `0.3`.

  **New:** `Text.fontPx` renders text at a fixed pixel size regardless of zoom, for labels that must stay readable at any zoom level (map labels, names). Takes precedence over `size` when both are set. Viewport culling accounts for the fixed-size label's world-space extent (`fontPx / scale`).

## 0.6.0

### Minor Changes

- 79db244: Adapt scale limits to the container in responsive modes so the camera never lands outside the gesture-reachable zoom range after a resize.

  - `ICamera` gains `setScaleLimits(minScale, maxScale)`; `Camera` limits are now mutable and setting them clamps the current scale into the new range.
  - `"preserve-viewport"` rescales `minScale` with the base scale (it acts as a zoom-out factor of the configured `scale`), while `maxScale` keeps its configured px value as a zoom-in quality cap — lifted only when the base scale itself exceeds it. The wrapper no longer gets CSS `min-width`/`max-width` derived from the scale limits, so the canvas can shrink and grow with any container instead of overflowing narrow layouts.
  - `"preserve-scale"` lowers the minimum zoom limit to track the scale at which finite `bounds` fit the viewport, keeping intents like "minScale shows the whole board" valid at every container width. The limit is never raised above the current scale, and configs without finite bounds keep their limits unchanged.
  - Responsive resizes now update the viewport size before mutating the camera, so bounds clamping during a resize uses the new dimensions.
  - `"preserve-viewport"` resizes that change the scale now fire `onZoom` with the new value (matching wheel/pinch and programmatic zoom changes), so scale-dependent app logic keeps working across container resizes. The initial responsive sizing runs during engine construction before callbacks attach; read the starting value with `getScale()` after mount.

## 0.5.0

### Minor Changes

- 35f9532: Fix fixed-board centering: `gridToSize` now also returns the board `center` (`(columns-1)/2, (rows-1)/2`) to pass to the engine, and `gridAligned` snaps the initial center to the nearest aligned value instead of always flooring - half-integers for even tile counts (integer ties snap down, so a center computed as `N/2` lands on the true board center `(N-1)/2`), and integers for odd tile counts (previously not snapped at all). Non-integer tile counts are left untouched. This makes a `gridToSize` board of cells `0..N-1` exactly fill the viewport.

## 0.4.0

### Minor Changes

- 2068dac: Catch-up release: everything merged since 0.3.0.

  **Features**

  - Spritesheet & animation support: `ImageItem.sprite` (`SpriteRect`), `SpriteSheet` frame calculator (margin/spacing, `frame`/`frameByIndex`/`framesInRow`), and `SpriteAnimator` rAF loop that only re-renders on frame change (#107)
  - Zoom anchor modes for `eventHandlers.zoom` ("pointer" / "center") (#104)
  - Engine and renderer interfaces (`IRenderer`, `IDrawAPI`, `IImageLoader`) are now generic over mount/image types, enabling non-DOM renderers (server, React Native Skia)

  **Fixes**

  - Keep camera fixed during pinch zoom in "center" anchor mode (#105)
  - Fire `onZoom` for programmatic zoom changes; notify `onCoordsChange` when `setBounds` moves the camera; guard pinch zoom against near-zero start distance; validate `scale` against `minScale`/`maxScale`; complete animations instantly when duration is 0 (#100)

  **Breaking notes** (0.x minor)

  - The unused optional `renderer` property was removed from the config type — remove it from your config object if you passed it
  - `Config.get()` now returns a frozen snapshot — mutate config via the engine API instead of mutating the returned object (#100)

All notable changes to `@canvas-tile-engine/core` will be documented in this file.

## [0.3.0] - 2026-01-08

- Add @canvas-tile-engine/renderer-canvas package with Canvas2D implementation ([#59](https://github.com/enesyukselx/canvas-tile-engine/pull/59))
- Refactor core package to be DOM-agnostic with IRenderer interface
- Renderer now injected via constructor (dependency injection pattern)
- Update React package to accept renderer as prop
- Update docs, examples, and CI workflows for new architecture

## [0.2.0] - 2026-01-02

- fix(core): prevent accidental click after pinch-to-zoom
- feat(core): add config and runtime validation (#55)
- feat(core): add rotation support to drawText (#54)
- feat(core): refactor drawText API for consistency (#52)
- fix(core): set wrapper height for preserve-scale responsive mode (#49)
- fix(core): add touch tap support for click events (#48)

## [0.1.0] - 2025-12-27

- fix(core): correct gridAligned calculation for odd/even tile counts (#47)
- feat: add responsive mode with preserve-scale and preserve-viewport options (#46)
- feat: add gridToSize utility for grid-based configuration (#32)
- feat: add setScale method to public API (#45)
- fix(core): clamp static cache source rect to prevent mobile renderig issues (#34)
- fix(core): add touch event support for mouse callbacks (#33)

## [0.0.4] - 2025-12-24

- fix: improve lineWidth rendering consistency across browsers

## [0.0.3] - 2025-12-21

- feat: unify mouse event callback structures by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/24
- feat: add onRightClick callback for right-click events by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/30
- fix: ensure initial canvas top/left are set to 0 by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/25
- feat: add gridAligned config option for pixel-perfect grid alignment by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/28
- feat: add getVisibleBounds() to get visible viewport coordinates by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/29

## [0.0.2] - 2025-12-18

### Added

- **onZoom** callback for zoom level changes

## [0.0.1] - 2024-12-18

### Added

- **Camera System** - Pan, zoom, drag with smooth animations
- **Coordinate System** - Grid-based world coordinates with automatic transformations
- **Layer-based Rendering**
  - `drawRect` - Rectangles with rotation and border-radius
  - `drawCircle` - Circles sized in world units
  - `drawImage` - Images with rotation support
  - `drawLine` - Line segments
  - `drawPath` - Polylines
  - `drawText` - Text at world positions
  - `drawGridLines` - Grid overlay
- **Performance Optimizations**
  - Spatial indexing with R-Tree (rbush) for 10k+ items
  - Viewport culling - skip off-screen work
  - Static cache (`drawStaticRect`, `drawStaticImage`, `drawStaticCircle`)
- **Event Handling** - click, hover, drag, zoom, resize
- **Animation Controller** - `goCoords()` with smooth transitions
- **Bounds System** - Restrict camera movement
- **Debug HUD** - Coordinate overlay, FPS counter, viewport info
- **ImageLoader** - Async image loading with caching
