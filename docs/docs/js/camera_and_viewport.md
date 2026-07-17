---
sidebar_position: 4
---

# Camera & Viewport

The engine uses a virtual camera system to navigate the infinite grid. The camera is always focused on a specific **center coordinate** in the world.

## Camera Concepts

-   **Center-Based**: The camera is defined by the world coordinate at the exact center of the viewport.
-   **Infinite Grid**: You can pan infinitely in any direction.
-   **Zoom**: Controls how many pixels a single grid unit occupies (`scale`).

## Programmatic Control

You can move the camera using the engine instance.

### Moving the Camera

#### `goCenter(x, y, duration?)`

Smoothly animates the camera to a new position.

| Parameter  | Type     | Default      | Description               |
| :--------- | :------- | :----------- | :------------------------ |
| `x`        | `number` | **Required** | Target world X.           |
| `y`        | `number` | **Required** | Target world Y.           |
| `duration` | `number` | `500`        | Animation duration in ms. |

```typescript
// Pan to coordinates (15, 20) over 1 second
engine.goCenter(15, 20, 1000);
```

#### `setCenter(center)`

Instantly jumps to a position without animation.

```typescript
engine.setCenter({ x: 0, y: 0 });
```

#### `getCenter()`

Returns the current center coordinates of the view.

```typescript
const center = engine.getCenter();
console.log(center); // { x: 5.5, y: 10.2 }
```

:::note Renamed APIs
`goCenter`, `setCenter`, and `getCenter` were previously named `goCoords`, `updateCoords`, and `getCenterCoords`. The old names still work as deprecated aliases and will be removed in a future major version.
:::

#### `getVisibleBounds()`

Returns the world coordinate bounds of the visible viewport. Values are floored/ceiled to cell boundaries.

```typescript
const bounds = engine.getVisibleBounds();
console.log(bounds); // { minX: 0, maxX: 10, minY: 0, maxY: 10 }

// Use for random placement within visible area
const x = bounds.minX + Math.floor(Math.random() * (bounds.maxX - bounds.minX));
const y = bounds.minY + Math.floor(Math.random() * (bounds.maxY - bounds.minY));
```

| Property | Description                      |
| :------- | :------------------------------- |
| `minX`   | Left edge of viewport (floored)  |
| `maxX`   | Right edge of viewport (ceiled)  |
| `minY`   | Top edge of viewport (floored)   |
| `maxY`   | Bottom edge of viewport (ceiled) |

### Zooming

Zooming is primarily handled by user interaction (mouse wheel), but you can configure the limits and control zoom programmatically.

**Configuration:**

```typescript
const config = {
    scale: 20, // Initial zoom (pixels per grid unit)
    minScale: 10, // Minimum zoom out
    maxScale: 100, // Maximum zoom in
    eventHandlers: {
        zoom: true, // Enable mouse wheel zoom
    },
};
```

#### `zoomIn(factor?)`

Zooms in by a given factor, centered on the viewport.

| Parameter | Type     | Default | Description                                  |
| :-------- | :------- | :------ | :------------------------------------------- |
| `factor`  | `number` | `1.5`   | Zoom multiplier. Higher values zoom in more. |

```typescript
engine.zoomIn(); // Zoom in by 1.5x
engine.zoomIn(2); // Zoom in by 2x
```

#### `zoomOut(factor?)`

Zooms out by a given factor, centered on the viewport.

| Parameter | Type     | Default | Description                                   |
| :-------- | :------- | :------ | :-------------------------------------------- |
| `factor`  | `number` | `1.5`   | Zoom multiplier. Higher values zoom out more. |

```typescript
engine.zoomOut(); // Zoom out by 1.5x
engine.zoomOut(2); // Zoom out by 2x
```

#### `getScale()`

Returns the current zoom scale.

```typescript
const scale = engine.getScale();
console.log(scale); // 50
```

#### `setScale(scale)`

Sets the zoom level directly. The value is clamped to `minScale` and `maxScale` bounds, and the change is anchored at the viewport center (matching `goScale`/`zoomIn`/`zoomOut`).

| Parameter | Type     | Description                                    |
| :-------- | :------- | :--------------------------------------------- |
| `scale`   | `number` | The desired zoom level (pixels per grid unit). |

