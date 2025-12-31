---
sidebar_position: 2
---

# Drawing & Layers

The engine provides a layered rendering system where you can draw shapes, text, images, and custom content. All drawing operations use **world coordinates**, and the engine handles the scaling and positioning automatically.

:::tip Type Safety
All drawing types are exported from the package. See [Types Reference](/docs/introduction/types) for complete type definitions.

```typescript
import { Rect, Circle, Text, Path, ImageItem, Coords } from "@canvas-tile-engine/core";
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
drawRect(items: Rect | Rect[], layer?: number): LayerHandle
drawCircle(items: Circle | Circle[], layer?: number): LayerHandle
```

**Rect / Circle Properties:**

| Property | Type                 | Default                            | Description                                                                                                                     |
| :------- | :------------------- | :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| `x`, `y` | `number`             | **Required**                       | World coordinates of the center/origin.                                                                                         |
| `size`   | `number`             | `1`                                | Size in grid units (width/diameter).                                                                                            |
| `style`  | `object`             | `{}`                               | Styling options (see below).                                                                                                    |
| `origin` | `object`             | `{ mode: "cell", x: 0.5, y: 0.5 }` | Anchor point.                                                                                                                   |
| `rotate` | `number`             | `0`                                | Rotation angle in degrees (only for `drawRect`).                                                                                |
| `radius` | `number \| number[]` | -                                  | Border radius in pixels. Single value for all corners, or `[topLeft, topRight, bottomRight, bottomLeft]` (only for `drawRect`). |

**Style Options:**

-   `fillStyle`: Fill color (e.g., `"#ff0000"`, `"rgba(0,0,0,0.5)"`)
-   `strokeStyle`: Border color
-   `lineWidth`: Border width in pixels

```typescript
// Draw a blue square on layer 1
engine.drawRect(
    {
        x: 5,
        y: 5,
        size: 1,
        style: { fillStyle: "#0077be" },
    },
    1
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
    1
);

// Draw a rounded rectangle
engine.drawRect(
    {
        x: 10,
        y: 5,
        size: 1,
        radius: 8, // 8px radius for all corners
        style: { fillStyle: "#2ecc71" },
    },
    1
);

// Draw with different corner radii [topLeft, topRight, bottomRight, bottomLeft]
engine.drawRect(
    {
        x: 12,
        y: 5,
        size: 1,
        radius: [10, 0, 10, 0], // Diagonal rounded corners
        style: { fillStyle: "#9b59b6" },
    },
    1
);

// Draw a red circle on layer 2
engine.drawCircle(
    {
        x: 6,
        y: 5,
        size: 0.8,
        style: { fillStyle: "#e63946" },
    },
    2
);

// Batch drawing (Array)
engine.drawRect(
    [
        { x: 10, y: 10 },
        { x: 12, y: 10 },
        { x: 14, y: 10 },
    ],
    1
);
```

## Lines & Paths

### `drawLine`

Draw a straight line between two points. Supports single object or array of objects.

```typescript
drawLine(items: Line | Line[], style?: { strokeStyle?: string; lineWidth?: number }, layer?: number): LayerHandle
```

**Line Properties:**

| Property | Type       | Description        |
| :------- | :--------- | :----------------- |
| `from`   | `{ x, y }` | Start coordinates. |
| `to`     | `{ x, y }` | End coordinates.   |

```typescript
// Single line
engine.drawLine({ from: { x: 0, y: 0 }, to: { x: 10, y: 10 } }, { strokeStyle: "#fb8500", lineWidth: 3 }, 1);

// Multiple lines
engine.drawLine([
    { from: { x: 0, y: 0 }, to: { x: 5, y: 5 } },
    { from: { x: 5, y: 0 }, to: { x: 0, y: 5 } },
], { strokeStyle: "red", lineWidth: 2 }, 1);
```

### `drawPath`

Draw a continuous line through multiple points. Supports a single path (array of points) or an array of paths.

```typescript
drawPath(items: Path | Path[], style?: { strokeStyle?: string; lineWidth?: number }, layer?: number): LayerHandle
```

**Path:** An array of `{ x, y }` coordinates.

```typescript
// Single path
engine.drawPath(
    [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 },
    ],
    { strokeStyle: "#219ebc", lineWidth: 2 },
    1
);

// Multiple paths
engine.drawPath(
    [
        [{ x: 0, y: 0 }, { x: 5, y: 5 }],
        [{ x: 10, y: 0 }, { x: 15, y: 5 }],
    ],
    { strokeStyle: "green", lineWidth: 1 },
    1
);
```

### `drawGridLines`

