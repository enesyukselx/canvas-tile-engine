# React Web Reference

Package: `@canvas-tile-engine/react` (+ `@canvas-tile-engine/core` + a
browser renderer). Two usage styles that freely mix: declarative compound
components as children, and the imperative `EngineHandle` from the hook.

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react @canvas-tile-engine/renderer-canvas
```

## Component and hook

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

function Map() {
    const engine = useCanvasTileEngine();   // stable handle, safe before mount

    return (
        <CanvasTileEngine
            engine={engine}                  // REQUIRED
            renderer={new RendererCanvas()}  // REQUIRED, read once on mount
            config={config}                  // REQUIRED, read once on mount
            center={{ x: 0, y: 0 }}          // optional, read once on mount
            className="map"                  // wrapper div class
            style={{ borderRadius: 8 }}      // wrapper div styles
            onClick={(coords, mouse, client) => {}}
            onRightClick={(coords, mouse, client) => {}}
            onHover={(coords, mouse, client) => {}}
            onMouseDown={(coords, mouse, client) => {}}
            onMouseUp={(coords, mouse, client) => {}}
            onMouseLeave={(coords, mouse, client) => {}}
            onCoordsChange={(center) => {}}
            onZoom={(scale) => {}}
            onResize={() => {}}
            onDraw={(ctx, info) => {}}
        >
            {/* declarative draw children */}
        </CanvasTileEngine>
    );
}
```

### Lifecycle rules

- `config`, `renderer`, and `center` are read ONCE when the engine mounts.
  Later prop changes are ignored. To apply a whole new config or renderer,
  remount with a `key`:

```tsx
<CanvasTileEngine key={rendererName} renderer={makeRenderer(rendererName)} ... />
```

- For dynamic changes use runtime APIs instead: `engine.setBounds`,
  `engine.setEventHandlers`, `engine.updateCoords`, `engine.goCoords`,
  `engine.setScale`, `engine.resize`.
- Event callback props CAN change freely - they are kept fresh via refs
  without re-creating the engine.
- The engine is destroyed automatically on unmount.

## The `EngineHandle`

`useCanvasTileEngine()` returns a referentially stable handle exposing the
full engine API. Before the component mounts every method is a safe no-op
(draw methods return a dummy handle; getters return defaults), so no null
checks are needed - but work done before mount is LOST, so gate imperative
setup on `isReady`:

```tsx
const engine = useCanvasTileEngine();

useEffect(() => {
    if (!engine.isReady) return;
    engine.drawGridLines(1);
    engine.render();
}, [engine.isReady]);   // isReady flips true exactly once after mount
```

With `responsive: "preserve-viewport"`, track scale via `onZoom` PLUS an
initial read - the first responsive sizing runs inside the engine
constructor, before callbacks attach, so `onZoom` cannot deliver it:

```tsx
const [scale, setScale] = useState(config.scale);
useEffect(() => {
    if (map.isReady) setScale(map.getScale()); // real mount-time scale
}, [map, map.isReady]);
// ...
<CanvasTileEngine onZoom={setScale} ... />  // all later changes (gesture,
                                            // programmatic, responsive resize)
```

Handle members beyond the core engine API (see
[core-api.md](core-api.md) for the shared methods):

| Member | Notes |
| :-- | :-- |
| `isReady: boolean` | False until the engine mounts. Valid `useEffect` dependency. |
| `instance` | The raw `CanvasTileEngine` instance or `null`. Escape hatch. |
| `images` | The image loader, `undefined` before mount. |
| `loadImage(src, retry?)` | `Promise<HTMLImageElement>`; rejects if called before ready. |

The same handle can drive multiple concerns (toolbar buttons calling
`engine.zoomIn()`, effects calling `engine.goCoords(...)`) without prop
drilling the instance around. One handle per `<CanvasTileEngine>`; create two
handles for two canvases (e.g. main map + minimap).

## Compound draw components (all render `null`; must be children of `<CanvasTileEngine>`)

Common behavior: registers its draw call on mount / when props change,
removes its handle on unmount, and batches repaints through a single
`requestAnimationFrame`. `items` props are compared BY REFERENCE - a new
array identity re-registers the callback and rebuilds the spatial index for
500+ items. Keep items in `useMemo` or state, never inline literals.

