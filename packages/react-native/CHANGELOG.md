# @canvas-tile-engine/react-native

## 0.7.0

### Minor Changes

- 60f732a: The engine handle gains `setAccessibility(patch)` for updating the accessible name, description, role and tab-stop behavior at runtime — needed because both bindings read `config` once on mount — plus `onAccessibilityChange(listener)` for subscribing to those updates.

  React Native applies `accessible`, `accessibilityLabel`, `accessibilityHint` and `accessibilityRole` to the measured `View`, never to the Skia `Canvas`. The `View` reads the engine's resolved snapshot and subscribes to `onAccessibilityChange`, so `setAccessibility` reaches it too; the `config` prop is the fallback for the window before the first layout creates the engine. Only `role: "image"` has a React Native equivalent; `"region"` and `"application"` are dropped and the label still announces.

  Known limitation, documented rather than implied: on React Native this makes the surface **announced** but not **operable**. Keyboard camera control is DOM-only because React Native's core `View` has no key events, and `accessibilityActions` is not wired yet.

  On the web, behavior change: interactive surfaces become keyboard tab stops by default and arrow keys pan them. Opt out with `accessibility: { focusable: false }`.

- bcea4b7: feat: `clip` — confine a draw registration to a world rectangle

  - Every draw method takes `clip` in its options, and every React/React Native draw component takes it as a prop: a world rectangle the registration is confined to. Nothing it draws paints outside, and nothing outside it hit-tests. That covers a chart's plot area, a minimap frame, or any "this layer belongs inside that box" region — none of which could be expressed before without dropping into `addDrawFunction` and calling `ctx.clip` by hand, which only clips one of the four renderers (on WebGL that context is the text overlay, so the GPU primitives ignored it entirely).
  - **World (item) space**, the same coordinates `fitBounds` and `hitTestRect` take, so a clip pans and zooms with the scene. For a chart plot area that is the behavior you want: the axes drawn outside the clip keep their position relative to the data, and panning cannot smear the series across them.
  - Applies to every draw kind, `drawGridLines`, the `drawStatic*` variants and `addDrawFunction` included.
  - **Hit testing follows the clip**, or clipped-away items would stay clickable. Point queries reject before any geometry work; marquee queries are narrowed to the overlap rather than skipped when they miss, so a selection half inside the clip cannot reach what is cut away. `padding`/`paddingPx` deliberately do not widen a clip: they grow an item's own tap target, and a target that is not drawn has nothing to grow.
  - Axis-aligned rectangles only. An arbitrary shape would need the stencil buffer on WebGL, where path fills already live, so the scope stops at what all four renderers can do identically.
  - The React `clip` prop is compared **by value**, unlike `items`, so an inline object literal does not re-register the draw call on every render.

  Purely additive: a registration without a `clip` behaves exactly as before.

  Internally each renderer supplies a clip adapter to the shared layer manager, which applies it inside the `save()`/`restore()` pair every draw callback already runs in. The layer manager stays free of coordinate math because the renderers genuinely need different spaces — CSS pixels for a Canvas2D or Skia path clip, device pixels measured from the bottom for a WebGL scissor. WebGL cuts on both of its surfaces: the scissor for batched primitives, an ordinary path clip for the 2D overlay that carries text and custom drawing.

- 819dd99: `fitBounds` now reports what it did instead of failing silently. It returns `{ scale, fitted }`: the scale the fit targets after clamping, and whether the whole rectangle actually ends up visible. `fitted` is `false` only when `minScale` floors the fit — the area needs a smaller scale than the configured minimum, so the view shows less than was asked for and nothing previously signalled that. Clamping at `maxScale` still leaves the rectangle fully visible, so it stays `true`.

  The new `FitBoundsResult` type is exported from all three packages. On the React and React Native handles `fitBounds` returns `undefined` before mount, where there is no engine to fit. Existing callers that ignore the return value are unaffected.