Draw grid lines at specified intervals. This is useful for creating grid overlays on your map.

```typescript
drawGridLines(cellSize: number, lineWidth?: number, strokeStyle?: string, layer?: number): LayerHandle
```

| Parameter     | Type     | Default   | Description                            |
| :------------ | :------- | :-------- | :------------------------------------- |
| `cellSize`    | `number` | -         | Size of each grid cell in world units. |
| `lineWidth`   | `number` | `1`       | Width of grid lines in pixels.         |
| `strokeStyle` | `string` | `"black"` | Color of the grid lines.               |
| `layer`       | `number` | `0`       | Rendering layer.                       |

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
drawText(items: Text | Text[], layer?: number): LayerHandle
```

**Text Properties:**

| Property | Type     | Default                            | Description                              |
| :------- | :------- | :--------------------------------- | :--------------------------------------- |
| `x`, `y` | `number` | **Required**                       | World coordinates.                       |
| `text`   | `string` | **Required**                       | The text content.                        |
| `size`   | `number` | `1`                                | Font size in world units (scales with zoom). |
| `origin` | `object` | `{ mode: "cell", x: 0.5, y: 0.5 }` | Anchor point.                            |
| `style`  | `object` | -                                  | Font styling options.                    |
| `rotate` | `number` | `0`                                | Rotation angle in degrees (clockwise).   |

**Style Options:**

-   `fillStyle`: Text color
-   `fontFamily`: Font family (default: `"sans-serif"`)
-   `textAlign`: `"left"`, `"center"`, `"right"`
-   `textBaseline`: `"top"`, `"middle"`, `"bottom"`

```typescript
// Single text
engine.drawText({
    x: 5,
    y: 5,
    text: "Base Camp",
    size: 1,
    style: { fillStyle: "white", fontFamily: "Arial" }
}, 3);

// Rotated text (45 degrees)
engine.drawText({
    x: 8,
    y: 5,
    text: "Rotated",
    size: 1,
    rotate: 45,
    style: { fillStyle: "yellow" }
}, 3);

// Multiple texts (batch rendering)
engine.drawText([
    { x: 0, y: 0, text: "A", size: 2, style: { fillStyle: "red" } },
    { x: 1, y: 0, text: "B", size: 2, style: { fillStyle: "blue" } },
    { x: 2, y: 0, text: "C", size: 2, style: { fillStyle: "green" } },
], 3);
```

:::tip Scale-Aware Text
The `size` property works like other draw methods - it's in world units and scales with zoom. Use `size: 1` for text that fills approximately one tile height.
:::

### `drawImage`

Draw an image scaled to world units. Supports single object or array of objects.

```typescript
drawImage(items: ImageItem | ImageItem[], layer?: number): LayerHandle
```

**ImageItem Properties:**

| Property | Type               | Default      | Description                                                        |
| :------- | :----------------- | :----------- | :----------------------------------------------------------------- |
| `x`, `y` | `number`           | **Required** | World coordinates.                                                 |
| `img`    | `HTMLImageElement` | **Required** | The loaded image object.                                           |
| `size`   | `number`           | `1`          | Size in grid units (maintains aspect ratio).                       |
| `rotate` | `number`           | `0`          | Rotation angle in degrees (0 = no rotation, positive = clockwise). |
| `origin` | `object`           | `{ mode: "cell", x: 0.5, y: 0.5 }` | Anchor point.                                  |

```typescript
// Single image
const img = await engine.images.load("/assets/tree.png");
engine.drawImage({ x: 2, y: 3, size: 1.5, img }, 2);

// Rotated image (90 degrees clockwise)
const arrow = await engine.images.load("/assets/arrow.png");
engine.drawImage({ x: 5, y: 3, size: 1, img: arrow, rotate: 90 }, 2);

