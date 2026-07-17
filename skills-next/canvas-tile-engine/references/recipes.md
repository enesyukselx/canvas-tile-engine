# Recipes: Complete Build Patterns

Adapt the closest recipe instead of designing from scratch. All item shapes:
[drawing.md](drawing.md). All config fields: [core-api.md](core-api.md).

## 1. Interactive game map (vanilla, Canvas2D)

Pannable/zoomable world with terrain, units, hover highlight, and selection.

```html
<div id="map" style="width:fit-content"><canvas></canvas></div>
```

```ts
import { CanvasTileEngine, type DrawHandle } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const engine = new CanvasTileEngine(
    document.getElementById("map") as HTMLDivElement,
    {
        scale: 48, minScale: 16, maxScale: 128,
        size: { width: 960, height: 600 },
        backgroundColor: "#0f172a",
        bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },   // world edges
        eventHandlers: { drag: true, zoom: "pointer", click: true, hover: true },
        coordinates: { enabled: true, shownScaleRange: { min: 24, max: 128 } },
    },
    new RendererCanvas(),
    { x: 50, y: 50 },
);

// Layer 0: grid, Layer 1: terrain, Layer 2: units, Layer 3: labels, Layer 10: UI
engine.drawGridLines(1, 1, "#1e293b", 0);
engine.drawRect(terrainTiles, 1);              // big array - culling handles it
engine.drawCircle(unitMarkers, 2);
engine.drawText(placeLabels, 3);

let hover: DrawHandle | undefined;
engine.onHover = (c) => {
    if (hover) engine.removeDrawHandle(hover);
    hover = engine.drawRect({ x: c.snapped.x, y: c.snapped.y, size: 1,
                              style: { strokeStyle: "#38bdf8", lineWidthPx: 2 } }, 10);
    engine.render();
};
engine.onMouseLeave = () => { if (hover) { engine.removeDrawHandle(hover); hover = undefined; engine.render(); } };

let selection: DrawHandle | undefined;
engine.onClick = (c) => {
    if (selection) engine.removeDrawHandle(selection);
    selection = engine.drawRect({ x: c.snapped.x, y: c.snapped.y, size: 1,
                                  style: { fillStyle: "rgba(34,197,94,0.3)" } }, 10);
    engine.render();
    onTileSelected(c.snapped);
};

engine.render();
```

## 2. Main map + synced minimap (React)

Two engines; the minimap uses a static cache and mirrors the main camera.

```tsx
import { useMemo } from "react";
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
import type { Rect } from "@canvas-tile-engine/core";

export function MapWithMinimap({ world }: { world: Rect[] }) {
    const main = useCanvasTileEngine();
    const mini = useCanvasTileEngine();
    const worldItems = useMemo(() => world, [world]);

    return (
        <div style={{ position: "relative" }}>
            <CanvasTileEngine
                engine={main}
                renderer={new RendererCanvas()}
                config={{ scale: 48, size: { width: 960, height: 600 },
                          eventHandlers: { drag: true, zoom: true, click: true } }}
                center={{ x: 50, y: 50 }}
                onCoordsChange={(center) => {
                    // keep the minimap centered on the main camera
                    mini.setCenter(center);
                }}
            >
                <CanvasTileEngine.GridLines cellSize={1} strokeStyle="#1e293b" layer={0} />
                <CanvasTileEngine.Rect items={worldItems} layer={1} />
            </CanvasTileEngine>

            <div style={{ position: "absolute", right: 8, bottom: 8, border: "1px solid #334155" }}>
                <CanvasTileEngine
                    engine={mini}
                    renderer={new RendererCanvas()}
                    config={{ scale: 2, size: { width: 200, height: 200 },
                              eventHandlers: { click: true } }}   // no drag/zoom on minimap
                    center={{ x: 50, y: 50 }}
                    onClick={(c) => main.goCenter(c.raw.x, c.raw.y, 300)}  // click to jump
                >
                    <CanvasTileEngine.StaticRect items={worldItems} cacheKey="minimap" layer={1} />
                </CanvasTileEngine>
            </div>
        </div>
    );
}
```

Optional viewport rectangle on the minimap: draw the main map's
`getVisibleBounds()` as a stroked rect on a high minimap layer inside
`onCoordsChange`/`onZoom` (swap one `DrawHandle` via `mini.instance`).

## 3. Pixel painter (React)

Fixed board, no pan/zoom, click-drag painting.

```tsx
import { useCallback, useMemo, useState } from "react";
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
import { gridToSize, type Rect } from "@canvas-tile-engine/core";

// Board center: cells 0..N-1 are centered at (N-1)/2 (integers are cell
// centers). gridToSize returns it; it MUST be passed or the board renders
// mostly off-screen.
const { center: boardCenter, ...board } = gridToSize({ columns: 32, rows: 32, cellSize: 16 });

export function PixelPainter() {
    const engine = useCanvasTileEngine();
    const [pixels, setPixels] = useState<Map<string, string>>(new Map());
    const [color, setColor] = useState("#38bdf8");
    const [down, setDown] = useState(false);

    const paint = useCallback((x: number, y: number) => {
        setPixels((prev) => new Map(prev).set(`${x},${y}`, color));
    }, [color]);

    const items = useMemo<Rect[]>(
        () => Array.from(pixels, ([key, fill]) => {
            const [x, y] = key.split(",").map(Number);
            return { x, y, size: 1, style: { fillStyle: fill } };
        }),
        [pixels],
    );

    return (
        <CanvasTileEngine
            engine={engine}
            renderer={new RendererCanvas()}
            center={boardCenter}
            config={{
                ...board,
                gridAligned: true,
                backgroundColor: "#ffffff",
                eventHandlers: { click: true, hover: true, drag: false, zoom: false },
            }}
            onMouseDown={(c) => { setDown(true); paint(c.snapped.x, c.snapped.y); }}
            onHover={(c) => { if (down) paint(c.snapped.x, c.snapped.y); }}
            onMouseUp={() => setDown(false)}
            onMouseLeave={() => setDown(false)}
        >
            <CanvasTileEngine.GridLines cellSize={1} strokeStyle="#e2e8f0" layer={0} />
            <CanvasTileEngine.Rect items={items} layer={1} />
        </CanvasTileEngine>
    );
}
```