| Component | Props (defaults) |
| :-- | :-- |
| `<CanvasTileEngine.Rect>` | `items: Rect \| Rect[]`, `layer = 1` |
| `<CanvasTileEngine.Circle>` | `items: Circle \| Circle[]`, `layer = 1` |
| `<CanvasTileEngine.Image>` | `items: ImageItem \| ImageItem[]`, `layer = 1` |
| `<CanvasTileEngine.Text>` | `items: Text \| Text[]`, `layer = 2` |
| `<CanvasTileEngine.Line>` | `items: Line \| Line[]`, `style?: { strokeStyle?, lineWidth? }`, `layer = 1` |
| `<CanvasTileEngine.Path>` | `items: Path \| Path[]`, `style?: { strokeStyle?, lineWidth? }`, `layer = 1` |
| `<CanvasTileEngine.GridLines>` | `cellSize: number`, `lineWidth = 1`, `strokeStyle = "black"`, `layer = 0` |
| `<CanvasTileEngine.StaticRect>` | `items: Rect[]`, `cacheKey: string`, `layer = 1` |
| `<CanvasTileEngine.StaticCircle>` | `items: Circle[]`, `cacheKey: string`, `layer = 1` |
| `<CanvasTileEngine.StaticImage>` | `items: ImageItem[]`, `cacheKey: string`, `layer = 1` |
| `<CanvasTileEngine.Sprite>` | `items: ImageItem \| ImageItem[]`, `frames: SpriteRect[]`, `fps: number`, `loop = true`, `playing = true`, `layer = 1`, `onComplete?` |
| `<CanvasTileEngine.DrawFunction>` | `children: (ctx, topLeft, config) => void`, `layer = 1` |

Item shapes are identical to the core draw API: [drawing.md](drawing.md).
Sprite semantics: [sprites.md](sprites.md).

```tsx
<CanvasTileEngine.DrawFunction layer={5}>
    {(ctx, topLeft, config) => {
        const c = ctx as CanvasRenderingContext2D;
        c.fillStyle = "rgba(255,255,255,0.6)";
        c.fillRect((0 - topLeft.x) * config.scale, (0 - topLeft.y) * config.scale, config.scale, config.scale);
    }}
</CanvasTileEngine.DrawFunction>
```

## Updating drawn data

Declarative: put items in state; setting new state (new array reference)
swaps the drawn content automatically.

```tsx
const [tiles, setTiles] = useState<Rect[]>([]);

const paint = (coords: ProcessedClick) =>
    setTiles((prev) => [...prev, { x: coords.snapped.x, y: coords.snapped.y, size: 1,
                                   style: { fillStyle: "#38bdf8" } }]);

<CanvasTileEngine engine={engine} config={config} renderer={renderer}
                  onClick={(coords) => paint(coords)}>
    <CanvasTileEngine.Rect items={tiles} layer={1} />
</CanvasTileEngine>
```

For very hot updates (60fps animation over huge arrays), prefer the mutation
pattern through the handle (`engine.drawRect` once + mutate + `engine.render()`)
to avoid array recreation - see [drawing.md](drawing.md).

## Loading images in React

```tsx
const [img, setImg] = useState<HTMLImageElement | null>(null);

useEffect(() => {
    if (!engine.isReady) return;
    engine.loadImage("/assets/terrain.png").then(setImg);
}, [engine.isReady]);

const items = useMemo(() => (img ? [{ x: 0, y: 0, size: 2, img }] : []), [img]);
// ...
<CanvasTileEngine.Image items={items} layer={1} />
```

## Pitfalls checklist

- Inline `items={[...]}` literal: re-registers every render. Use
  `useMemo`/state.
- Expecting `config`/`center`/`renderer` prop changes to apply: they will not;
  remount with `key` or use runtime APIs.
- Imperative drawing without gating on `engine.isReady`: silently no-ops.
- Creating one handle for two `<CanvasTileEngine>` mounts: each canvas needs
  its own `useCanvasTileEngine()`.
- Forgetting `eventHandlers` in config: canvas renders but nothing responds.
- Mixing declarative children and `clearAll()`/`clearLayer()` on the same
  layers: the imperative clear removes the components' registered callbacks
  and they will not re-register until their props change. Keep imperative
  layer management on layers the components do not use.