```typescript
// Set zoom to 50 pixels per grid unit
engine.setScale(50);

// Zoom in (larger scale = more zoomed in)
engine.setScale(100);

// Zoom out (smaller scale = more zoomed out)
engine.setScale(10);
```

#### `goScale(scale, duration?, onComplete?)`

Smoothly animates the zoom level to a target value, like `goCenter` does for position. The zoom is anchored at the viewport center (matching `zoomIn`/`zoomOut`), and the target is clamped to `minScale` and `maxScale` bounds.

| Parameter    | Type       | Default      | Description                                    |
| :----------- | :--------- | :----------- | :--------------------------------------------- |
| `scale`      | `number`   | **Required** | The desired zoom level (pixels per grid unit). |
| `duration`   | `number`   | `500`        | Animation duration in ms. `0` = instant.       |
| `onComplete` | `function` | -            | Called when the animation finishes.            |

```typescript
// Smoothly zoom to 100 pixels per grid unit over 1 second
engine.goScale(100, 1000);

// Combine with goCenter for a fly-to effect
engine.goCenter(15, 20, 1000);
engine.goScale(50, 1000);
```

#### `setScaleLimits(minScale, maxScale)`

Updates the `minScale` and `maxScale` limits at runtime. All zooming (gestures, `setScale`, `goScale`, `zoomIn`, `zoomOut`) clamps to the new range, and the current scale is clamped into it immediately (firing `onZoom` if it changes).

| Parameter  | Type     | Description                                 |
| :--------- | :------- | :------------------------------------------ |
| `minScale` | `number` | New minimum zoom level. Must be positive.   |
| `maxScale` | `number` | New maximum zoom level. Must be >= minScale. |

```typescript
// Allow zooming between 10 and 200 pixels per grid unit
engine.setScaleLimits(10, 200);

// Lock the zoom at the current scale
const scale = engine.getScale();
engine.setScaleLimits(scale, scale);
```

Throws a `ConfigValidationError` if either limit is not a positive finite number or `minScale` is greater than `maxScale`.

#### `fitBounds(bounds, options?)`

Fits a world-space rectangle into the viewport: centers the view on the rectangle and picks the largest scale that keeps the whole (padded) area visible, clamped to the scale limits. Animated by default. Not related to `setBounds`, which restricts camera movement.

| Parameter | Type | Description |
| :-------- | :--- | :---------- |
| `bounds` | `{ minX, maxX, minY, maxY }` | Rectangle to fit. Every edge must be finite. |
| `options.padding` | `number` | Extra world-unit margin on every side. Default `0`. |
| `options.durationMs` | `number` | Animation duration in ms. Default `500`; `0` = instant. |
| `options.onComplete` | `function` | Called when the fit completes. |

```typescript
// Show the whole 32x32 board with one cell of margin
engine.fitBounds({ minX: 0, maxX: 32, minY: 0, maxY: 32 }, { padding: 1 });

// Jump to a selection instantly
engine.fitBounds(selectionBounds, { durationMs: 0 });
```

Throws a `ConfigValidationError` if an edge is not finite, `min >= max` on an axis, or padding is negative.

## Viewport & Resizing

The viewport is the visible area of the canvas. The engine can handle resizing automatically or manually.

### Auto-Resizing

If `eventHandlers.resize` is enabled in the config, the engine will automatically adjust the canvas size when its container changes size.

```typescript
const config = {
    // ...
    eventHandlers: {
        resize: true,
    },
};
```

### Manual Resizing

#### `resize(width, height, duration?)`

You can manually trigger a resize, optionally with an animation. This is useful for UI-driven layout changes.

```typescript
// Resize canvas to 800x600 over 500ms
engine.resize(800, 600, 500);
```

#### `getSize()`

Returns the current dimensions of the canvas in pixels.

```typescript
const size = engine.getSize(); // { width: 1920, height: 1080 }
```

## Events

Listen to camera and viewport changes to sync your UI.

### `onCoordsChange`

Fires whenever the camera moves (pan, zoom, or animation).

```typescript
engine.onCoordsChange = (center) => {
    updateMiniMap(center);
    updateCoordinatesHUD(center);
};
```

### `onResize`

Fires when the canvas dimensions change.

```typescript
engine.onResize = () => {
    console.log("Viewport resized");
};
```
