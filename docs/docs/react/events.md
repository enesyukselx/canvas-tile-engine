---
sidebar_position: 3
---

# Interactions & Events

The React package provides event handling through props on the `CanvasTileEngine` component. Events automatically translate screen coordinates into world coordinates.

## Enabling Events

Enable events in the configuration:

```tsx
const config = {
    // ...
    eventHandlers: {
        click: true, // Enable click events
        hover: true, // Enable hover events
        drag: true, // Enable panning
        zoom: true, // Enable zooming
        resize: true, // Enable auto-resize
    },
};
```

## Event Props

### `onClick`

Triggered when the user clicks on the canvas.

```tsx
<CanvasTileEngine
    engine={engine}
    config={config}
    onClick={(world, canvas, client) => {
        console.log("Clicked Cell:", world.snapped); // { x: 5, y: 10 }
        console.log("Exact World Pos:", world.raw); // { x: 5.23, y: 10.87 }
    }}
>
    {/* children */}
</CanvasTileEngine>
```

### `onRightClick`

Triggered when the user right clicks on the canvas.

```tsx
<CanvasTileEngine
    engine={engine}
    config={config}
    onRightClick={(world, canvas, client) => {
        console.log("Clicked Cell:", world.snapped); // { x: 5, y: 10 }
        console.log("Exact World Pos:", world.raw); // { x: 5.23, y: 10.87 }
    }}
>
    {/* children */}
</CanvasTileEngine>
```

### `onHover`

Triggered when the mouse moves over the canvas.

```tsx
function MapWithHover() {
    const engine = useCanvasTileEngine();
    const [hoverCell, setHoverCell] = useState<Coords | null>(null);

    const hoverRect = useMemo(
        () => (hoverCell ? { x: hoverCell.x, y: hoverCell.y, style: { fillStyle: "rgba(255,255,0,0.3)" } } : null),
        [hoverCell]
    );

    return (
        <CanvasTileEngine
            engine={engine}
            config={config}
            onHover={(world) => setHoverCell(world.snapped)}
            onMouseLeave={() => setHoverCell(null)}
        >
            <CanvasTileEngine.GridLines cellSize={1} />
            {hoverRect && <CanvasTileEngine.Rect items={hoverRect} layer={3} />}
        </CanvasTileEngine>
    );
}
```

### `onMouseDown` & `onMouseUp`

Triggered when mouse buttons are pressed/released. Useful for drawing tools.

```tsx
function PaintingApp() {
    const engine = useCanvasTileEngine();
    const [isDrawing, setIsDrawing] = useState(false);
    const [paintedCells, setPaintedCells] = useState<Set<string>>(new Set());

    const paintRects = useMemo(
        () =>
            Array.from(paintedCells).map((key) => {
                const [x, y] = key.split(",").map(Number);
                return { x, y, size: 1, style: { fillStyle: "blue" } };
            }),
        [paintedCells]
    );

    return (
        <CanvasTileEngine
            engine={engine}
            config={config}
            onMouseDown={() => setIsDrawing(true)}
            onMouseUp={() => setIsDrawing(false)}
            onMouseLeave={() => setIsDrawing(false)}
            onHover={(world) => {
                if (isDrawing) {
                    const key = `${world.snapped.x},${world.snapped.y}`;
                    setPaintedCells((prev) => new Set(prev).add(key));
                }
            }}
        >
            <CanvasTileEngine.GridLines cellSize={1} />
            <CanvasTileEngine.Rect items={paintRects} layer={1} />
        </CanvasTileEngine>
    );
}
```

### `onMouseLeave`

Triggered when the mouse leaves the canvas area.

```tsx
<CanvasTileEngine
    engine={engine}
    config={config}
    onMouseLeave={(world, canvas, client) => {
        setHoverCell(null);
        setIsDrawing(false);
    }}
>
    {/* children */}
</CanvasTileEngine>
```

### `onCoordsChange`

Triggered whenever the camera moves (pan or zoom).

