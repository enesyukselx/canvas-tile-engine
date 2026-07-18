# @canvas-tile-engine/react-native

## 0.4.0

### Minor Changes

- 3f963dc: Rename the view-center APIs for consistency with the `getScale`/`setScale`/`goScale` family: `getCenter()` (was `getCenterCoords`), `setCenter()` (was `updateCoords`), and `goCenter()` (was `goCoords`). The old names keep working as deprecated aliases — no breaking change — and will be removed in a future major version. The React and React Native engine handles expose both sets.
- 90db398: Add `engine.fitBounds(bounds, options?)`: fit a world-space rectangle into the viewport by centering on it and picking the largest scale that keeps the whole area visible, clamped to the scale limits (including runtime `setScaleLimits`). Options: `padding` (world units, default 0), `durationMs` (default 500, 0 = instant — animates center and scale together), `onComplete`. Rejects non-finite bounds, `min >= max` axes, and negative padding with a `ConfigValidationError`. Exposed on the React and React Native engine handles. Not related to `setBounds`, which restricts camera movement.
- 5ff7617: `hitTestRect` — marquee/box-selection region queries

  `engine.hitTestRect(rect, { layer?, mode? })` returns every item whose geometry intersects (default) or lies fully inside (`mode: "contain"`) a world rectangle, in the same visual-priority order as `hitTest`. Corners may be passed in any order — build them from drag-start/end `coords.raw` values. Geometry is tested exactly: circles as discs (not bounding boxes), rotated rects/images as convex quads, lines as segments, and paths against their flattened subpaths with filled interiors counting and holes excluded. Both React handles expose the same method (empty before mount).

- 4a5eecd: Path v2: free-form `PathItem` paths with fill and hit testing

  `drawPath` (and the React/React Native `Path` component) now accepts `PathItem` objects: `{ points, closed, fillRule, style, data }`. Paths can be closed, filled under a `nonzero`/`evenodd` fill rule, styled per item (stroke, dash, and new `cornerRadius`/`cornerRadiusPx` tangent-arc corner rounding on the shared world-vs-px unit convention), and carry app `data`. The legacy bare-`Coords[]` form with a call-level style keeps working but is deprecated.

  Paths and lines join hit testing: filled paths hit on their interior, unfilled paths and lines hit within half the stroke width of the geometry (resolved against the live camera scale, with a minimum tap width so hairlines stay tappable). `Line` items accept an optional `data` field, and `engine.drawLine` accepts the full `LineStyle` (dash included).

  All four renderers implement the new form with identical corner-arc geometry via the shared `traceRoundedPath`/`cornerArc` helpers, and path fills are exact everywhere: WebGL fills through a two-pass stencil-then-cover pass, so both fill rules match Canvas2D on self-intersecting outlines and translucent fills show no self-overlap seams.

- 92afd33: **Breaking:** removed all deprecated APIs

  - `getCenterCoords()` / `updateCoords()` / `goCoords()` are gone — use `getCenter()` / `setCenter()` / `goCenter()` (same behavior, renamed in the previous release).
  - `drawPath`'s legacy bare-coordinates form (`Coords[]` / `Coords[][]` with a call-level style argument) is gone — pass `PathItem` objects: `drawPath({ points, style }, layer)`. The React/React Native `Path` component loses its `style` prop the same way (`PathItem` carries its own style), and the deprecated `Path = Coords[]` type alias is no longer exported.

- 601c541: Touch input now runs through react-native-gesture-handler

  The React Native binding replaces the JS responder system with a Manual react-native-gesture-handler gesture used as a raw touch transport into the engine's existing gesture pipeline. Because RNGH participates in native gesture arbitration, interactive maps now work inside `ScrollView`s on the New Architecture: the map claims the touch stream while interactions are enabled, and yields to the page scroll when they are not. Tap detection, pinch handling, and the iOS touch-drop defenses are unchanged.

  **Migration:** install the new peer dependency `react-native-gesture-handler` (>=2.14) in your app and wrap the app root in `GestureHandlerRootView`. Without the root view the map receives no touch input.

