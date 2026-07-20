---
sidebar_position: 2
---

# Drawing & Layers

The engine provides a layered rendering system where you can draw shapes, text, images, and custom content. All drawing operations use **world coordinates**, and the engine handles the scaling and positioning automatically.

:::tip Type Safety
All drawing types are exported from the package. See [Types Reference](/docs/introduction/types) for complete type definitions.

```typescript
import {
    Rect,
    Circle,
    Text,
    Path,
    ImageItem,
    Coords,
} from "@canvas-tile-engine/core";
```

:::

## Layer System

Layers control the Z-order of your content. Lower numbers draw first (background), higher numbers draw last (foreground).

| Layer | Typical Usage                  |
| :---- | :----------------------------- |
| `0`   | Background / Terrain           |
| `1`   | Grid lines / Floor decorations |
| `2`   | Objects / Units / Buildings    |
| `3`   | UI Markers / Overlays          |

:::tip
You can use any number for a layer. They are sorted automatically at render time.
:::

## Shapes

### `drawRect` & `drawCircle`

Draw basic geometric shapes. You can pass a single object or an array of objects for batch rendering.

```typescript
drawRect(items: Rect | Rect[], layer?: number, options?: DrawOptions): DrawHandle
drawCircle(items: Circle | Circle[], layer?: number, options?: DrawOptions): DrawHandle
```