- 576f4b7: feat: itemsBounds — the rectangle `fitBounds`/`fitScale` ask for

  - New pure helper `itemsBounds(items)`: the world rectangle enclosing a list of items, or `null` when nothing in the list has bounds. Replaces the hand-rolled min/max reduce every "fit to selection" flow needed. Returns `Bounds | null`, so the call is guarded: `const b = itemsBounds(selected); if (b) engine.fitBounds(b, { paddingPx: 24 });` — an empty selection should not move the camera.
  - Every item kind fits in one list, mixed freely, so `hitTest`/`hitTestRect` results go straight in with no filtering: `Rect`/`Circle`/`Text`/`ImageItem` contribute `width ?? size` by `height ?? size` world units (default 1) centered on the anchor, `Line` its two endpoints, `PathItem` its vertex box (`points`) or control-point hull (`commands`). Items that draw nothing — a path with fewer than two points, an empty command list — are skipped rather than counted.
  - `pathItemBounds(item)` is exported as the single-path building block.
  - Deliberately camera-independent, so it leaves out `origin` offsets and `rotate` (both stay within half an item of the box — add `padding` for slack), `sizePx`/`fontPx` (pixel sizes have no world extent without a camera scale), and measured text: a `Text` item contributes its `size` box, not its glyph extents, because core carries no font metrics.
  - Re-exported from `@canvas-tile-engine/react` and `@canvas-tile-engine/react-native` alongside `gridToSize`/`fitScale` (with the `BoundedItem` type).

- c3a6381: Fix: the config snapshot the React and React Native handles return before the engine mounts no longer contradicts the engine's own defaults.

  `engine.getConfig()` answers with a default snapshot until the engine attaches, and that snapshot was a hand-written copy of the defaults that had drifted from what `Config` actually resolves: it reported `eventHandlers.drag: true` and `zoom: "pointer"` where the engine defaults both to off, and `debug.eventHandlers.*: false` where the engine defaults them to on. Code that read the handle before `isReady` — to decide whether panning is enabled, or to initialise a zoom control — got values that flipped the moment the engine mounted. The snapshot was also returned by reference and unfrozen, unlike `Config.get()`'s deeply frozen one, so a consumer mutating it corrupted every later pre-mount call.

  The pre-mount snapshot is now produced by the engine's own normalization and is deeply frozen, so no field can disagree with a mounted engine. It still describes an _unconfigured_ engine (`scale: 1`, zero size, matching the pre-mount `getSize()`) because the handle cannot see the `config` you pass to the component — so `minScale`/`maxScale` are `0.5`/`2` rather than your scale's limits. Read config-derived values after `isReady`.

  `@canvas-tile-engine/core` exports the normalization behind this as `normalizeConfig(config)`: it fills every optional field with its default and returns the deeply frozen snapshot, without validating (`new CanvasTileEngine(...)` still validates what it is given). `normalizeConfig({ scale: 32, size }).minScale` is `16`. It also no longer freezes the `bounds` and `coordinates.shownScaleRange` objects you pass in — those are copied into the snapshot now, matching what `updateBounds` already did.

- 91b4014: The engine handle gains `setReducedMotion(value)` and `getReducedMotion()`. `getReducedMotion()` returns `false` before mount, matching the handle's neutral-default convention.

  Behavior change: engine-driven camera animation now follows the platform reduced-motion setting by default. On the web that signal comes from the renderer's `prefers-reduced-motion` watcher; on React Native the binding subscribes to `AccessibilityInfo` itself, so apps wire nothing. When in effect it overrides an explicitly passed `durationMs`; the opt-out is `accessibility: { reducedMotion: false }` or `engine.setReducedMotion(false)`.

### Patch Changes

