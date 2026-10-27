# Core API Reference

Package: `@canvas-tile-engine/core`. Everything here is renderer-agnostic and
applies to all platforms unless noted.

Contents:

- [Coordinate spaces](#coordinate-spaces)
- [Construction](#construction-vanilla--server-react-packages-construct-for-you)
- [Full config reference](#full-config-reference) (responsive, accessibility)
- [Engine methods](#engine-methods) (camera, bounds, animation, draw, hits)
- [Image loading](#image-loading) (CORS)
- [Utilities](#utilities) (`gridToSize`, `fitScale`, `itemsBounds`)
- [Exported types and classes](#exported-types-and-classes-import-from-canvas-tile-enginecore)
- [Validation errors](#validation-errors)

## Coordinate spaces

Two world spaces, half a cell apart. Mixing them up is the most common bug.

- **Item space** - where items live. An integer `x`/`y` is a cell CENTER;
  cell `k` spans `[k - 0.5, k + 0.5]`, so cells `0..N-1` taken as an AREA
  are `-0.5..N-0.5`.
- **Raw (corner) space** - what pointer events report as `coords.raw`. Cell
  `k` spans `[k, k + 1]`, so `coords.snapped = Math.floor(raw)` is the
  clicked cell's integer, i.e. the value you put in an item's `x`.

| API | Space |
| :-- | :-- |
| item `x`/`y`, `setCenter`, `goCenter`, `getCenter`, `onCoordsChange(center)` | item |
| `fitBounds(bounds)`, draw `clip`, `itemsBounds()` result | item, as an area |
| `getVisibleBounds()` | item, floored/ceiled (may include one extra cell per side) |
| `hitTest`, `hitTestFirst`, `hitTestRect` | raw - pass `coords.raw` straight in (they subtract 0.5) |
| `config.bounds`, `setBounds` | corner: `{ minX: 0, maxX: 10 }` = cells 0..9 |
| draw callback `topLeft` arg, `transform.screenToWorld()` result | raw |
| `transform.worldToScreen(x, y)` input | item |
| event `mouse` / `client` | canvas CSS px / viewport px ([events.md](events.md#pointer-callback-payload)) |

Two traps:

- `goCenter(coords.raw.x, coords.raw.y)` lands half a cell off. Use
  `coords.snapped` to center on the clicked cell, or `raw - 0.5` for the
  exact point.
- `bounds` is corner space, unlike `fitBounds`/`clip`: a board of cells
  `0..N-1` is `bounds: { minX: 0, maxX: N, ... }` but
  `fitBounds({ minX: -0.5, maxX: N - 0.5, ... })`.

## Construction (vanilla / server; React packages construct for you)

```ts
new CanvasTileEngine<TMount, TImage>(
    canvasWrapper: TMount,               // DOM: a div that CONTAINS a <canvas> child
    config: CanvasTileEngineConfig,
    renderer: IRenderer<TMount, TImage>, // e.g. new RendererCanvas()
    center?: Coords,                     // initial center (item space), default { x: 0, y: 0 }
)
```

DOM renderers (`RendererCanvas`, `RendererWebGL`) take an `HTMLDivElement`
that already contains `<canvas></canvas>`; the server takes the exported
`SERVER_MOUNT`. `engine.canvas` is the `HTMLCanvasElement` on DOM mounts (for
`engine.canvas.style.cursor`), `undefined` elsewhere; `engine.canvasWrapper`
is the wrapper you passed in.

## Full config reference

```ts
type CanvasTileEngineConfig = {
    scale: number;                     // REQUIRED. Initial px per world unit.
    size: {                            // REQUIRED. Logical canvas size in px.
        width: number;
        height: number;
        minWidth?: number;             // default 100. min/max clamp resize() and
        minHeight?: number;            // default 100   eventHandlers.resize only;
        maxWidth?: number;             // default Infinity   responsive modes
        maxHeight?: number;            // default Infinity   ignore them
    };
    minScale?: number;                 // default scale * 0.5
    maxScale?: number;                 // default scale * 2
    backgroundColor?: string;          // default "#ffffff", any CSS color
    gridAligned?: boolean;             // default false. Construction only: snaps the
                                       // initial center per axis by tile count =
                                       // size/scale (even -> x.5, odd -> integer,
                                       // fractional -> as is). Trap: a fractional
                                       // gutter (8 cells in 9 units) snaps off-center
                                       // - pass `center` and leave this off.
    responsive?: "preserve-scale" | "preserve-viewport" | "fill" | false; // default false
    eventHandlers?: {                  // ALL default false. Gates: events.md
        click?: boolean;
        rightClick?: boolean;          // DOM renderers only
        hover?: boolean;
        drag?: boolean;                // pan by drag
        zoom?: boolean | "pointer" | "center"; // wheel + pinch; true === "pointer"
                                       // (anchor: cursor / pinch midpoint; "center"
                                       // anchors at the viewport center)
        resize?: boolean;              // responsive=false only: wrapper gets CSS
                                       // `resize: both` and the canvas follows it
        keyboard?: boolean | { pan?: number; panPx?: number; zoomFactor?: number };
                                       // (core >= 0.12) DOM only. Unset mirrors the
                                       // pointer gates; events.md#keyboard-camera-control
    };
    bounds?: { minX: number; maxX: number; minY: number; maxY: number };
                                       // camera limits, CORNER space; see Camera bounds
    accessibility?: {                  // (core >= 0.12); see Accessibility below
        label?: string;
        description?: string;
        role?: "region" | "image" | "application";
        focusable?: boolean;
        reducedMotion?: boolean | "auto";
    };
    coordinates?: {                    // edge labels: integer item-space values (Y
                                       // left, X bottom), thinned 1-2-5 when crowded.
                                       // Format is fixed: draw Text items for a-h.
        enabled?: boolean;             // default false
        shownScaleRange?: { min: number; max: number }; // default {0, Infinity}
    };
    debug?: {
        enabled?: boolean;             // master switch, default false
        hud?: {                        // on-canvas HUD panel, all default false;
            enabled?: boolean;         // coordinates = center coords, fps = browser
            topLeftCoordinates?: boolean; coordinates?: boolean; scale?: boolean;
            tilesInView?: boolean; fps?: boolean;
        };
        eventHandlers?: {              // console logging per event type, default true each
            click?: boolean; hover?: boolean; drag?: boolean;
            zoom?: boolean; resize?: boolean;
        };
    };
};
```

### Responsive modes (browser renderers only)

| Mode | Behavior |
| :-- | :-- |
| `"preserve-scale"` | Scale fixed; the visible area grows/shrinks with the wrapper WIDTH. The wrapper gets `width: 100%` and its height is PINNED to `config.size.height` by inline style (CSS heights are overridden). |
| `"preserve-viewport"` | The configured tile count stays visible; scale follows the wrapper width, height follows the configured aspect ratio. |
| `"fill"` (core >= 0.12) | Scale fixed; BOTH axes follow the PARENT: the wrapper gets `width: 100%; height: 100%`, so the parent needs a definite height (a flex/grid child also `min-height: 0`). A zero-height parent warns once and the canvas stays blank. In React the wrapper is the component's own div - size its parent. `config.size` only seeds the first camera, the `gridAligned` tile count and the min-scale baseline. |
| `false` | Fixed `config.size` until `engine.resize()` or `eventHandlers.resize`. |

Every mode uses the renderer's own `ResizeObserver` on the wrapper plus a
devicePixelRatio watcher - add no window `resize` listener. While a mode is
on, `engine.resize()` warns and no-ops and `eventHandlers.resize` is ignored.
The server renderer ignores `responsive`; React Native uses `onLayout`.

Scale limits adapt on resize so the camera never lands outside the
gesture-reachable range: `"preserve-viewport"` scales `minScale` with the
base scale (and fires `onZoom` when the scale changes); `"preserve-scale"`/
`"fill"` (finite `bounds` only) rescale `minScale` with the scale at which
the bounds fit, so "minScale shows the whole board" survives resizes (capped
at the current scale). `maxScale` is an absolute quality cap, lifted only
when an adapted value exceeds it. `setScaleLimits` values adapt the same way.
The first responsive sizing runs during construction, before callbacks
attach - read the starting scale with `engine.getScale()` after mount.

### Accessibility and reduced motion

(core >= 0.12.) The wrapper carries the accessible identity; canvases get
`aria-hidden`. Attributes you set yourself are never overwritten.

| Field | Default | Meaning |
| :-- | :-- | :-- |
| `label` | none | Accessible name (`aria-label`; RN `accessibilityLabel`). Without it neither `aria-label` nor `role` is written. |
| `description` | none | Usage text, e.g. which keys do what (hidden `aria-describedby` node; RN `accessibilityHint`). |
| `role` | `"region"` if `label` set | `"region"`: interactive maps/boards, screen-reader browse keys keep working. `"application"`: ONLY when the surface handles every key itself - it disables screen-reader browse/quick-nav keys. `"image"`: non-interactive pictures (minimap, thumbnail). RN maps only `"image"`. |
| `focusable` | derived | Tab stop (`tabindex="0"`). A boolean `eventHandlers.keyboard` decides; otherwise `true` iff any pointer flag is on. `setEventHandlers` moves it. Set `false` on hover-only surfaces. |
| `reducedMotion` | `"auto"` | `"auto"` follows `prefers-reduced-motion` / RN `AccessibilityInfo`. When in effect, `goCenter`/`goScale`/`fitBounds`/`resize` land instantly, OVERRIDING an explicit `durationMs` - no per-call escape; `false` is the escape. `SpriteAnimator` and your own drawing are not covered (`animator.stop()` yourself). |

| Method | Notes |
| :-- | :-- |
| `setAccessibility(patch): void` | Merge into `config.accessibility` at runtime; DOM renderers re-apply attributes. Needed because React reads `config` once on mount. |
| `onAccessibilityChange(listener): () => void` | Fires on `setAccessibility` and when `setEventHandlers` flips the derived `focusable`. Only hosts that render their own accessible surface need it (DOM renderers and the RN binding subscribe internally). |
| `setReducedMotion(value: boolean \| "auto"): void` | Replace the preference. Fires no change event. |
| `getReducedMotion(): boolean` | The RESOLVED value. Poll-only: there is no change event for it or for OS changes. `getConfig().accessibility.reducedMotion` is the preference (may be `"auto"`). Handle: `false` before mount. |

Keys, focus rules and what the keyboard may do:
[events.md](events.md#keyboard-camera-control).

## Engine methods

### Lifecycle and frame

| Signature | Notes |
| :-- | :-- |
| `render(): void` | Paint one frame. Needed after draw registration and after data mutation. Camera changes (drag/zoom/goCenter/...) render automatically. |
| `destroy(): void` | Cancel animations, remove listeners/observers. Call on teardown (React does this on unmount). |

### Camera and viewport

| Signature | Notes |
| :-- | :-- |
| `getCenter(): Coords` | Current center (item space). |
| `setCenter(center: Coords): void` | Jump instantly. Throws on non-finite values. |
| `goCenter(x, y, durationMs = 500, onComplete?): void` | Animated move. `0` = instant. |
| `getScale(): number` | Current scale (px per world unit). |
| `setScale(n): void` | Instant, clamped to min/max, anchored at the viewport center. |
| `goScale(n, durationMs = 500, onComplete?): void` | Animated zoom to `n` clamped to min/max, anchored at the viewport center. `0` = instant. |
| `zoomIn(factor = 1.5)` / `zoomOut(factor = 1.5)` | Instant zoom around the viewport center. |
| `setScaleLimits(minScale, maxScale): void` | Replace the limits at runtime; clamps the current scale now (fires `onZoom` if it moves). Throws on non-positive/non-finite values or `minScale > maxScale`. |
| `fitBounds(bounds, opts?): FitBoundsResult` | Center on an item-space AREA and pick the largest scale showing all of it, clamped to the limits. `opts: { padding? (world units), paddingPx? (screen px kept free on every side, wins over padding - PREFER for fit-to-selection), durationMs? (default 500), onComplete? }`. Returns `{ scale, fitted }` (core >= 0.12): `fitted: false` ONLY when `minScale` floors the fit, so part of the area stays hidden; a `maxScale` clamp keeps `true`. Unrelated to `setBounds`. React/RN handle: `undefined` before mount. |
| `getSize(): { width, height }` | Logical canvas size in px. |
| `resize(w, h, durationMs = 500, onComplete?): void` | Animated resize keeping the center. Warns and no-ops while `responsive` is on. |
| `getVisibleBounds(): Bounds` | Visible cells, item space, floored/ceiled - coarse. Exact extent: `getCenter().x +/- getSize().width / (2 * getScale())`. |
| `setBounds(bounds): void` | Replace the camera bounds and clamp now; see below. |
| `getConfig(): Required<CanvasTileEngineConfig>` | Normalized snapshot with LIVE `scale`, `minScale`, `maxScale` and `size` (responsive adjustments included). Read zoom-UI limits here and re-read after resizes. Read-only. React/RN handle before mount: a frozen placeholder (`normalizeConfig({ scale: 1, size: { width: 0, height: 0 } })`), NOT your `config` prop - read after `isReady`. |
| `setEventHandlers(partial): void` | Toggle interactions at runtime, e.g. `{ drag: false, hover: true }` ([events.md](events.md)). |

### Camera bounds

`config.bounds` / `setBounds` clamp the VIEWPORT EDGES in corner space:
`{ minX: 0, maxX: 10 }` keeps the left edge >= 0 and the right edge <= 10,
which is cells 0..9. The clamp is re-applied on every pan, zoom, `setScale`,
`setCenter`, resize and animation frame (`goCenter`, `goScale`,
`fitBounds`), so animated moves never overshoot. When the viewport is as large as the bounds or
larger on an axis, that axis locks with the bounds centered. `-Infinity` /
`Infinity` leave an axis free. Bounds never limit zoom: pair them with
`minScale` (or [`fitScale`](#fitscale---content-driven-scale-limits)).

### Animation and interruption

`setCenter`/`goCenter` cancel the running move; `setScale`/`zoomIn`/
`zoomOut`/`goScale` cancel the running zoom; the other channel continues, so
a concurrent move + zoom works. `fitBounds` cancels both. Instant,
reduced-motion and unchanged-value calls cancel too; invalid calls throw
without cancelling. An interrupted run never fires its `onComplete`, also
when the new call comes from inside `onCoordsChange`/`onZoom`. Reduced
motion and no `requestAnimationFrame` (server) make every call instant:

| Call | `onZoom` | `onCoordsChange` | `onComplete` |
| :-- | :-- | :-- | :-- |
| `goCenter(x, y, 0)` | never | once | synchronously |
| `goScale(s, 0)`, `setScale`, `zoomIn`/`zoomOut` | once, if the scale changed | once | synchronously (`goScale`) |
| `fitBounds(b, { durationMs: 0 })` | once, if the scale changed | once | synchronously |
| animated `goCenter` / `goScale` / `fitBounds` | per frame while the scale changes | per frame | after the last frame |

### Draw methods

All return a `DrawHandle` (`{ id: symbol, layer: number }`). Item shapes and
semantics: [drawing.md](drawing.md).

| Signature | Default layer |
| :-- | :-- |
| `drawRect(items: Rect \| Rect[], layer?, options?)` | 1 |
| `drawCircle(items: Circle \| Circle[], layer?, options?)` | 1 |
| `drawImage(items: ImageItem \| ImageItem[], layer?, options?)` | 1 |
| `drawText(items: Text \| Text[], layer?, options?)` | 2 |
| `drawLine(items: Line \| Line[], style?: LineStyle, layer?, options?)` | 1 |
| `drawPath(items: PathItem \| PathItem[], layer?, options?)` | 1 |
| `drawGridLines(cellSize: number, lineWidth = 1, strokeStyle = "black", layer = 0, options?)` | 0 |
| `drawStaticRect(items: Rect[], cacheKey: string, layer?, options?)` | 1 |
| `drawStaticCircle(items: Circle[], cacheKey: string, layer?, options?)` | 1 |
| `drawStaticImage(items: ImageItem[], cacheKey: string, layer?, options?)` | 1 |
| `addDrawFunction(fn: (ctx, topLeft, config, transform) => void, layer?, options?)` | 1 |

The six dynamic draws infer `TData` from the items, so `styleOf(item)` sees
a typed `item.data` (optional: `item.data?.id`); statics are not generic.
`options?` (core >= 0.10; `hitTest`/`visibleOf`/`interactiveOf` >= 0.11;
`clip` >= 0.12):

| Option | Accepted by | Does |
| :-- | :-- | :-- |
| `id: string` | every non-static draw (a static's `cacheKey` is its id) | Same id atomically replaces the previous registration (callback + hit entries). One namespace across kinds and layers; the replacement re-enters at the end of its layer. |
| `hitTest: boolean` | every hit-testable kind incl. statics; default `true` | `false` keeps the registration out of every hit query and skips its spatial index - declare decorative layers this way once. |
| `clip: Bounds` | every kind incl. statics, grid lines, `addDrawFunction` | Item-space rect: nothing paints or hit-tests outside it. |
| `styleOf: (item) => style \| undefined` | dynamic rect, circle, text, line, path | Per-item paint-time style overlay. |
| `visibleOf: (item) => boolean \| undefined` | the `styleOf` five + `drawImage` | `false` hides the item (paint and hits) for the frame. |
| `interactiveOf: (item) => boolean \| undefined` | dynamic rect, circle, image, line, path | `false` keeps the item painted but out of hit queries. |

The `*Of` callbacks read your state live: mutate it and call `render()`,
nothing re-registers. What each may change, including the Line/Path width
limit: [drawing.md](drawing.md#styleof-visibleof-interactiveof).

`addDrawFunction` and `onDraw` callbacks get the same four arguments:
`ctx` (typed `unknown`: the 2D context on Canvas2D, the WebGL overlay and
the server; `SkCanvas` on Skia; logical px, pixel ratio applied), `topLeft`
(viewport top-left, raw space), `config` (live: current `scale`, `size`)
and `transform` (`worldToScreen(x, y)`: item space -> canvas px, `(k, k)` =
center of cell k; `screenToWorld(px, py)` -> raw). Use cases and
screen-fixed overlays: [drawing.md](drawing.md#custom-draw-functions).

### Draw management

| Signature | Notes |
| :-- | :-- |
| `removeDrawHandle(handle: DrawHandle): void` | Remove one registration (a static's cache is dropped too). |
| `clearLayer(layer: number): void` | Remove every registration on a layer (drops its static caches). |
| `clearAll(): void` | Remove everything and drop all static caches. |
| `clearStaticCache(cacheKey?: string): void` | Drop one or all static caches. Does NOT re-render: a registered static keeps drawing what it captured. Re-registering with the same key already invalidates, so this is rarely needed. |

### Hit testing

| Signature | Notes |
| :-- | :-- |
| `hitTest<TData>(point: Coords, opts?: { layer?: number; padding?: number; paddingPx?: number }): HitResult<TImage, TData>[]` | Every rect/circle/image/line/path under a RAW point (pass `coords.raw`), top-most first: higher layer, later registration, later item. |
| `hitTestFirst<TData>(point: Coords, opts?): HitResult<TImage, TData> \| undefined` | Top-most item only. |
| `hitTestRect<TData>(rect: Bounds, opts?: { layer?: number; mode?: "intersect" \| "contain" }): HitResult<TImage, TData>[]` | Marquee: items intersecting (default) or fully inside a raw-space rect, corners in any order (build it from `coords.raw` drag points). Exact geometry: discs, rotated quads, path interiors minus holes. Stroke widths and `padding` are NOT applied - grow the rect instead. |

`HitResult` = `{ item, kind, layer, handle, index }`; `item` is the exact
object you drew. Identify items by their `data?: TData` field (never read by
the engine), not `index` (array position at draw time, stale after a
re-draw). `TData` is an explicit, UNCHECKED type argument - results are not
linked to the draw call that typed the items. The hit box is the drawn box
(origin, Rect `width`/`height`, image fit, rotation, `drawStatic*`
included); filled paths hit on the interior, lines and unfilled paths within
half the stroke width (min 8px). Text never hit-tests; neither do
`hitTest: false` registrations, items hidden by `visibleOf` or opted out by
`interactiveOf`, nor points outside the registration's `clip`. Hit tests
follow mutated item positions while a registration holds <= 500 items; above
that the index is built once, so re-register moved items
([500-item note](drawing.md#the-retained-draw-model)). `padding` (world
units) and `paddingPx` (screen px) grow every tested item, additively - use
them instead of invisible halo items. 500+ item draw calls use a spatial
index, so hover-rate queries are fine. Usage pattern:
[events.md](events.md#pattern-item-click--hover-via-hittest).

### Event callbacks (assign as properties)

```ts
engine.onClick = (coords, mouse, client, info) => {}; // info?.source (core >= 0.12)
engine.onRightClick = (coords, mouse, client) => {};  // DOM only
engine.onHover = (coords, mouse, client) => {};
engine.onMouseDown = (coords, mouse, client) => {};
engine.onMouseUp = (coords, mouse, client) => {};
engine.onMouseLeave = (coords, mouse, client) => {};
engine.onWheel = (coords, mouse, client, wheel) => {}; // wheel/pinch gesture
engine.onZoom = (scale) => {};                        // the scale changed
engine.onCoordsChange = (center) => {};               // camera notification
engine.onResize = () => {};
engine.onDraw = (ctx, topLeft, config, transform) => {}; // after each frame
```

Payload, which flag gates which callback, and when each fires:
[events.md](events.md).

## Image loading

`engine.images` is the renderer's `IImageLoader<TImage>`:

```ts
interface IImageLoader<TImage> {
    load(src: string, retry?: number): Promise<TImage>; // cached; retry default 1
    get(src: string): TImage | undefined;               // cache lookup, no load
    has(src: string): boolean;
    clear(): void;
    onLoad(cb: () => void): () => void;                 // returns unsubscribe
}
```

`TImage` is `HTMLImageElement` on web, `SkImage` on React Native, and the
`@napi-rs/canvas` `Image` on the server (paths, `file://`, `http(s)://` and
`data:` URIs supported there).

```ts
const img = await engine.images.load("/assets/tile.png");
engine.drawImage({ x: 0, y: 0, size: 1, img }, 1);
engine.render();
```

### CORS on the browser renderers

(core >= 0.12.) `RendererCanvas` and `RendererWebGL` load images with
`crossOrigin="anonymous"` by default, so images served WITHOUT an
`Access-Control-Allow-Origin` header fail to load entirely (the error names
the URL, not the header). Opt out per renderer:

```ts
new RendererCanvas({ crossOrigin: null });          // plain request, no CORS
new RendererCanvas({ crossOrigin: "use-credentials" }); // CORS with cookies
```

Use `null` for a bucket, CDN or tile server that sends no CORS headers. Safe
on Canvas2D (the canvas is merely tainted; nothing reads it back). On WebGL a
tainted image cannot become a texture and is skipped - opt out there only if
every image is same-origin.

## Utilities

### `gridToSize` - think in cells instead of pixels

For fixed boards (chess, match-3, minesweeper). Returns `{ size, scale,
center }` where `center = ((columns-1)/2, (rows-1)/2)` is the exact center of
cells `0..N-1`. ALWAYS pass this center to the engine (without it the board
renders mostly off-screen); `gridAligned` is then unnecessary.

```ts
import { gridToSize } from "@canvas-tile-engine/core";

const { center, ...board } = gridToSize({ columns: 8, rows: 8, cellSize: 60 });
// board => size {480,480}, scale 60; center => { x: 3.5, y: 3.5 }

const engine = new CanvasTileEngine(wrapper, {
    ...board,
    eventHandlers: { click: true, hover: true, drag: false, zoom: false },
}, new RendererCanvas(), center);
```

### `fitScale` - content-driven scale limits

`fitScale(bounds: Bounds, size: { width, height }, options?: { padding?,
paddingPx? }): number` returns the scale at which `bounds` exactly fits a
`size`-px viewport - the SAME math `fitBounds` uses, as a pure config-time
function. `paddingPx` (screen px) wins over `padding` (world units). The
result is unclamped - apply your own policy. Throws on invalid bounds,
paddings or size. Derive `scale`/`minScale` from the content instead of
hand-tuned constants:

```ts
import { fitScale } from "@canvas-tile-engine/core";

const fit = fitScale(WORLD_BOUNDS, VIEWPORT, { paddingPx: 24 });
const config = {
    size: VIEWPORT,
    scale: fit,          // open showing everything
    minScale: fit * 0.8, // overview slack - your policy
    maxScale: 64,        // quality cap - NOT derivable from bounds, keep hand-picked
};
// Runtime content change: setScaleLimits(fit * 0.8, 64) + fitBounds(bounds)
```

### `itemsBounds` - the rectangle `fitBounds`/`fitScale` ask for

(core >= 0.12.) `itemsBounds(items)` returns the item-space `Bounds`
enclosing a list of items of any kinds (hit results go straight in), or
`null` when nothing in it has bounds:

| Kind                              | Box |
| --------------------------------- | --- |
| `Rect`, `Circle`, `Text`, `Image` | `width ?? size` x `height ?? size` world units (default 1), centered on the anchor |
| `Line`                            | its two endpoints |
| `PathItem`                        | vertex box for `points`, control-point hull for `commands` |

```ts
import { itemsBounds } from "@canvas-tile-engine/core";

// Marquee selection -> frame it (rects, lines and paths in one list)
const picked = engine.hitTestRect(marquee, { mode: "contain" }).map((h) => h.item);
const bounds = itemsBounds(picked);
if (bounds) {
    engine.fitBounds(bounds, { paddingPx: 24 });
}
```

Keep the guard: a selection or hit result can be empty (`!` only for sets
known to be non-empty). Items that draw nothing are skipped. Camera-
independent, so it ignores `origin` offsets and `rotate` (add `padding` for
slack), `sizePx`/`fontPx`, and glyph extents (a `Text` counts its `size`
box). `pathItemBounds(item)` is the single-path building block.

## Exported types and classes (import from `@canvas-tile-engine/core`)

| Group | Exports |
| :-- | :-- |
| Values | `CanvasTileEngine`, `SpriteSheet`, `SpriteAnimator`, `gridToSize`, `fitScale`, `itemsBounds`, `pathItemBounds`, `normalizeConfig` (plus `Config`, `GestureProcessor`, ... for renderer authors) |
| Config | `CanvasTileEngineConfig`, `EventHandlers`, `ZoomMode`, `KeyboardConfig`, `AccessibilityConfig`, `AccessibilityRole`, `ReducedMotionSetting` |
| Geometry | `Coords`, `Bounds`, `BoundedItem`, `FitBoundsOptions`, `FitBoundsResult`, `FitScaleOptions`, `DrawTransform` |
| Items, paint | `DrawObject`, `Rect`, `Circle`, `Text`, `Line`, `PathItem`, `PathCommand`, `PathStyle`, `ImageItem`, `SpriteRect`, `LineStyle`, `TextAlign`, `TextBaseline`, `FontWeight`, `LinearGradient`, `Paint` (`string \| LinearGradient`), `ColorStop` |
| Draw options | `DrawHandle`, `DrawOptions`, `StaticDrawOptions`, `RectDrawOptions` (and `Circle`/`Text`/`Line`/`Path`/`Image` variants), `StyleOf`, `VisibleOf`, `InteractiveOf` |
| Hit testing | `HitResult`, `HitKind`, `HitTestOptions`, `HitTestRectOptions` |
| Callbacks | `onClickCallback`, `onRightClickCallback`, `onHoverCallback`, `onMouseDownCallback`, `onMouseUpCallback`, `onMouseLeaveCallback`, `onWheelCallback`, `onZoomCallback`, `onDrawCallback`, `ClickInfo`, `WheelInfo` (no named type for `onCoordsChange`/`onResize`) |
| Sprites | `SpriteSheetOptions`, `SpriteAnimation` |
| Renderer authors | `IRenderer`, `IDrawAPI`, `IImageLoader`, `ICamera`, `RendererDependencies` |

Generics: `Rect`, `Circle`, `Text`, `Line`, `PathItem` are `<TData =
unknown>`, `ImageItem` is `<TImage, TData>`; type a dataset as
`Rect<{ id: string }>[]` for a typed `item.data` in `styleOf` and hits. The
React/RN packages re-export all of these except `normalizeConfig` and the
renderer-author exports (core >= 0.12; the engine class as
`CanvasTileEngineCore`): [react.md](react.md#types-binding-or-core).

## Validation errors

Invalid input throws a plain `Error` whose message starts with
`[CanvasTileEngine] Invalid config:` (there is no exported error class). The
constructor rejects non-positive/non-finite `scale`, `size` or limits,
`minScale > maxScale`, `scale` outside explicit limits, an unknown `zoom`
mode, bad `accessibility` fields and `bounds` with `min >= max`. At runtime
`setScale`/`goScale`, `setCenter`/`goCenter` (non-finite), `setScaleLimits`,
`setBounds`, `setAccessibility`, `setReducedMotion`, `fitBounds`/`fitScale`
(non-finite edge, `min >= max`, negative padding) throw the same way;
`drawGridLines` throws a `RangeError` for a non-positive `cellSize`.
`normalizeConfig(config)` (core >= 0.12) fills every default above without
an engine and returns a frozen snapshot (`normalizeConfig({ scale: 32, size
}).minScale === 16`); it does NOT validate.
