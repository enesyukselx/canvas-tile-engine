---
sidebar_position: 8
---

# Utilities

Helper functions for common configuration patterns.

## gridToSize

Converts grid-based dimensions (columns/rows) to pixel-based config plus the board center. Useful when you want to think in terms of "how many cells should be visible" rather than pixel dimensions.

```tsx
import { gridToSize } from "@canvas-tile-engine/react";

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
Integer world coordinates are **cell centers**: cell `k` spans `[k - 0.5, k + 0.5]`. A board of cells `0..N-1` therefore spans `[-0.5, N - 0.5]` and is centered at `(N - 1) / 2`. Pass the returned `center` to the component so the board exactly fills the viewport - without it the engine centers on world `(0, 0)` and most of the board sits off-screen.
:::

### Example: Fixed game board

```tsx
import { CanvasTileEngine, useCanvasTileEngine, gridToSize } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const { center, ...board } = gridToSize({ columns: 8, rows: 8, cellSize: 60 });

const config = {
    ...board,
    gridAligned: true,
    backgroundColor: "#2d2d2d",
    eventHandlers: { click: true, hover: true, drag: false, zoom: false },
};

function GameBoard() {
    const engine = useCanvasTileEngine();

    return (
        <CanvasTileEngine engine={engine} renderer={new RendererCanvas()} config={config} center={center}>
            <CanvasTileEngine.GridLines cellSize={1} />
        </CanvasTileEngine>
    );
}

// Creates a 480x480 pixel canvas showing an 8x8 grid
// center = { x: 3.5, y: 3.5 } - cells 0..7 exactly fill the canvas
```

## fitScale

The scale (pixels per world unit) at which a world rectangle exactly fits a viewport — the same math `fitBounds` uses to pick its target scale, exposed as a pure function for config time. Where `gridToSize` derives config for fixed boards, `fitScale` derives scale limits for free-form content, so `scale`/`minScale` stop being hand-tuned constants that must be recalibrated every time the content size changes.

```tsx
import { fitScale } from "@canvas-tile-engine/react";

const VIEWPORT = { width: 800, height: 600 };
const WORLD_BOUNDS = { minX: 0, maxX: 200, minY: 0, maxY: 120 };

const fit = fitScale(WORLD_BOUNDS, VIEWPORT, { paddingPx: 24 });

const config = {
    size: VIEWPORT,
    scale: fit, // open showing everything
    minScale: fit * 0.8, // small overview slack - your policy
    maxScale: 64, // quality cap - intentionally hand-picked
};
```

When the content grows 10x, `fit` shrinks 10x automatically — no retuning. Only `maxScale` stays a deliberate choice: it is a content-resolution quality cap (at what pixel density your tiles or labels stop looking good), which no bounds can imply.

Options mirror `fitBounds`: `padding` (world units, scales with content) or `paddingPx` (screen pixels, wins over `padding`). The result is unclamped — apply your own min/max policy. Because `fitBounds` shares this exact computation, `engine.fitBounds(bounds, { paddingPx: 24 })` lands precisely on the scale `fitScale(bounds, size, { paddingPx: 24 })` returns (before scale-limit clamping).

For content that changes at runtime, pair it with the runtime APIs:

```tsx
const applyContent = (bounds: Bounds) => {
    const fit = fitScale(bounds, engine.getSize(), { paddingPx: 24 });
    engine.setScaleLimits(fit * 0.8, 64);
    engine.fitBounds(bounds, { paddingPx: 24 });
};
```