- 97cdb9e: Add `engine.setScaleLimits(minScale, maxScale)` for adjusting the min/max zoom limits at runtime, alongside `setScale` and `setEventHandlers`. All zooming (gestures and programmatic) clamps to the new range, and the current scale is clamped into it immediately (firing `onZoom` when it changes). Invalid limits (non-positive, non-finite, or `minScale > maxScale`) throw a `ConfigValidationError`. The React and React Native engine handles expose the new method.
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
  - @canvas-tile-engine/renderer-skia@0.4.0

## 0.3.0

### Minor Changes

- c4c5c01: Custom draw callbacks receive ready-made coordinate transform helpers, so user code never re-derives the `(world - topLeft) * scale` formula or the cell-center offset. `addDrawFunction` callbacks (and the React/RN `DrawFunction` children) get a fourth `transform` argument with `worldToScreen(x, y)` (item-space in, integers are cell centers) and `screenToWorld(x, y)` (raw corner-space out, like event `coords.raw`); existing three-argument callbacks keep working.

  **BREAKING:** `onDraw` now uses the same signature as `addDrawFunction`: `(ctx, coords, config, transform)` instead of `(ctx, info)`. Migration: `info.scale` → `config.scale`, `info.width`/`info.height` → `config.size.width`/`config.size.height`, `info.coords` → the `coords` argument.

- 030cbdd: Expose `engine.goScale(targetScale, durationMs?, onComplete?)` (animated zoom to a target scale) on the `useCanvasTileEngine` handle.
- b8e76ca: **BREAKING:** `style.lineWidth` and `radius` are now world units and scale with zoom, matching item geometry and Text's `size`/`fontPx` precedent (previously they were fixed screen pixels). Migration: keep old visuals with the new `lineWidthPx`; divide old radius values by your typical scale (e.g. `radius: 8` at scale 40 becomes `radius: 0.2`). GridLines keep their zoom-independent pixel width. This also makes Skia static-picture replay consistent with dynamic drawing instead of a documented quirk.

  **New:** dashed Line/Path rendering via `LineStyle.lineDash` (world units, dashes anchored to the world) and `lineDashPx` (screen pixels). Follows Canvas2D `setLineDash` semantics; the pattern flows continuously around Path corners on every renderer (WebGL tessellates dashes on the CPU). Shared unit resolvers (`resolveLineWidthPx`, `resolveLineDashPx`, `resolveRadiusPx`) are exported from core.

### Patch Changes

- a959abc: Add an optional `data` field to drawable items (`Rect`, `Circle`, `ImageItem`, `Text`) for attaching arbitrary app data, typed through a new `TData` generic parameter (`Rect<TData>`, `ImageItem<TImage, TData>`, ...) that defaults to `unknown` - fully backward compatible.

  - The engine and renderers never read `data`; it is carried through so `hitTest` results can identify the hit item via `hit.item.data` instead of the position-based `index`, which goes stale when a filtered or re-ordered items array is re-drawn.
  - `hitTest<TData>(point)` / `hitTestFirst<TData>(point)` (core and the React / React Native hook handles) accept a type parameter that types `hit.item.data` on the results - a compile-time assertion, not a runtime check.
  - `HitResult` gains a second generic parameter: `HitResult<TImage, TData = unknown>`.

