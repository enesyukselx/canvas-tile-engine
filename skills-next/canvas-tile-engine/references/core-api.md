# Core API Reference

Package: `@canvas-tile-engine/core`. Everything here is renderer-agnostic and
applies to all platforms unless noted.

## Construction (vanilla / server; React packages construct for you)

```ts
new CanvasTileEngine<TMount, TImage>(
    canvasWrapper: TMount,               // DOM: a div that CONTAINS a <canvas> child
    config: CanvasTileEngineConfig,
    renderer: IRenderer<TMount, TImage>, // e.g. new RendererCanvas()
    center?: Coords,                     // initial world center, default { x: 0, y: 0 }
)
```

- DOM renderers (`RendererCanvas`, `RendererWebGL`): `canvasWrapper` is an
  `HTMLDivElement` that must already contain `<canvas></canvas>`.
- Server renderer: pass the exported `SERVER_MOUNT` constant as the wrapper.
- `engine.canvas` is the `HTMLCanvasElement` on DOM mounts (useful for
  `engine.canvas.style.cursor = "crosshair"`), `undefined` on non-DOM mounts.
- `engine.canvasWrapper` is the wrapper you passed in.

## Full config reference

```ts
type CanvasTileEngineConfig = {
    scale: number;                     // REQUIRED. Initial pixels per world unit.
    size: {                            // REQUIRED. Logical canvas size in px.
        width: number;
        height: number;
        minWidth?: number;             // default 100  (resize/responsive clamp)
        minHeight?: number;            // default 100
        maxWidth?: number;             // default Infinity
        maxHeight?: number;            // default Infinity
    };
    minScale?: number;                 // default scale * 0.5
    maxScale?: number;                 // default scale * 2
    backgroundColor?: string;          // default "#ffffff", any CSS color
    gridAligned?: boolean;             // default false. Snaps the initial center to
                                       // the nearest grid-aligned value: half-integers
                                       // for even tile counts, integers for odd
                                       // (pixel-perfect grids). Integer ties snap
                                       // down, so N/2 lands on a 0-based board's
                                       // true center (N-1)/2.
    responsive?: "preserve-scale" | "preserve-viewport" | false; // default false
    eventHandlers?: {                  // ALL default false
        click?: boolean;
        rightClick?: boolean;          // DOM renderers only
        hover?: boolean;
        drag?: boolean;
        zoom?: boolean | "pointer" | "center"; // true === "pointer"
        resize?: boolean;              // observe wrapper size when responsive=false
    };
    bounds?: { minX: number; maxX: number; minY: number; maxY: number };
                                       // camera limits; use +/-Infinity per axis
    coordinates?: {                    // coordinate labels around the viewport edge
        enabled?: boolean;             // default false
        shownScaleRange?: { min: number; max: number }; // default {0, Infinity}
    };
    debug?: {
        enabled?: boolean;             // master switch, default false
        hud?: {                        // on-canvas HUD panel
            enabled?: boolean;
            topLeftCoordinates?: boolean;
            coordinates?: boolean;     // center coords
            scale?: boolean;
            tilesInView?: boolean;
            fps?: boolean;             // browser renderers only
        };
        eventHandlers?: {              // console logging per event type, default true each
            click?: boolean; hover?: boolean; drag?: boolean;
            zoom?: boolean; resize?: boolean;
        };
    };
};
```

### Responsive modes (browser renderers only)

| Mode | Behavior |
| :-- | :-- |
| `"preserve-scale"` | Scale stays fixed; visible world area grows/shrinks with the wrapper. Width-responsive only: the wrapper is set to `width: 100%` and its height is PINNED to `config.size.height` via inline style (CSS heights are overridden). |
| `"preserve-viewport"` | Configured tile count stays visible; scale changes with wrapper width. |
| `false` | Fixed `config.size` until `engine.resize()` or `eventHandlers.resize`. |

When `responsive` is enabled, `engine.resize()` and `eventHandlers.resize`
are ignored (the wrapper element controls size - style the wrapper with CSS).
The server renderer ignores `responsive`; React Native measures its `View`
via `onLayout` instead.

Scale limits adapt to the container in responsive modes: `"preserve-viewport"`
scales `minScale` with the base scale (a zoom-out factor of the configured
`scale`), and `"preserve-scale"` lowers the minimum limit to the scale at
which finite `bounds` fit the viewport (never raising it above the current
scale). `maxScale` stays absolute in both modes - a px-per-tile quality cap,
lifted only when a preserve-viewport base scale exceeds it. The camera
therefore never lands outside the gesture-reachable zoom range after a resize.

When a `"preserve-viewport"` resize changes the scale, `onZoom` fires with the
new value (like wheel/pinch and programmatic zooms), so scale-threshold logic
keeps working. The initial responsive sizing runs during engine construction
before callbacks attach - read the starting value with `engine.getScale()`
after mount.

### Zoom anchor

