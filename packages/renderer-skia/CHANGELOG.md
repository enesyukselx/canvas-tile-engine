# @canvas-tile-engine/renderer-skia

## 0.6.1

### Patch Changes

- 1b68c1d: Fix: the renderers' color caches no longer grow without bound, so `styleOf` can compute a color string per frame the way it is documented to.

  Both renderers memoize parsed colors keyed on the raw CSS string, and both only dropped that map on destroy. That is right for a fixed palette, but the natural way to write a pulse, a heat map, or a fade is a computed string — a `styleOf` returning `fillStyle: "hsl(" + item.data.load * 120 + ", 70%, 50%)"` — and every distinct value it ever produced stayed resident for the renderer's lifetime. A 60fps animation over a large item set added tens of thousands of entries per minute.

  - Both caches are now a fixed-capacity LRU. The bound is sized per renderer — 4096 entries in `renderer-webgl`, 8192 in `renderer-skia`, where a miss is a native call rather than an inline parse — so it clears the working set even when `styleOf` gives every cell on screen its own color. A palette that is touched every frame stays resident; computed one-off colors cost a fixed amount of memory instead of one permanent entry each.
  - `renderer-webgl` additionally parses the `#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa`, `rgb()`/`rgba()`, and `hsl()`/`hsla()` forms inline, in both the legacy comma and the modern space/slash syntaxes. Those were previously normalized by painting onto a 1x1 canvas and reading the pixel back — a GPU-to-CPU sync per new color, per frame, which the bound alone would have made more frequent. Everything else (named colors, `color-mix()`, `oklch()`, ...) still goes through the canvas, unchanged.

  Colors render the same. The inline path keeps full float precision where the pixel readback quantized to 8 bits per channel, so an `hsl()` or fractional-alpha value can differ from the old result by less than 1/255.

- 91b4014: Internal: the renderer's animation controller now receives the engine's config as its motion policy, so `resizeWithAnimation` honors the reduced-motion preference like every other engine animation. No API change; the React Native binding supplies the platform signal.
- 3ca8eee: Internal refactor: the world-space geometry every renderer's draw pipeline duplicated now comes from one place.

  - Per-item path culling bounds (control-point hull for command paths, vertex box for polylines) was a byte-identical block in all three draw pipelines. They now call core's `pathItemBounds`.
  - `getViewportBounds` / `isVisible` were identical private methods in each pipeline; they move to a new `geometry` entry point in the private `@canvas-tile-engine/renderer-shared` package, so the viewport-plus-tile-buffer formula is stated once instead of six times. Renderer-only helpers stay out of core's public API.
  - `renderer-skia` now consumes `renderer-shared` like the other three renderers (bundled source, nothing new on npm).

  No behavior change.

- 868229a: Internal refactor: the FPS loop, the debug HUD and the coordinate overlay are computed in one place instead of two.

  - The rAF sampler behind `FPS: n`, the block that assembles the HUD strings from camera/viewport state, and the overlay's border geometry, font-size clamp and label loop were duplicated line for line between `renderer-shared` and `renderer-skia`. They move to a new `scene` entry point in the private `@canvas-tile-engine/renderer-shared` package; each renderer keeps only its paint calls (`fillRect`/`fillText` vs `drawRect`/`drawText`).
  - Skia's HUD offset — the panel sits 50px lower so the status bar / notch does not hide it — is now the shared layout's `topOffset` argument rather than an undocumented divergence.
  - `renderer-skia`'s `Layer` was a byte-for-byte reimplementation of the shared one; it now uses the shared manager, which restores Skia canvases to their save depth exactly as before. `DrawHandle` is re-exported from core (same shape) instead of from the deleted module.
  - The sampler's stop path is fixed on the way: stopping now cancels the frame the last tick queued and starting clears the sample window. Stopping and restarting within the same frame previously left two chained loops running, which roughly doubled the reported `FPS: n` for the rest of the session; the HUD never reached that path, so no released renderer showed it.

  No other behavior change.

