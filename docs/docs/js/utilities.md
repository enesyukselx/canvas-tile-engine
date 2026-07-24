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

## fitScale

The scale (pixels per world unit) at which a world rectangle exactly fits a viewport — the same math `fitBounds` uses to pick its target scale, exposed as a pure function for config time. Where `gridToSize` derives config for fixed boards, `fitScale` derives scale limits for free-form content, so `scale`/`minScale` stop being hand-tuned constants that must be recalibrated every time the content size changes.

```ts
import { fitScale } from "@canvas-tile-engine/core";

const VIEWPORT = { width: 800, height: 600 };
const WORLD_BOUNDS = { minX: 0, maxX: 200, minY: 0, maxY: 120 };

const fit = fitScale(WORLD_BOUNDS, VIEWPORT, { paddingPx: 24 });

const config = {
    size: VIEWPORT,
    scale: fit, // open showing everything
    minScale: fit * 0.8, // small overview slack - your policy
    maxScale: 64, // quality cap - intentionally hand-picked (see below)
};
```

When the content grows 10x, `fit` shrinks 10x automatically — no retuning. Only `maxScale` stays a deliberate choice: it is a content-resolution quality cap (at what pixel density your tiles or labels stop looking good), which no bounds can imply.

### Parameters

| Parameter           | Type                          | Description                                                                                    |
| ------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `bounds`            | `{ minX, maxX, minY, maxY }`  | Rectangle to fit. Every edge must be finite.                                                   |
| `size`              | `{ width, height }`           | Viewport size in logical pixels.                                                               |
| `options.padding`   | `number`                      | World-unit margin on every side; scales with the content. Default `0`.                         |
| `options.paddingPx` | `number`                      | Screen-pixel margin kept free on every side, content-size-independent. Wins over `padding`.    |

Returns the fitting scale as a plain number, unclamped — apply your own min/max policy. Throws a `ConfigValidationError` on non-finite bounds, `min >= max` on an axis, negative paddings, or a non-positive `size`. Because `fitBounds` shares this exact computation, `engine.fitBounds(bounds, { paddingPx: 24 })` lands precisely on the scale `fitScale(bounds, size, { paddingPx: 24 })` returns (before scale-limit clamping).

### Example: content-driven scale limits

```ts
function configForContent(bounds: Bounds) {
    const fit = fitScale(bounds, VIEWPORT, { paddingPx: 24 });
    return {
        size: VIEWPORT,
        scale: fit,
        minScale: fit * 0.8,
        maxScale: 64,
    };
}

// Later, when the content changes at runtime:
const fit = fitScale(newBounds, engine.getSize(), { paddingPx: 24 });
engine.setScaleLimits(fit * 0.8, 64);
engine.fitBounds(newBounds, { paddingPx: 24 });
```
