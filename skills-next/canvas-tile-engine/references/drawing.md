# Drawing Reference

Applies to every renderer. Item coordinates and sizes are in world (tile)
units; the engine converts to pixels using the current camera scale.

## The retained draw model

- `drawX(...)` registers a persistent callback on a layer and returns a
  `DrawHandle`. Nothing paints until `engine.render()` runs.
- Callbacks re-run every frame (pan, zoom, resize, explicit `render()`).
- Registering again ADDS another callback - it does not replace. Three ways
  to update content:

```ts
// A. Handle swap (best for one changing thing, e.g. hover highlight)
let handle = engine.drawRect(rectA, 5);
engine.removeDrawHandle(handle);
handle = engine.drawRect(rectB, 5);
engine.render();

// B. Layer swap (best for a whole dynamic layer)
engine.clearLayer(2);
engine.drawRect(newRects, 2);
engine.render();

// C. Mutation (best for animation; items are held by reference)
const item = { x: 0, y: 0, size: 1, style: { fillStyle: "red" } };
engine.drawRect(item, 1);
item.x += 1;        // mutate the same object
engine.render();    // repaint shows the new position
```

## Layers

Ascending draw order: layer 0 paints first (bottom), higher layers paint on
top. Defaults: `drawGridLines` 0, most primitives 1, `drawText` 2. Multiple
draw calls can share a layer (drawn in registration order).

## Coordinate convention: integers are cell centers

An item at integer coordinate `k` is centered on its cell. Concretely:

- Cell `k` spans world `[k - 0.5, k + 0.5]`; cell boundaries (and grid lines)
  fall on half-integers (`-0.5`, `0.5`, `1.5`, ...).
- A board of cells `0..N-1` spans world `[-0.5, N - 0.5]` and is centered at
  `(N - 1) / 2` on each axis - e.g. `(9.5, 9.5)` for 20x20, `(3.5, 3.5)` for
  8x8. Using `N/2` puts everything half a cell off (background strips on the
  right/bottom edges, clicks landing on cell boundaries).
- `gridToSize` returns this center for you; pass it to the engine
  constructor (vanilla/server) or the `center` prop (React/RN).
- Clicks/hover report the cell as `coords.snapped` (floored), consistent
  with this convention - no adjustment needed.

## Shared item fields (`DrawObject`)

```ts
{
    x: number;                // world position
    y: number;
    size?: number;            // world units, default 1
    origin?: {
        mode?: "cell" | "self";   // default "cell"
        x?: number;               // 0..1, default 0.5
        y?: number;               // 0..1, default 0.5
    };
    style?: {
        fillStyle?: string;
        strokeStyle?: string;
        lineWidth?: number;    // border width in WORLD units (scales with zoom)
        lineWidthPx?: number;  // border width in screen px (zoom-independent); wins over lineWidth
    };
    rotate?: number;          // degrees, positive = clockwise (Rect/Image only)
    radius?: number | number[]; // corner radius in WORLD units, scales with zoom (Rect only);
                              // array = [topLeft, topRight, bottomRight, bottomLeft]
    data?: TData;             // arbitrary app data; never read by the engine,
                              // returned as hit.item.data from hitTest
}
```

### Origin / anchoring

- `mode: "cell"` (default): anchor relative to the grid cell at `(x, y)`.
  `origin { x: 0.5, y: 0.5 }` centers the object in its cell - the typical
  tile look.
- `mode: "self"`: anchor relative to the object's own size. `{ x: 0.5, y: 0.5 }`
  centers the object exactly on the coordinate - useful for markers of
  varying size pinned to a point.

Styles: if `fillStyle` is set the shape is filled; if `strokeStyle` is set it
is stroked; both work together. Any CSS color string works (`"#22c55e"`,
`"rgba(56,189,248,0.25)"`, `"hsl(200 80% 50%)"`).

## Primitives

### Rect

Adds to the shared fields:

```ts
{
    width?: number;   // world units, defaults to size - non-square rects
    height?: number;  // world units, defaults to size
}
```

```ts
engine.drawRect({ x: 2, y: 3, size: 1, rotate: 45, radius: 0.12,
                  style: { fillStyle: "#22c55e", strokeStyle: "#166534", lineWidth: 0.05 } }, 1);
engine.drawRect(rectArray, 1);   // arrays are the fast path for many items

// Non-square: one 4x2 zone floor instead of 8 one-cell rects
engine.drawRect({ x: 5, y: 8, width: 4, height: 2,
                  style: { fillStyle: "rgba(34,197,94,0.3)" } }, 1);
```

