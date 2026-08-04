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

## itemsBounds

The world rectangle enclosing a list of items — the missing half of `fitBounds` and `fitScale`, both of which take a rectangle you had to compute by hand:

```ts
import { itemsBounds } from "@canvas-tile-engine/core";

// Fit to a selection. The result is null when there is nothing to frame, so
// guard it: "zoom to selection" with an empty selection should not move the
// camera.
const selection = itemsBounds(selectedSeats);
if (selection) {
    engine.fitBounds(selection, { paddingPx: 24 });
}

// Fit to whatever a marquee caught - rects, lines and paths in one list
const picked = engine.hitTestRect(marquee, { mode: "contain" }).map((hit) => hit.item);
const region = itemsBounds(picked);
if (region) {
    engine.fitBounds(region, { paddingPx: 24 });
}

// Derive scale limits from the content that exists right now
const content = itemsBounds(tiles);
if (content) {
    const fit = fitScale(content, engine.getSize(), { paddingPx: 24 });
    engine.setScaleLimits(fit * 0.8, 64);
}
```

A set you know is non-empty (a fixed board, a hard-coded tile list) can skip the
guard with a non-null assertion — `itemsBounds(tiles)!` — but anything derived
from user selection or a hit test needs it.

### Parameters

| Parameter | Type             | Description                                                                                              |
| --------- | ---------------- | -------------------------------------------------------------------------------------------------------- |
| `items`   | `BoundedItem[]`  | Any mix of drawn items. Every kind the draw API accepts fits as-is, so `hitTest` results need no filtering. |

Returns `{ minX, maxX, minY, maxY }`, or `null` when nothing in the list has bounds (an empty list, or only items that draw nothing — guard before passing it on).

Each kind contributes the geometry it is drawn from:

| Kind                              | Box                                                                       |
| --------------------------------- | ------------------------------------------------------------------------- |
| `Rect`, `Circle`, `Text`, `Image` | `width ?? size` by `height ?? size` world units (default 1), centered on the anchor |
| `Line`                            | its two endpoints                                                         |
| `Path`                            | vertex box for `points`, control-point hull for `commands`                |

Items that draw nothing are skipped rather than counted: a path with fewer than two points, an empty command list, an object with no geometry at all.

Deliberately left out, so the result stays camera-independent:

- `origin` offsets and `rotate` — both stay within half an item of this box; add your own `padding` if you need the slack.
- `sizePx` / `fontPx` — pixel sizes only gain a world extent once you pick a camera scale.
- Measured text — a `Text` item contributes its `size` box, not its glyph extents. The engine has no font metrics (that is what keeps core platform-agnostic), so a long label reaches past this box. Pad accordingly when framing labels.

### Example: zoom to a group

```ts
const group = units.filter((u) => u.data.team === "red");
const bounds = itemsBounds(group);
if (bounds) {
    engine.fitBounds(bounds, { paddingPx: 32, durationMs: 300 });
}
```