// Multiple images
engine.drawImage([
    { x: 0, y: 0, size: 1, img: treeImg },
    { x: 2, y: 0, size: 1, img: treeImg },
    { x: 4, y: 0, size: 1, img: treeImg },
], 2);
```

## Advanced

### Custom Drawing (`addDrawFunction`)

For maximum flexibility, you can register a custom drawing function that gets direct access to the canvas context.

```typescript
engine.addDrawFunction((ctx, coords, config) => {
    // coords = Top-left world coordinate of the view
    // config = Current engine configuration

    ctx.fillStyle = "purple";
    ctx.fillRect(100, 100, 50, 50); // Draw in screen pixels
}, 4);
```

:::tip
`addDrawFunction()` also returns a layer handle. You can remove the registered callback later via `engine.removeLayerHandle(handle)` (see “Clearing Layers”).
:::

### Renderer Hook (`onDraw`)

The `onDraw` callback runs **after** all layers have been drawn but **before** the debug overlays. It is useful for post-processing effects or drawing UI elements that should always be on top of the map content.

```typescript
engine.onDraw = (ctx, info) => {
    // info contains: { scale, width, height, coords }

    // Draw a border around the entire canvas
    ctx.strokeStyle = "red";
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, info.width, info.height);
};
```

### Origin & Anchoring

The `origin` property controls how shapes and images are positioned relative to their `x, y` coordinates.

-   **`mode: "cell"` (Default)**: Anchors relative to the grid cell. `x: 0.5, y: 0.5` centers the object in the cell.
-   **`mode: "self"`**: Anchors relative to the object's own size. `x: 0.5, y: 0.5` centers the object on the coordinate.

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
    radius: 4, // Optional rounded corners
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

The cache key (second parameter) identifies each pre-rendered cache. Using the same key reuses the existing cache; using a different key creates a new one.

```typescript
// These use separate caches
engine.drawStaticRect(villages, "villages", 1);
engine.drawStaticRect(cities, "cities", 1);

// This reuses the "villages" cache (no re-render)
engine.drawStaticRect(villages, "villages", 1);
```

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

-   You have 50k–100k+ items visible at once (e.g., mini-maps, overview maps)
-   Dragging/panning is enabled on that canvas

If your canvas doesn't support drag interactions, or only a small portion of items are visible at a time, the regular `drawRect`/`drawCircle`/`drawImage` methods with automatic culling are sufficient.

:::tip
Static caching is most effective when:

-   Zoom level is fixed (like a mini-map)
-   Content doesn't change frequently
-   All or most items are visible at once

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

// When items change, clear and redraw
function updateMiniMap() {
    miniMap.clearStaticCache("minimap-items");
    miniMap.clearLayer(1);
    miniMap.drawStaticRect(updatedItems, "minimap-items", 1);
    miniMap.render();
}
```

## Clearing Layers

When your scene content changes dynamically (e.g., objects change color, get added or removed), you need to clear the layer before redrawing. Without clearing, new draw calls accumulate on top of existing ones.

### Remove a Single Draw Call (`LayerHandle`)

Most `draw*()` methods (and `addDrawFunction`) return a **layer handle** that uniquely identifies the registered draw callback.
You can keep this handle and later remove **only that specific draw call** without clearing the whole layer.

This is especially useful for temporary overlays (hover highlights, selections, debug helpers) where you want to “add, then remove” a single draw callback.

```typescript
// Add a temporary overlay
const handle = engine.drawRect({ x: 5, y: 5, size: 1, style: { fillStyle: "rgba(255, 255, 0, 0.25)" } }, 3);
engine.render();

// Later: remove only this draw callback (no need to clear the entire layer)
engine.removeLayerHandle(handle);
engine.render();
```

You can also use this with custom drawing functions:

```typescript
const hudHandle = engine.addDrawFunction((ctx) => {
    ctx.fillStyle = "white";
    ctx.fillText("HUD", 10, 20);
}, 99);

// Remove HUD when no longer needed
engine.removeLayerHandle(hudHandle);
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

| Scenario                | Clear Needed? | Example                  |
| :---------------------- | :------------ | :----------------------- |
| Camera pan/zoom         | ❌ No         | User drags the map       |
| Object color changes    | ✅ Yes        | Seat selection in cinema |
| Object added/removed    | ✅ Yes        | Placing a tower          |
| Object position changes | ✅ Yes        | Moving a unit            |
| Loading new level       | ✅ Yes        | Game level transition    |

:::tip
If your scene is **static** (objects don't change), you only need to call `drawX()` once at startup. The engine will re-render the same layer content when the camera moves.

If your scene is **dynamic** (objects change state), use `clearLayer()` + `drawX()` + `render()` pattern.
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
function redraw() {
    engine.clearLayer(1); // Clear old seats
    engine.drawRect(
        seats.map((s) => ({
            x: s.x,
            y: s.y,
            size: 0.9,
            style: { fillStyle: s.selected ? "blue" : "green" },
        })),
        1
    );
    engine.render();
}

engine.onClick = (coords) => {
    const seat = findSeat(coords.snapped.x, coords.snapped.y);
    if (seat) {
        seat.selected = !seat.selected;
        redraw(); // Clear + Draw + Render
    }
};
```

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

-   The camera is panned or zoomed.
-   The viewport is resized.

For all other changes (adding shapes, changing config, loading images), you must call `render()` manually.
