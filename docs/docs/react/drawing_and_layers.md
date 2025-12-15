---
sidebar_position: 2
---

# Drawing & Layers

The React package provides declarative draw components that automatically manage layer registration and rendering. All components use **world coordinates**, and the engine handles scaling and positioning.

## Layer System

Layers control the Z-order of your content. Lower numbers draw first (background), higher numbers draw last (foreground).

| Layer | Typical Usage                  |
| :---- | :----------------------------- |
| `0`   | Background / Terrain           |
| `1`   | Grid lines / Floor decorations |
| `2`   | Objects / Units / Buildings    |
| `3`   | UI Markers / Overlays          |

## Shapes

### `<Rect>` & `<Circle>`

Draw basic geometric shapes. Pass a single object or an array for batch rendering.

| Prop     | Type                 | Default | Description                                                                                                                      |
| :------- | :------------------- | :------ | :------------------------------------------------------------------------------------------------------------------------------- |
| `items`  | `DrawObject \| DrawObject[]` | **Required** | Shape definitions.                                                                                                        |
| `layer`  | `number`             | `1`     | Rendering layer.                                                                                                                 |

**DrawObject Properties:**

| Property | Type                 | Default                            | Description                                                                                                                      |
| :------- | :------------------- | :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| `x`, `y` | `number`             | **Required**                       | World coordinates.                                                                                                               |
| `size`   | `number`             | `1`                                | Size in grid units.                                                                                                              |
| `style`  | `object`             | `{}`                               | Styling options.                                                                                                                 |
| `origin` | `object`             | `{ mode: "cell", x: 0.5, y: 0.5 }` | Anchor point.                                                                                                                    |
| `rotate` | `number`             | `0`                                | Rotation angle in degrees (only for `Rect`).                                                                                     |
| `radius` | `number \| number[]` | -                                  | Border radius in pixels. Single value for all corners, or `[topLeft, topRight, bottomRight, bottomLeft]` (only for `Rect`).     |

**Style Options:**

- `fillStyle`: Fill color (e.g., `"#ff0000"`, `"rgba(0,0,0,0.5)"`)
- `strokeStyle`: Border color
- `lineWidth`: Border width in pixels

```tsx
<CanvasTileEngine engine={engine} config={config}>
    {/* Blue square */}
    <CanvasTileEngine.Rect
        items={{ x: 5, y: 5, size: 1, style: { fillStyle: "#0077be" } }}
        layer={1}
    />

    {/* Rotated rectangle */}
    <CanvasTileEngine.Rect
        items={{ x: 8, y: 5, size: 1, rotate: 45, style: { fillStyle: "#ff6b6b" } }}
        layer={1}
    />

    {/* Rounded rectangle */}
    <CanvasTileEngine.Rect
        items={{ x: 10, y: 5, size: 1, radius: 8, style: { fillStyle: "#2ecc71" } }}
        layer={1}
    />

    {/* Different corner radii */}
    <CanvasTileEngine.Rect
        items={{ x: 12, y: 5, size: 1, radius: [10, 0, 10, 0], style: { fillStyle: "#9b59b6" } }}
        layer={1}
    />

    {/* Red circle */}
    <CanvasTileEngine.Circle
        items={{ x: 6, y: 5, size: 0.8, style: { fillStyle: "#e63946" } }}
        layer={2}
    />

    {/* Batch rendering */}
    <CanvasTileEngine.Rect
        items={[
            { x: 10, y: 10, style: { fillStyle: "blue" } },
            { x: 12, y: 10, style: { fillStyle: "green" } },
            { x: 14, y: 10, style: { fillStyle: "red" } },
        ]}
        layer={1}
    />
</CanvasTileEngine>
```

## Lines & Paths

### `<Line>`

Draw straight lines between two points.

| Prop    | Type                                         | Default | Description       |
| :------ | :------------------------------------------- | :------ | :---------------- |
| `items` | `{ from: Coords, to: Coords } \| Array`      | **Required** | Line definitions. |
| `style` | `{ strokeStyle?: string, lineWidth?: number }` | -     | Line style.       |
| `layer` | `number`                                     | `1`     | Rendering layer.  |

```tsx
<CanvasTileEngine.Line
    items={{ from: { x: 0, y: 0 }, to: { x: 10, y: 10 } }}
    style={{ strokeStyle: "#fb8500", lineWidth: 3 }}
    layer={1}
/>
```

