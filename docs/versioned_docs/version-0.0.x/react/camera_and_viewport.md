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

#### `goCoords(x, y, duration?, onComplete?)`

Smoothly animates the camera to a new position.

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `x` | `number` | **Required** | Target world X. |
| `y` | `number` | **Required** | Target world Y. |
| `duration` | `number` | `500` | Animation duration in ms. |
| `onComplete` | `() => void` | `undefined` | Callback fired when animation completes. |

```tsx
function MapWithNavigation() {
    const engine = useCanvasTileEngine();
    const [isNavigating, setIsNavigating] = useState(false);

    const goToBase = () => {
        if (engine.isReady) {
            setIsNavigating(true);
            engine.goCoords(0, 0, 1000, () => {
                setIsNavigating(false);
                console.log('Arrived at base!');
            });
        }
    };

    const goToMarker = () => {
        if (engine.isReady) {
            engine.goCoords(50, 50, 500); // Without callback
        }
    };

    return (
        <div>
            <button onClick={goToBase} disabled={isNavigating}>
                {isNavigating ? 'Going...' : 'Go to Base'}
            </button>
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

### Programmatic Zoom Control

#### `zoomIn(factor?)`

Zooms in by a given factor (default: 1.5), centered on the viewport.

```tsx
const handleZoomIn = () => {
    engine.zoomIn();    // Zoom in by 1.5x
    engine.zoomIn(2);   // Zoom in by 2x
};
```

#### `zoomOut(factor?)`

Zooms out by a given factor (default: 1.5), centered on the viewport.

```tsx
const handleZoomOut = () => {
    engine.zoomOut();   // Zoom out by 1.5x
    engine.zoomOut(2);  // Zoom out by 2x
};
```

#### `getScale()`

Returns the current zoom scale.

```tsx
const logScale = () => {
    const scale = engine.getScale();
    console.log("Current scale:", scale); // 50
};
```

### Example: Zoom Controls

```tsx
function MapWithZoomControls() {
    const engine = useCanvasTileEngine();

    return (
        <div>
            <div>
                <button onClick={() => engine.zoomIn()}>+</button>
                <button onClick={() => engine.zoomOut()}>-</button>
            </div>

            <CanvasTileEngine engine={engine} config={config}>
                {/* children */}
            </CanvasTileEngine>
        </div>
    );
}
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

#### `resize(width, height, duration?, onComplete?)`

Manually trigger a resize with optional animation:

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `width` | `number` | **Required** | New canvas width in pixels. |
| `height` | `number` | **Required** | New canvas height in pixels. |
| `duration` | `number` | `500` | Animation duration in ms. |
| `onComplete` | `() => void` | `undefined` | Callback fired when resize animation completes. |

```tsx
function MapWithResizing() {
    const engine = useCanvasTileEngine();
    const [isResizing, setIsResizing] = useState(false);

    const changeResolution = (width: number, height: number) => {
        if (engine.isReady) {
            setIsResizing(true);
            engine.resize(width, height, 500, () => {
                setIsResizing(false);
            });
        }
    };

    return (
        <div>
            <button 
                onClick={() => changeResolution(800, 600)}
                disabled={isResizing}
            >
                Resize to 800x600
            </button>
            <CanvasTileEngine engine={engine} config={config}>
                {/* children */}
            </CanvasTileEngine>
        </div>
    );
}
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