`zoom: "pointer"` (or `true`) zooms toward the cursor / pinch midpoint.
`zoom: "center"` zooms toward the viewport center. `false` disables zoom.

## Engine methods

### Lifecycle and frame

| Signature | Notes |
| :-- | :-- |
| `render(): void` | Paint one frame. Needed after initial draw registration and after data mutation. Camera changes (drag/zoom/goCoords/...) render automatically. |
| `destroy(): void` | Cancel animations, remove listeners/observers. Call on teardown (React does this on unmount). |

### Camera and viewport

| Signature | Notes |
| :-- | :-- |
| `getCenterCoords(): Coords` | Current world center. |
| `updateCoords(center: Coords): void` | Jump to a new center instantly. Throws on non-finite values. |
| `goCoords(x, y, durationMs = 500, onComplete?): void` | Animated smooth move. `durationMs: 0` = instant. |
| `getScale(): number` | Current scale (px per world unit). |
| `setScale(n): void` | Set scale directly, clamped to min/max. |
| `goScale(n, durationMs = 500, onComplete?): void` | Animated smooth zoom to a target scale, clamped to min/max. Anchored at the viewport center. `durationMs: 0` = instant. |
| `zoomIn(factor = 1.5): void` / `zoomOut(factor = 1.5): void` | Zoom around viewport center. |
| `getSize(): { width, height }` | Current logical canvas size in px. |
| `resize(w, h, durationMs = 500, onComplete?): void` | Animated resize keeping the view centered. Warns and no-ops when `responsive` is enabled. |
| `getVisibleBounds(): { minX, maxX, minY, maxY }` | Which world cells are visible (floored/ceiled). |
| `setBounds(bounds): void` | Restrict camera movement; clamps current position immediately. Infinity removes a limit. |
| `getConfig(): Required<CanvasTileEngineConfig>` | Normalized config snapshot with live scale/size. |
| `setEventHandlers(partial): void` | Toggle interactions at runtime, e.g. `{ drag: false, hover: true }`. |

### Draw methods

All return a `DrawHandle` (`{ id: symbol, layer: number }`). Full item shapes
and semantics: [drawing.md](drawing.md).

| Signature | Default layer |
| :-- | :-- |
| `drawRect(items: Rect \| Rect[], layer?)` | 1 |
| `drawCircle(items: Circle \| Circle[], layer?)` | 1 |
| `drawImage(items: ImageItem \| ImageItem[], layer?)` | 1 |
| `drawText(items: Text \| Text[], layer?)` | 2 |
| `drawLine(items: Line \| Line[], style?: LineStyle, layer?)` | 1 |
| `drawPath(items: Path \| Path[], style?: LineStyle, layer?)` | 1 |
| `drawGridLines(cellSize: number, lineWidth = 1, strokeStyle = "black", layer = 0)` | 0 |
| `drawStaticRect(items: Rect[], cacheKey: string, layer?)` | 1 |
| `drawStaticCircle(items: Circle[], cacheKey: string, layer?)` | 1 |
| `drawStaticImage(items: ImageItem[], cacheKey: string, layer?)` | 1 |
| `addDrawFunction(fn: (ctx, topLeft: Coords, config) => void, layer?)` | 1 |

### Draw management

| Signature | Notes |
| :-- | :-- |
| `removeDrawHandle(handle: DrawHandle): void` | Remove one registered draw callback. |
| `clearLayer(layer: number): void` | Remove every callback on a layer. |
| `clearAll(): void` | Remove all callbacks on all layers. |
| `clearStaticCache(cacheKey?: string): void` | Drop one or all pre-rendered static caches (forces rebuild next frame). |

### Hit testing

| Signature | Notes |
| :-- | :-- |
| `hitTest<TData>(point: Coords, opts?: { layer?: number; padding?: number; paddingPx?: number }): HitResult<TImage, TData>[]` | All rect/circle/image items under a world point, highest visual priority first (higher layer, later registration, later item). |
| `hitTestFirst<TData>(point: Coords, opts?): HitResult<TImage, TData> \| undefined` | Topmost item only. |

`HitResult` = `{ item, kind: "rect"|"circle"|"image", layer, handle, index }`;
`item` is the exact object passed to the draw call. Every drawable item
accepts an optional `data?: TData` field the engine never reads - attach app
data there and read it back as `hit.item.data`. The `TData` type parameter
types that field (assertion only, no runtime check). Prefer `data` over
`index` for identity: `index` is the position in the array at draw time and
goes stale when a filtered/re-ordered array is re-drawn. Pass `coords.raw`
from event callbacks; origin anchoring, non-square Rect `width`/`height`,
image aspect fit, and rotation are handled internally - the hit box is always
the drawn box. Covers `drawStatic*` variants too; Line/Path/Text are NOT
hit-testable. Position mutations require re-registration to be reflected
(same rule as rendering). 500+ item draw calls are queried via a spatial
index - hover-frequency use is fine at scale.