- 576f4b7: Fix: `drawStaticRect` sized its picture cull rect from `size` alone, so a rect with per-axis `width`/`height` recorded outside its own bounds — `drawStaticRect([{ x: 0, y: 0, width: 8, height: 2 }])` painted 25px past the left edge at scale 10. Skia may quick-reject or clip against that rect, and the Canvas2D static cache already accounted for `width`/`height`, so the two renderers disagreed on the same input. Both now derive the box from the shared `itemsBounds` helper.
- Updated dependencies [819dd99]
- Updated dependencies [819dd99]
- Updated dependencies [f6c4f64]
- Updated dependencies [576f4b7]
- Updated dependencies [c3a6381]
- Updated dependencies [91b4014]
- Updated dependencies [e7509c1]
- Updated dependencies [467b077]
  - @canvas-tile-engine/core@0.12.0

## 0.6.0

### Minor Changes

- 2670beb: feat: per-item Line style

  - `Line` items accept an optional `style?: LineStyle`, overriding the call-level `drawLine` style per item — mixed-style batches no longer need one `drawLine` call per style, and the last primitive without item-level styling joins the Rect/Circle/Path/Text convention. The call-level style stays as the batch default; `styleOf` decorations still overlay both at paint time.
  - Because item styles are registration-time (unlike paint-time `styleOf` decorations), they may change `lineWidth`/`lineWidthPx`: hit testing resolves the item's own stroke width, so a thick line gets a matching hit area — the first way to give individual lines their own width. Renderers resolve the painted width from these same registration-time layers only, so a width smuggled past the decoration types at runtime (JS callers, non-literal returns) can never desync the painted stroke from the hit corridor.
  - Styles overlay unit pair by unit pair via the new shared `overlayLineStyle` helper (exported from core): a layer that sets either field of a pair (`lineWidth`/`lineWidthPx`, `lineDash`/`lineDashPx`) replaces the whole pair, so an item's world-unit value is never shadowed by the batch's `*Px` value. This also fixes a latent `styleOf` merge bug where a dash decoration could be shadowed by a call-level `lineDashPx`.
  - Renderer batching is preserved: runs of lines on the shared batch style still collapse into a single stroke (Canvas2D/server); items with their own style stroke solo, exactly like decorated items already did. WebGL maps overrides onto its per-instance color/width/dash; Skia mutates and restores the shared stroke paint.

- c5c51a2: feat: dashed borders for Rect and Circle

  - `DrawObject.style` (used by `drawRect`, `drawCircle`, and their static variants) accepts `lineDash` and `lineDashPx`, completing the stroke unit convention the shapes already follow for `lineWidth`/`lineWidthPx`: `lineDash` is world units and scales with zoom, `lineDashPx` is screen pixels and wins when both are set. Semantics match Canvas2D `setLineDash` (odd-length patterns repeat; empty, negative, or zero-sum patterns fall back to solid) — the same contract `Line` and `Path` styles already use.
  - All four renderers apply the pattern to shape borders: Canvas2D and server via `setLineDash` around the stroke, Skia via a dash path effect on the stroke paint, WebGL by tessellating the border into dash sub-segments on the CPU — the dash phase flows continuously around rect corners and circle outlines.
  - Because the fields live on `DrawObject.style`, they are also available in `styleOf` decorations: a dashed selection or hover outline is a paint-time state change, no re-registration.
  - Static draw variants support dashed borders too. World-unit `lineDash` holds everywhere; `lineDashPx` follows the same static-path rules as `lineWidthPx` (Canvas2D/server caches rebuild per scale so it stays pixel-accurate; Skia pictures bake it at the record scale — use dynamic draws when a zoom-independent px pattern must hold).