### `<Path>`

Draw continuous lines through multiple points.

| Prop    | Type                                         | Default | Description       |
| :------ | :------------------------------------------- | :------ | :---------------- |
| `items` | `Coords[] \| Coords[][]`                     | **Required** | Points array.    |
| `style` | `{ strokeStyle?: string, lineWidth?: number }` | -     | Path style.       |
| `layer` | `number`                                     | `1`     | Rendering layer.  |

```tsx
<CanvasTileEngine.Path
    items={[
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 },
    ]}
    style={{ strokeStyle: "#219ebc", lineWidth: 2 }}
    layer={1}
/>
```

### `<GridLines>`

Draw grid lines at specified intervals.

| Prop          | Type     | Default   | Description                            |
| :------------ | :------- | :-------- | :------------------------------------- |
| `cellSize`    | `number` | **Required** | Size of each grid cell in world units. |
| `lineWidth`   | `number` | `1`       | Width of grid lines in pixels.         |
| `strokeStyle` | `string` | `"black"` | Color of the grid lines.               |
| `layer`       | `number` | `0`       | Rendering layer.                       |

```tsx
{/* Basic grid */}
<CanvasTileEngine.GridLines cellSize={1} />

{/* Styled grid */}
<CanvasTileEngine.GridLines
    cellSize={5}
    lineWidth={2}
    strokeStyle="rgba(255, 255, 255, 0.3)"
    layer={0}
/>

{/* Multiple grid scales */}
<CanvasTileEngine.GridLines cellSize={1} lineWidth={0.5} strokeStyle="rgba(0,0,0,0.1)" layer={0} />
<CanvasTileEngine.GridLines cellSize={5} lineWidth={1} strokeStyle="rgba(0,0,0,0.3)" layer={0} />
<CanvasTileEngine.GridLines cellSize={50} lineWidth={2} strokeStyle="rgba(0,0,0,0.5)" layer={0} />
```

## Text & Images

### `<Text>`

Render text at world coordinates.

| Prop    | Type                                     | Default | Description       |
| :------ | :--------------------------------------- | :------ | :---------------- |
| `items` | `{ coords: Coords, text: string } \| Array` | **Required** | Text definitions. |
| `style` | `object`                                 | -       | Font styling.     |
| `layer` | `number`                                 | `2`     | Rendering layer.  |

**Style Options:**

- `font`: CSS font string (e.g., `"12px Arial"`)
- `fillStyle`: Text color
- `textAlign`: `"left"`, `"center"`, `"right"`
- `textBaseline`: `"top"`, `"middle"`, `"bottom"`

```tsx
<CanvasTileEngine.Text
    items={{ coords: { x: 5, y: 5 }, text: "Base Camp" }}
    style={{ font: "14px sans-serif", fillStyle: "white" }}
    layer={3}
/>
```

### `<Image>`

Draw images scaled to world units.

| Prop    | Type               | Default | Description        |
| :------ | :----------------- | :------ | :----------------- |
| `items` | `ImageItem \| ImageItem[]` | **Required** | Image definitions. |
| `layer` | `number`           | `1`     | Rendering layer.   |

**ImageItem Properties:**

| Property | Type               | Description                                                        |
| :------- | :----------------- | :----------------------------------------------------------------- |
| `img`    | `HTMLImageElement` | The loaded image object.                                           |
| `x`, `y` | `number`           | World coordinates.                                                 |
| `size`   | `number`           | Size in grid units (maintains aspect ratio).                       |
| `rotate` | `number`           | Rotation angle in degrees (0 = no rotation, positive = clockwise). |

```tsx
function MapWithImages() {
    const engine = useCanvasTileEngine();
    const [treeImg, setTreeImg] = useState<HTMLImageElement | null>(null);

    useEffect(() => {
        if (engine.isReady && engine.images) {
            engine.images.load("/assets/tree.png").then(setTreeImg);
        }
    }, [engine.isReady, engine.images]);

    return (
        <CanvasTileEngine engine={engine} config={config}>
            {treeImg && (
                <CanvasTileEngine.Image
                    items={{ x: 2, y: 3, size: 1.5, img: treeImg }}
                    layer={2}
                />
            )}
        </CanvasTileEngine>
    );
}
```

## Advanced

### `<DrawFunction>`

For maximum flexibility, use a custom draw function with direct canvas context access.

