---
sidebar_position: 8
---

# Utilities

Helper functions for common configuration patterns.

## gridToSize

Converts grid-based dimensions (columns/rows) to pixel-based config. Useful when you want to think in terms of "how many cells should be visible" rather than pixel dimensions.

```tsx
import { gridToSize } from "@canvas-tile-engine/react";

const config = {
    ...gridToSize({ columns: 12, rows: 12, cellSize: 50 }),
    gridAligned: true,
    backgroundColor: "#337426",
    eventHandlers: { drag: true, zoom: true },
};

// Result:
// config.size = { width: 600, height: 600 }
// config.scale = 50
```

### Parameters

| Parameter  | Type     | Description                       |
| ---------- | -------- | --------------------------------- |
| `columns`  | `number` | Number of grid columns to display |
| `rows`     | `number` | Number of grid rows to display    |
| `cellSize` | `number` | Size of each cell in pixels       |

### Returns

```ts
{
    size: {
        width: number;
        height: number;
    }
    scale: number;
}
```

### Example: Fixed game board

```tsx
import { CanvasTileEngine, useCanvasTileEngine, gridToSize } from "@canvas-tile-engine/react";

const config = {
    ...gridToSize({ columns: 8, rows: 8, cellSize: 60 }),
    gridAligned: true,
    backgroundColor: "#2d2d2d",
    eventHandlers: { click: true, hover: true, drag: false, zoom: false },
};

function GameBoard() {
    const engine = useCanvasTileEngine();

    return (
        <CanvasTileEngine engine={engine} config={config} center={{ x: 4, y: 4 }}>
            <CanvasTileEngine.GridLines cellSize={1} />
        </CanvasTileEngine>
    );
}

// Creates a 480x480 pixel canvas showing an 8x8 grid
```