The hit area is exactly the drawn geometry by default; expand it for generous
touch targets with `padding` (world units) and/or `paddingPx` (screen pixels,
zoom-independent, converted with the current scale per query). Both expand
every tested item outward and combine additively; negative values are 0. Use
these instead of registering invisible oversized "halo" items.

```ts
engine.drawRect(stations.map((s) => ({ x: s.x, y: s.y, size: 1, data: s })), 2);
engine.onClick = (coords) => {
    // Small station dots stay clickable up to 0.6 units around each center
    const hit = engine.hitTestFirst<Station>(coords.raw, { padding: 0.6 });
    if (hit?.item.data) openPanel(hit.item.data);
};
```

### Event callbacks (assign as properties)

```ts
engine.onClick      = (coords, mouse, client) => {};
engine.onRightClick = (coords, mouse, client) => {};  // DOM only
engine.onHover      = (coords, mouse, client) => {};
engine.onMouseDown  = (coords, mouse, client) => {};
engine.onMouseUp    = (coords, mouse, client) => {};
engine.onMouseLeave = (coords, mouse, client) => {};
engine.onCoordsChange = (center: Coords) => {};       // any camera movement
engine.onZoom       = (scale: number) => {};          // any scale change
engine.onWheel      = (coords, mouse, client, wheel) => {}; // wheel/pinch zoom
                                       // gesture; wheel = { deltaY, direction, source }
engine.onResize     = () => {};
engine.onDraw       = (ctx, coords, config, transform) => {}; // after each frame,
                                       // same signature as addDrawFunction (drawing.md)
```

Payload details and patterns: [events.md](events.md).

## Image loading

`engine.images` is the renderer's `IImageLoader<TImage>`:

```ts
interface IImageLoader<TImage> {
    load(src: string, retry?: number): Promise<TImage>; // cached; retry default 1
    get(src: string): TImage | undefined;               // cache lookup, no load
    has(src: string): boolean;
    clear(): void;
    onLoad(cb: () => void): () => void;                 // returns unsubscribe
}
```

`TImage` is `HTMLImageElement` on web, `SkImage` on React Native, and the
`@napi-rs/canvas` `Image` on the server (paths, `file://`, `http(s)://` and
`data:` URIs supported there).

```ts
const img = await engine.images.load("/assets/tile.png");
engine.drawImage({ x: 0, y: 0, size: 1, img }, 1);
engine.render();
```

## Utilities

### `gridToSize` - think in cells instead of pixels

Returns `{ size, scale, center }` where `center = ((columns-1)/2, (rows-1)/2)`
is the exact center of a board of cells `0..N-1` (integers are cell centers -
see [drawing.md](drawing.md)). ALWAYS pass this center to the engine;
without it the board renders mostly off-screen.

```ts
import { gridToSize } from "@canvas-tile-engine/core";

const { center, ...board } = gridToSize({ columns: 8, rows: 8, cellSize: 60 });
// board => size {480,480}, scale 60; center => { x: 3.5, y: 3.5 }

const engine = new CanvasTileEngine(wrapper, {
    ...board,
    gridAligned: true,
    eventHandlers: { click: true, hover: true, drag: false, zoom: false },
}, new RendererCanvas(), center);
```

Perfect for fixed boards (chess, match-3, minesweeper): a known number of
cells fully visible, often with `drag`/`zoom` disabled. On core versions
before 0.5 `gridToSize` has no `center` field - compute
`{ x: (columns-1)/2, y: (rows-1)/2 }` manually.

## Exported types and classes (import from `@canvas-tile-engine/core`)

Values: `CanvasTileEngine`, `SpriteSheet`, `SpriteAnimator`, `gridToSize`,
`SpatialIndex`, `Config`, `ViewportState`, `CoordinateTransformer`,
`GestureProcessor`, `AnimationController`.

Types: `CanvasTileEngineConfig`, `Coords`, `Bounds`, `DrawObject`, `Rect`,
`Circle`, `Text`, `Line`, `Path`, `ImageItem<TImage>`, `SpriteRect`,
`SpriteSheetOptions`, `SpriteAnimation`, `EventHandlers`, `ZoomMode`,
`DrawHandle`, `LineStyle`, `TextAlign`, `TextBaseline`, `IRenderer`,
`IDrawAPI`, `IImageLoader`, `ICamera`, `RendererDependencies`, plus all
callback types (`onClickCallback`, `onHoverCallback`, ...).

The module classes (`Config`, `GestureProcessor`, ...) are exported for
renderer authors; app code normally only needs `CanvasTileEngine`,
`SpriteSheet`, `SpriteAnimator`, `gridToSize`, and the types.

## Validation errors

`scale` must be a positive finite number and coordinates finite numbers;
`setScale`, `goScale`, `updateCoords`, and `goCoords` throw
`ConfigValidationError` otherwise. Config normalization fills every optional field with the defaults
listed above.
