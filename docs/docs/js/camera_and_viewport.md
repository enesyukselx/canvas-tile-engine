---
sidebar_position: 4
---

# Camera & Viewport

The engine uses a virtual camera system to navigate the infinite grid. The camera is always focused on a specific **center coordinate** in the world.

## Camera Concepts

- **Center-Based**: The camera is defined by the world coordinate at the exact center of the viewport.
- **Infinite Grid**: You can pan infinitely in any direction.
- **Zoom**: Controls how many pixels a single grid unit occupies (`scale`).

## Programmatic Control

You can move the camera using the engine instance.

### Moving the Camera

#### `goCoords(x, y, duration?)`

Smoothly animates the camera to a new position.

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `x` | `number` | **Required** | Target world X. |
| `y` | `number` | **Required** | Target world Y. |
| `duration` | `number` | `500` | Animation duration in ms. |

```typescript
// Pan to coordinates (15, 20) over 1 second
engine.goCoords(15, 20, 1000);
```

#### `updateCoords(center)`

Instantly jumps to a position without animation.

```typescript
engine.updateCoords({ x: 0, y: 0 });
```

#### `getCenterCoords()`

Returns the current center coordinates of the view.

```typescript
const center = engine.getCenterCoords();
console.log(center); // { x: 5.5, y: 10.2 }
```

#### `getVisibleBounds()`

Returns the world coordinate bounds of the visible viewport. Values are floored/ceiled to cell boundaries.

```typescript
const bounds = engine.getVisibleBounds();
console.log(bounds); // { minX: 0, maxX: 10, minY: 0, maxY: 10 }

// Use for random placement within visible area
const x = bounds.minX + Math.floor(Math.random() * (bounds.maxX - bounds.minX));
const y = bounds.minY + Math.floor(Math.random() * (bounds.maxY - bounds.minY));
```

| Property | Description |
| :--- | :--- |
| `minX` | Left edge of viewport (floored) |
| `maxX` | Right edge of viewport (ceiled) |
| `minY` | Top edge of viewport (floored) |
| `maxY` | Bottom edge of viewport (ceiled) |

### Zooming

Zooming is primarily handled by user interaction (mouse wheel), but you can configure the limits and control zoom programmatically.

**Configuration:**

```typescript
const config = {
  scale: 20,       // Initial zoom (pixels per grid unit)
  minScale: 10,    // Minimum zoom out
  maxScale: 100,   // Maximum zoom in
  eventHandlers: {
    zoom: true     // Enable mouse wheel zoom
  }
};
```

#### `setScale(scale)`

Sets the zoom level directly. The value is clamped to `minScale` and `maxScale` bounds.

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `scale` | `number` | The desired zoom level (pixels per grid unit). |

```typescript
// Set zoom to 50 pixels per grid unit
engine.setScale(50);

// Zoom in (larger scale = more zoomed in)
engine.setScale(100);

// Zoom out (smaller scale = more zoomed out)
engine.setScale(10);
```

## Viewport & Resizing

The viewport is the visible area of the canvas. The engine can handle resizing automatically or manually.

### Auto-Resizing

If `eventHandlers.resize` is enabled in the config, the engine will automatically adjust the canvas size when its container changes size.

```typescript
const config = {
  // ...
  eventHandlers: {
    resize: true
  }
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
