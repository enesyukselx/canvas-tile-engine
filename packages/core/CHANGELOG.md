# Changelog

## 0.9.0

### Minor Changes

- 3f963dc: Rename the view-center APIs for consistency with the `getScale`/`setScale`/`goScale` family: `getCenter()` (was `getCenterCoords`), `setCenter()` (was `updateCoords`), and `goCenter()` (was `goCoords`). The old names keep working as deprecated aliases — no breaking change — and will be removed in a future major version. The React and React Native engine handles expose both sets.
- 90db398: Add `engine.fitBounds(bounds, options?)`: fit a world-space rectangle into the viewport by centering on it and picking the largest scale that keeps the whole area visible, clamped to the scale limits (including runtime `setScaleLimits`). Options: `padding` (world units, default 0), `durationMs` (default 500, 0 = instant — animates center and scale together), `onComplete`. Rejects non-finite bounds, `min >= max` axes, and negative padding with a `ConfigValidationError`. Exposed on the React and React Native engine handles. Not related to `setBounds`, which restricts camera movement.
- 5ff7617: `hitTestRect` — marquee/box-selection region queries

  `engine.hitTestRect(rect, { layer?, mode? })` returns every item whose geometry intersects (default) or lies fully inside (`mode: "contain"`) a world rectangle, in the same visual-priority order as `hitTest`. Corners may be passed in any order — build them from drag-start/end `coords.raw` values. Geometry is tested exactly: circles as discs (not bounding boxes), rotated rects/images as convex quads, lines as segments, and paths against their flattened subpaths with filled interiors counting and holes excluded. Both React handles expose the same method (empty before mount).

- e9b8aa0: Path v2 phase 2: free-form `commands` — curves, arcs, subpaths, holes

  `PathItem` gains a Canvas2D-style `commands` list (`moveTo` / `lineTo` / `arc` / `quadraticCurveTo` / `bezierCurveTo` / `closePath`; world units, angles in degrees) as the free-form alternative to the `points` polyline. Each `moveTo` starts a new subpath, so one item can be an outline plus holes: under `evenodd` any overlapping subpath punches a hole, under `nonzero` a hole winds opposite its outer ring — Canvas2D `fill()` semantics on every renderer (Canvas2D/server/Skia replay natively; WebGL flattens through a shared core implementation with a 2× scale-bucket cache and fills via multi-ring stencil winding).

  Hit testing follows the same geometry: filled command paths hit on their interior with holes excluded, curves hit on the actual flattened curve, strokes on every subpath. `closed` and `cornerRadius` remain `points`-form sugar — with `commands`, use `closePath` and explicit arcs.

- 4a5eecd: Path v2: free-form `PathItem` paths with fill and hit testing

  `drawPath` (and the React/React Native `Path` component) now accepts `PathItem` objects: `{ points, closed, fillRule, style, data }`. Paths can be closed, filled under a `nonzero`/`evenodd` fill rule, styled per item (stroke, dash, and new `cornerRadius`/`cornerRadiusPx` tangent-arc corner rounding on the shared world-vs-px unit convention), and carry app `data`. The legacy bare-`Coords[]` form with a call-level style keeps working but is deprecated.

  Paths and lines join hit testing: filled paths hit on their interior, unfilled paths and lines hit within half the stroke width of the geometry (resolved against the live camera scale, with a minimum tap width so hairlines stay tappable). `Line` items accept an optional `data` field, and `engine.drawLine` accepts the full `LineStyle` (dash included).

  All four renderers implement the new form with identical corner-arc geometry via the shared `traceRoundedPath`/`cornerArc` helpers, and path fills are exact everywhere: WebGL fills through a two-pass stencil-then-cover pass, so both fill rules match Canvas2D on self-intersecting outlines and translucent fills show no self-overlap seams.

- 92afd33: **Breaking:** removed all deprecated APIs

  - `getCenterCoords()` / `updateCoords()` / `goCoords()` are gone — use `getCenter()` / `setCenter()` / `goCenter()` (same behavior, renamed in the previous release).
  - `drawPath`'s legacy bare-coordinates form (`Coords[]` / `Coords[][]` with a call-level style argument) is gone — pass `PathItem` objects: `drawPath({ points, style }, layer)`. The React/React Native `Path` component loses its `style` prop the same way (`PathItem` carries its own style), and the deprecated `Path = Coords[]` type alias is no longer exported.

- 97cdb9e: Add `engine.setScaleLimits(minScale, maxScale)` for adjusting the min/max zoom limits at runtime, alongside `setScale` and `setEventHandlers`. All zooming (gestures and programmatic) clamps to the new range, and the current scale is clamped into it immediately (firing `onZoom` when it changes). Invalid limits (non-positive, non-finite, or `minScale > maxScale`) throw a `ConfigValidationError`. The React and React Native engine handles expose the new method.
- 4222d1e: **Behavior change:** `setScale` is now anchored at the viewport center, matching `goScale`, `zoomIn`, and `zoomOut`. Previously it anchored at the top-left corner, so the view drifted toward the bottom-right when zooming in — `setScale(n)` and `goScale(n, 0)` produced different views. They are now equivalent. If you relied on the old top-left anchoring, re-position with `setCenter` after the scale change.
- e32b9ee: `sizePx` on Circle/Image and `flipX`/`flipY` on ImageItem

  `sizePx` is the marker-pattern analog of Text's `fontPx`: a fixed screen-pixel size (circle diameter / image box), independent of zoom, taking precedence over the world-unit `size`. Hit testing resolves it against the live camera scale, and culling accounts for pixel items' world extent growing as the camera zooms out. `drawStaticCircle`/`drawStaticImage` ignore `sizePx` on every renderer — static caches replay at a recorded scale, so pixel sizing cannot hold there.

  `flipX`/`flipY` mirror an image around its draw box center — a true mirror, which no rotation can produce (one right-facing sprite serves both directions). They combine with `rotate` (mirror first, rotation second) and spritesheet `sprite` frames, work in static image draws, and don't affect hit geometry.

