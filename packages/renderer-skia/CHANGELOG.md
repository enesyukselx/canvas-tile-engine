# @canvas-tile-engine/renderer-skia

## 0.4.0

### Minor Changes

- e9b8aa0: Path v2 phase 2: free-form `commands` — curves, arcs, subpaths, holes

  `PathItem` gains a Canvas2D-style `commands` list (`moveTo` / `lineTo` / `arc` / `quadraticCurveTo` / `bezierCurveTo` / `closePath`; world units, angles in degrees) as the free-form alternative to the `points` polyline. Each `moveTo` starts a new subpath, so one item can be an outline plus holes: under `evenodd` any overlapping subpath punches a hole, under `nonzero` a hole winds opposite its outer ring — Canvas2D `fill()` semantics on every renderer (Canvas2D/server/Skia replay natively; WebGL flattens through a shared core implementation with a 2× scale-bucket cache and fills via multi-ring stencil winding).

  Hit testing follows the same geometry: filled command paths hit on their interior with holes excluded, curves hit on the actual flattened curve, strokes on every subpath. `closed` and `cornerRadius` remain `points`-form sugar — with `commands`, use `closePath` and explicit arcs.

- 4a5eecd: Path v2: free-form `PathItem` paths with fill and hit testing

  `drawPath` (and the React/React Native `Path` component) now accepts `PathItem` objects: `{ points, closed, fillRule, style, data }`. Paths can be closed, filled under a `nonzero`/`evenodd` fill rule, styled per item (stroke, dash, and new `cornerRadius`/`cornerRadiusPx` tangent-arc corner rounding on the shared world-vs-px unit convention), and carry app `data`. The legacy bare-`Coords[]` form with a call-level style keeps working but is deprecated.

  Paths and lines join hit testing: filled paths hit on their interior, unfilled paths and lines hit within half the stroke width of the geometry (resolved against the live camera scale, with a minimum tap width so hairlines stay tappable). `Line` items accept an optional `data` field, and `engine.drawLine` accepts the full `LineStyle` (dash included).

  All four renderers implement the new form with identical corner-arc geometry via the shared `traceRoundedPath`/`cornerArc` helpers, and path fills are exact everywhere: WebGL fills through a two-pass stencil-then-cover pass, so both fill rules match Canvas2D on self-intersecting outlines and translucent fills show no self-overlap seams.

- e32b9ee: `sizePx` on Circle/Image and `flipX`/`flipY` on ImageItem

  `sizePx` is the marker-pattern analog of Text's `fontPx`: a fixed screen-pixel size (circle diameter / image box), independent of zoom, taking precedence over the world-unit `size`. Hit testing resolves it against the live camera scale, and culling accounts for pixel items' world extent growing as the camera zooms out. `drawStaticCircle`/`drawStaticImage` ignore `sizePx` on every renderer — static caches replay at a recorded scale, so pixel sizing cannot hold there.

  `flipX`/`flipY` mirror an image around its draw box center — a true mirror, which no rotation can produce (one right-facing sprite serves both directions). They combine with `rotate` (mirror first, rotation second) and spritesheet `sprite` frames, work in static image draws, and don't affect hit geometry.

- be54576: Add an `onWheel` callback for wheel (desktop) and pinch (touch) zoom gestures. Unlike `onZoom`, which reports the resulting scale, `onWheel` reports the input gesture itself: the standard `coords`/`mouse`/`client` payload (the pinch midpoint on touch) plus `{ deltaY, direction, source }`, and it fires even when the scale is clamped at a limit. `deltaY` is negative when zooming in; for pinch it is synthesized as the wheel delta that would produce the same zoom factor, so both sources read on one axis. Requires `eventHandlers.zoom`; no new config flag. Exposed as an engine property, on all interactive renderers, and as an `onWheel` prop in the React and React Native components.

### Patch Changes

- Updated dependencies [3f963dc]
- Updated dependencies [90db398]
- Updated dependencies [5ff7617]
- Updated dependencies [e9b8aa0]
- Updated dependencies [4a5eecd]
- Updated dependencies [92afd33]
- Updated dependencies [97cdb9e]
- Updated dependencies [4222d1e]
- Updated dependencies [e32b9ee]
- Updated dependencies [be54576]
  - @canvas-tile-engine/core@0.9.0

## 0.3.0

### Minor Changes

- c4c5c01: Custom draw callbacks receive ready-made coordinate transform helpers, so user code never re-derives the `(world - topLeft) * scale` formula or the cell-center offset. `addDrawFunction` callbacks (and the React/RN `DrawFunction` children) get a fourth `transform` argument with `worldToScreen(x, y)` (item-space in, integers are cell centers) and `screenToWorld(x, y)` (raw corner-space out, like event `coords.raw`); existing three-argument callbacks keep working.

  **BREAKING:** `onDraw` now uses the same signature as `addDrawFunction`: `(ctx, coords, config, transform)` instead of `(ctx, info)`. Migration: `info.scale` → `config.scale`, `info.width`/`info.height` → `config.size.width`/`config.size.height`, `info.coords` → the `coords` argument.

- b8e76ca: **BREAKING:** `style.lineWidth` and `radius` are now world units and scale with zoom, matching item geometry and Text's `size`/`fontPx` precedent (previously they were fixed screen pixels). Migration: keep old visuals with the new `lineWidthPx`; divide old radius values by your typical scale (e.g. `radius: 8` at scale 40 becomes `radius: 0.2`). GridLines keep their zoom-independent pixel width. This also makes Skia static-picture replay consistent with dynamic drawing instead of a documented quirk.

  **New:** dashed Line/Path rendering via `LineStyle.lineDash` (world units, dashes anchored to the world) and `lineDashPx` (screen pixels). Follows Canvas2D `setLineDash` semantics; the pattern flows continuously around Path corners on every renderer (WebGL tessellates dashes on the CPU). Shared unit resolvers (`resolveLineWidthPx`, `resolveLineDashPx`, `resolveRadiusPx`) are exported from core.

### Patch Changes

- Updated dependencies [8fe841d]
- Updated dependencies [87614ab]
- Updated dependencies [c4c5c01]
- Updated dependencies [030cbdd]
- Updated dependencies [204ec08]
- Updated dependencies [a959abc]
- Updated dependencies [b8e76ca]
  - @canvas-tile-engine/core@0.8.0

## 0.2.0

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

## 0.1.2

### Patch Changes

- Updated dependencies [79db244]
  - @canvas-tile-engine/core@0.6.0

## 0.1.1

### Patch Changes

- Updated dependencies [35f9532]
  - @canvas-tile-engine/core@0.5.0