- 7e78df9: Make disabled interactions actually leave platform defaults alone. DOM renderers no longer call `preventDefault` unconditionally: with `zoom` off the mouse wheel scrolls the page again, with `rightClick` off the browser context menu opens, and with `click`/`drag`/`zoom`/`hover` all off touch gestures scroll the page instead of being captured (taps still reach mouse callbacks via the browser's synthetic mouse events). The React Native wrapper now claims the gesture responder only while an interaction is enabled or an `onMouseDown`/`onMouseUp` callback is set, so parent scroll views keep receiving touches. Checks run per event, so `setEventHandlers()` toggles keep working.
- fbacfce: Fix `onClick` firing twice for a stationary tap. The binding forwarded the lifted pointer through both the engine's touch-end click path and its own tap dispatch; touch-end is now dispatched without the changed pointer, `onMouseUp` is raised via `dispatchPointerUp`, and click is owned solely by the binding's tap detection.
- e5af906: Fix Static components showing a stale cache when `items` changes under the same `cacheKey`. Renderers rebuild static caches only on a cache miss (Canvas2D also on bounds/scale change), so style-only or interior-position changes replayed the old bitmap/picture. `StaticRect`, `StaticCircle`, and `StaticImage` now clear the cache whenever the `items` array identity changes, matching the documented "rebuild when items change" behavior.
- Updated dependencies [8fe841d]
- Updated dependencies [87614ab]
- Updated dependencies [c4c5c01]
- Updated dependencies [030cbdd]
- Updated dependencies [204ec08]
- Updated dependencies [a959abc]
- Updated dependencies [b8e76ca]
  - @canvas-tile-engine/core@0.8.0
  - @canvas-tile-engine/renderer-skia@0.3.0

## 0.2.0

### Minor Changes

- ff94c7a: Expose `hitTest` / `hitTestFirst` on the `useCanvasTileEngine()` handle. Like the other handle methods they are safe before mount (empty array / `undefined`), so no null checks or `engine.instance` escape hatch needed. Results are typed with the platform image handle (`HTMLImageElement` / `SkImage`).

### Patch Changes

- Updated dependencies [ff94c7a]
- Updated dependencies [153eacc]
- Updated dependencies [fafe337]
- Updated dependencies [38a5d18]
- Updated dependencies [1be475c]
  - @canvas-tile-engine/core@0.7.0
  - @canvas-tile-engine/renderer-skia@0.2.0

## 0.1.3

### Patch Changes

- c9a1fe3: Fix imperative draw effects keyed on `engine.instance` never re-firing after a `key` remount.

  `_setInstance` drove re-renders through a boolean `isReady` state. A key remount calls it twice in one flush (`null`, then the new engine), so the boolean collapses back to `true` — React treats the update as a no-op, discards the re-render, and skips consumer effects entirely, **even ones whose deps (`engine.instance`) changed**. The new engine ended up with zero registered draws: a blank canvas at full fps. Declarative children were unaffected (fixed in #117); this completes the story for the imperative path the docs recommend.

  The hook now bumps a monotonically increasing counter per `_setInstance` call, so the post-remount render always commits and effects depending on `engine.instance` re-fire.

- c9a1fe3: Fix declarative children (notably `GridLines` and `DrawFunction`) disappearing after Fast Refresh.

  `useCanvasTileEngine` built its handle with `useMemo`, which React treats as a discardable cache — Fast Refresh invalidates it, producing a new handle identity. That remounted the engine instance, and because child effects run before parent effects, every child's draw registration landed on a not-yet-created engine and was dropped. Components whose props changed identity afterwards (e.g. `items` arrays re-set by app effects) silently re-registered; components with only primitive or ref-held props (`GridLines`, `DrawFunction`) stayed blank.

  The handle now lives in a `useRef`, guaranteeing one identity for the component's whole lifetime. As a side effect, editing app code no longer destroys and recreates the engine, so camera position and zoom survive Fast Refresh too.

## 0.1.2

### Patch Changes

- 7a61024: Fix declarative children silently drawing nothing after a `key` remount.

  The children gate used `engine.isReady`, which reads the shared handle. During a key-driven remount the old engine is still attached at render time, so children mounted immediately and their draw effects ran in the null-instance window between the old engine's destroy and the new engine's creation (child effects fire before parent effects) — every registration was dropped into a dummy handle and the new canvas stayed blank with no error. The gate is now component-local state that starts `false` on every mount, so children always mount after their own engine exists, exactly like the first-mount path.

  Draw calls that arrive while no engine is mounted now also log a dev-only `console.warn` instead of failing silently. For imperative setups that must survive remounts, depend on `engine.instance` (changes identity per engine) rather than `engine.isReady` (collapses back to `true` within the remount flush).

- Updated dependencies [79db244]
  - @canvas-tile-engine/core@0.6.0
  - @canvas-tile-engine/renderer-skia@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [35f9532]
  - @canvas-tile-engine/core@0.5.0
  - @canvas-tile-engine/renderer-skia@0.1.1