- c561670: Add `visibleOf` and `interactiveOf` per-item callbacks alongside `styleOf`.

  - `visibleOf(item)`: return `false` to skip an item for the frame — it is neither painted nor hit-testable. Like `styleOf`, it reads external state live: mutate a filter set and call `render()` without re-registering or rebuilding the spatial index. Available on `drawRect`, `drawCircle`, `drawText`, `drawLine`, `drawPath`, and `drawImage` (dynamic draws only, like `styleOf`).
  - `interactiveOf(item)`: return `false` to keep an item out of `hitTest`/`hitTestFirst`/`hitTestRect` while it stays painted — the per-item counterpart of `hitTest: false`. Queries fall through to items below it. Items hidden by `visibleOf` never hit-test, regardless of this callback. Available on the hit-tested kinds (`drawRect`, `drawCircle`, `drawImage`, `drawLine`, `drawPath`).

  `drawImage` gains an options object (`ImageDrawOptions`) carrying `id`, `hitTest`, and the two new callbacks; it still has no `styleOf` — images carry no `style`, appearance changes go through item fields like `opacity` (read live at paint time).

  The React and React Native `Rect`, `Circle`, `Image`, `Line`, `Text`, and `Path` components accept matching `visibleOf`/`interactiveOf` props (`Text`: `visibleOf` only), read through refs like `styleOf` so identity changes never re-register.

### Patch Changes

- b9b2e0e: refactor: dedupe origin-offset math into `resolveOrigin`/`computeOriginOffset`, newly exported from `@canvas-tile-engine/core` and shared by all renderers and hit testing. No behavior change.
- 22167f8: fix: path decorations can no longer change painted stroke width or corner radius

  `PathDecorationStyle` excludes `lineWidth*`/`cornerRadius*` because hit-test geometry resolves at registration time — but that guard is type-level only, and TypeScript's excess-property check does not fire on non-literal returns (or in plain JS). A width or corner radius smuggled into a `styleOf` decoration was applied when painting while hit testing kept the registration-time values: a silent visual/interaction desync. Renderers now resolve geometry-feeding values (stroke width, corner radius) from the registration-time `item.style` only — the same layer hit testing reads — so the desync is structurally impossible. Decoration color, dash, and fill behavior are unchanged.

- Updated dependencies [d35db27]
- Updated dependencies [3696d8c]
- Updated dependencies [77d471c]
- Updated dependencies [2670beb]
- Updated dependencies [b9b2e0e]
- Updated dependencies [c5c51a2]
- Updated dependencies [c561670]
  - @canvas-tile-engine/core@0.11.0

## 0.5.0

### Minor Changes

- dae6f9b: feat: styleOf — paint-time decoration without re-registration

  - The dynamic engine draw methods (`drawRect`, `drawCircle`, `drawText`, `drawLine`, `drawPath`) accept an optional `styleOf` callback in their `options`. It runs per item on every frame at paint time; the returned fields overlay the item's own `style` for that frame (`undefined` leaves the item untouched). Because it resolves at paint time it reads external state live: mutate a selection/hover set and call `render()` — items are never re-registered and the spatial index never rebuilds, turning selection updates from O(n) alloc + index rebuild into an O(1) state change plus repaint.
  - Decoration types are narrowed where style feeds hit-test geometry: `Line` and `PathItem` decorations exclude `lineWidth`/`lineWidthPx` (and `cornerRadius`/`cornerRadiusPx` for paths), which are resolved at registration time. Rect/circle/text decorations allow the full style. For `drawLine`, `styleOf` overlays the call-level `style` per item — also the first way to give individual lines their own color. Paint order is preserved on every renderer: array order stays z-order (Canvas2D renderers batch undecorated runs contiguously and stroke decorated lines in place), matching hit-test's "later item wins" priority.
  - React and React Native: the `Rect`, `Circle`, `Text`, `Line`, and `Path` components accept a `styleOf` prop. It is read through a ref, so its identity may change on every render at no cost (inline arrows are fine); a change only repaints. `useMemo` discipline now applies to `items` (geometry) only. The imperative `EngineHandle` draw methods also accept the new `options` parameter (including `id`).
  - Static draw methods intentionally do not support `styleOf`: caches replay a recorded picture, so per-frame decoration cannot apply. Changing styles is dynamic content — use the dynamic methods with `styleOf`, or an overlay registration.

### Patch Changes

- Updated dependencies [e79724c]
- Updated dependencies [dae6f9b]
  - @canvas-tile-engine/core@0.10.0

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