- 4e5bbac: Re-export the rest of core's app-facing types, so binding code no longer needs a second import from `@canvas-tile-engine/core` to name them: `Bounds`, `FitBoundsOptions`, `DrawTransform`, `LinearGradient`, `Paint`, `ColorStop`, `TextAlign`, `TextBaseline`, `FontWeight`, `HitResult`, `HitKind`, `HitTestOptions`, `HitTestRectOptions`, `ClickInfo`, `ZoomMode`, `KeyboardConfig`, `AccessibilityConfig`, `AccessibilityRole`, `ReducedMotionSetting`, `StyleOf`, `VisibleOf`, `InteractiveOf`, the `*DrawOptions` types (`DrawOptions`, `StaticDrawOptions`, `RectDrawOptions`, `CircleDrawOptions`, `TextDrawOptions`, `LineDrawOptions`, `PathDrawOptions`, `ImageDrawOptions`) and the `*DecorationStyle` types. The re-exports are type-only, so bundles do not change. Only `normalizeConfig` and the renderer-author APIs (`IRenderer`, `IDrawAPI`, ...) remain core-only.
- e1ea988: Synchronize React Native's native gesture blocker with runtime `setEventHandlers()` changes without waiting for a painted frame. Callback-only interactions now also track adding or removing `onMouseDown` and `onMouseUp` props immediately, and config subscriptions are cleaned up on unmount.
- ffb207a: Throw the documented `ConfigValidationError` for invalid config and runtime arguments. The constructor, `setScale`, `goScale`, `setScaleLimits`, `setBounds`, `setCenter`, `goCenter`, `fitBounds`, `fitScale`, `setAccessibility` and `setReducedMotion` already promised it in their JSDoc but threw a plain `Error`. The class is a new export of core, re-exported by the React and React Native bindings, so `error instanceof ConfigValidationError` now works. Messages are unchanged and keep the `[CanvasTileEngine] Invalid config:` prefix, but `error.name` changes from `"Error"` to `"ConfigValidationError"`. `drawGridLines` still throws a `RangeError` for an invalid `cellSize`.
- 9d10090: Declare `@canvas-tile-engine/core` only as a peer dependency (`>=0.12.0`) instead of also listing it under `dependencies`. The renderers and bindings now always use the app's own copy of core, so a core release outside the old caret range can no longer install a second copy that the renderer is wired to instead of the app's engine. Apps must install `@canvas-tile-engine/core` themselves, which the installation docs already require. The minimum is 0.12.0 because these releases import core APIs added in that version.
- bcb23c3: Fix the imperative examples and the dropped-draw warning, which led to duplicate registrations, and warn in development when it happens.

  The `@example Imperative API` on `<CanvasTileEngine>` (web and React Native) and the `useCanvasTileEngine` example drew in an effect keyed on `engine.isReady` without an `id`. Such an effect can run twice as the engine attaches: on the web it runs in the commit that attaches the engine and again on the re-render that follows, so the grid was registered, painted and hit-tested twice from the first frame. The examples now key the effect on `engine.instance` (so it also runs for a new engine after a `key` remount) and draw with an `id`, so a second run replaces the first registration. The dev warning logged when a draw call is dropped before mount now gives the same advice: return early while `engine.instance` is null, list it in the deps, and pass an `id` or remove the returned handle in the effect's cleanup.

  In development, the engine handle now also warns once per engine when the same items (or the same grid) are registered on the same layer twice without an `id` and without removing the first registration, which is what an effect written in the old style does as the engine attaches. Production behavior is unchanged.

- d83c4eb: Balance native press callbacks independently of tap eligibility. Multitouch still suppresses clicks but releases an earlier one-finger press once; cancellation and unmount cancel it through onMouseLeave, including when native touch data is incomplete. Ignore duplicate terminal events and reset the gesture before a new press.
- 467b077: Fix: `Text` and `ImageItem` inherited `origin` and `radius` from `DrawObject` without any renderer reading them, so both fields typechecked and silently did nothing — `{ x, y, text: "A", origin: { mode: "self", x: 0, y: 0 } }` and `{ x, y, img, radius: 8 }` looked like they should work but were dropped on every renderer. `Text` now omits `origin` and `ImageItem` now omits `radius`, matching the pattern `Circle` already used for `rotate`/`radius`. Type-only change; if either is meant to be supported later, that's a separate feature.
- Updated dependencies [a4d056a]
- Updated dependencies [1b68c1d]
- Updated dependencies [b7c1115]
- Updated dependencies [9d10090]
- Updated dependencies [bcea4b7]
- Updated dependencies [164e37d]
- Updated dependencies [e69c0dc]
- Updated dependencies [e0c6ed3]
- Updated dependencies [91b4014]
- Updated dependencies [3ca8eee]
- Updated dependencies [868229a]
- Updated dependencies [c26fc3f]
- Updated dependencies [576f4b7]
- Updated dependencies [c428a05]
- Updated dependencies [5b8e9fe]
- Updated dependencies [94ab3ac]
  - @canvas-tile-engine/renderer-skia@0.7.0

