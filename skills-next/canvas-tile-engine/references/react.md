# React Web Reference

Package: `@canvas-tile-engine/react` (+ `@canvas-tile-engine/core` + a
browser renderer). Two styles that mix freely: declarative compound
components as children, and the imperative `EngineHandle` from the hook.

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react @canvas-tile-engine/renderer-canvas
```

Contents:

- [Component and hook](#component-and-hook)
- [The `EngineHandle`](#the-enginehandle)
- [Compound draw components](#compound-draw-components)
- [Types: binding or core](#types-binding-or-core)
- [Styling by state (`styleOf`)](#styling-by-state-styleof)
- [Hover highlight](#hover-highlight)
- [Updating drawn data](#updating-drawn-data)
- [Loading images in React](#loading-images-in-react)
- [Pitfalls checklist](#pitfalls-checklist)

## Component and hook

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

function Map() {
    const engine = useCanvasTileEngine(); // stable handle, safe before mount

    return (
        <CanvasTileEngine
            engine={engine} // REQUIRED
            renderer={new RendererCanvas()} // REQUIRED, read once on mount
            config={config} // REQUIRED, read once on mount
            center={{ x: 0, y: 0 }} // optional, read once on mount
            className="map" // wrapper div class
            style={{ borderRadius: 8 }} // wrapper div styles
            onClick={(coords, mouse, client, info) => {}} // info: core >= 0.12
            onRightClick={(coords, mouse, client) => {}}
            onHover={(coords, mouse, client) => {}}
            onMouseDown={(coords, mouse, client) => {}}
            onMouseUp={(coords, mouse, client) => {}}
            onMouseLeave={(coords, mouse, client) => {}}
            onCoordsChange={(center) => {}}
            onZoom={(scale) => {}}
            onWheel={(coords, mouse, client, wheel) => {}}
            onResize={() => {}}
            onDraw={(ctx, topLeft, config, transform) => {}}
        >
            {/* declarative draw children */}
        </CanvasTileEngine>
    );
}
```

