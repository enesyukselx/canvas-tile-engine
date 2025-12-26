---
sidebar_position: 4
---

# Camera & Viewport

The engine uses a virtual camera system to navigate the infinite grid. Control the camera through the engine handle.

## Camera Concepts

-   **Center-Based**: The camera is defined by the world coordinate at the exact center of the viewport.
-   **Infinite Grid**: You can pan infinitely in any direction.
-   **Zoom**: Controls how many pixels a single grid unit occupies (`scale`).

## Initial Position

Set the initial camera position with the `center` prop:

```tsx
<CanvasTileEngine
    engine={engine}
    config={config}
    center={{ x: 10, y: 10 }} // Start centered at (10, 10)
>
    {/* children */}
</CanvasTileEngine>
```

## Programmatic Control

Access camera methods through the engine handle when `engine.isReady` is `true`.

### Moving the Camera

#### `goCoords(x, y, duration?)`

Smoothly animates the camera to a new position.

```tsx
function MapWithNavigation() {
    const engine = useCanvasTileEngine();

    const goToBase = () => {
        if (engine.isReady) {
            engine.goCoords(0, 0, 1000); // Pan to origin over 1 second
        }
    };

    const goToMarker = () => {
        if (engine.isReady) {
            engine.goCoords(50, 50, 500); // Pan to (50, 50) over 500ms
        }
    };

    return (
        <div>
            <button onClick={goToBase}>Go to Base</button>
            <button onClick={goToMarker}>Go to Marker</button>

            <CanvasTileEngine engine={engine} config={config}>
                {/* children */}
            </CanvasTileEngine>
        </div>
    );
}
```

#### `updateCoords(center)`

Instantly jumps to a position without animation.

```tsx
const jumpToPosition = (x: number, y: number) => {
    if (engine.isReady) {
        engine.updateCoords({ x, y });
    }
};
```

#### `getCenterCoords()`

Returns the current center coordinates of the view.

```tsx
const logPosition = () => {
    if (engine.isReady) {
        const center = engine.getCenterCoords();
        console.log("Current position:", center); // { x: 5.5, y: 10.2 }
    }
};
```

#### `getVisibleBounds()`

Returns the world coordinate bounds of the visible viewport. Useful for knowing which cells are on screen.

```tsx
const placeRandomMine = () => {
    if (engine.isReady) {
        const bounds = engine.getVisibleBounds();
        // { minX: 0, maxX: 10, minY: 0, maxY: 10 }

        const x = bounds.minX + Math.floor(Math.random() * (bounds.maxX - bounds.minX));
        const y = bounds.minY + Math.floor(Math.random() * (bounds.maxY - bounds.minY));

        console.log("Random position:", x, y);
    }
};
```

| Property | Description |
| :--- | :--- |
| `minX` | Left edge of viewport (floored) |
| `maxX` | Right edge of viewport (ceiled) |
| `minY` | Top edge of viewport (floored) |
| `maxY` | Bottom edge of viewport (ceiled) |

### Tracking Camera Position

Use `onCoordsChange` to track camera movement:

```tsx
function MapWithCoordinateDisplay() {
    const engine = useCanvasTileEngine();
    const [center, setCenter] = useState({ x: 0, y: 0 });

    return (
        <div>
            <div>
                Position: ({center.x.toFixed(1)}, {center.y.toFixed(1)})
            </div>

            <CanvasTileEngine engine={engine} config={config} onCoordsChange={setCenter}>
                {/* children */}
            </CanvasTileEngine>
        </div>
    );
}
```

## Zooming

Configure zoom limits in the config:

```tsx
const config = {
    scale: 50, // Initial zoom (pixels per grid unit)
    minScale: 10, // Minimum zoom out
    maxScale: 200, // Maximum zoom in
    eventHandlers: {
        zoom: true, // Enable mouse wheel zoom
    },
};
```

### `setScale(scale)`

Sets the zoom level directly. The value is clamped to `minScale` and `maxScale` bounds.

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `scale` | `number` | The desired zoom level (pixels per grid unit). |

```tsx
const zoomIn = () => {
    if (engine.isReady) {
        engine.setScale(100); // Zoom in
    }
};

const zoomOut = () => {
    if (engine.isReady) {
        engine.setScale(10); // Zoom out
    }
};

const resetZoom = () => {
    if (engine.isReady) {
        engine.setScale(50); // Reset to default
    }
};
```

## Viewport & Resizing

### Auto-Resizing

Enable automatic resize handling:

```tsx
const config = {
    // ...
    eventHandlers: {
        resize: true,
    },
};
```

### Manual Resizing

#### `resize(width, height, duration?)`

Manually trigger a resize with optional animation:

```tsx
const changeResolution = (width: number, height: number) => {
    if (engine.isReady) {
        engine.resize(width, height, 500); // Animate over 500ms
    }
};
```

#### `getSize()`

Get the current canvas dimensions:

```tsx
const logSize = () => {
    if (engine.isReady) {
        const size = engine.getSize();
        console.log("Canvas size:", size); // { width: 1920, height: 1080 }
    }
};
```

### Handling Resize Events

```tsx
<CanvasTileEngine
    engine={engine}
    config={config}
    onResize={() => {
        const size = engine.getSize();
        console.log("Resized to:", size);
    }}
>
    {/* children */}
</CanvasTileEngine>
```

## Camera Bounds

Restrict camera movement to a specific area:

### In Configuration

```tsx
const config = {
    // ...
    bounds: {
        minX: -100,
        maxX: 100,
        minY: -100,
        maxY: 100,
    },
};
```

### Dynamically with `setBounds`

```tsx
const restrictToArea = () => {
    if (engine.isReady) {
        engine.setBounds({ minX: 0, maxX: 500, minY: 0, maxY: 500 });
    }
};

const removeBounds = () => {
    if (engine.isReady) {
        engine.setBounds({
            minX: -Infinity,
            maxX: Infinity,
            minY: -Infinity,
            maxY: Infinity,
        });
    }
};
```