## 0.6.0

### Minor Changes

- d35db27: feat: fitScale — content-driven scale limits

  - New pure config-time helper `fitScale(bounds, size, options?)`: the scale (pixels per world unit) at which a world rectangle exactly fits a viewport — the `gridToSize` of free-form content. Derive `scale`/`minScale` from content bounds instead of hand-tuning constants that need recalibration whenever the content size changes; only `maxScale` stays a deliberate choice (a content-resolution quality cap no bounds can imply). Options mirror `fitBounds`: `padding` (world units) or `paddingPx` (screen pixels, wins). The result is unclamped — apply your own min/max policy.
  - `fitBounds` now delegates its target-scale computation to the same shared implementation, so a scale derived from `fitScale` is exactly the scale `fitBounds` targets before scale-limit clamping — the two cannot drift.
  - Re-exported from `@canvas-tile-engine/react` and `@canvas-tile-engine/react-native` alongside `gridToSize` (with the `FitScaleOptions` type).

- 77d471c: feat: hitTest: false — per-registration hit-testing opt-out

  - Every engine draw method's options (and a new `options` parameter on the static draw helpers) accept `hitTest: false`, keeping that registration out of `hitTest`/`hitTestFirst`/`hitTestRect` — the `pointer-events: none` of the draw API. Decorative content (floor tiles, background images, zone overlays) is declared once at registration instead of being filtered at every query site, so a marquee over the board selects units, not the floor.
  - Opted-out registrations skip hit-registry bookkeeping entirely: large decorative sets stop paying the hit-side spatial-index cost. Re-registering under the same `id`/`cacheKey` with the flag changed toggles participation atomically.
  - React and React Native: all draw components that participate in hit testing (`Rect`, `Circle`, `Image`, `Sprite`, `Line`, `Path`, `StaticRect`, `StaticCircle`, `StaticImage`) accept a `hitTest` prop, and the imperative handle's `drawImage`/`drawStatic*` signatures take the new options parameter.
  - Purely core-side mechanics — no renderer package is involved. Text and custom draw functions never entered hit testing and are unaffected.

- eaa6523: `engine.getConfig()` now returns a default config snapshot before the engine mounts instead of `undefined`, matching `@canvas-tile-engine/react` — its return type no longer includes `undefined`. Internally the handle hook, engine context, and compound draw components now come from the private `@canvas-tile-engine/react-shared` package shared with `@canvas-tile-engine/react` (bundled into dist, no new dependency).
- c561670: Add `visibleOf` and `interactiveOf` per-item callbacks alongside `styleOf`.

  - `visibleOf(item)`: return `false` to skip an item for the frame — it is neither painted nor hit-testable. Like `styleOf`, it reads external state live: mutate a filter set and call `render()` without re-registering or rebuilding the spatial index. Available on `drawRect`, `drawCircle`, `drawText`, `drawLine`, `drawPath`, and `drawImage` (dynamic draws only, like `styleOf`).
  - `interactiveOf(item)`: return `false` to keep an item out of `hitTest`/`hitTestFirst`/`hitTestRect` while it stays painted — the per-item counterpart of `hitTest: false`. Queries fall through to items below it. Items hidden by `visibleOf` never hit-test, regardless of this callback. Available on the hit-tested kinds (`drawRect`, `drawCircle`, `drawImage`, `drawLine`, `drawPath`).

  `drawImage` gains an options object (`ImageDrawOptions`) carrying `id`, `hitTest`, and the two new callbacks; it still has no `styleOf` — images carry no `style`, appearance changes go through item fields like `opacity` (read live at paint time).

  The React and React Native `Rect`, `Circle`, `Image`, `Line`, `Text`, and `Path` components accept matching `visibleOf`/`interactiveOf` props (`Text`: `visibleOf` only), read through refs like `styleOf` so identity changes never re-register.