Payloads: [events.md](events.md#pointer-callback-payload). Which
`eventHandlers` flag gates which callback:
[events.md](events.md#flags-and-the-callbacks-they-gate).

### Lifecycle rules

- `config`, `renderer` and `center` are read ONCE when the engine mounts;
  later prop changes are ignored. To apply a whole new config or renderer,
  remount with a `key`:

```tsx
<CanvasTileEngine key={rendererName} engine={engine} config={config} renderer={makeRenderer(rendererName)} />
```

- For dynamic changes use the runtime APIs instead: `setCenter`/`goCenter`,
  `setScale`/`goScale`/`zoomIn`/`zoomOut`, `setScaleLimits`, `fitBounds`,
  `setBounds`, `setEventHandlers`, `resize`, `setAccessibility`,
  `setReducedMotion`.
- Accessibility (core >= 0.12) follows the same rule: a name set in
  `config.accessibility` can only change later through
  `engine.setAccessibility(patch)`. Reduced motion: `engine.setReducedMotion`
  / `getReducedMotion()` (`false` before mount, poll-only). Fields, role
  choice and what reduced motion covers:
  [core-api.md](core-api.md#accessibility-and-reduced-motion); keys:
  [events.md](events.md#keyboard-camera-control).
- Event callback props CAN change freely - they are read through refs, the
  engine is not recreated.
- The engine is destroyed on unmount. StrictMode's dev double-mount
  destroys the first engine and creates a second; the handle follows it.

## The `EngineHandle`

`useCanvasTileEngine()` returns a referentially stable handle exposing the
full engine API ([core-api.md](core-api.md)). Before mount every method is a
safe no-op: draw methods return a dummy handle (and `console.warn` in dev),
getters return defaults, `fitBounds` returns `undefined`, `loadImage`
rejects. Work done before mount is LOST, so do imperative setup in an effect
keyed on `engine.instance`:

```tsx
const engine = useCanvasTileEngine();

useEffect(() => {
    if (!engine.instance) return; // null until this engine mounts
    const grid = engine.drawGridLines(1, 1, "#1e293b", 0);
    engine.render();
    return () => engine.removeDrawHandle(grid);
}, [engine, engine.instance]);
```

- Key on `engine.instance`, not `engine.isReady`. `instance` changes
  identity with every engine; `isReady` flips true -> false -> true inside
  one flush on a `key` remount, so an `[engine.isReady]` effect never
  re-fires and the new canvas stays blank.
- Always make the body idempotent: return a cleanup that removes what it
  registered, or register with an `id` (same id replaces). An effect keyed
  on `engine.instance` or `engine.isReady` can run twice as the engine
  attaches - on the web it fires in the commit that attaches the engine AND
  again on the re-render that follows - StrictMode adds a second engine,
  and any other dep re-runs it on the same engine. Without cleanup or id,
  the first mount alone registers everything twice (painted and hit-tested
  twice); in development the handle warns once when the same items land on
  the same layer twice without an `id`.

Mount-time reads (the responsive start scale, live zoom limits for a
slider) belong in such an effect too: before mount `getConfig()` answers
with frozen placeholder defaults for an UNCONFIGURED engine (`scale: 1`,
size 0x0, `minScale`/`maxScale` `0.5`/`2`), not your `config`. `onZoom`
delivers every later scale change; re-read limits in `onResize` when a
responsive mode adapts them. Worked example:
[recipes.md](recipes.md#3-pixel-painter-react).

Handle members beyond the core engine API:

| Member | Notes |
| :-- | :-- |
| `isReady: boolean` | False until mount. Fine for render-time checks (disable a toolbar); key effects on `instance`. |
| `instance` | The raw core `CanvasTileEngine` or `null`. Effect key and escape hatch. |
| `images` | The image loader, `undefined` before mount. |
| `loadImage(src, retry?)` | `Promise<HTMLImageElement>`; rejects before mount. |
| `resize(w, h, durationMs?, onComplete?)` | Web handle only (RN sizes by layout). No-op in responsive modes. |

One handle per `<CanvasTileEngine>`: two canvases (main map + minimap) need
two `useCanvasTileEngine()` calls. One handle can drive many concerns
(toolbar buttons calling `engine.zoomIn()`, effects calling
`engine.goCenter(...)`) without prop drilling the instance.

## Compound draw components

All render `null` and register through the engine in context:

- Register on mount and when a registration prop changes, remove their own
  handle on unmount, batch repaints through one `requestAnimationFrame`.
- `items` is compared BY REFERENCE: a new array identity re-registers (and
  rebuilds the spatial index for 500+ items). Keep items in `useMemo` or
  state, never inline literals.
- `styleOf`/`visibleOf`/`interactiveOf` are read through refs: identity may
  change every render (inline arrows are fine) and a change only repaints.
- `clip={{ minX, maxX, minY, maxY }}` (core >= 0.12, every component) is
  compared BY VALUE, so an inline literal is fine. Semantics:
  [drawing.md](drawing.md#clipping-a-registration).
- `hitTest={false}` keeps a component's items out of `hitTest`/
  `hitTestRect` queries (decorative floors, overlays).
- They find the engine through context, so they work at any depth: inside
  Fragments, conditionals, `.map()` and your own wrapper components.
  Outside a `<CanvasTileEngine>` they throw.
- Children mount only after their engine exists. A custom child can call
  `useEngineContext()` (`{ engine, requestRender }`) and register in a plain
  `[engine]` effect - still return a cleanup.
- Non-draw children (a tooltip, HUD or legend `<div>`) render AFTER the
  wrapper div, not inside or over it. For an overlay, put
  `<CanvasTileEngine>` and the overlay in a shared `position: relative`
  parent and position the overlay absolutely:
  [drawing.md](drawing.md#screen-fixed-overlays-hud-legend-labels-pinned-to-the-viewport).

| Component | Props (defaults) |
| :-- | :-- |
| `<CanvasTileEngine.Rect>` | `items: Rect \| Rect[]`, `layer = 1`, `styleOf?`, `visibleOf?`, `interactiveOf?`, `hitTest?` |
| `<CanvasTileEngine.Circle>` | `items: Circle \| Circle[]`, `layer = 1`, `styleOf?`, `visibleOf?`, `interactiveOf?`, `hitTest?` |
| `<CanvasTileEngine.Image>` | `items: ImageItem \| ImageItem[]`, `layer = 1`, `visibleOf?`, `interactiveOf?`, `hitTest?` |
| `<CanvasTileEngine.Text>` | `items: Text \| Text[]`, `layer = 2`, `styleOf?`, `visibleOf?` |
| `<CanvasTileEngine.Line>` | `items: Line \| Line[]`, `style?: LineStyle`, `layer = 1`, `styleOf?`, `visibleOf?`, `interactiveOf?`, `hitTest?` |
| `<CanvasTileEngine.Path>` | `items: PathItem \| PathItem[]`, `layer = 1`, `styleOf?`, `visibleOf?`, `interactiveOf?`, `hitTest?` |
| `<CanvasTileEngine.GridLines>` | `cellSize: number`, `lineWidth = 1`, `strokeStyle = "black"`, `layer = 0` |
| `<CanvasTileEngine.StaticRect>` | `items: Rect[]`, `cacheKey: string`, `layer = 1`, `hitTest?` |
| `<CanvasTileEngine.StaticCircle>` | `items: Circle[]`, `cacheKey: string`, `layer = 1`, `hitTest?` |
| `<CanvasTileEngine.StaticImage>` | `items: ImageItem[]`, `cacheKey: string`, `layer = 1`, `hitTest?` |
| `<CanvasTileEngine.Sprite>` | `items: ImageItem \| ImageItem[]`, `frames: SpriteRect[]`, `fps: number`, `loop = true`, `playing = true`, `layer = 1`, `onComplete?`, `hitTest?` |
| `<CanvasTileEngine.DrawFunction>` | `children: (ctx, topLeft, config, transform) => void`, `layer = 1` |

Item shapes are identical to the core draw API: [drawing.md](drawing.md).
Sprite semantics: [sprites.md](sprites.md). Static components drop their
cache automatically when `items` gets a new identity or `cacheKey` changes
(no manual `clearStaticCache`), and an empty `items` array registers
nothing. How static caches behave on zoom, per renderer:
[drawing.md](drawing.md#static-caching-drawstaticrect--drawstaticcircle--drawstaticimage).

```tsx
<CanvasTileEngine.DrawFunction layer={5}>
    {(ctx, topLeft, config, transform) => {
        const c = ctx as CanvasRenderingContext2D;
        const p = transform.worldToScreen(0, 0); // item space: center of cell (0, 0)
        c.fillStyle = "rgba(255,255,255,0.6)";
        c.fillRect(p.x - config.scale / 2, p.y - config.scale / 2, config.scale, config.scale);
    }}
</CanvasTileEngine.DrawFunction>
```

A new `children` function identity repaints (never re-registers); wrap it
in `useCallback` to skip those repaints. Arguments and rules:
[drawing.md](drawing.md#custom-draw-functions).

## Types: binding or core

Import from `@canvas-tile-engine/react` (re-exported):

- Components and hooks: `CanvasTileEngine`, `useCanvasTileEngine`,
  `useEngineContext`; types `EngineHandle`, `EngineContextValue`,
  `CanvasTileEngineProps`, `RectProps` ... `DrawFunctionProps`.
- Config and items: `CanvasTileEngineConfig`, `EventHandlers`, `Coords`,
  `DrawObject`, `Rect`, `Circle`, `Text`, `Line`, `LineStyle`, `PathItem`,
  `PathStyle`, `PathCommand`, `ImageItem`, `SpriteRect`, `DrawHandle`.
- Callbacks: `onClickCallback`, `onRightClickCallback`, `onHoverCallback`,
  `onMouseDownCallback`, `onMouseUpCallback`, `onMouseLeaveCallback`,
  `onWheelCallback`, `onZoomCallback`, `onDrawCallback`, `WheelInfo`.
- Helpers: `gridToSize`, `fitScale`, `itemsBounds` and `pathItemBounds`
  (core >= 0.12), `pathCommandsBounds`, `SpriteSheet`, `SpriteAnimator`,
  `CanvasTileEngineCore` (the engine class); types `FitBoundsResult`
  (core >= 0.12), `FitScaleOptions`, `BoundedItem`, `SpriteSheetOptions`,
  `SpriteAnimation`.

Import from `@canvas-tile-engine/core` (NOT re-exported): `Bounds`,
`LinearGradient`, `Paint`, `ColorStop`, `HitResult`, `HitTestOptions`,
`ClickInfo`, `FitBoundsOptions`, `AccessibilityConfig`, `StyleOf`, and the
`*DrawOptions` / `*DecorationStyle` types.

Generics: item types take a `data` type (`Rect<TData>`). The handle's
`engine.drawRect(items, ...)` infers it from the items, so its `styleOf`
sees typed `item.data`. Component callbacks are typed against `Rect<any>`,
so `item.data` is `any` there - annotate the parameter (`(s: Rect<Seat>) =>
...`) to get checking back. `data` is optional: write `s.data?.id`.

## Styling by state (`styleOf`)

Selection/hover/highlight must NOT go through derived `items` (the classic
`useMemo(() => items.map(...), [items, selected])` re-registers and rebuilds
the spatial index on every selection change). Pass `styleOf`: it runs per
item at paint time and overlays the item's own style.

```tsx
type Seat = { id: string };

function SeatMap({ seats }: { seats: Rect<Seat>[] }) { // stable: state or useMemo upstream
    const engine = useCanvasTileEngine();
    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

    const toggle: onClickCallback = (coords) => {
        const id = engine.hitTestFirst<Seat>(coords.raw)?.item.data?.id;
        if (!id) return;
        setSelected((prev) => {
            const next = new Set(prev);
            if (!next.delete(id)) next.add(id);
            return next;
        });
    };

    return (
        // config needs eventHandlers: { click: true }
        <CanvasTileEngine engine={engine} renderer={renderer} config={config} onClick={toggle}>
            <CanvasTileEngine.Rect
                items={seats} // geometry only: never re-registers on selection
                styleOf={(s: Rect<Seat>) =>
                    s.data && selected.has(s.data.id) ? { fillStyle: "#2563eb" } : undefined
                }
            />
        </CanvasTileEngine>
    );
}
```

Contract: `items` changed = geometry changed = re-register (memoize it);
`styleOf` changed = appearance changed = repaint only. `visibleOf`
(`false` = not painted, not hit-testable - category filters) and
`interactiveOf` (`false` = painted, skipped by hit queries) follow the same
model. `<Image>` has both but no `styleOf`; `<Text>` has no
`interactiveOf`; statics take none. What each primitive's `styleOf` may
change (Line/Path cannot change width):
[drawing.md](drawing.md#styleof-visibleof-interactiveof).

## Hover highlight

Hover fires many times per second: keep it out of React state. Both
patterns need `eventHandlers.hover: true` (web only; RN has no hover).

A. Highlight the ITEM under the pointer: a ref read by `styleOf`, plus
`engine.render()` - no React render per move.

```tsx
const hovered = useRef<string | undefined>(undefined);

const onHover: onHoverCallback = (coords) => {
    const id = engine.hitTestFirst<Seat>(coords.raw)?.item.data?.id;
    if (id === hovered.current) return; // repaint only on change
    hovered.current = id;
    engine.render();
};
// <CanvasTileEngine onHover={onHover}
//     onMouseLeave={() => { hovered.current = undefined; engine.render(); }} ...>
<CanvasTileEngine.Rect
    items={seats}
    styleOf={(s: Rect<Seat>) =>
        hovered.current !== undefined && s.data?.id === hovered.current
            ? { strokeStyle: "#f59e0b", lineWidthPx: 2 }
            : undefined
    }
/>;
```

B. Highlight the CELL under the pointer: an id-registered overlay on its
own layer, through the handle - the vanilla code from
[events.md](events.md#pattern-hover-highlight) unchanged, passed as the
`onHover`/`onMouseLeave` props: `engine.drawRect({ x: coords.snapped.x, y:
coords.snapped.y, size: 1, style }, 10, { id: "hover", hitTest: false })`
then `engine.render()`; on leave, re-register `[]` under the same id.

Declarative children and imperative registrations coexist, even on one
layer: components remove only their own handles, and ids are yours. A
separate layer keeps paint order predictable (a component that re-registers
moves to the end of its layer). The one hazard is `clearLayer`/`clearAll`
on a layer components use: it removes their registrations and they do not
come back until their props change. Imperative registrations belong to the
engine instance - a `key` remount drops them (redo persistent ones in an
`engine.instance` effect).

## Updating drawn data

Declarative: keep items in state; a new array swaps the drawn content.
Right for occasional geometry changes:

```tsx
const [tiles, setTiles] = useState<Rect[]>([]);

const addTile: onClickCallback = (coords) =>
    setTiles((prev) => [...prev, { x: coords.snapped.x, y: coords.snapped.y, size: 1, style: { fillStyle: "#38bdf8" } }]);

<CanvasTileEngine engine={engine} config={config} renderer={renderer} onClick={addTile}>
    <CanvasTileEngine.Rect items={tiles} layer={1} />
</CanvasTileEngine>;
```

For changes on every pointer move (painting) or every frame, keep stable
items and change appearance through a ref + `styleOf`/`visibleOf` +
`engine.render()` ([recipes.md](recipes.md#3-pixel-painter-react)), or
mutate registered items and `render()` ([drawing.md](drawing.md)).

## Loading images in React

```tsx
const [img, setImg] = useState<HTMLImageElement | null>(null);

useEffect(() => {
    if (!engine.instance) return;
    let live = true;
    engine.loadImage("/assets/terrain.png").then((i) => live && setImg(i));
    return () => {
        live = false;
    };
}, [engine, engine.instance]);

const items = useMemo<ImageItem[]>(() => (img ? [{ x: 0, y: 0, size: 2, img }] : []), [img]);
// <CanvasTileEngine.Image items={items} layer={1} />
```

Cross-origin images: `new RendererCanvas({ crossOrigin: "anonymous" })`
(core >= 0.12), see [core-api.md](core-api.md#cors-on-the-browser-renderers).

## Pitfalls checklist

- Inline `items={[...]}` literal: re-registers every render. Use
  `useMemo`/state.
- Selection/hover styling derived into `items`: re-registers + index rebuild
  per click. Use `styleOf`.
- Hover kept in React state: one React render per cell crossed. Use a ref +
  `engine.render()` or an id overlay ([Hover highlight](#hover-highlight)).
- Expecting `config`/`center`/`renderer` prop changes to apply: remount with
  `key` or use runtime APIs.
- Imperative effects keyed on `[engine.isReady]` (blank after a `key`
  remount) or without cleanup/id (duplicate registrations from the first
  mount on). Key on `[engine, engine.instance]` and clean up or pass an `id`.
- One handle for two `<CanvasTileEngine>` mounts: each needs its own
  `useCanvasTileEngine()`.
- Forgetting `eventHandlers` in config: canvas renders, nothing responds.
- `clearAll()`/`clearLayer()` on layers declarative children use.
- Expecting non-draw children (a legend `<div>`) to overlay the canvas: they
  render after the wrapper div. Use a shared positioned parent
  ([Compound draw components](#compound-draw-components)).
- `responsive: "fill"` with a parent of no definite height: the component's
  own div is the wrapper, so size its PARENT.