Note `drag: false` - essential for painting. For an eraser/pan mode toggle,
call `engine.setEventHandlers(...)` from toolbar buttons.

## 4. Fixed game board with clicks (vanilla)

Chess/match-3 style: exact cell count, no camera movement.

```ts
import { CanvasTileEngine, gridToSize } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

// center is REQUIRED: cells 0..7 are centered at (3.5, 3.5), not (4, 4)
// and not the default (0, 0) - integers are cell centers.
const { center, ...board } = gridToSize({ columns: 8, rows: 8, cellSize: 60 }); // 480x480, scale 60

const engine = new CanvasTileEngine(wrapper, {
    ...board,
    gridAligned: true,
    backgroundColor: "#2d2d2d",
    eventHandlers: { click: true, hover: true, drag: false, zoom: false },
}, new RendererCanvas(), center);

// Checkerboard
const squares = [];
for (let x = 0; x < 8; x++)
    for (let y = 0; y < 8; y++)
        squares.push({ x, y, size: 1, style: { fillStyle: (x + y) % 2 ? "#b58863" : "#f0d9b5" } });
engine.drawRect(squares, 0);
engine.render();
```

With the `gridToSize` center, cells 0..7 exactly fill the canvas: cell (0,0)
touches the top-left corner and cell (7,7) the bottom-right. `gridAligned`
then guards against slightly-off centers by snapping to the nearest aligned
value.

## 5. Responsive fullscreen map

```ts
// Wrapper styled by CSS (e.g. width:100%; height:100vh). The engine follows it.
const engine = new CanvasTileEngine(wrapper, {
    scale: 48,
    size: { width: 800, height: 600, minWidth: 320, minHeight: 240 },  // initial + clamps
    responsive: "preserve-scale",     // or "preserve-viewport" to keep tile count
    eventHandlers: { drag: true, zoom: true },
}, new RendererCanvas());
```

Do not call `engine.resize()` in responsive mode - CSS on the wrapper is the
size authority. In React pass `style={{ width: "100%", height: "100vh" }}`.
Scale limits adapt on resize (preserve-viewport: the minimum is a zoom-out
factor of the base scale; preserve-scale: the minimum follows the bounds fit
scale; the maximum stays absolute in both), and
preserve-viewport resizes fire `onZoom` - read the initial scale with
`engine.getScale()` after mount, since the first sizing runs before
callbacks attach.

## 6. Animated units from a spritesheet (vanilla)

```ts
import { SpriteSheet, SpriteAnimator } from "@canvas-tile-engine/core";

const img = await engine.images.load("/assets/units.png");
const sheet = new SpriteSheet({ frameWidth: 64, frameHeight: 64, columns: 8 });

const units = unitData.map((u) => ({ x: u.x, y: u.y, size: 1, img, sprite: sheet.frame(0, 0) }));
engine.drawImage(units, 2);
engine.render();

const walk = new SpriteAnimator({ frames: sheet.framesInRow(0, 0, 3), fps: 8 });
walk.start((frame) => {
    for (const u of units) u.sprite = frame;   // all units flip in sync
    engine.render();
});
// Different unit types animating different rows: one SpriteAnimator per row,
// each driving its own subset of items.
```

React equivalent: `<CanvasTileEngine.Sprite items={units} frames={frames} fps={8} />`
(see [sprites.md](sprites.md)).

## 7. Server-side OG image / thumbnail endpoint

See [server.md](server.md) for the full pattern with `renderToBuffer`,
`registerFont`, and `getVisibleBounds`-driven data fetching.

## 8. React Native game board

See [react-native.md](react-native.md) - the React recipes above translate
directly: same components, `style={{ flex: 1 }}` for sizing, `SkImage` for
images, no hover (use tap-to-select instead of hover-highlight).

## 9. Swapping to WebGL for heavy scenes

```ts
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";
// Only this line changes:
const engine = new CanvasTileEngine(wrapper, config, new RendererWebGL(), center);
```

Check the layering caveat first (text/custom draws composite above GPU
primitives): [performance.md](performance.md).

## Cross-cutting reminders

- Every camera-moving API (`goCenter`, `setCenter`, `setScale`, `goScale`, `zoomIn`,
  `zoomOut`, `setBounds`, drag/zoom gestures) re-renders automatically; only
  draw registration and data mutation need an explicit `render()`.
- Group scene content into meaningful layers from the start (0 grid,
  1 terrain, 2 entities, 3 labels, 10 transient UI) - it makes selective
  `clearLayer` updates trivial.
- Store game state in your own structures (Map/array); derive draw items
  from it. The engine is a view layer, not a data store.