```tsx
function MapWithMinimap() {
    const engine = useCanvasTileEngine();
    const [center, setCenter] = useState({ x: 0, y: 0 });

    return (
        <>
            <CanvasTileEngine engine={engine} config={config} onCoordsChange={setCenter}>
                {/* Main map content */}
            </CanvasTileEngine>

            <MiniMap center={center} />
        </>
    );
}
```

### `onResize`

Triggered when the canvas is resized.

```tsx
<CanvasTileEngine
    engine={engine}
    config={config}
    onResize={() => {
        console.log("Canvas resized to:", engine.getSize());
    }}
>
    {/* children */}
</CanvasTileEngine>
```

### `onZoom`

Triggered when the zoom level changes (via mouse wheel or pinch gesture). Receives the new scale value.

```tsx
<CanvasTileEngine
    engine={engine}
    config={config}
    onZoom={(scale) => {
        console.log("Zoom level changed:", scale);
        setCurrentZoom(scale);
    }}
>
    {/* children */}
</CanvasTileEngine>
```

:::tip Use Cases

-   **Zoom indicator**: Display current zoom percentage in the UI
-   **Level of detail**: Conditionally render components based on zoom level
-   **Minimap sync**: Update viewport representation in a minimap
    :::

## Coordinate Data Structure

The `onClick` and `onHover` callbacks receive three coordinate objects:

| Argument      | Property  | Description                                          | Example               |
| :------------ | :-------- | :--------------------------------------------------- | :-------------------- |
| **1. World**  | `raw`     | Exact floating-point world coordinates.              | `{ x: 5.5, y: 10.2 }` |
|               | `snapped` | Integer grid cell coordinates.                       | `{ x: 5, y: 10 }`     |
| **2. Canvas** | `raw`     | Pixel coordinates relative to the canvas element.    | `{ x: 400, y: 300 }`  |
|               | `snapped` | Pixel coordinates of the cell's bottom-right corner. | `{ x: 380, y: 280 }`  |
| **3. Client** | `raw`     | Pixel coordinates relative to the browser viewport.  | `{ x: 420, y: 320 }`  |
|               | `snapped` | Screen pixel coordinates of the cell's corner.       | `{ x: 400, y: 300 }`  |

## Dynamic Event Handlers

Use `setEventHandlers` to toggle event handlers at runtime:

```tsx
function ModeBasedInteraction() {
    const engine = useCanvasTileEngine();
    const [mode, setMode] = useState<"pan" | "paint">("pan");

    const enablePaintMode = () => {
        setMode("paint");
        engine.setEventHandlers({ drag: false, hover: true });
    };

    const enablePanMode = () => {
        setMode("pan");
        engine.setEventHandlers({ drag: true, hover: false });
    };

    return (
        <div>
            <div>
                <button onClick={enablePanMode}>Pan Mode</button>
                <button onClick={enablePaintMode}>Paint Mode</button>
            </div>

            <CanvasTileEngine
                engine={engine}
                config={config}
                onHover={(world) => {
                    if (mode === "paint") {
                        // Handle painting
                    }
                }}
            >
                {/* children */}
            </CanvasTileEngine>
        </div>
    );
}
```

## Keyboard Shortcuts

Combine with keyboard events for professional interactions:

```tsx
function AdvancedInteraction() {
    const engine = useCanvasTileEngine();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Shift") {
                engine.setEventHandlers({ drag: false, hover: true });
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "Shift") {
                engine.setEventHandlers({ drag: true, hover: false });
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keyup", handleKeyUp);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("keyup", handleKeyUp);
        };
    }, [engine]);

    return (
        <CanvasTileEngine engine={engine} config={config}>
            {/* children */}
        </CanvasTileEngine>
    );
}
```

:::tip Best Practices

-   **Use state for UI-driven interactions**: React state keeps your UI in sync
-   **Use refs for high-frequency updates**: For painting operations with many updates per second
-   **Memoize computed values**: Use `useMemo` for derived data like painted cells
-   **Clean up on mouse leave**: Always handle `onMouseLeave` to prevent stuck states
    :::
