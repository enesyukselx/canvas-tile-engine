---
sidebar_position: 3
---

# Interactions & Events

The engine provides a robust event system that handles user interactions like clicking, hovering, dragging, and zooming. It automatically translates screen coordinates (pixels) into world coordinates (grid units).

## Enabling Events

By default, all interactions are disabled for performance. You must enable them in your configuration:

```typescript
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

## Event Callbacks

### `onClick`

Triggered when the user clicks on the canvas.

```typescript
engine.onClick = (world, canvas, client) => {
    console.log("Clicked Cell:", world.snapped); // { x: 5, y: 10 }
    console.log("Exact World Pos:", world.raw); // { x: 5.23, y: 10.87 }
};
```

### `onHover`

Triggered when the mouse moves over the canvas. Useful for tooltips or highlighting cells.

```typescript
engine.onHover = (world, canvas, client) => {
    // Highlight the cell under the cursor
    engine.drawRect(
        {
            x: world.snapped.x,
            y: world.snapped.y,
            style: { fillStyle: "rgba(255, 255, 0, 0.3)" },
        },
        3
    );
};
```

### `onMouseLeave`

Triggered when the mouse leaves the canvas area.

```typescript
engine.onMouseLeave = () => {
    console.log("Mouse left the map");
    // Clear highlights or tooltips
};
```

### `onCoordsChange`

Triggered whenever the camera moves (pan or zoom). Useful for syncing UI elements like a mini-map or coordinate display.

```typescript
engine.onCoordsChange = (center) => {
    console.log("New Camera Center:", center);
};
```

### `onResize`

Triggered when the canvas is resized.

```typescript
engine.onResize = () => {
    console.log("Canvas resized to:", engine.getSize());
};
```

## Coordinate Data Structure

The `onClick` and `onHover` callbacks receive three coordinate objects to provide position data in different contexts:

| Argument      | Property  | Description                                                 | Example               |
| :------------ | :-------- | :---------------------------------------------------------- | :-------------------- |
| **1. World**  | `raw`     | Exact floating-point world coordinates.                     | `{ x: 5.5, y: 10.2 }` |
|               | `snapped` | Integer grid cell coordinates.                              | `{ x: 5, y: 10 }`     |
| **2. Canvas** | `raw`     | Pixel coordinates relative to the canvas element.           | `{ x: 400, y: 300 }`  |
|               | `snapped` | Pixel coordinates of the cell's bottom-right corner.        | `{ x: 380, y: 280 }`  |
| **3. Client** | `raw`     | Pixel coordinates relative to the browser viewport.         | `{ x: 420, y: 320 }`  |
|               | `snapped` | Screen pixel coordinates of the cell's bottom-right corner. | `{ x: 400, y: 300 }`  |

:::info
**Snapped Coordinates:**

-   **World**: Snaps to the integer grid coordinates (e.g., `5.9` becomes `5`).
-   **Canvas/Client**: Snaps to the bottom-right pixel of that grid cell on the screen.
    :::

## Camera Controls

While events handle user input, you can also control the camera programmatically to focus on specific areas or adjust the view.

### `updateCoords`

Instantly jumps the camera to a new center position without animation.

| Parameter   | Type       | Description                                |
| :---------- | :--------- | :----------------------------------------- |
| `newCenter` | `{ x, y }` | The new center coordinates in world space. |

```typescript
// Jump immediately to (10, 10)
engine.updateCoords({ x: 10, y: 10 });
```

### `goCoords`

Smoothly animates the camera center to target coordinates over a specified duration.

| Parameter    | Type     | Default      | Description                                                      |
| :----------- | :------- | :----------- | :--------------------------------------------------------------- |
| `x`          | `number` | **Required** | Target world X coordinate.                                       |
| `y`          | `number` | **Required** | Target world Y coordinate.                                       |
| `durationMs` | `number` | `500`        | Animation duration in milliseconds. Set to `0` for instant move. |

```typescript
// Pan to (10, 10) over 1 second
engine.goCoords(10, 10, 1000);

// Instant move (same as updateCoords)
engine.goCoords(5, 5, 0);
```

### `resize`

Manually updates the canvas size (e.g., when the container resizes or user selects a resolution). The engine attempts to keep the current center point in focus during the resize.

| Parameter    | Type     | Default      | Description                                                     |
| :----------- | :------- | :----------- | :-------------------------------------------------------------- |
| `width`      | `number` | **Required** | New canvas width in pixels.                                     |
| `height`     | `number` | **Required** | New canvas height in pixels.                                    |
| `durationMs` | `number` | `500`        | Animation duration in milliseconds. Use `0` for instant resize. |

```typescript
// Resize to 800x600 with a smooth transition
engine.resize(800, 600, 500);
```
