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

### `onMouseDown`

Triggered when the user presses the mouse button on the canvas. This is useful for starting drawing operations, selecting cells, or implementing custom drag behaviors.

```typescript
let isDrawing = false;

engine.onMouseDown = () => {
    isDrawing = true;
    console.log("Mouse button pressed");
};
```

### `onMouseUp`

Triggered when the user releases the mouse button. Useful for completing drawing operations or drag actions.

```typescript
engine.onMouseUp = () => {
    isDrawing = false;
    console.log("Mouse button released");
};
```

:::tip Drawing Example
Combine `onMouseDown`, `onMouseUp`, and `onHover` to create a painting tool:

```typescript
let isDrawing = false;
const paintedCells = new Set();

engine.onMouseDown = () => {
    isDrawing = true;
    paintedCells.clear();
};

engine.onHover = (world) => {
    if (isDrawing) {
        const key = `${world.snapped.x},${world.snapped.y}`;
        if (!paintedCells.has(key)) {
            paintedCells.add(key);
            engine.drawRect(
                {
                    x: world.snapped.x,
                    y: world.snapped.y,
                    size: 1,
                    style: { fillStyle: "blue" },
                },
                1
            );
            engine.render();
        }
    }
};

engine.onMouseUp = () => {
    isDrawing = false;
    console.log("Painted cells:", Array.from(paintedCells));
};
```

:::

:::info Working with Drag
When `eventHandlers.drag` is enabled, both drag and custom mouse interactions (like painting) will try to work simultaneously. To implement mode-based interactions (e.g., paint mode vs pan mode), use `setEventHandlers()` to toggle drag on/off:

**Keyboard-based Mode Switching:**

```typescript
let isPaintMode = false;
let isDrawing = false;
const paintedCells = new Set();

// Toggle paint mode with Shift key
document.addEventListener("keydown", (e) => {
    if (e.key === "Shift" && !isPaintMode) {
        isPaintMode = true;
        engine.setEventHandlers({ drag: false, hover: true }); // Disable drag, enable hover
        engine.canvas.style.cursor = "crosshair";
    }
});

document.addEventListener("keyup", (e) => {
    if (e.key === "Shift") {
        isPaintMode = false;
        engine.setEventHandlers({ drag: true, hover: false }); // Re-enable drag
        engine.canvas.style.cursor = "default";
    }
});

engine.onMouseDown = () => {
    if (isPaintMode) {
        isDrawing = true;
        paintedCells.clear();
    }
};

engine.onHover = (world) => {
    if (isPaintMode && isDrawing) {
        const key = `${world.snapped.x},${world.snapped.y}`;
        if (!paintedCells.has(key)) {
            paintedCells.add(key);
            engine.drawRect(
                {
                    x: world.snapped.x,
                    y: world.snapped.y,
                    size: 1,
                    style: { fillStyle: "blue" },
                },
                1
            );
            engine.render();
        }
    }
};

engine.onMouseUp = () => {
    isDrawing = false;
};

engine.onMouseLeave = () => {
    isDrawing = false; // Stop painting when mouse leaves canvas
};
```

**Button-based Mode Switching:**

```typescript
const paintModeBtn = document.getElementById("paint-mode");
const panModeBtn = document.getElementById("pan-mode");

paintModeBtn.addEventListener("click", () => {
    engine.setEventHandlers({ drag: false, hover: true });
    // Enable painting logic
});

panModeBtn.addEventListener("click", () => {
    engine.setEventHandlers({ drag: true, hover: false });
    // Disable painting logic
});
```

:::

:::tip Best Practices

-   **Disable drag when painting**: Use `setEventHandlers({ drag: false })` to prevent camera movement during drawing operations
-   **Use keyboard shortcuts**: Shift, Space, or Alt keys for quick mode switching (like Photoshop/Figma)
-   **Update cursor**: Change the cursor style to indicate the current mode (`crosshair` for paint, `grab` for pan)
-   **Clean up on mouse leave**: Always stop drawing operations in `onMouseLeave` to prevent stuck states
    :::

### `onMouseLeave`

Triggered when the mouse leaves the canvas area. Useful for cleaning up hover states, hiding tooltips, or stopping drawing operations.

```typescript
engine.onMouseLeave = () => {
    console.log("Mouse left the map");
    // Clear highlights or tooltips
    isDrawing = false; // Stop drawing if in progress
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

| Parameter    | Type         | Default      | Description                                                      |
| :----------- | :----------- | :----------- | :--------------------------------------------------------------- |
| `x`          | `number`     | **Required** | Target world X coordinate.                                       |
| `y`          | `number`     | **Required** | Target world Y coordinate.                                       |
| `durationMs` | `number`     | `500`        | Animation duration in milliseconds. Set to `0` for instant move. |
| `onComplete` | `() => void` | `undefined`  | Callback fired when animation completes.                         |

```typescript
// Pan to (10, 10) over 1 second
engine.goCoords(10, 10, 1000);

// With completion callback
engine.goCoords(50, 50, 500, () => {
    console.log('Navigation complete!');
});

