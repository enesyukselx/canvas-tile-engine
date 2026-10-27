# Drawing Reference

Every draw primitive, its item shape and options, on every renderer. Item
positions and sizes are world units; the engine converts them to pixels with
the camera scale.

Contents:

- [The retained draw model](#the-retained-draw-model)
- [styleOf, visibleOf, interactiveOf](#styleof-visibleof-interactiveof)
- [Layers and paint order](#layers-and-paint-order)
- [Coordinate convention: integers are cell centers](#coordinate-convention-integers-are-cell-centers)
- [Shared item fields (`DrawObject`)](#shared-item-fields-drawobject)
- [Primitives](#primitives)
- [Clipping a registration](#clipping-a-registration)
- [Static caching](#static-caching-drawstaticrect--drawstaticcircle--drawstaticimage)
- [Custom draw functions](#custom-draw-functions)
- [Screen-fixed overlays](#screen-fixed-overlays-hud-legend-labels-pinned-to-the-viewport)
- [High-DPI](#high-dpi)

## The retained draw model

`drawX(...)` registers a persistent callback on a layer and returns a
`DrawHandle` (`{ id: symbol, layer: number }`). It re-runs every frame,
reading its items by reference. Nothing paints until `engine.render()`
(camera moves render on their own). Calling a draw method again ADDS a
registration unless you pass the same `id` (core >= 0.10).

| What changed | Do this, then `render()` |
| :-- | :-- |
| Appearance by state (selection, hover, highlight) | `styleOf` ([next section](#styleof-visibleof-interactiveof)) |
| Show/hide by state (filters, toggles) | `visibleOf` - never a filtered copy of the array |
| Positions or sprite frames of the same items | mutate the item objects (see the 500-item note) |
| The item set or its geometry | draw again with the same `id` |
| Everything on one layer / one registration | `clearLayer(n)` and redraw / `removeDrawHandle(handle)` |

```ts
// Same id: the previous registration (callback + hit entries) is replaced
// atomically. Idempotent - safe to call from any state-change handler.
engine.drawRect(seatRects, 1, { id: "seats" });
engine.drawRect(newSeatRects, 1, { id: "seats" }); // replaces, no accumulation

// Mutation: the cheapest animation path
const unit = { x: 0, y: 0, size: 1, style: { fillStyle: "red" } };
engine.drawRect(unit, 1);
unit.x += 1;
engine.render(); // repaint shows the new position
```

500-item note: paint and hit testing reliably follow MOVED items only while
a registration holds <= 500 items. Above that a spatial index built from the
first positions can cull and hit-test moved items at their old place -
re-register with the same `id` instead.

Ids share one namespace across draw kinds and layers (a `drawCircle` with a
rect's id replaces the rect; a reused id on another layer moves the
registration). A replaced registration re-enters at the END of its layer's
draw order. Every draw method takes `options?` as its LAST parameter: `id`,
`hitTest: false` for decorative content, `clip` (core >= 0.12,
[Clipping a registration](#clipping-a-registration)) and the per-item
callbacks in the next section. Which method accepts which option:
[core-api.md](core-api.md#draw-methods).

## styleOf, visibleOf, interactiveOf

Per-item callbacks in the draw options, run at paint time (and, for
`visibleOf`/`interactiveOf`, at hit-query time). They read external state
live: mutate a Set and call `render()` - no new array, no re-registration, no
spatial-index rebuild. Identify items through `item.data`; return
`undefined` for the common undecorated case.

- `styleOf(item)` (core >= 0.10): returned fields overlay the item's own
  `style` for that frame.
- `visibleOf(item)`: `false` skips the item for the frame - neither painted
  nor hit-testable (queries fall through to items below).
- `interactiveOf(item)`: `false` keeps it painted but out of `hitTest`/
  `hitTestFirst`/`hitTestRect`. A `visibleOf`-hidden item never hit-tests,
  whatever this returns.

```ts
type Seat = { id: string; zone: string; sold: boolean };
const seats: Rect<Seat>[] = [
    { x: 0, y: 0, style: { fillStyle: "#334155" }, data: { id: "A1", zone: "vip", sold: false } },
    { x: 1, y: 0, style: { fillStyle: "#334155" }, data: { id: "A2", zone: "std", sold: true } },
];
const selected = new Set<string>();
const hiddenZones = new Set<string>();

engine.drawRect(seats, 1, {
    id: "seats",
    // item.data is typed from the items (Rect<Seat>) but optional: guard it
    styleOf: (s) =>
        s.data && selected.has(s.data.id)
            ? { strokeStyle: "#f59e0b", lineWidthPx: 3, lineDashPx: [6, 4] }
            : undefined,
    visibleOf: (s) => !(s.data && hiddenZones.has(s.data.zone)),
    interactiveOf: (s) => !s.data?.sold,
});

selected.add("A1");
hiddenZones.add("std");
engine.render(); // A1 gets a dashed frame; "std" seats vanish and stop hit-testing
```

Each `styleOf` limit matches that primitive's hit-test geometry - do NOT
assume they all behave the same:

| Method | `styleOf` may return | `visibleOf` | `interactiveOf` |
| :-- | :-- | :-- | :-- |
| `drawRect`, `drawCircle` | full style: `fillStyle` (color or gradient), `strokeStyle`, `lineWidth*`, `lineDash*` | yes | yes |
| `drawText` | full text style: `fillStyle`, `fontFamily`, `fontWeight`, `textAlign`, `textBaseline` | yes | no (text never hit-tests) |
| `drawLine` | `strokeStyle`, `lineDash`/`lineDashPx` - NOT `lineWidth*` | yes | yes |
| `drawPath` | `strokeStyle`, `lineDash*`, `fillStyle` - NOT `lineWidth*`, `cornerRadius*` | yes | yes |
| `drawImage` | no `styleOf` (no style): mutate `opacity` + `render()` | yes | yes |
| `drawStatic*`, `drawGridLines`, `addDrawFunction` | none of the three | - | - |

The width rule: line and path hit corridors derive from the stroke width
(paths also the corner radius) at REGISTRATION time, so their decorations
exclude those fields (a type error) - a paint-time change would desync
visuals from hit areas. For a per-item line/path width, set it in the item's
own `style` (registration-time; hit testing follows it) or re-register with
the same `id`. Rect/circle borders never feed hit geometry, so decorating
their width is safe.

- `styleOf` changes style fields only; position, size, `radius` and `rotate`
  are item fields (mutate or re-register).
- `drawLine`: the decoration overlays both the call-level `style` and the
  item's own `style` - item styles for fixed looks, `styleOf` for state.
- `drawPath`: decorating an unfilled path with `fillStyle` paints a fill,
  but hit testing still targets the stroke.
- Text: returning `undefined` keeps the item's color;
  `{ fillStyle: undefined }` resets it to black.
- Invisible but tappable? Not `visibleOf` - grow the target with the hit
  query's `padding`/`paddingPx`.

## Layers and paint order

- Layers paint ascending: layer 0 first (bottom). Defaults: `drawGridLines`
  0, `drawText` 2, everything else 1.
- Within a layer, registrations paint in registration order; within one
  draw call, items paint in ARRAY order (also above the 500-item index
  threshold; batching never reorders). Put the item that must be on top last.
- Hit testing mirrors this: topmost (higher layer, later registration, later
  item) first.
- WebGL exception: text and custom draw functions paint on a 2D overlay
  ABOVE every GPU primitive regardless of layer
  ([performance.md](performance.md)).

## Coordinate convention: integers are cell centers

Item `x`/`y` are item space: integer `k` is the CENTER of cell `k`, so cell
`k` spans `k - 0.5..k + 0.5`, grid lines fall on half-integers, and cells
`0..N-1` cover `-0.5..N - 0.5`. Center an N-cell board at `(N - 1) / 2`
(`gridToSize` returns it; `N / 2` puts everything half a cell off). A rect
`W` cells wide whose first cell is `c` has `x = c + (W - 1) / 2`. Which API
takes which space, and raw vs snapped event coords:
[core-api.md](core-api.md#coordinate-spaces).

## Shared item fields (`DrawObject`)

```ts
{
    x: number;                // item-space position
    y: number;
    size?: number;            // world units, default 1
    origin?: {
        mode?: "cell" | "self";   // default "cell"
        x?: number;               // 0..1, default 0.5
        y?: number;               // 0..1, default 0.5
    };
    style?: {
        fillStyle?: Paint;      // color string OR a linear gradient (see below)
        strokeStyle?: string;
        lineWidth?: number;    // border width in WORLD units (scales with zoom)
        lineWidthPx?: number;  // border width in screen px; wins over lineWidth
        lineDash?: number[];   // border dash in WORLD units (Canvas2D setLineDash semantics)
        lineDashPx?: number[]; // border dash in screen px; wins over lineDash
    };
    rotate?: number;          // degrees, positive = clockwise (Rect/Image only)
    radius?: number | number[]; // corner radius in WORLD units (Rect only);
                              // array = [topLeft, topRight, bottomRight, bottomLeft]
    data?: TData;             // app data, never read by the engine; hit.item.data
}
```

Item types are generic over `data`: `Rect<TData>`, `Circle<TData>`,
`Text<TData>`, `Line<TData>`, `PathItem<TData>`, `ImageItem<TImage, TData>`.
Declare the array with it (`const tiles: Rect<{ id: string }>[] = ...`) and
the draw call infers `TData`, typing `item.data` in `styleOf` and friends.

`fillStyle` fills, `strokeStyle` strokes, both work together; any CSS color
string works. `lineDash`/`lineDashPx` dash the border; omit for solid.

### Origin / anchoring

`origin` (Rect, Circle, Image; not Text) places the drawn box relative to
`(x, y)`. Neither mode snaps to a cell: a fractional `x` is used exactly, so
`x: 15.5` straddles cells 15 and 16.

- `mode: "cell"` (default): `origin.x`/`y` (0..1) pick a point of the
  one-unit cell centered on `(x, y)` (0 = left/top edge, 1 = right/bottom
  edge), and the box is CENTERED on that point, whatever its size.
- `mode: "self"`: `origin.x`/`y` pick a point of the BOX, and that point
  lands on `(x, y)`.

At the default `{ x: 0.5, y: 0.5 }` both modes center the box on `(x, y)` -
the usual tile look. Use `"self"` to anchor by an edge or corner, e.g. a map
pin whose tip sits on the point: `{ mode: "self", x: 0.5, y: 1 }`.

### Gradient fills

`fillStyle` on Rect/Circle and on `PathStyle` accepts a `LinearGradient`
(core >= 0.12) as well as a color string:
`{ type: "linear", from, to, stops: { offset, color }[], units? }`, where
`from`/`to` are `Coords` and `units` is `"box"` (default) or `"world"`.
`strokeStyle` and text fills stay color strings.

- `"box"` units (default): `from`/`to` are FRACTIONS of the item's own drawn
  box (a path's bounding box), so one gradient object is "top to bottom" for
  every item whatever its size, position or rotation (a rotated shape's ramp
  turns with it). One spec serves a whole series.
- `"world"` units: `from`/`to` are item-space coordinates; the ramp spans the
  scene and neighbouring items each show their slice of it.
- Stops are clamped to `0..1` and sorted; two stops at one offset make a hard
  break. An empty list paints nothing, a single stop paints flat.
- Identical on all four renderers. `drawStatic*` bakes a `"world"` axis at
  the scale its cache was recorded at.
- `LinearGradient`, `Paint` and `ColorStop` are core types, also
  re-exported by the React/RN bindings (core >= 0.12).

```ts
import type { LinearGradient } from "@canvas-tile-engine/core";

const ramp: LinearGradient = {
    type: "linear",
    from: { x: 0, y: 0 },
    to: { x: 0, y: 1 },
    stops: [{ offset: 0, color: "#f97316" }, { offset: 1, color: "#22d3ee" }],
};
engine.drawRect(bars.map((b) => ({ ...b, style: { fillStyle: ramp } })), 1);
```

## Primitives

### Rect

Adds to the shared fields:

```ts
{
    width?: number;    // world units, defaults to size - non-square rects
    height?: number;   // world units, defaults to size
    sizePx?: number;   // fixed screen-px size for both axes, wins over size/width/height
    widthPx?: number;  // fixed screen-px width, wins over sizePx and width
    heightPx?: number; // fixed screen-px height, wins over sizePx and height
}
```

The `*Px` fields are core >= 0.12. Per axis the resolution order is
`widthPx` -> `sizePx` -> `width` -> `size` (pixels before world units, the
specific field before the shared one). `drawStaticRect` ignores them.

```ts
engine.drawRect({ x: 2, y: 3, size: 1, rotate: 45, radius: 0.12,
                  style: { fillStyle: "#22c55e", strokeStyle: "#166534", lineWidth: 0.05 } }, 1);
engine.drawRect(rectArray, 1);   // arrays are the fast path for many items

// Non-square: one 4x2 zone floor over cells 5..8 x 8..9 instead of 8 rects
engine.drawRect({ x: 6.5, y: 8.5, width: 4, height: 2,
                  style: { fillStyle: "rgba(34,197,94,0.3)" } }, 1);

// Zoom-independent: a 14px square marker and a 120x24px label plate
engine.drawRect({ x: 3, y: 3, sizePx: 14, style: { fillStyle: "#f43f5e" } }, 2);
engine.drawRect({ x: 3, y: 4, widthPx: 120, heightPx: 24,
                  style: { fillStyle: "#0f172acc" } }, 2);
```

Radii apply to fill and stroke (dashed and rotated borders included); one to
four values expand CSS-style, and radii that overflow the box shrink
uniformly. Rotation spins around the box center.

### Circle

Same as Rect minus `rotate`/`radius`/`width`/`height`. `size` is the
diameter in world units; `sizePx` is a fixed screen-pixel diameter that wins
over `size` (ignored by `drawStaticCircle`). Hit testing follows whichever
size is drawn.

```ts
engine.drawCircle({ x: 0, y: 0, size: 0.8, style: { fillStyle: "#22d3ee" } }, 1);
engine.drawCircle({ x: 4, y: 0, sizePx: 12, style: { fillStyle: "#f43f5e" } }, 2); // 12px at any zoom
```

### Text

No `radius`, no `origin` (anchors from `x`/`y` via `textAlign`/
`textBaseline`), never hit-tested. `size` (default 1) is the em-box height in
world units and scales with zoom; `fontPx` is a fixed pixel size that wins
over `size` (labels readable at any zoom).

```ts
engine.drawText({
    x: 0, y: -1,
    text: "Spawn",
    size: 0.35,
    style: {
        fillStyle: "#e2e8f0",              // default "#000000" on every renderer
        fontFamily: "sans-serif",          // default "sans-serif"
        fontWeight: "bold",                // core >= 0.12: "normal"|"bold"|100..900
        textAlign: "center",               // "center"|"end"|"left"|"right"|"start"
        textBaseline: "middle",            // "alphabetic"|"bottom"|"hanging"|"ideographic"|"middle"|"top"
    },
}, 2);
engine.drawText({ x: 0, y: 0, text: "Ankara", fontPx: 14 }, 2); // always 14px
```

On the server, register fonts first ([server.md](server.md#fonts)).

### Image

`ImageItem` = `DrawObject` minus `style` and `radius`, plus:

```ts
{
    img: TImage;          // HTMLImageElement (web) / SkImage (RN) / napi Image (server)
    sprite?: { x: number; y: number; w: number; h: number };
                          // optional source rect in image pixels (spritesheet frame)
    sizePx?: number;      // fixed screen-pixel size, wins over size; IGNORED by drawStaticImage
    flipX?: boolean;      // horizontal mirror (rotation cannot produce it)
    flipY?: boolean;      // vertical mirror; both combine with rotate/sprite, work in statics
    opacity?: number;     // 0..1, default 1 - ghost/preview placements
}
```

```ts
const img = await engine.images.load("/assets/unit.png");
engine.drawImage({ x: 5, y: 3, size: 2, img, rotate: 90 }, 1);
engine.drawImage({ x: 7, y: 3, size: 2, img, opacity: 0.5 }, 2); // ghost preview
```

The aspect ratio comes from the image (or the `sprite` frame) and fits the
`size` box. Spritesheets and animation: [sprites.md](sprites.md).

### Line and Path

```ts
// Line: independent segments; the style argument is the batch default and
// an item's own style overrides it
engine.drawLine([
    { from: { x: 0, y: 0 }, to: { x: 8, y: 0 } },
    { from: { x: 0, y: 1 }, to: { x: 8, y: 1 }, style: { strokeStyle: "#f59e0b", lineWidthPx: 4 } },
    { from: { x: 0, y: 2 }, to: { x: 8, y: 2 }, style: { lineDashPx: [6, 3] } },
], { strokeStyle: "#94a3b8", lineWidthPx: 1 }, 1);

// Path, points form: open polyline, or a filled zone. fillStyle closes the
// outline for filling and makes the interior hit-testable.
engine.drawPath({ points: route, style: { strokeStyle: "#0ea5e9", lineWidthPx: 3, lineDashPx: [8, 4] } }, 1);
engine.drawPath({
    points: zoneOutline,
    closed: true,
    fillRule: "nonzero", // or "evenodd"; matters on self-intersecting outlines
    style: { fillStyle: "#22c55e55", strokeStyle: "#166534", lineWidthPx: 2, cornerRadius: 0.5 },
    data: { id: "zone-a" },
}, 1);

// Path, commands form: a plaza with a hole
engine.drawPath({ commands: [
    { type: "moveTo", x: 0, y: 0 }, { type: "lineTo", x: 10, y: 0 },
    { type: "lineTo", x: 10, y: 10 }, { type: "lineTo", x: 0, y: 10 },
    { type: "closePath" },
    { type: "arc", x: 5, y: 5, radius: 2, startAngle: 0, endAngle: 360, ccw: true },
], style: { fillStyle: "#94a3b833" } });
```

- `PathItem` = `{ commands?, points?, closed?, fillRule?, style?, data? }`,
  exactly one of `commands`/`points` (`commands` wins if both); `fillRule`
  is `"nonzero"` (default) or `"evenodd"`.
- `points` form: `closed: true` closes the outline; `cornerRadius` (world) /
  `cornerRadiusPx` (px, wins) round corners with tangent arcs.
- `commands` form mirrors Canvas2D in world units: `moveTo`/`lineTo`
  (`x, y`) | `arc` (center `x, y`, `radius`, `startAngle`/`endAngle` in
  DEGREES, `ccw?`) | `quadraticCurveTo` (`cpx, cpy, x, y`) | `bezierCurveTo`
  (`cp1x, cp1y, cp2x, cp2y, x, y`) | `closePath`; `closed` and
  `cornerRadius` do not apply. Each `moveTo` starts a subpath, so one item
  can carry holes: with `evenodd` any overlapping subpath punches one, with
  `nonzero` the inner ring must wind opposite the outer.
- `PathStyle` = `LineStyle` + `fillStyle?` (color or gradient) +
  `cornerRadius?`/`cornerRadiusPx?`. Fill-only items draw no outline;
  unstyled items stroke a hairline. Fills are exact on every renderer.
- Hit testing matches the drawing: holes are not clickable, curves hit on
  the curve, unfilled paths and lines hit within half the stroke width.
- `LineStyle` = `strokeStyle?`, `lineWidth?`, `lineWidthPx?`, `lineDash?`,
  `lineDashPx?`. A Line item's own `style` overrides the batch default
  unit pair by unit pair: setting either width field replaces the whole
  width pair (an item's world `lineWidth` is never shadowed by the batch
  `lineWidthPx`); same for dash. Item styles are registration-time, so
  unlike `styleOf` they MAY set the width. Line items also take `data?`.
- Unit rule (as Text `size`/`fontPx`): plain numbers are world units and
  scale with zoom; `*Px` are screen px and win. `drawGridLines`' `lineWidth`
  is px by design.

### Grid lines

```ts
engine.drawGridLines(1, 1, "#1e293b", 0);
// (cellSize world units, lineWidth px = 1, strokeStyle = "black", layer = 0, options?)
```

Infinite: they cover whatever the camera shows, at item-space
`k * cellSize - 0.5` (the cell edges for `cellSize` 1). Zoomed out below 2px
spacing, only every 2nd/4th/8th/... line draws, so the count stays bounded.
`cellSize` must be a positive finite number (fractions are fine); anything
else throws `RangeError` synchronously, before registering or replacing an
`id` (the React/RN `GridLines` component too).

## Clipping a registration

`clip` (core >= 0.12) confines one registration to an axis-aligned world
rectangle: nothing it draws paints outside, and nothing outside hit-tests.

```ts
const plotArea = { minX: -0.5, maxX: 39.5, minY: -0.5, maxY: 19.5 }; // cells 0..39 x 0..19
engine.drawRect(bars, 1, { clip: plotArea });
engine.drawLine(series, { strokeStyle: "#22d3ee" }, 1, { clip: plotArea });
engine.drawStaticRect(plotBackground, "plot-bg", 0, { clip: plotArea });
```

- Item space, like `fitBounds`/`itemsBounds` (cells `0..N-1` =
  `-0.5..N-0.5`), so it pans and zooms with the scene - a chart plot area, a
  minimap inset frame. NOT the corner space of `config.bounds`
  ([coordinate spaces](core-api.md#coordinate-spaces)).
- Every draw kind takes it (primitives, `drawGridLines`, `drawStatic*`,
  `addDrawFunction`) on all four renderers; WebGL clips its GPU primitives
  and its 2D overlay (text, draw functions) alike.
- Hit testing follows it: a point outside never hits, `hitTestRect` narrows
  to the overlap, and `padding`/`paddingPx` do NOT widen it.
- Per registration only - there is no per-layer clip; pass the same object
  to each registration. Never clipped: `engine.onDraw`, the coordinate
  overlay.
- React/RN: a `clip` prop on every draw component, compared BY VALUE (an
  inline literal is fine, unlike `items`).

## Static caching (`drawStaticRect` / `drawStaticCircle` / `drawStaticImage`)

`drawStaticRect(items, cacheKey, layer?, options?)` (same shape for Circle
and Image) renders all items once and replays that cache every frame.
`options` takes only `hitTest` and `clip`; `cacheKey` is the id. No
`styleOf`/`visibleOf`/`interactiveOf`, and statics are not generic.

```ts
engine.drawStaticRect(minimapItems, "minimap-items", 1, { hitTest: false });
```

| Renderer | Cache | Zoomed in past the registration scale |
| :-- | :-- | :-- |
| Canvas2D, server | bitmap rendered at the registration scale, blitted and scaled | softens; re-register to re-render sharp |
| Skia | SkPicture recorded at the registration scale, replayed scaled | stays sharp (vector); px values baked in at that scale |
| WebGL | none - statics are aliases of the dynamic path | n/a; `*Px` sizes still stripped, `clearStaticCache` is a no-op |

The Canvas2D/server bitmap is rendered at the pixel ratio active at
registration (`devicePixelRatio` in the browser, the renderer's `pixelRatio`
on the server), so at the registration scale a static layer is as crisp as
a dynamic draw, on HiDPI screens and in `pixelRatio: 2` images too
(core >= 0.12; older releases render it at CSS-pixel resolution, slightly
soft at ratios above 1). When `devicePixelRatio` changes (browser zoom,
another monitor), the layer re-records itself once on the next frame. A
bitmap that would exceed 16384 px a side or ~16.7M px in area at the device
ratio is recorded at a lower ratio (never below 1) instead.

To keep a Canvas2D static layer sharp on a zoomable map, re-register it
(same `cacheKey`) once a zoom settles above the recorded scale, e.g. from a
debounced `onZoom`.

| Scenario | Static? | Why |
| :-- | :-- | :-- |
| Minimap with 100k items, all visible | Yes | Culling cannot help when everything is on screen. |
| Fixed-zoom overview map | Yes | One pre-render serves every frame. |
| Zoomable main map | OK on Skia/WebGL; softens on Canvas2D past the registration scale | Dynamic draws already cull with the spatial index. |
| Content that changes (moving units, selection) | No | Every change re-renders the whole cache; no `styleOf`. |

- The cache does NOT observe item mutations. Re-calling `drawStatic*` with
  the same key replaces the registration AND rebuilds the cache - after
  editing the dataset, re-register and `render()`. Removing the registration
  (`removeDrawHandle`/`clearLayer`/`clearAll`) drops the cache;
  `clearStaticCache(key)` only drops the stored reference (a registered
  layer keeps drawing what it captured).
- Pixel sizes (`sizePx`, `widthPx`, `heightPx`) are ignored by drawing and
  hit testing alike; `sprite` frames are frozen at build time.
- Canvas2D/server caches are capped at 16384 physical px per side (world
  extent * scale * pixel ratio). A larger cache (huge world extent at a high
  scale or ratio), or a platform without offscreen canvases, falls back to
  dynamic drawing with a console warning.

## Custom draw functions

`engine.addDrawFunction(fn, layer = 1, options?)` gives full rendering control
on a layer (`options`: `id`, `clip`). `fn(ctx, topLeft, config, transform)`
gets a renderer-specific `ctx`:

| Renderer | `ctx` in `addDrawFunction` / `onDraw` |
| :-- | :-- |
| renderer-canvas | `CanvasRenderingContext2D` |
| renderer-webgl | `CanvasRenderingContext2D` (2D overlay - always above GL primitives) |
| renderer-skia | `SkCanvas` |
| renderer-server | `SKRSContext2D` (`@napi-rs/canvas`) |

```ts
engine.addDrawFunction((ctx, topLeft, config, transform) => {
    const c = ctx as CanvasRenderingContext2D;
    // worldToScreen takes ITEM-space coords (integers = cell centers) and
    // returns canvas px - never hand-roll (world - topLeft) * scale.
    const p = transform.worldToScreen(3, 2); // center of cell (3, 2)
    c.fillStyle = "rgba(255,255,255,0.8)";
    c.fillRect(p.x - config.scale / 2, p.y - config.scale / 2, config.scale, config.scale);
}, 5);
```

- `ctx` units are CSS px (the device pixel ratio is already applied).
  `config` is the normalized config with LIVE `scale` and `size`. `topLeft`
  is the corner-space world coordinate of the top-left pixel
  (= `transform.screenToWorld(0, 0)`).
- `transform.worldToScreen(x, y)`: item space in, px out - for drawing.
  `transform.screenToWorld(px, py)`: px in, corner space (= event
  `coords.raw`) out - for querying (`Math.floor`, `hitTest`), never back
  into `ctx`; `worldToScreen(screenToWorld(p))` is half a cell off by design.
- `engine.onDraw = fn` has the SAME signature (`onDrawCallback`): one hook
  that runs after ALL layers every frame (only the coordinate overlay and
  debug HUD paint above it), ignores `clip`, and survives `clearAll()`.
- Draw functions never hit-test. React/RN: `<CanvasTileEngine.DrawFunction>`
  ([react.md](react.md)).

## Screen-fixed overlays (HUD, legend, labels pinned to the viewport)

Items live in world space and pan with the map; `*Px` fields (`sizePx`,
`fontPx`, `lineWidthPx`) fix an item's SIZE on screen, not its POSITION. To
pin something to the viewport:

| Option | Use for | Notes |
| :-- | :-- | :-- |
| DOM element over the surface | legends, buttons, panels, text a screen reader should read | Simplest and accessible. `pointer-events: none` unless interactive, so the map still pans under it. |
| `onDraw` / `addDrawFunction` in screen px | scale bars, crosshairs, frame-synced readouts, server images | `ctx` coordinates ARE screen px; position from `config.size`. Not hit-testable or accessible. Repaints only on engine renders - `render()` after its state changes. |

Vanilla: the renderer gives the wrapper `position: relative` and absolutely
positions its canvas, so an absolutely positioned child sits on top:

```ts
const wrapper = document.getElementById("map") as HTMLDivElement;
const legend = document.createElement("div");
legend.textContent = "Elevation (m)";
Object.assign(legend.style, { position: "absolute", right: "8px", bottom: "8px", pointerEvents: "none" });
wrapper.appendChild(legend);
```

React/RN: non-draw children of `<CanvasTileEngine>` render AFTER the
surface, not over it - put the engine and an absolutely positioned overlay
(`pointerEvents="none"` on RN) in a shared `position: relative` parent.

Canvas HUD pinned top-right (`onDraw` sits above every layer; use
`addDrawFunction(fn, layer)` when higher layers must cover it):

```ts
engine.onDraw = (ctx, _topLeft, config) => {
    const c = ctx as CanvasRenderingContext2D;
    const x = config.size.width - 128;
    c.fillStyle = "rgba(15,23,42,0.8)";
    c.fillRect(x, 8, 120, 28);
    c.fillStyle = "#e2e8f0";
    c.font = "12px sans-serif";
    c.fillText(`zoom ${config.scale.toFixed(1)} px/cell`, x + 8, 26);
};
```

## High-DPI

Browser renderers size the backing store by `devicePixelRatio`
automatically; never multiply sizes by DPR yourself. On the server, use the
`pixelRatio` option instead.