| Prop       | Type                                              | Default | Description         |
| :--------- | :------------------------------------------------ | :------ | :------------------ |
| `children` | `(ctx, coords, config) => void`                   | **Required** | Draw function.  |
| `layer`    | `number`                                          | `1`     | Rendering layer.    |

```tsx
<CanvasTileEngine.DrawFunction layer={4}>
    {(ctx, coords, config) => {
        // coords = Top-left world coordinate of the view
        // config = Current engine configuration

        ctx.fillStyle = "purple";
        ctx.fillRect(100, 100, 50, 50); // Draw in screen pixels
    }}
</CanvasTileEngine.DrawFunction>
```

### `onDraw` Callback

The `onDraw` prop runs after all layers are drawn but before debug overlays.

```tsx
<CanvasTileEngine
    engine={engine}
    config={config}
    onDraw={(ctx, info) => {
        // info contains: { scale, width, height, coords }
        ctx.strokeStyle = "red";
        ctx.lineWidth = 5;
        ctx.strokeRect(0, 0, info.width, info.height);
    }}
>
    {/* children */}
</CanvasTileEngine>
```

## Static Caching (Pre-rendered Content)

For large static datasets (e.g., mini-maps with 100k+ items), use static components that cache content to an offscreen canvas.

### When to Use Static Caching

| Scenario                       | Use Static? | Why                                      |
| :----------------------------- | :---------- | :--------------------------------------- |
| Mini-map with 100k items       | ✅ Yes      | All items visible, static content        |
| Main map with 100k items       | ❌ No       | Only viewport visible, culling is enough |
| Overview map (fixed zoom)      | ✅ Yes      | Static zoom, all items visible           |
| Dynamic content (units moving) | ❌ No       | Content changes frequently               |

### `<StaticRect>`

Pre-renders rectangles to an offscreen canvas. Supports `rotate` and `radius` properties.

| Prop       | Type           | Default      | Description            |
| :--------- | :------------- | :----------- | :--------------------- |
| `items`    | `DrawObject[]` | **Required** | Rectangle definitions. |
| `cacheKey` | `string`       | **Required** | Unique cache key.      |
| `layer`    | `number`       | `1`          | Rendering layer.       |

```tsx
const miniMapItems = useMemo(() =>
    items.map((item) => ({
        x: item.x,
        y: item.y,
        size: 0.9,
        style: { fillStyle: item.color },
        rotate: item.rotation,
        radius: 4,
    })),
    [items]
);

<CanvasTileEngine.StaticRect
    items={miniMapItems}
    cacheKey="minimap-items"
    layer={1}
/>
```

### `<StaticCircle>`

Pre-renders circles to an offscreen canvas.

```tsx
<CanvasTileEngine.StaticCircle
    items={markers}
    cacheKey="minimap-markers"
    layer={2}
/>
```

### `<StaticImage>`

Pre-renders images to an offscreen canvas. Supports `rotate` property.

```tsx
<CanvasTileEngine.StaticImage
    items={terrainTiles}
    cacheKey="terrain-cache"
    layer={0}
/>
```

:::tip Automatic Cache Management
Static components automatically:
- Clear the cache when `cacheKey` changes
- Clean up the cache on unmount
- Rebuild when `items` change
:::

:::warning Memory Usage
Each static cache creates an offscreen canvas sized to fit all items. Use static caching only when the performance benefit justifies the memory cost.
:::

## Dynamic Content

React's declarative nature handles dynamic content automatically. When your data changes, the components re-render:

```tsx
function DynamicScene({ seats }) {
    const engine = useCanvasTileEngine();

    const seatRects = useMemo(() =>
        seats.map((s) => ({
            x: s.x,
            y: s.y,
            size: 0.9,
            style: { fillStyle: s.selected ? "blue" : "green" },
        })),
        [seats]
    );

    return (
        <CanvasTileEngine engine={engine} config={config}>
            <CanvasTileEngine.GridLines cellSize={1} />
            <CanvasTileEngine.Rect items={seatRects} layer={1} />
        </CanvasTileEngine>
    );
}
```

:::tip Performance
- Use `useMemo` for computed items arrays to avoid unnecessary re-renders
- For truly static content, use `<StaticRect>`, `<StaticCircle>`, or `<StaticImage>`
- The engine automatically batches renders when multiple components update in the same frame
:::