Every draw method accepts an optional `options` object as its last parameter. Its single field, `id`, gives the registration a stable identity: calling a draw method again with the same `id` **replaces** the previous registration instead of accumulating alongside it. See [Replacing with a registration id](#replacing-with-a-registration-id-optionsid).

**Rect / Circle Properties:**

| Property | Type                 | Default                            | Description                                                                                                                                             |
| :------- | :------------------- | :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `x`, `y` | `number`             | **Required**                       | World coordinates of the center/origin.                                                                                                                 |
| `size`   | `number`             | `1`                                | Size in grid units (width/diameter).                                                                                                                    |
| `sizePx` | `number`             | -                                  | Fixed diameter in screen pixels, independent of zoom — marker-style dots (only for `drawCircle`, analog of Text's `fontPx`). Wins over `size`. Ignored by `drawStaticCircle`.  |
| `style`  | `object`             | `{}`                               | Styling options (see below).                                                                                                                            |
| `origin` | `object`             | `{ mode: "cell", x: 0.5, y: 0.5 }` | Anchor point.                                                                                                                                           |
| `width`  | `number`             | `size`                             | Width in world units (only for `drawRect`). Combine with `height` for non-square rectangles: bars, cards, zone floors.                                  |
| `height` | `number`             | `size`                             | Height in world units (only for `drawRect`).                                                                                                            |
| `rotate` | `number`             | `0`                                | Rotation angle in degrees (only for `drawRect`).                                                                                                        |
| `radius` | `number \| number[]` | -                                  | Border radius in world units (scales with zoom). Single value for all corners, or `[topLeft, topRight, bottomRight, bottomLeft]` (only for `drawRect`). |
| `data`   | `TData`              | -                                  | Arbitrary app data. Never read by the engine; returned on `hitTest` results as `hit.item.data` to identify what was hit.                                |

**Style Options:**

- `fillStyle`: Fill color (e.g., `"#ff0000"`, `"rgba(0,0,0,0.5)"`)
- `strokeStyle`: Border color
- `lineWidth`: Border width in world units; scales with zoom like the shape
- `lineWidthPx`: Border width in screen pixels, independent of zoom; wins over `lineWidth`

```typescript
// Draw a blue square on layer 1
engine.drawRect(
    {
        x: 5,
        y: 5,
        size: 1,
        style: { fillStyle: "#0077be" },
    },
    1,
);

// Draw a 4x2 zone floor (anchored on its center cell)
engine.drawRect(
    {
        x: 5,
        y: 8,
        width: 4,
        height: 2,
        style: { fillStyle: "rgba(34, 197, 94, 0.3)", strokeStyle: "#166534" },
    },
    1,
);

// Draw a rotated rectangle (45 degrees)
engine.drawRect(
    {
        x: 8,
        y: 5,
        size: 1,
        rotate: 45, // 45 degrees
        style: { fillStyle: "#ff6b6b" },
    },
    1,
);

// Draw a rounded rectangle
engine.drawRect(
    {
        x: 10,
        y: 5,
        size: 1,
        radius: 0.15, // world units: corners stay proportional at every zoom
        style: { fillStyle: "#2ecc71" },
    },
    1,
);

// Draw with different corner radii [topLeft, topRight, bottomRight, bottomLeft]
engine.drawRect(
    {
        x: 12,
        y: 5,
        size: 1,
        radius: [0.2, 0, 0.2, 0], // Diagonal rounded corners
        style: { fillStyle: "#9b59b6" },
    },
    1,
);

// Draw a red circle on layer 2
engine.drawCircle(
    {
        x: 6,
        y: 5,
        size: 0.8,
        style: { fillStyle: "#e63946" },
    },
    2,
);

// Batch drawing (Array)
engine.drawRect(
    [
        { x: 10, y: 10 },
        { x: 12, y: 10 },
        { x: 14, y: 10 },
    ],
    1,
);
```

## Lines & Paths

### `drawLine`

Draw a straight line between two points. Supports single object or array of objects.

```typescript
drawLine(items: Line | Line[], style?: LineStyle, layer?: number, options?: DrawOptions): DrawHandle
```

**Line Properties:**

| Property | Type       | Description        |
| :------- | :--------- | :----------------- |
| `from`   | `{ x, y }` | Start coordinates. |
| `to`     | `{ x, y }` | End coordinates.   |

```typescript
// Single line
engine.drawLine(
    { from: { x: 0, y: 0 }, to: { x: 10, y: 10 } },
    { strokeStyle: "#fb8500", lineWidthPx: 3 },
    1,
);

// Multiple lines
engine.drawLine(
    [
        { from: { x: 0, y: 0 }, to: { x: 5, y: 5 } },
        { from: { x: 5, y: 0 }, to: { x: 0, y: 5 } },
    ],
    { strokeStyle: "red", lineWidthPx: 2 },
    1,
);
```

**`LineStyle`** (used by `drawLine`):

| Property      | Unit  | Description                                                             |
| :------------ | :---- | :---------------------------------------------------------------------- |
| `strokeStyle` | -     | Line color.                                                             |
| `lineWidth`   | world | Thickness scales with zoom (a road/river that belongs to the world).    |
| `lineWidthPx` | px    | Zoom-independent thickness (cartographic lines); wins over `lineWidth`. |
| `lineDash`    | world | Dash pattern anchored to the world; dashes scale with zoom.             |
| `lineDashPx`  | px    | Zoom-independent dash pattern; wins over `lineDash`.                    |

Dash patterns follow Canvas2D `setLineDash` semantics (odd-length patterns repeat).

Lines participate in hit testing: a click/tap within half the stroke width of a segment hits it (with a minimum tap width for hairlines). An optional `data` field on each line carries through to hit results.

### `drawPath`

Draw free-form paths: open polylines, closed outlines, and filled shapes. Each `PathItem` owns its geometry and style.

```typescript
drawPath(items: PathItem | PathItem[], layer?: number, options?: DrawOptions): DrawHandle
```

**`PathItem` properties:**

| Property   | Type                      | Default     | Description                                                                                 |
| :--------- | :------------------------ | :---------- | :------------------------------------------------------------------------------------------ |
| `commands` | `PathCommand[]`           | -           | Free-form Canvas2D-style command list (below). Wins over `points` when both are set.        |
| `points`   | `Coords[]`                | -           | Polyline vertices in world units. One of `commands`/`points` is required.                   |
| `closed`   | `boolean`                 | `false`     | Join the last point back to the first (`points` form only — use a `closePath` command otherwise). |
| `fillRule` | `"nonzero" \| "evenodd"`  | `"nonzero"` | Canvas2D fill rule; the difference shows on self-intersecting outlines.                     |
| `style`    | `PathStyle`               | -           | Per-item styling (below).                                                                   |
| `data`     | `TData`                   | -           | App data carried through to hit results; never read by the engine.                          |

**`PathStyle`** extends the `LineStyle` fields above with:

| Property         | Unit  | Description                                                                             |
| :--------------- | :---- | :-------------------------------------------------------------------------------------- |
| `fillStyle`      | -     | Fill color. Setting it makes the path a filled shape (the outline closes implicitly for filling, like Canvas2D `fill()`). |
| `cornerRadius`   | world | Rounds every corner with a tangent arc; scales with zoom.                               |
| `cornerRadiusPx` | px    | Zoom-independent corner rounding; wins over `cornerRadius`.                             |

```typescript
// A ferry route: 3px dashed line at every zoom level
engine.drawPath(
    { points: ferryPoints, style: { strokeStyle: "#0ea5e9", lineWidthPx: 3, lineDashPx: [8, 4] } },
    1,
);

// A filled zone with a rounded outline, identifiable in hit results
engine.drawPath(
    {
        points: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 3 },
            { x: 0, y: 3 },
        ],
        closed: true,
        style: { fillStyle: "#22c55e55", strokeStyle: "#166534", lineWidthPx: 2, cornerRadius: 0.5 },
        data: { id: "zone-a" },
    },
    1,
);

// Multiple items, each with its own style
engine.drawPath(
    [
        { points: routeA, style: { strokeStyle: "#219ebc", lineWidthPx: 2 } },
        { points: routeB, style: { strokeStyle: "green", lineWidthPx: 1 } },
    ],
    1,
);
```

#### Free-form commands: curves, arcs, and holes

`commands` mirrors the Canvas2D path API. Coordinates and radii are world units; angles are **degrees** (like `rotate`).

```typescript
type PathCommand =
    | { type: "moveTo"; x: number; y: number }
    | { type: "lineTo"; x: number; y: number }
    | { type: "arc"; x: number; y: number; radius: number; startAngle: number; endAngle: number; ccw?: boolean }
    | { type: "quadraticCurveTo"; cpx: number; cpy: number; x: number; y: number }
    | { type: "bezierCurveTo"; cp1x: number; cp1y: number; cp2x: number; cp2y: number; x: number; y: number }
    | { type: "closePath" };
```

Each `moveTo` starts a new subpath, so one item can be an outline plus holes. Under `"evenodd"` any overlapping subpath punches a hole; under `"nonzero"` (default) a hole must wind in the opposite direction of its outer ring — exactly Canvas2D `fill()` semantics, on every renderer.

```typescript
// A curved metro line
engine.drawPath({
    commands: [
        { type: "moveTo", x: 0, y: 10 },
        { type: "lineTo", x: 6, y: 10 },
        { type: "quadraticCurveTo", cpx: 10, cpy: 10, x: 10, y: 6 },
        { type: "lineTo", x: 10, y: 0 },
    ],
    style: { strokeStyle: "#e11d48", lineWidthPx: 4 },
});

// A plaza with a hole (fountain): outer ring CW, inner ring CCW
engine.drawPath({
    commands: [
        { type: "moveTo", x: 0, y: 0 },
        { type: "lineTo", x: 10, y: 0 },
        { type: "lineTo", x: 10, y: 10 },
        { type: "lineTo", x: 0, y: 10 },
        { type: "closePath" },
        { type: "arc", x: 5, y: 5, radius: 2, startAngle: 0, endAngle: 360, ccw: true },
    ],
    style: { fillStyle: "#94a3b833" },
    data: { id: "plaza" },
});
```

Hit testing follows the same geometry: the hole is not clickable, curves hit on the actual curve (not the chord). `cornerRadius` applies to the `points` form only — with `commands`, draw arcs explicitly.

Paths participate in hit testing: filled paths hit on their interior (under the item's `fillRule`), unfilled paths hit on the stroke itself — within half the stroke width, with a minimum tap width so hairlines stay tappable.

Dash patterns flow continuously around corners, including rounded ones.



### `drawGridLines`

Draw grid lines at specified intervals. This is useful for creating grid overlays on your map.

```typescript
drawGridLines(cellSize: number, lineWidth?: number, strokeStyle?: string, layer?: number, options?: DrawOptions): DrawHandle
```

| Parameter     | Type          | Default   | Description                                       |
| :------------ | :------------ | :-------- | :------------------------------------------------ |
| `cellSize`    | `number`      | -         | Size of each grid cell in world units.            |
| `lineWidth`   | `number`      | `1`       | Width of grid lines in pixels.                    |
| `strokeStyle` | `string`      | `"black"` | Color of the grid lines.                          |
| `layer`       | `number`      | `0`       | Rendering layer.                                  |
| `options`     | `DrawOptions` | -         | Optional `id` for replace-on-re-register.         |

```typescript
// Draw a basic grid with 1-unit cells
engine.drawGridLines(1);

// Draw a grid with custom styling
engine.drawGridLines(5, 2, "rgba(255, 255, 255, 0.3)", 0);

// Draw multiple grids at different scales
engine.drawGridLines(1, 0.5, "rgba(0, 0, 0, 0.1)", 0); // Fine grid
engine.drawGridLines(5, 1, "rgba(0, 0, 0, 0.3)", 0); // Medium grid
engine.drawGridLines(50, 2, "rgba(0, 0, 0, 0.5)", 0); // Coarse grid
```

## Text & Images

### `drawText`

Render text at world coordinates. Supports single object or array of objects. Text size scales with zoom.

```typescript
drawText(items: Text | Text[], layer?: number, options?: DrawOptions): DrawHandle
```

**Text Properties:**

| Property | Type     | Default                            | Description                                                                   |
| :------- | :------- | :--------------------------------- | :---------------------------------------------------------------------------- |
| `x`, `y` | `number` | **Required**                       | World coordinates.                                                            |
| `text`   | `string` | **Required**                       | The text content.                                                             |
| `size`   | `number` | `1`                                | Font size in world units (scales with zoom). Ignored when `fontPx` is set.    |
| `fontPx` | `number` | -                                  | Fixed font size in pixels, independent of zoom. Takes precedence over `size`. |
| `origin` | `object` | `{ mode: "cell", x: 0.5, y: 0.5 }` | Anchor point.                                                                 |
| `style`  | `object` | -                                  | Font styling options.                                                         |
| `rotate` | `number` | `0`                                | Rotation angle in degrees (clockwise).                                        |

**Style Options:**

- `fillStyle`: Text color
- `fontFamily`: Font family (default: `"sans-serif"`)
- `textAlign`: `"left"`, `"center"`, `"right"`
- `textBaseline`: `"top"`, `"middle"`, `"bottom"`

```typescript
// Single text
engine.drawText(
    {
        x: 5,
        y: 5,
        text: "Base Camp",
        size: 1,
        style: { fillStyle: "white", fontFamily: "Arial" },
    },
    3,
);

// Rotated text (45 degrees)
engine.drawText(
    {
        x: 8,
        y: 5,
        text: "Rotated",
        size: 1,
        rotate: 45,
        style: { fillStyle: "yellow" },
    },
    3,
);

// Fixed-size label: always 14px on screen, regardless of zoom
engine.drawText(
    {
        x: 5,
        y: 3,
        text: "Ankara",
        fontPx: 14,
        style: { fillStyle: "white" },
    },
    3,
);

// Multiple texts (batch rendering)
engine.drawText(
    [
        { x: 0, y: 0, text: "A", size: 2, style: { fillStyle: "red" } },
        { x: 1, y: 0, text: "B", size: 2, style: { fillStyle: "blue" } },
        { x: 2, y: 0, text: "C", size: 2, style: { fillStyle: "green" } },
    ],
    3,
);
```

:::tip Two sizing modes
`size` works like other draw methods - it's in world units, so `size: 1` text has a font em box of one tile and scales with zoom. Use `fontPx` instead for labels that must stay readable at any zoom level (map labels, names): the text keeps the same pixel size on screen no matter how far you zoom out.
:::

### `drawImage`

Draw an image scaled to world units. Supports single object or array of objects.

```typescript
drawImage(items: ImageItem | ImageItem[], layer?: number, options?: DrawOptions): DrawHandle
```

**ImageItem Properties:**

| Property  | Type               | Default                            | Description                                                                                                      |
| :-------- | :----------------- | :--------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| `x`, `y`  | `number`           | **Required**                       | World coordinates.                                                                                               |
| `img`     | `HTMLImageElement` | **Required**                       | The loaded image object.                                                                                         |
| `size`    | `number`           | `1`                                | Size in grid units (maintains aspect ratio).                                                                     |
| `sizePx`  | `number`           | -                                  | Fixed size in screen pixels, independent of zoom — marker-style images. Wins over `size`. Ignored by `drawStaticImage`.  |
| `flipX`   | `boolean`          | `false`                            | Mirror horizontally (a true mirror — no rotation can produce it). Combines with `rotate` and `sprite`.           |
| `flipY`   | `boolean`          | `false`                            | Mirror vertically.                                                                                               |
| `rotate`  | `number`           | `0`                                | Rotation angle in degrees (0 = no rotation, positive = clockwise).                                               |
| `origin`  | `object`           | `{ mode: "cell", x: 0.5, y: 0.5 }` | Anchor point.                                                                                                    |
| `sprite`  | `SpriteRect`       | -                                  | Source rectangle in sheet pixels — draws a sub-region of `img`. See [Spritesheet & Animation](./spritesheet.md). |
| `opacity` | `number`           | `1`                                | Opacity from 0 (transparent) to 1 (opaque). Ideal for ghost/preview placements.                                  |
| `data`    | `TData`            | -                                  | Arbitrary app data. Never read by the engine; returned on `hitTest` results as `hit.item.data`.                  |

```typescript
// Single image
const img = await engine.images.load("/assets/tree.png");
engine.drawImage({ x: 2, y: 3, size: 1.5, img }, 2);

// Rotated image (90 degrees clockwise)
const arrow = await engine.images.load("/assets/arrow.png");
engine.drawImage({ x: 5, y: 3, size: 1, img: arrow, rotate: 90 }, 2);

// Ghost preview: semi-transparent placement indicator
engine.drawImage({ x: 7, y: 3, size: 1.5, img, opacity: 0.5 }, 3);

// Marker: always 24px on screen, regardless of zoom
engine.drawImage({ x: 9, y: 3, sizePx: 24, img }, 3);

// Mirrored sprite: one right-facing image serves both directions
engine.drawImage({ x: 11, y: 3, size: 1, img, flipX: true }, 2);

// Multiple images
engine.drawImage(
    [
        { x: 0, y: 0, size: 1, img: treeImg },
        { x: 2, y: 0, size: 1, img: treeImg },
        { x: 4, y: 0, size: 1, img: treeImg },
    ],
    2,
);
```

## Advanced

### Custom Drawing (`addDrawFunction`)

For maximum flexibility, you can register a custom drawing function that gets direct access to the rendering context.

```typescript
engine.addDrawFunction((ctx, coords, config, transform) => {
    // ctx = Rendering context (type depends on renderer)
    // coords = Top-left world coordinate of the view
    // config = Current engine configuration
    // transform = Coordinate helpers (see below)

    // Cast to the appropriate context type for your renderer
    const context = ctx as CanvasRenderingContext2D;

    context.fillStyle = "purple";
    context.fillRect(100, 100, 50, 50); // Draw in screen pixels

    // Or draw at a world position without doing the pixel math yourself:
    const p = transform.worldToScreen(5, 3); // pixel at the center of cell (5, 3)
    context.fillRect(p.x - 5, p.y - 5, 10, 10);
}, 4);
```

**`transform` helpers:** `worldToScreen(x, y)` takes item-space world coordinates (integers are cell centers, the same space item `x`/`y` use) and returns the canvas pixel position. `screenToWorld(x, y)` converts a pixel position back to raw (corner-space) world coordinates — the same space event payloads report as `coords.raw`. Prefer these over hand-rolling `(world - topLeft) * scale`, which silently misses the half-cell offset.

:::tip Rule of thumb
Everything you pass to `ctx` is pixels. `worldToScreen` is for drawing (world in, pixels out); `screenToWorld` is for querying (pixels in, world out — feed it to `Math.floor` or `hitTest`, never back into `ctx`).
:::

:::tip
`addDrawFunction()` also returns a draw handle and accepts `options.id` as its last parameter. You can remove the registered callback later via `engine.removeDrawHandle(handle)`, or re-register with the same `id` to replace it (see "Clearing Layers").
:::

### Renderer Hook (`onDraw`)

The `onDraw` callback runs **after** all layers have been drawn but **before** the debug overlays. It is useful for post-processing effects or drawing UI elements that should always be on top of the map content.

`onDraw` uses the same callback signature as `addDrawFunction`:

```typescript
engine.onDraw = (ctx, coords, config, transform) => {
    // ctx = Rendering context (type depends on renderer)
    // coords = Top-left world coordinate of the view
    // config = Live engine configuration (current scale and size)
    // transform = { worldToScreen, screenToWorld } coordinate helpers

    // Cast to the appropriate context type for your renderer
    const context = ctx as CanvasRenderingContext2D;

    // Draw a border around the entire canvas
    context.strokeStyle = "red";
    context.lineWidth = 5;
    context.strokeRect(0, 0, config.size.width, config.size.height);
};
```

### Origin & Anchoring

The `origin` property controls how shapes and images are positioned relative to their `x, y` coordinates.

- **`mode: "cell"` (Default)**: Anchors relative to the grid cell. `x: 0.5, y: 0.5` centers the object in the cell.
- **`mode: "self"`**: Anchors relative to the object's own size. `x: 0.5, y: 0.5` centers the object on the coordinate.

### Performance (Culling)

The engine automatically skips drawing objects that are outside the current viewport (plus a small buffer). You can safely pass thousands of objects to the draw methods; only the visible ones will be rendered.

## Static Caching (Pre-rendered Content)

For large static datasets (e.g., mini-maps with 100k+ items), the engine provides pre-rendering methods that cache content to an offscreen canvas. This dramatically improves performance when all items need to be visible at once.

### When to Use Static Caching

| Scenario                       | Use Static? | Why                                      |
| :----------------------------- | :---------- | :--------------------------------------- |
| Mini-map with 100k items       | ✅ Yes      | All items visible, static content        |
| Main map with 100k items       | ❌ No       | Only viewport visible, culling is enough |
| Overview map (fixed zoom)      | ✅ Yes      | Static zoom, all items visible           |
| Dynamic content (units moving) | ❌ No       | Content changes frequently               |

### `drawStaticRect`

Pre-renders rectangles to an offscreen canvas. Ideal for mini-maps. Supports `rotate` property for rotated rectangles and `radius` property for rounded corners.

```typescript
const miniMapItems = items.map((item) => ({
    x: item.x,
    y: item.y,
    size: 0.9,
    style: { fillStyle: item.color },
    rotate: item.rotation, // Optional rotation in degrees
    radius: 0.1, // Optional rounded corners
}));

// "minimap-items" is a unique cache key
miniMap.drawStaticRect(miniMapItems, "minimap-items", 1);
```

### `drawStaticCircle`

Pre-renders circles to an offscreen canvas.

```typescript
const markers = items.map((item) => ({
    x: item.x,
    y: item.y,
    size: 0.5,
    style: { fillStyle: item.color },
}));

miniMap.drawStaticCircle(markers, "minimap-markers", 2);
```

### `drawStaticImage`

Pre-renders images to an offscreen canvas. Useful for static terrain or decorations with fixed zoom. Supports `rotate` property for rotated images.

```typescript
const terrainTiles = tiles.map((tile) => ({
    x: tile.x,
    y: tile.y,
    size: 1,
    img: tileImages[tile.type],
    rotate: tile.rotation, // Optional rotation in degrees
}));

engine.drawStaticImage(terrainTiles, "terrain-cache", 0);
```

### `clearStaticCache`

Clears pre-rendered caches when content changes.

```typescript
// Clear a specific cache
engine.clearStaticCache("minimap-items");

// Clear all static caches
engine.clearStaticCache();
```

### Cache Keys

The cache key (second parameter) identifies each pre-rendered cache **and** acts as the registration id: calling a static draw method again with the same key replaces the previous registration and invalidates its cache, so the new items are pre-rendered from scratch. Different keys create independent caches.

```typescript
// These use separate caches
engine.drawStaticRect(villages, "villages", 1);
engine.drawStaticRect(cities, "cities", 1);

// Same key -> replaces the "villages" registration and rebuilds its cache
engine.drawStaticRect(updatedVillages, "villages", 1);
```

Removing a static registration (`removeDrawHandle`, `clearLayer`, `clearAll`) also drops its offscreen cache, so a later registration under the same key always renders fresh content.

:::warning Memory Usage
Each static cache creates an offscreen canvas sized to fit all items. For 100k items spread across a large world, this can consume significant memory. Use static caching only when the performance benefit justifies it.
:::

### How It Works

1. **First render**: All items are drawn to an offscreen canvas (OffscreenCanvas or HTMLCanvasElement)
2. **Subsequent renders**: Only the visible portion is copied (blitted) to the main canvas
3. **Zoom changes**: Cache is automatically rebuilt when scale changes

### When to Use

The performance benefit becomes most noticeable during **dragging**. Each drag movement triggers a re-render, and without static caching, this means redrawing all visible items on every frame—causing noticeable lag when you have tens of thousands of items.

With static caching, dragging remains smooth because only a **single `drawImage` call** copies the pre-rendered content during each frame.

**We recommend using static caching when:**

- You have 50k–100k+ items visible at once (e.g., mini-maps, overview maps)
- Dragging/panning is enabled on that canvas

If your canvas doesn't support drag interactions, or only a small portion of items are visible at a time, the regular `drawRect`/`drawCircle`/`drawImage` methods with automatic culling are sufficient.

:::tip
Static caching is most effective when:

- Zoom level is fixed (like a mini-map)
- Content doesn't change frequently
- All or most items are visible at once

For scrollable maps where only a small portion is visible, the regular `drawRect`/`drawCircle`/`drawImage` methods with automatic culling are more efficient.
:::

### Example: Mini-map with 100k Items

```typescript
// Mini-map uses static caching (all 100k items visible)
const miniMapRects = allItems.map((item) => ({
    x: item.x,
    y: item.y,
    size: 0.9,
    style: { fillStyle: item.color },
}));
miniMap.drawStaticRect(miniMapRects, "minimap-items", 1);

// When items change, re-register under the same key: the previous
// registration is replaced and its cache rebuilt automatically
function updateMiniMap() {
    miniMap.drawStaticRect(updatedItems, "minimap-items", 1);
    miniMap.render();
}
```

## Clearing Layers

When your scene's **geometry** changes (objects get added, removed, or moved), the previous registration has to go away before you redraw. Without that, draw calls accumulate on top of existing ones — every frame pays for every stale registration, and `hitTest` starts returning duplicates. There are three tools, from most to least targeted: a registration `id` (replace automatically), a `DrawHandle` (remove one call), and `clearLayer`/`clearAll` (remove in bulk). When only the **appearance** changes (selection, hover), nothing needs to be cleared at all — see [Styling by State](#styling-by-state-optionsstyleof).

### Replacing with a Registration Id (`options.id`)

Every draw method accepts an optional `id` as its last parameter. Re-registering with the same id atomically replaces the previous registration — the old draw callback and its hit-test entries are removed before the new one is added. This makes redraw code idempotent: calling it N times is always correct, with no handle bookkeeping.

```typescript
function redraw() {
    engine.drawRect(
        seats.map((s) => ({
            x: s.x,
            y: s.y,
            size: 0.9,
            style: { fillStyle: s.selected ? "blue" : "green" },
        })),
        1,
        { id: "seats" }, // same id -> replaces the previous "seats" registration
    );
    engine.render();
}
```

Ids share a single namespace across draw kinds and layers: registering `drawCircle(..., { id: "marker" })` after `drawRect(..., { id: "marker" })` replaces the rect, and reusing an id on another layer moves the registration there. Static draw methods don't take an `id` — their `cacheKey` plays the same role (see [Cache Keys](#cache-keys)).

:::note
Within a layer, a replaced registration re-enters at the end of the draw order. If you rely on registration order between draw calls sharing a layer, give them separate layers instead.
:::

### Styling by State (`options.styleOf`)

Re-registering is the right tool when **geometry** changes (items added, removed, or moved). When only the **appearance** changes — selection, hover, a highlight filter — re-registering makes the engine rebuild its spatial index and hit-test entries for items whose positions never moved. At 50k+ items that is real per-click cost.

`styleOf` removes it. The dynamic draw methods (`drawRect`, `drawCircle`, `drawText`, `drawLine`, `drawPath`) accept a `styleOf` callback that runs per item on every frame, at paint time. The fields it returns overlay the item's own `style` for that frame; returning `undefined` leaves the item untouched:

```typescript
const selected = new Set<number>();

engine.drawRect(seats, 1, {
    id: "seats",
    styleOf: (seat) => (selected.has(seat.data.id) ? { fillStyle: "blue" } : undefined),
});
engine.render();
```

Because `styleOf` resolves at paint time, it reads external state **live**. A selection change is now just:

```typescript
engine.onClick = (coords) => {
    const hit = engine.hitTestFirst(coords.raw);
    if (!hit) return;
    selected.add(hit.data.id);
    engine.render(); // no re-registration, no index rebuild
};
```

The items array is registered once and never touched again — no `map` copy, no spatial index rebuild, no hit-test re-registration. The registration `id` is still useful alongside it for actual geometry changes.

Rules of thumb:

- Identify items through `item.data` (the same convention as `hitTest` results); most items should return `undefined`.
- The returned object **overlays** the item's `style` — return only the fields that change (`{ fillStyle: "blue" }` keeps the item's stroke).
- Line and path decorations cannot change `lineWidth`/`lineWidthPx` (or `cornerRadius` for paths): those feed hit-test geometry resolved at registration time, and the types enforce it. A width change is a geometry change — re-register for that.
- For `drawLine`, `styleOf` overlays the call-level `style` per item, which also makes it the way to give individual lines their own color.
- Static draw methods do not support `styleOf`: their cache replays a recorded image, so per-frame decoration cannot apply. Changing styles is dynamic content.

### Remove a Single Draw Call (`DrawHandle`)

Most `draw*()` methods (and `addDrawFunction`) return a **draw handle** that uniquely identifies the registered draw callback.
You can keep this handle and later remove **only that specific draw call** without clearing the whole layer.

This is especially useful for temporary overlays (hover highlights, selections, debug helpers) where you want to "add, then remove" a single draw callback.

```typescript
// Add a temporary overlay
const handle = engine.drawRect(
    { x: 5, y: 5, size: 1, style: { fillStyle: "rgba(255, 255, 0, 0.25)" } },
    3,
);
engine.render();

// Later: remove only this draw callback (no need to clear the entire layer)
engine.removeDrawHandle(handle);
engine.render();
```

You can also use this with custom drawing functions:

```typescript
const hudHandle = engine.addDrawFunction((ctx) => {
    const context = ctx as CanvasRenderingContext2D;
    context.fillStyle = "white";
    context.fillText("HUD", 10, 20);
}, 99);

// Remove HUD when no longer needed
engine.removeDrawHandle(hudHandle);
```

### `clearLayer(layer)`

Clears all draw callbacks from a specific layer.

```typescript
// Clear layer 1 before redrawing
engine.clearLayer(1);
engine.drawRect(updatedRects, 1);
engine.render();
```

### `clearAll()`

Clears all draw callbacks from all layers. Useful for complete scene reset.

```typescript
// Reset everything
engine.clearAll();
// Redraw from scratch
engine.drawRect(background, 0);
engine.drawImage(units, 1);
engine.render();
```

### When to Clear?

| Scenario                | Clear Needed?              | Example                  |
| :---------------------- | :------------------------- | :----------------------- |
| Camera pan/zoom         | ❌ No                      | User drags the map       |
| Object color changes    | ❌ No — use `styleOf`      | Seat selection in cinema |
| Object added/removed    | ✅ Yes — re-register (`id`) | Placing a tower          |
| Object position changes | ✅ Yes — re-register (`id`) | Moving a unit            |
| Loading new level       | ✅ Yes                     | Game level transition    |

:::tip
If your scene is **static** (objects don't change), you only need to call `drawX()` once at startup. The engine will re-render the same layer content when the camera moves.

If your scene is **dynamic**, split the changes: appearance-only changes (selection, hover, highlight) go through `styleOf` + `render()` — no re-registration at all. Geometry changes (add/remove/move) register with an `id` and re-call `drawX(items, layer, { id })` + `render()`. Reach for `clearLayer()` when you want to wipe a whole layer regardless of what registered on it.
:::

**Static Scene Example (Map):**

```typescript
// Draw once at startup
engine.drawImage(mapTiles, 0);
engine.drawImage(buildings, 1);
engine.render();

// Camera changes only need render()
engine.onCoordsChange = () => {
    engine.render(); // No clear needed, objects are the same
};
```

**Dynamic Scene Example (Cinema Seats):**

```typescript
const selected = new Set<string>();

// Register once: geometry and base styles never change.
engine.drawRect(
    seats.map((s) => ({
        x: s.x,
        y: s.y,
        size: 0.9,
        style: { fillStyle: "green" },
        data: { id: s.id },
    })),
    1,
    {
        id: "seats",
        styleOf: (seat) => (selected.has(seat.data.id) ? { fillStyle: "blue" } : undefined),
    },
);
engine.render();

engine.onClick = (coords) => {
    const seat = findSeat(coords.snapped.x, coords.snapped.y);
    if (seat) {
        selected.has(seat.id) ? selected.delete(seat.id) : selected.add(seat.id);
        engine.render(); // styleOf reads the set live — nothing re-registers
    }
};
```

If seats were added or removed, that would be a geometry change: re-call `drawRect(..., { id: "seats" })` with the new array and the `id` replaces the old registration. `clearLayer(1)` before redrawing also works, but removes *everything* on the layer, not just this registration.

## Rendering

The engine uses a passive rendering approach. It does not run a continuous loop (like `requestAnimationFrame`) unless you implement one. You must explicitly call `render()` to update the canvas when you modify the scene.

### `render()`

Draws the current state of all layers to the canvas.

```typescript
engine.drawRect({ x: 10, y: 10 });
engine.render(); // Must be called to see the rectangle
```

**Automatic Renders:**
The engine automatically calls `render()` when:

- The camera is panned or zoomed.
- The viewport is resized.

For all other changes (adding shapes, changing config, loading images), you must call `render()` manually.