// Instant move (same as updateCoords)
engine.goCoords(5, 5, 0);
```

### `resize`

Manually updates the canvas size (e.g., when the container resizes or user selects a resolution). The engine attempts to keep the current center point in focus during the resize.

| Parameter    | Type         | Default      | Description                                                     |
| :----------- | :----------- | :----------- | :-------------------------------------------------------------- |
| `width`      | `number`     | **Required** | New canvas width in pixels.                                     |
| `height`     | `number`     | **Required** | New canvas height in pixels.                                    |
| `durationMs` | `number`     | `500`        | Animation duration in milliseconds. Use `0` for instant resize. |
| `onComplete` | `() => void` | `undefined`  | Callback fired when resize animation completes.                 |

```typescript
// Resize to 800x600 with a smooth transition
engine.resize(800, 600, 500);

// With completion callback
engine.resize(1024, 768, 300, () => {
    console.log('Resize complete!');
});
```

### `setEventHandlers`

Dynamically updates event handlers at runtime. This is essential for implementing mode-based interactions (e.g., switching between pan mode, paint mode, select mode).

| Parameter  | Type                     | Description                                                                 |
| :--------- | :----------------------- | :-------------------------------------------------------------------------- |
| `handlers` | `Partial<EventHandlers>` | Event handler flags to update (`click`, `hover`, `drag`, `zoom`, `resize`). |

```typescript
// Disable drag for painting mode
engine.setEventHandlers({ drag: false, hover: true });

// Re-enable drag for pan mode
engine.setEventHandlers({ drag: true, hover: false });

// Disable all interactions temporarily
engine.setEventHandlers({
    click: false,
    hover: false,
    drag: false,
    zoom: false,
});
```

**Common Use Cases:**

```typescript
// Paint mode toggle
function enablePaintMode() {
    engine.setEventHandlers({ drag: false, hover: true });
    canvas.style.cursor = "crosshair";
}

function enablePanMode() {
    engine.setEventHandlers({ drag: true, hover: false });
    canvas.style.cursor = "grab";
}

// Presentation mode (view only)
function enableViewMode() {
    engine.setEventHandlers({
        click: false,
        hover: false,
        drag: false,
        zoom: false,
    });
}

// Full interactivity
function enableEditMode() {
    engine.setEventHandlers({
        click: true,
        hover: true,
        drag: true,
        zoom: true,
    });
}
```

:::tip Integration with Keyboard Shortcuts
Combine `setEventHandlers()` with keyboard events for professional-grade interaction patterns:

```typescript
let currentMode = "pan";

document.addEventListener("keydown", (e) => {
    // Shift = Paint mode
    if (e.key === "Shift" && currentMode === "pan") {
        currentMode = "paint";
        engine.setEventHandlers({ drag: false, hover: true });
        canvas.style.cursor = "crosshair";
    }

    // Space = Temporarily enable pan (even in other modes)
    if (e.code === "Space") {
        engine.setEventHandlers({ drag: true, hover: false });
        canvas.style.cursor = "grab";
    }
});

document.addEventListener("keyup", (e) => {
    // Release Shift = Back to pan mode
    if (e.key === "Shift" && currentMode === "paint") {
        currentMode = "pan";
        engine.setEventHandlers({ drag: true, hover: false });
        canvas.style.cursor = "default";
    }

    // Release Space = Back to previous mode
    if (e.code === "Space") {
        if (currentMode === "paint") {
            engine.setEventHandlers({ drag: false, hover: true });
            canvas.style.cursor = "crosshair";
        } else {
            engine.setEventHandlers({ drag: true, hover: false });
            canvas.style.cursor = "default";
        }
    }
});
```

:::

### `setBounds`

Set or update map boundaries to restrict camera movement to a specific area. This prevents users from panning beyond defined limits.

| Parameter | Type     | Description                                           |
| :-------- | :------- | :---------------------------------------------------- |
| `bounds`  | `object` | Boundary limits with `minX`, `maxX`, `minY`, `maxY`. |

```typescript
// Restrict map to -100 to 100 on both axes
engine.setBounds({ minX: -100, maxX: 100, minY: -100, maxY: 100 });

// Remove all boundaries
engine.setBounds({ 
    minX: -Infinity, 
    maxX: Infinity, 
    minY: -Infinity, 
    maxY: Infinity 
});

// Only limit horizontal scrolling
engine.setBounds({ 
    minX: 0, 
    maxX: 500, 
    minY: -Infinity, 
    maxY: Infinity 
});

// Limit to positive quadrant only
engine.setBounds({ 
    minX: 0, 
    maxX: 1000, 
    minY: 0, 
    maxY: 1000 
});
```

**Use Cases:**
- **Game maps**: Keep players within playable area
- **Data visualization**: Prevent scrolling beyond data boundaries
- **Floor plans**: Restrict view to building dimensions
- **Interactive maps**: Define explorable regions

:::info Initial Configuration
Boundaries can also be set in the initial configuration:

```typescript
const engine = new CanvasTileEngine(wrapper, {
    scale: 50,
    size: { width: 800, height: 600 },
    bounds: {
        minX: -100,
        maxX: 100,
        minY: -100,
        maxY: 100
    }
});
```
:::
