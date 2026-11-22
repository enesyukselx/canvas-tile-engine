# Recipes: Complete Build Patterns

Adapt the closest recipe instead of designing from scratch. Item shapes:
[drawing.md](drawing.md). Config fields: [core-api.md](core-api.md). Which
coordinate space each API takes:
[core-api.md](core-api.md#coordinate-spaces).

Contents:

- [1. Interactive game map (vanilla, Canvas2D)](#1-interactive-game-map-vanilla-canvas2d)
- [2. Main map + synced minimap (React)](#2-main-map--synced-minimap-react)
- [3. Pixel painter (React)](#3-pixel-painter-react)
- [4. Fixed game board with clicks (vanilla)](#4-fixed-game-board-with-clicks-vanilla)
- [5. Responsive full-window map](#5-responsive-full-window-map)
- [6. Animated units from a spritesheet (vanilla)](#6-animated-units-from-a-spritesheet-vanilla)
- [7. Server-side OG image / thumbnail endpoint](#7-server-side-og-image--thumbnail-endpoint)
- [8. React Native game board](#8-react-native-game-board)
- [9. Heavy heatmap on WebGL (vanilla)](#9-heavy-heatmap-on-webgl-vanilla)
- [Cross-cutting reminders](#cross-cutting-reminders)

## 1. Interactive game map (vanilla, Canvas2D)

Pannable/zoomable world with terrain, units, labels, a hover outline and
click-to-select tiles.

```html
<div id="map"><canvas></canvas></div>
```

```ts
import { CanvasTileEngine, type Circle, type Rect, type Text } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

type Tile = { id: string };
const terrainTiles: Rect<Tile>[] = loadTerrain(); // your data; Tile in item.data
const unitMarkers: Circle[] = loadUnits();
const placeLabels: Text[] = loadLabels();

const engine = new CanvasTileEngine(
    document.getElementById("map") as HTMLDivElement,
    {
        scale: 48,
        minScale: 16,
        maxScale: 128,
        size: { width: 960, height: 600 },
        backgroundColor: "#0f172a",
        // Corner space: 0..100 = cells 0..99. Clamps the VIEWPORT EDGES; an
        // axis wider than the world locks with the world centered.
        bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
        eventHandlers: { drag: true, zoom: "pointer", click: true, hover: true },
        coordinates: { enabled: true, shownScaleRange: { min: 24, max: 128 } },
    },
    new RendererCanvas(),
    { x: 50, y: 50 },
);

// Layer 0: grid, 1: terrain, 2: units, 3: labels, 10: transient UI
const selected = new Set<string>();
engine.drawGridLines(1, 1, "#1e293b", 0);
engine.drawRect(terrainTiles, 1, {
    id: "terrain",
    // selection tints the tiles themselves: a Set + render(), nothing re-registers
    styleOf: (t) => (t.data && selected.has(t.data.id) ? { fillStyle: "#22c55e" } : undefined),
});
engine.drawCircle(unitMarkers, 2, { id: "units" });
engine.drawText(placeLabels, 3, { id: "labels" });

// Same id -> replaces the previous outline: idempotent, no handle bookkeeping
engine.onHover = (c) => {
    engine.drawRect(
        { x: c.snapped.x, y: c.snapped.y, size: 1, style: { strokeStyle: "#38bdf8", lineWidthPx: 2 } },
        10,
        { id: "hover", hitTest: false },
    );
    engine.render();
};
engine.onMouseLeave = () => {
    engine.drawRect([], 10, { id: "hover" }); // replace with nothing
    engine.render();
};

engine.onClick = (c) => {
    // hit tests take coords.raw as-is
    const id = engine.hitTestFirst<Tile>(c.raw, { layer: 1 })?.item.data?.id;
    if (!id) return;
    if (!selected.delete(id)) selected.add(id);
    engine.render();
};

engine.render();
```

## 2. Main map + synced minimap (React)

Two engines. The minimap shows the whole world from a static cache, draws
the main viewport as an outline, and jumps the main camera on click.

```tsx
import { useCallback, useEffect } from "react";
import { CanvasTileEngine, gridToSize, useCanvasTileEngine, type Coords, type Rect } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const COLS = 100;
const ROWS = 100;
// The minimap fits the whole world at 2 px per cell (200x200), centered on it.
const { center: miniCenter, ...miniBoard } = gridToSize({ columns: COLS, rows: ROWS, cellSize: 2 });

export function MapWithMinimap({ world }: { world: Rect[] }) { // stable array: state/useMemo upstream
    const main = useCanvasTileEngine();
    const mini = useCanvasTileEngine();

    // The main viewport as an item-space rect: centered on the camera,
    // size / scale world units across. (getVisibleBounds() rounds to cells.)
    const drawViewport = useCallback(
        (center: Coords) => {
            if (!mini.instance) return;
            const { width, height } = main.getSize();
            const scale = main.getScale();
            mini.drawRect(
                {
                    x: center.x,
                    y: center.y,
                    width: width / scale,
                    height: height / scale,
                    origin: { mode: "self", x: 0.5, y: 0.5 },
                    style: { strokeStyle: "#f8fafc", lineWidthPx: 2 },
                },
                10,
                { id: "viewport", hitTest: false }, // same id replaces the previous outline
            );
            mini.render();
        },
        [main, mini],
    );

    // onCoordsChange does not fire at mount: draw the first outline once both exist.
    useEffect(() => {
        if (main.instance && mini.instance) drawViewport(main.getCenter());
    }, [main, mini, main.instance, mini.instance, drawViewport]);

    return (
        <div style={{ position: "relative", width: 960 }}>
            <CanvasTileEngine
                engine={main}
                renderer={new RendererCanvas()}
                config={{
                    scale: 48,
                    minScale: 16,
                    maxScale: 96,
                    size: { width: 960, height: 600 },
                    bounds: { minX: 0, maxX: COLS, minY: 0, maxY: ROWS }, // corner space: cells 0..99
                    eventHandlers: { drag: true, zoom: true },
                }}
                center={{ x: 50, y: 50 }}
                onCoordsChange={drawViewport} // fires on pan AND zoom
            >
                <CanvasTileEngine.GridLines cellSize={1} strokeStyle="#1e293b" layer={0} />
                <CanvasTileEngine.Rect items={world} layer={1} />
            </CanvasTileEngine>

            <div style={{ position: "absolute", right: 8, bottom: 8, border: "1px solid #334155" }}>
                <CanvasTileEngine
                    engine={mini}
                    renderer={new RendererCanvas()}
                    config={{ ...miniBoard, backgroundColor: "#0f172a", eventHandlers: { click: true } }}
                    center={miniCenter}
                    // snapped = the clicked cell's item x/y; coords.raw is half a cell off
                    onClick={(c) => main.goCenter(c.snapped.x, c.snapped.y, 300)}
                >
                    <CanvasTileEngine.StaticRect items={world} cacheKey="minimap" layer={1} hitTest={false} />
                </CanvasTileEngine>
            </div>
        </div>
    );
}
```

The minimap never zooms, which is where a static cache is safe on Canvas2D
([drawing.md](drawing.md#static-caching-drawstaticrect--drawstaticcircle--drawstaticimage)).
It has no drag/zoom flags, so it is click-only.

## 3. Pixel painter (React)

Stable cell items, colors in a ref read by `styleOf`/`visibleOf`,
`engine.render()` per painted cell (no React render, no re-registration),
paint/pan modes via `setEventHandlers`, a hover outline, and a zoom slider
bounded by the live limits.

```tsx
import { useEffect, useRef, useState } from "react";
import {
    CanvasTileEngine,
    gridToSize,
    useCanvasTileEngine,
    type Coords,
    type onHoverCallback,
    type onMouseDownCallback,
    type Rect,
} from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const COLS = 32;
const ROWS = 32;
// center is REQUIRED: cells 0..31 are centered at 15.5 (integers are cell centers)
const { center: boardCenter, ...board } = gridToSize({ columns: COLS, rows: ROWS, cellSize: 16 });
const BOARD_AREA = { minX: -0.5, maxX: COLS - 0.5, minY: -0.5, maxY: ROWS - 0.5 }; // item space
const inBoard = (c: Coords) => c.x >= 0 && c.x < COLS && c.y >= 0 && c.y < ROWS;

// Geometry: one item per cell, built once, never re-registered.
const CELLS: Rect[] = [];
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) CELLS.push({ x, y, size: 1 });

type Mode = "paint" | "pan";

export function PixelPainter() {
    const engine = useCanvasTileEngine();
    const [color, setColor] = useState("#38bdf8");
    const [mode, setMode] = useState<Mode>("paint");
    const [zoom, setZoom] = useState({ scale: board.scale, min: board.scale, max: board.scale });

    const pixels = useRef<(string | undefined)[]>([]); // index y * COLS + x
    const pressed = useRef(false);
    const hoverKey = useRef(""); // last outlined cell

    // Live limits exist only after mount (before it getConfig() is placeholders).
    useEffect(() => {
        if (!engine.instance) return;
        const { minScale, maxScale } = engine.getConfig();
        setZoom({ scale: engine.getScale(), min: minScale, max: maxScale });
    }, [engine, engine.instance]);

    // Each helper reports whether it changed anything; callers render once.
    const paintAt = (c: Coords) => {
        const i = c.y * COLS + c.x;
        if (!inBoard(c) || pixels.current[i] === color) return false;
        pixels.current[i] = color; // eraser: store undefined
        return true;
    };
    const outline = (c: Coords | null) => {
        const key = c && inBoard(c) ? `${c.x},${c.y}` : "";
        if (key === hoverKey.current) return false;
        hoverKey.current = key;
        engine.drawRect(
            c && key ? { x: c.x, y: c.y, size: 1, style: { strokeStyle: "#0f172a", lineWidthPx: 2 } } : [],
            10,
            { id: "hover", hitTest: false }, // same id replaces the previous outline
        );
        return true;
    };

    const onMouseDown: onMouseDownCallback = (c) => {
        if (mode !== "paint") return; // down/up fire in pan mode too (no flag gates them)
        pressed.current = true;
        if (paintAt(c.snapped)) engine.render();
    };
    const onHover: onHoverCallback = (c) => {
        const moved = outline(c.snapped);
        const painted = pressed.current && paintAt(c.snapped);
        if (moved || painted) engine.render();
    };

    const switchMode = (next: Mode) => {
        setMode(next);
        pressed.current = false;
        // paint: drag off so a press paints instead of panning; pan: drag on
        engine.setEventHandlers(next === "paint" ? { drag: false, hover: true } : { drag: true });
    };

    return (
        <div>
            <div>
                <button onClick={() => switchMode("paint")} disabled={mode === "paint"}>Paint</button>
                <button onClick={() => switchMode("pan")} disabled={mode === "pan"}>Pan</button>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                <input
                    type="range"
                    min={zoom.min}
                    max={zoom.max}
                    value={zoom.scale}
                    onChange={(e) => engine.setScale(Number(e.target.value))}
                />
            </div>
            <CanvasTileEngine
                engine={engine}
                renderer={new RendererCanvas()}
                center={boardCenter}
                config={{
                    ...board,
                    minScale: 8,
                    maxScale: 64,
                    backgroundColor: "#f8fafc",
                    bounds: { minX: 0, maxX: COLS, minY: 0, maxY: ROWS }, // corner space: cells 0..31
                    eventHandlers: { drag: false, hover: true, zoom: true }, // starts in paint mode
                }}
                onMouseDown={onMouseDown}
                onHover={onHover}
                onMouseUp={() => {
                    pressed.current = false;
                }}
                onMouseLeave={() => {
                    pressed.current = false;
                    if (outline(null)) engine.render();
                }}
                onZoom={(scale) => setZoom((z) => ({ ...z, scale }))}
            >
                <CanvasTileEngine.Rect
                    items={CELLS}
                    layer={1}
                    hitTest={false}
                    visibleOf={(c) => pixels.current[c.y * COLS + c.x] !== undefined} // skip blanks
                    styleOf={(c) => ({ fillStyle: pixels.current[c.y * COLS + c.x] })}
                />
                <CanvasTileEngine.GridLines cellSize={1} strokeStyle="#e2e8f0" layer={2} clip={BOARD_AREA} />
            </CanvasTileEngine>
        </div>
    );
}
```

Why this shape: a new items array per stroke would re-register and rebuild
the spatial index for 1024 cells on every pointer move; React state for
`pressed`/hover would re-render per move. `hover: true` + `drag: false` is
what makes `onHover` fire while the button is held
([events.md](events.md#flags-and-the-callbacks-they-gate)). `clip` (core >= 0.12) keeps the grid lines on the
board when zoomed out; with `minScale` 8 the 256 px board is smaller than
the canvas, and `bounds` centers it.

## 4. Fixed game board with clicks (vanilla)

Chess/match-3 style: exact cell count, no camera movement, click to select.

```ts
import { CanvasTileEngine, gridToSize, type Rect } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const N = 8;
// center is REQUIRED: cells 0..7 are centered at (3.5, 3.5), not (4, 4)
// and not the default (0, 0) - integers are cell centers.
const { center, ...board } = gridToSize({ columns: N, rows: N, cellSize: 60 }); // 480x480, scale 60

const engine = new CanvasTileEngine(
    document.getElementById("board") as HTMLDivElement,
    { ...board, backgroundColor: "#2d2d2d", eventHandlers: { click: true } }, // no drag/zoom
    new RendererCanvas(),
    center,
);

const squares: Rect[] = [];
for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
        squares.push({ x, y, size: 1, style: { fillStyle: (x + y) % 2 ? "#b58863" : "#f0d9b5" } });

let selected: { x: number; y: number } | null = null;
engine.drawRect(squares, 0, {
    id: "squares",
    styleOf: (s) => (selected && s.x === selected.x && s.y === selected.y ? { fillStyle: "#f6f669" } : undefined),
});

engine.onClick = (c) => {
    const { x, y } = c.snapped; // the clicked cell = its item x/y
    selected = x >= 0 && x < N && y >= 0 && y < N ? { x, y } : null;
    engine.render();
};
engine.render();
```

With the `gridToSize` center, cells 0..7 exactly fill the canvas. Leave
`gridAligned` off: with an exact center it adds nothing, and on a board with
a fractional margin it snaps half a cell off. For a-h / 1-8 labels draw
`Text` items; the coordinate overlay shows integers only.

## 5. Responsive full-window map

```html
<div style="height: 100vh"><div id="map"><canvas></canvas></div></div>
```

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const engine = new CanvasTileEngine(
    document.getElementById("map") as HTMLDivElement,
    {
        scale: 48,
        size: { width: 800, height: 600 }, // seeds the first frame only
        responsive: "fill", // (core >= 0.12) both axes follow the PARENT
        eventHandlers: { drag: true, zoom: true },
    },
    new RendererCanvas(),
);
```

`"fill"` sets the wrapper to 100% x 100% of its parent, so the parent needs
a definite height (here `100vh`; a flex/grid child also `min-height: 0`).
Add no window `resize` listener and never call `engine.resize()`: the
renderer observes the wrapper itself. `"preserve-scale"` follows the width
only (height stays `config.size.height`); `"preserve-viewport"` keeps the
tile count and changes the scale. In React the component's own div is the
wrapper: size its parent. Zoom limits adapt on resize - read live limits
with `getConfig()` after mount and in `onResize`
([core-api.md](core-api.md#responsive-modes-browser-renderers-only)).

## 6. Animated units from a spritesheet (vanilla)

```ts
import { SpriteSheet, SpriteAnimator, type ImageItem } from "@canvas-tile-engine/core";

const img = await engine.images.load("/assets/units.png");
const sheet = new SpriteSheet({ frameWidth: 64, frameHeight: 64, columns: 8 });

const units: ImageItem[] = unitData.map((u: { x: number; y: number }) => ({
    x: u.x,
    y: u.y,
    size: 1,
    img,
    sprite: sheet.frame(0, 0), // (col, row)
}));
engine.drawImage(units, 2, { id: "units" });
engine.render();

const walk = new SpriteAnimator({ frames: sheet.framesInRow(0, 0, 3), fps: 8 }); // row 0, cols 0..3
if (!engine.getReducedMotion()) {
    // reduced motion does not stop sprites; poll it yourself
    walk.start((frame) => {
        for (const u of units) u.sprite = frame; // all units flip in sync
        engine.render();
    });
}
// Different unit types animating different rows: one SpriteAnimator per row,
// each driving its own subset of items.
```

React equivalent:
`<CanvasTileEngine.Sprite items={units} frames={frames} fps={8} />` (see
[sprites.md](sprites.md)).

## 7. Server-side OG image / thumbnail endpoint

See [server.md](server.md) for the full pattern with `renderToBuffer`,
`registerFont`, and `getVisibleBounds`-driven data fetching.

## 8. React Native game board

Checkers board sized from the window, tap to select, a-h labels as `Text`
items. No hover on native: selection is tap-driven.

```tsx
import { useState } from "react";
import { useWindowDimensions } from "react-native";
import {
    CanvasTileEngine,
    gridToSize,
    useCanvasTileEngine,
    type Circle,
    type Coords,
    type Rect,
    type Text as TextItem, // RN's <Text> component has the same name
} from "@canvas-tile-engine/react-native";
import { RendererSkia } from "@canvas-tile-engine/renderer-skia";

const N = 8;
const SQUARES: Rect[] = [];
for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
        SQUARES.push({ x, y, size: 1, style: { fillStyle: (x + y) % 2 ? "#769656" : "#eeeed2" } });
// File letters in the bottom row's corners (the coordinate overlay cannot show letters)
const FILES: TextItem[] = Array.from("abcdefgh", (f, x) => ({
    x: x + 0.4,
    y: N - 1 + 0.36,
    text: f,
    fontPx: 10,
    style: { fillStyle: "#1f2937", textAlign: "right" },
}));

export function CheckersBoard({ pieces }: { pieces: Circle[] }) { // stable: game state upstream
    const engine = useCanvasTileEngine();
    const { width } = useWindowDimensions();
    const { size, scale, center } = gridToSize({ columns: N, rows: N, cellSize: Math.floor(width / N) });
    const [selected, setSelected] = useState<Coords | null>(null);

    return (
        <CanvasTileEngine
            key={width} // config/center are read once: remount on rotation
            engine={engine}
            renderer={new RendererSkia()}
            config={{ scale, size, eventHandlers: { click: true } }} // taps only, no pan/zoom
            center={center} // REQUIRED; leave gridAligned off
            style={{ width: size.width, height: size.height }}
            onClick={(c) => {
                const { x, y } = c.snapped; // the tapped cell
                setSelected(x >= 0 && x < N && y >= 0 && y < N ? { x, y } : null);
            }}
        >
            <CanvasTileEngine.Rect
                items={SQUARES}
                layer={0}
                hitTest={false}
                styleOf={(s) => (selected && s.x === selected.x && s.y === selected.y ? { fillStyle: "#baca44" } : undefined)}
            />
            <CanvasTileEngine.Circle items={pieces} layer={1} />
            <CanvasTileEngine.Text items={FILES} layer={2} />
        </CanvasTileEngine>
    );
}
```

A move is a geometry change: produce a new `pieces` array from your game
state and the `<Circle>` re-registers. Setup, imports and native-only
caveats: [react-native.md](react-native.md).

## 9. Heavy heatmap on WebGL (vanilla)

200k cells, a gradient legend, a hover tooltip and clipped annotations. The
container sizes the surface (`responsive: "fill"`); the view is fitted once.

```html
<div id="plot" style="position: relative; height: 70vh">
    <div id="heat"><canvas></canvas></div>
    <div id="tip" hidden style="position: absolute; left: 0; top: 0; pointer-events: none"></div>
</div>
```

```ts
import { CanvasTileEngine, itemsBounds, type LinearGradient, type Rect, type Text } from "@canvas-tile-engine/core";
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";

type Cell = { value: number };
const COLS = 500;
const ROWS = 400;
const values: ArrayLike<number> = loadValues(); // your data: row-major, normalized 0..1
const PALETTE = ["#1e3a8a", "#2563eb", "#22d3ee", "#a3e635", "#facc15", "#f97316", "#dc2626"];

const cells: Rect<Cell>[] = Array.from({ length: COLS * ROWS }, (_, i) => {
    const value = values[i];
    const color = PALETTE[Math.min(PALETTE.length - 1, Math.floor(value * PALETTE.length))];
    return { x: i % COLS, y: Math.floor(i / COLS), size: 1, style: { fillStyle: color }, data: { value } };
});

// Legend strip under the plot. "box" units (default) are fractions of the
// rect itself: x 0 -> 1 runs left to right. (core >= 0.12)
const ramp: LinearGradient = {
    type: "linear",
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
    stops: PALETTE.map((color, i) => ({ offset: i / (PALETTE.length - 1), color })),
};
const legend: Rect = { x: (COLS - 1) / 2, y: ROWS + 4, width: COLS, height: 6, style: { fillStyle: ramp } };
const legendLabels: Text[] = [
    { x: -0.5, y: ROWS + 10, text: "low", fontPx: 12, style: { fillStyle: "#cbd5e1", textAlign: "left" } },
    { x: COLS - 0.5, y: ROWS + 10, text: "high", fontPx: 12, style: { fillStyle: "#cbd5e1", textAlign: "right" } },
];

// Annotations near the plot edge must not spill onto the legend: clip them
// to the plot AREA (item space). Per registration - repeat it on each.
const PLOT = { minX: -0.5, maxX: COLS - 0.5, minY: -0.5, maxY: ROWS - 0.5 };
const hotspots: Rect[] = [
    // crosses the bottom edge: the part below the plot is cut, not drawn over the legend
    { x: 120, y: ROWS - 6, width: 40, height: 30, style: { strokeStyle: "#f8fafc", lineWidthPx: 2, lineDashPx: [6, 4] } },
];
const hotspotLabels: Text[] = [
    { x: 120, y: ROWS - 26, text: "Hotspot A", fontPx: 12, style: { fillStyle: "#f8fafc" } },
];

const engine = new CanvasTileEngine(
    document.getElementById("heat") as HTMLDivElement,
    {
        scale: 2,
        minScale: 0.5,
        maxScale: 64,
        size: { width: 800, height: 600 }, // seeds the first frame only
        responsive: "fill", // (core >= 0.12) follows #plot, no resize listener needed
        backgroundColor: "#0b1021",
        eventHandlers: { drag: true, zoom: true, hover: true },
    },
    new RendererWebGL(),
);

engine.drawRect(cells, 1, { id: "heat" }); // one batched GPU registration
engine.drawRect(legend, 1, { id: "legend", hitTest: false });
engine.drawText(legendLabels, 2, { id: "legend-labels" });
engine.drawRect(hotspots, 3, { id: "hotspots", clip: PLOT, hitTest: false }); // clip: core >= 0.12
engine.drawText(hotspotLabels, 4, { id: "hotspot-labels", clip: PLOT });

// Fit plot + legend instantly; itemsBounds returns the item-space AREA. (core >= 0.12)
const scene = itemsBounds([legend, ...legendLabels, ...cells]);
if (scene) engine.fitBounds(scene, { paddingPx: 16, durationMs: 0 });
engine.render();

const tip = document.getElementById("tip") as HTMLDivElement;
engine.onHover = (coords, mouse) => {
    const value = engine.hitTestFirst<Cell>(coords.raw, { layer: 1 })?.item.data?.value;
    tip.hidden = value === undefined;
    if (value === undefined) return;
    tip.textContent = `(${coords.snapped.x}, ${coords.snapped.y}) ${value.toFixed(2)}`;
    tip.style.transform = `translate(${mouse.raw.x + 12}px, ${mouse.raw.y + 12}px)`; // canvas px
};
engine.onMouseLeave = () => {
    tip.hidden = true;
};
```

- `hitTestFirst` is the general lookup (sparse or irregular items). On a
  dense grid `coords.snapped` is already the cell index: `values[y * COLS +
  x]` is cheaper.
- To keep the fit when the container resizes, re-run the `fitBounds` call
  in `engine.onResize` (it overrides the user's pan/zoom).
- On WebGL, text (labels, the overlay) always composites above GPU
  primitives; fine here. Budgets and the CPU-batching ceiling:
  [performance.md](performance.md).

## Cross-cutting reminders

- Plan layers up front (0 grid, 1 terrain/content, 2 entities, 3 labels,
  10 transient UI) so one id or `clearLayer` swaps a whole concern.
- Keep game/app state in your own structures (Map, array, ref) and derive
  draw items from it; the engine is a view layer, not a data store.
  Appearance changes go through `styleOf`/`visibleOf` + `render()`;
  geometry changes re-register (same `id`, or a new React `items` array).