Origin anchoring applies per axis (cell mode centers the box on the anchor
cell; self mode anchors to the box itself). Rotation spins around the box
center. `width`/`height` are Rect-only - Circle stays `size` (diameter) and
Image keeps its aspect-fit `size` box.

### Circle

Same as Rect minus `rotate`/`radius`. `size` is the diameter in world units;
`sizePx` is a fixed screen-pixel diameter that wins over `size` (the marker
pattern, fontPx analog — station dots that stay readable at any zoom).
`sizePx` is IGNORED by `drawStaticCircle` (caches replay at a recorded
scale); hit testing follows whichever the renderer draws.

```ts
engine.drawCircle({ x: 0, y: 0, size: 0.8, style: { fillStyle: "#22d3ee" } }, 1);
engine.drawCircle({ x: 4, y: 0, sizePx: 12, style: { fillStyle: "#f43f5e" } }, 2); // 12px at any zoom
```

### Text

Two sizing modes, no `radius`:

- `size` (default 1): font em-box height in world units; pixel height is
  `size * scale`, so text scales with zoom like other primitives.
- `fontPx`: fixed pixel size, independent of zoom - use for labels that must
  stay readable at any zoom level. Takes precedence over `size` when both set.

```ts
engine.drawText({
    x: 0, y: -1,
    text: "Spawn",
    size: 0.35,
    style: {
        fillStyle: "#e2e8f0",
        fontFamily: "sans-serif",          // default "sans-serif"
        textAlign: "center",               // "center"|"end"|"left"|"right"|"start"
        textBaseline: "middle",            // "alphabetic"|"bottom"|"hanging"|"ideographic"|"middle"|"top"
    },
}, 2);

// Zoom-independent label: always 14px on screen
engine.drawText({ x: 0, y: 0, text: "Ankara", fontPx: 14 }, 2);
```

On the WebGL renderer text is painted on a 2D overlay canvas and always
composites ABOVE all GPU primitives regardless of layer (see
[performance.md](performance.md)). On the server, register fonts first (see
[server.md](server.md)).

### Image

`ImageItem` = `DrawObject` minus `style`, plus:

```ts
{
    img: TImage;          // HTMLImageElement (web) / SkImage (RN) / napi Image (server)
    sprite?: { x: number; y: number; w: number; h: number };
                          // optional source rect in image pixels (spritesheet frame)
    sizePx?: number;      // fixed screen-pixel size, wins over size; IGNORED by drawStaticImage
    flipX?: boolean;      // horizontal mirror (true mirror - rotation can't produce it)
    flipY?: boolean;      // vertical mirror; both combine with rotate/sprite, work in statics
    opacity?: number;     // 0..1, default 1 - ghost/preview placements
}
```

```ts
const img = await engine.images.load("/assets/unit.png");
engine.drawImage({ x: 5, y: 3, size: 2, img, rotate: 90 }, 1);
engine.drawImage({ x: 7, y: 3, size: 2, img, opacity: 0.5 }, 2); // ghost preview
```

Aspect ratio derives from the image (or the `sprite` frame). Spritesheets and
animation: [sprites.md](sprites.md).

### Line and Path

```ts
// Line: independent segments
engine.drawLine(
    [{ from: { x: 0, y: 0 }, to: { x: 5, y: 5 } }],
    { strokeStyle: "#f59e0b", lineWidthPx: 2 },
    1,
);

// Path: PathItem objects — open polylines, closed outlines, filled shapes
engine.drawPath(
    {
        points: [{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 4, y: 0 }],
        style: { strokeStyle: "#a78bfa", lineWidthPx: 2 },
    },
    1,
);

// Filled zone: closed rounds every corner; fillStyle closes implicitly for
// filling (Canvas2D fill() semantics) and makes the interior hit-testable.
engine.drawPath({
    points: zoneOutline,
    closed: true,
    fillRule: "nonzero", // or "evenodd"; matters on self-intersecting outlines
    style: { fillStyle: "#22c55e55", strokeStyle: "#166534", lineWidthPx: 2, cornerRadius: 0.5 },
    data: { id: "zone-a" },
}, 1);

// Dashed (e.g. ferry routes, planned segments): lineDash is world units,
// lineDashPx is screen px and wins. Pattern flows around corners, rounded ones too.
engine.drawPath({ points: route, style: { strokeStyle: "#0ea5e9", lineWidthPx: 3, lineDashPx: [8, 4] } }, 1);
```