### Patch Changes

- Updated dependencies [d35db27]
- Updated dependencies [3696d8c]
- Updated dependencies [77d471c]
- Updated dependencies [2670beb]
- Updated dependencies [b9b2e0e]
- Updated dependencies [22167f8]
- Updated dependencies [c5c51a2]
- Updated dependencies [c561670]
  - @canvas-tile-engine/core@0.11.0
  - @canvas-tile-engine/renderer-skia@0.6.0

## 0.5.0

### Minor Changes

- dae6f9b: feat: styleOf — paint-time decoration without re-registration

  - The dynamic engine draw methods (`drawRect`, `drawCircle`, `drawText`, `drawLine`, `drawPath`) accept an optional `styleOf` callback in their `options`. It runs per item on every frame at paint time; the returned fields overlay the item's own `style` for that frame (`undefined` leaves the item untouched). Because it resolves at paint time it reads external state live: mutate a selection/hover set and call `render()` — items are never re-registered and the spatial index never rebuilds, turning selection updates from O(n) alloc + index rebuild into an O(1) state change plus repaint.
  - Decoration types are narrowed where style feeds hit-test geometry: `Line` and `PathItem` decorations exclude `lineWidth`/`lineWidthPx` (and `cornerRadius`/`cornerRadiusPx` for paths), which are resolved at registration time. Rect/circle/text decorations allow the full style. For `drawLine`, `styleOf` overlays the call-level `style` per item — also the first way to give individual lines their own color. Paint order is preserved on every renderer: array order stays z-order (Canvas2D renderers batch undecorated runs contiguously and stroke decorated lines in place), matching hit-test's "later item wins" priority.
  - React and React Native: the `Rect`, `Circle`, `Text`, `Line`, and `Path` components accept a `styleOf` prop. It is read through a ref, so its identity may change on every render at no cost (inline arrows are fine); a change only repaints. `useMemo` discipline now applies to `items` (geometry) only. The imperative `EngineHandle` draw methods also accept the new `options` parameter (including `id`).
  - Static draw methods intentionally do not support `styleOf`: caches replay a recorded picture, so per-frame decoration cannot apply. Changing styles is dynamic content — use the dynamic methods with `styleOf`, or an overlay registration.

- 016f67f: Re-export more core APIs from the React and React Native bindings

  Both bindings now re-export the imperative/type surface consumers previously had to reach into `@canvas-tile-engine/core` for:

  - `DrawHandle` — the return type of `engine.drawRect`/`drawCircle`/etc., needed to store a handle in a variable for the hover/selection/minimap swap patterns (`let handle: DrawHandle | undefined`).
  - `LineStyle` — the `<Line>` `style` prop / `engine.drawLine(items, style, layer)` argument type, for shared or state-driven line styles.
  - `PathCommand` + `pathCommandsBounds` — for building free-form path command lists programmatically and computing their world bounds (e.g. to `fitBounds` to a path).
  - `onRightClickCallback`, `onZoomCallback`, `onWheelCallback`, `WheelInfo` — completing the event-callback type family (the click/hover/mouse aliases were already exported), for typing handlers extracted out of JSX.

  Purely additive — importing these from `@canvas-tile-engine/core` still works.

### Patch Changes

- Updated dependencies [e79724c]
- Updated dependencies [dae6f9b]
  - @canvas-tile-engine/core@0.10.0
  - @canvas-tile-engine/renderer-skia@0.5.0

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
