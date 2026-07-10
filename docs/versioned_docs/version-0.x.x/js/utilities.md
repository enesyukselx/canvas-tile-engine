---
sidebar_position: 8
---

# Utilities

Helper functions for common configuration patterns.

## gridToSize

Converts grid-based dimensions (columns/rows) to pixel-based config plus the board center. Useful when you want to think in terms of "how many cells should be visible" rather than pixel dimensions.

```ts
import { gridToSize } from "@canvas-tile-engine/core";

const { center, ...board } = gridToSize({ columns: 12, rows: 12, cellSize: 50 });

const config = {
    ...board,
    gridAligned: true,
    backgroundColor: "#337426",
    eventHandlers: { drag: true, zoom: true },
};

// board.size = { width: 600, height: 600 }
// board.scale = 50
// center = { x: 5.5, y: 5.5 }
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
    center: {
        x: number; // (columns - 1) / 2
        y: number; // (rows - 1) / 2
    }
}
```

:::info Why `(columns - 1) / 2`?
Integer world coordinates are **cell centers**: cell `k` spans `[k - 0.5, k + 0.5]`. A board of cells `0..N-1` therefore spans `[-0.5, N - 0.5]` and is centered at `(N - 1) / 2`. Pass the returned `center` to the engine so the board exactly fills the viewport - without it the engine centers on world `(0, 0)` and most of the board sits off-screen.
:::

### Example: Fixed game board

```ts
import { CanvasTileEngine, gridToSize } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const wrapper = document.getElementById("game") as HTMLDivElement;

const { center, ...board } = gridToSize({ columns: 8, rows: 8, cellSize: 60 });

const engine = new CanvasTileEngine(
    wrapper,
    {
        ...board,
        gridAligned: true,
        backgroundColor: "#2d2d2d",
        eventHandlers: { click: true, hover: true, drag: false, zoom: false },
    },
    new RendererCanvas(),
    center, // { x: 3.5, y: 3.5 } - cells 0..7 exactly fill the canvas
);

// Creates a 480x480 pixel canvas showing an 8x8 grid
```