PathItem = { points: Coords[], closed?, fillRule? ("nonzero" default |
"evenodd"), style?, data? }. PathStyle = LineStyle fields + fillStyle? +
cornerRadius? (world) / cornerRadiusPx? (px, wins) for tangent-arc corner
rounding. Fill-only items draw no outline; unstyled items stroke a hairline.
The legacy `drawPath(Coords[] | Coords[][], style?, layer?)` form is
deprecated (stroke-only). Line keeps its call-level style argument, and Line
items accept `data?` now that lines surface in hit results. LineStyle =
{ strokeStyle?, lineWidth? (world), lineWidthPx?, lineDash? (world),
lineDashPx? }. UNIT RULE (matches Text size/fontPx): plain numbers are world
units and scale with zoom; *Px variants are screen pixels and take
precedence. GridLines lineWidth stays px by design. Path fills are exact on
every renderer, both fill rules and self-intersecting outlines included
(WebGL uses a two-pass stencil-then-cover fill).

### Grid lines

```ts
engine.drawGridLines(1, 1, "#1e293b", 0);
// (cellSize world units, lineWidth px = 1, strokeStyle = "black", layer = 0)
```

Grid lines are infinite - they cover whatever the camera shows.

## Static caching (`drawStaticRect` / `drawStaticCircle` / `drawStaticImage`)

Renders ALL items once into an offscreen canvas, then blits only the visible
region each frame. Signature adds a `cacheKey: string` (unique per dataset).

```ts
engine.drawStaticRect(minimapItems, "minimap-items", 1);
```

When to use:

| Scenario | Static? | Why |
| :-- | :-- | :-- |
| Minimap with 100k items, all visible | Yes | Culling cannot help when everything is on screen. |
| Main map with 100k items | No | Viewport culling + spatial index already handles it. |
| Fixed-zoom overview map | Yes | One pre-render serves every frame. |
| Content that changes (moving units) | No | Every change would force a cache rebuild. |

Rules:

- The cache does NOT observe item changes. After editing the dataset:
  `engine.clearStaticCache("minimap-items")`, remove the old handle or clear
  the layer, re-register, `render()`.
- `sprite` frames are frozen at build time on the static path - no animation.
- On the WebGL renderer `drawStatic*` are aliases of the dynamic path
  (batched GPU drawing is already cheap) and `clearStaticCache` is a no-op
  there - the API stays portable, behavior is equivalent.
- Caches are capped at 16384 px per dimension; huge world extents at high
  scale can exceed it, in which case the renderer falls back gracefully.

## Custom draw functions

Full rendering control on any layer. The `ctx` type depends on the renderer:

| Renderer | `ctx` in `addDrawFunction` / `onDraw` |
| :-- | :-- |
| renderer-canvas | `CanvasRenderingContext2D` |
| renderer-webgl | `CanvasRenderingContext2D` (2D overlay - always above GL primitives) |
| renderer-skia | `SkCanvas` |
| renderer-server | `SKRSContext2D` (`@napi-rs/canvas`) |

```ts
engine.addDrawFunction((ctx, topLeft, config, transform) => {
    const c = ctx as CanvasRenderingContext2D;
    // transform.worldToScreen takes ITEM-space coords (integers = cell
    // centers) and returns the pixel position — never hand-roll
    // (world - topLeft) * scale or the 0.5 cell offset.
    const p = transform.worldToScreen(3, 2); // center of cell (3, 2)
    c.fillStyle = "rgba(255,255,255,0.8)";
    c.fillRect(p.x - config.scale / 2, p.y - config.scale / 2, config.scale, config.scale);
}, 5);
```

`topLeft` is the camera's top-left world coordinate; `config` is the
normalized config with live `scale` and `size`; `transform` also has
`screenToWorld(x, y)`, which returns raw corner-space coords (the same space
as event `coords.raw`). `engine.onDraw` has the SAME signature and runs after
ALL layers every frame — code moves between the two hooks unchanged; only the
timing/z-order differs (and `clearAll()` does not remove `onDraw`).

RULE: everything passed to `ctx` is pixels. `worldToScreen` is for drawing
(world in, pixels out); `screenToWorld` is for querying (pixels in, world
out — feed it to `Math.floor`/`hitTest`, never back into `ctx`, and note
`worldToScreen(screenToWorld(p))` is half a cell off by design: the two
speak different world spaces).

## High-DPI

Browser renderers automatically size the backing store by `devicePixelRatio`.
Never multiply sizes by DPR yourself. On the server, use the `pixelRatio`
option instead.
