---
sidebar_position: 2
---

# Drawing & Layers

The engine provides a layered rendering system where you can draw shapes, text, images, and custom content. All drawing operations use **world coordinates**, and the engine handles the scaling and positioning automatically.

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

| Property | Type     | Default                            | Description                             |
| :------- | :------- | :--------------------------------- | :-------------------------------------- |
| `x`, `y` | `number` | **Required**                       | World coordinates of the center/origin. |
| `size`   | `number` | `1`                                | Size in grid units (width/diameter).    |
| `layer`  | `number` | `1`                                | Rendering layer.                        |
| `style`  | `object` | `{}`                               | Styling options (see below).            |
| `origin` | `object` | `{ mode: "cell", x: 0.5, y: 0.5 }` | Anchor point.                           |

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

| Property | Type | Description |
| `from` | `{ x, y }` | Start coordinates. |
| `to` | `{ x, y }` | End coordinates. |
| `style` | `object` | Line style (`strokeStyle`, `lineWidth`). |

```typescript
engine.drawLine({ from: { x: 0, y: 0 }, to: { x: 10, y: 10 } }, { strokeStyle: "#fb8500", lineWidth: 3 }, 1);
```

### `drawPath`

Draw a continuous line through multiple points. Supports a single path (array of points) or an array of paths.

| Property | Type | Description |
| `items` | `Coords[]` | Array of points `{ x, y }`. |
| `style` | `object` | Path style (`strokeStyle`, `lineWidth`). |

```typescript
engine.drawPath(
    [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 },
    ],
    { strokeStyle: "#219ebc", lineWidth: 2 },
    1
);
```

## Text & Images

### `drawText`

Render text at a specific world coordinate. Supports single object or array of objects.

| Property | Type       | Default      | Description              |
| :------- | :--------- | :----------- | :----------------------- |
| `coords` | `{ x, y }` | **Required** | Position in world space. |
| `text`   | `string`   | **Required** | The text content.        |
| `style`  | `object`   | -            | Font styling options.    |

**Style Options:**

-   `font`: CSS font string (e.g., `"12px Arial"`)
-   `fillStyle`: Text color
-   `textAlign`: `"left"`, `"center"`, `"right"`
-   `textBaseline`: `"top"`, `"middle"`, `"bottom"`

```typescript
engine.drawText({ coords: { x: 5, y: 5 }, text: "Base Camp" }, { font: "14px sans-serif", fillStyle: "white" }, 3);
```

### `drawImage`

Draw an image scaled to world units. Supports single object or array of objects.

| Property | Type               | Description                                  |
| :------- | :----------------- | :------------------------------------------- |
| `img`    | `HTMLImageElement` | The loaded image object.                     |
| `x`, `y` | `number`           | World coordinates.                           |
| `size`   | `number`           | Size in grid units (maintains aspect ratio). |

```typescript
const img = await engine.images.load("/assets/tree.png");
engine.drawImage({ x: 2, y: 3, size: 1.5, img }, 2);
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