- be54576: Add an `onWheel` callback for wheel (desktop) and pinch (touch) zoom gestures. Unlike `onZoom`, which reports the resulting scale, `onWheel` reports the input gesture itself: the standard `coords`/`mouse`/`client` payload (the pinch midpoint on touch) plus `{ deltaY, direction, source }`, and it fires even when the scale is clamped at a limit. `deltaY` is negative when zooming in; for pinch it is synthesized as the wheel delta that would produce the same zoom factor, so both sources read on one axis. Requires `eventHandlers.zoom`; no new config flag. Exposed as an engine property, on all interactive renderers, and as an `onWheel` prop in the React and React Native components.

## 0.8.0

### Minor Changes

- c4c5c01: Custom draw callbacks receive ready-made coordinate transform helpers, so user code never re-derives the `(world - topLeft) * scale` formula or the cell-center offset. `addDrawFunction` callbacks (and the React/RN `DrawFunction` children) get a fourth `transform` argument with `worldToScreen(x, y)` (item-space in, integers are cell centers) and `screenToWorld(x, y)` (raw corner-space out, like event `coords.raw`); existing three-argument callbacks keep working.

  **BREAKING:** `onDraw` now uses the same signature as `addDrawFunction`: `(ctx, coords, config, transform)` instead of `(ctx, info)`. Migration: `info.scale` → `config.scale`, `info.width`/`info.height` → `config.size.width`/`config.size.height`, `info.coords` → the `coords` argument.

- 030cbdd: Add `engine.goScale(targetScale, durationMs?, onComplete?)` - animated zoom, the `goCoords` counterpart for scale.

  - Smoothly animates the scale to the target value (default 500ms, `0` = instant), anchored at the viewport center like `zoomIn`/`zoomOut`.
  - Interpolation is geometric (log-space), so the zoom speed feels uniform across the whole range instead of front-loading the zoomed-in half.
  - The target is clamped to `minScale`/`maxScale` up front, so the animation runs toward the effective value instead of saturating at the limit partway through.
  - Fires `onZoom` on every frame that changes the scale and `onCoordsChange`/render per frame; composes with a concurrent `goCoords` animation for fly-to effects.
  - Completes instantly in headless environments (no `requestAnimationFrame`), matching `goCoords`.

- 204ec08: Add `padding` and `paddingPx` to `HitTestOptions` - generous touch targets for `hitTest`/`hitTestFirst` without invisible helper items.

  - `padding` (world units) expands every tested item's hit geometry outward: circles gain radius, rect/image boxes grow on every side (in the item's rotated frame, so rotation keeps working).
  - `paddingPx` (screen pixels) is zoom-independent: the engine converts it with the current scale at query time, so targets stay finger-sized at any zoom. Combined additively with `padding`.
  - The spatial-index query on the 500+ item path widens by the padding too, so no edge candidates are missed.
  - Negative values are treated as 0. React and React Native handles pick the options up automatically (`HitTestOptions` is re-exported from core).

- a959abc: Add an optional `data` field to drawable items (`Rect`, `Circle`, `ImageItem`, `Text`) for attaching arbitrary app data, typed through a new `TData` generic parameter (`Rect<TData>`, `ImageItem<TImage, TData>`, ...) that defaults to `unknown` - fully backward compatible.

  - The engine and renderers never read `data`; it is carried through so `hitTest` results can identify the hit item via `hit.item.data` instead of the position-based `index`, which goes stale when a filtered or re-ordered items array is re-drawn.
  - `hitTest<TData>(point)` / `hitTestFirst<TData>(point)` (core and the React / React Native hook handles) accept a type parameter that types `hit.item.data` on the results - a compile-time assertion, not a runtime check.
  - `HitResult` gains a second generic parameter: `HitResult<TImage, TData = unknown>`.

- b8e76ca: **BREAKING:** `style.lineWidth` and `radius` are now world units and scale with zoom, matching item geometry and Text's `size`/`fontPx` precedent (previously they were fixed screen pixels). Migration: keep old visuals with the new `lineWidthPx`; divide old radius values by your typical scale (e.g. `radius: 8` at scale 40 becomes `radius: 0.2`). GridLines keep their zoom-independent pixel width. This also makes Skia static-picture replay consistent with dynamic drawing instead of a documented quirk.

  **New:** dashed Line/Path rendering via `LineStyle.lineDash` (world units, dashes anchored to the world) and `lineDashPx` (screen pixels). Follows Canvas2D `setLineDash` semantics; the pattern flows continuously around Path corners on every renderer (WebGL tessellates dashes on the CPU). Shared unit resolvers (`resolveLineWidthPx`, `resolveLineDashPx`, `resolveRadiusPx`) are exported from core.

### Patch Changes

- 8fe841d: Close config validation gaps: size limits (`minWidth`/`maxWidth`/`minHeight`/`maxHeight`) now reject NaN, non-number values, and `Infinity` min limits (Infinity stays valid for max limits); bounds now reject NaN and degenerate infinite pairs like `minX: Infinity`, which previously slipped through and silently blanked the canvas via NaN camera math. `-Infinity`/`Infinity` remain valid for unbounded axes.
- 87614ab: Fix `onResize` firing twice after a programmatic `resize()`. The engine mirrors the callback into the renderer, whose resize completion already invokes it; the engine no longer invokes it a second time from its own completion handler. Watcher-driven (responsive/resize-event) notifications are unaffected.

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
