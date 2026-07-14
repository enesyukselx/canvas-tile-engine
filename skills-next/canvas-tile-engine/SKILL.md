---
name: canvas-tile-engine
description: >-
  Build apps with the @canvas-tile-engine npm packages: zoomable/pannable 2D
  tile maps, game boards, minimaps, pixel editors, spritesheet animations, and
  data-heavy grid UIs. Use when a task involves any @canvas-tile-engine package
  (core, react, react-native, renderer-canvas, renderer-webgl, renderer-skia,
  renderer-server) or when building an interactive tile/grid canvas surface in
  vanilla JS, React, React Native, or server-side PNG/JPEG/WebP image
  rendering. This library is NOT in LLM training data - always follow this
  skill instead of guessing the API.
---

# Canvas Tile Engine

Canvas Tile Engine is a renderer-agnostic TypeScript engine for zoomable 2D
grid surfaces. The core package owns camera, coordinate transforms, gestures,
layers, culling, sprites, and the draw API. Renderer packages decide where
pixels go: HTML Canvas2D, WebGL, React Native Skia, or a headless Node.js
image buffer.

IMPORTANT: Do not invent API from memory. Every public signature you need is
in this skill and its `references/` files. If something is not documented
here, check the installed package's `.d.ts` files before using it.

## Package selection (decide first)

| You are building | Install | Docs |
| :-- | :-- | :-- |
| Vanilla JS/TS web app | `@canvas-tile-engine/core` + `@canvas-tile-engine/renderer-canvas` | [core-api](references/core-api.md), [drawing](references/drawing.md), [events](references/events.md) |
| Heavy web scene (50k+ dynamic items) | `@canvas-tile-engine/core` + `@canvas-tile-engine/renderer-webgl` | same as above + [performance](references/performance.md) |
| React web app | add `@canvas-tile-engine/react` | [react](references/react.md) |
| React Native app | `@canvas-tile-engine/core` + `@canvas-tile-engine/react-native` + `@canvas-tile-engine/renderer-skia` + `@shopify/react-native-skia` | [react-native](references/react-native.md) |
| Server-side images (OG images, thumbnails, snapshots) | `@canvas-tile-engine/core` + `@canvas-tile-engine/renderer-server` | [server](references/server.md) |

`RendererCanvas` and `RendererWebGL` are drop-in swaps of each other: change
`new RendererCanvas()` to `new RendererWebGL()` and nothing else. Default to
Canvas2D; switch to WebGL only for very heavy dynamic scenes (see
[performance](references/performance.md) for the one WebGL layering caveat).

## Mental model (read before writing any code)

1. **World units, not pixels - and integers are CELL CENTERS.** Item `x`,
   `y`, `size` are in world (tile) units. `config.scale` is pixels per world
   unit; zooming changes it between `minScale` and `maxScale`. Text `size` is
   also in world units (or use `fontPx` for a zoom-independent pixel size).
   The same rule covers styling: `lineWidth`, `radius`, and `lineDash` are
   world units that scale with zoom; the `lineWidthPx`/`lineDashPx` opt-ins
   are screen pixels and take precedence (GridLines' `lineWidth` is the one
   px exception).
   Crucially, an item at integer `k` is centered on its
   cell: cell `k` spans world `[k - 0.5, k + 0.5]`, grid lines fall on
   half-integers, and a board of cells `0..N-1` is centered at `(N-1)/2`
   (NOT `N/2` - that is half a cell off).
2. **Retained draw model.** `engine.drawRect(...)` does NOT paint immediately.
   It registers a persistent draw callback on a layer and returns a
   `DrawHandle`. The callback re-runs on every frame. Call `engine.render()`
   once after registering draws; pan/zoom re-render automatically.
3. **Repeat registration accumulates.** Calling `drawRect` again does not
   replace the previous call - both stay registered. To update content:
   remove the old handle (`removeDrawHandle`), or `clearLayer(n)` then
   redraw, or mutate the item objects you already passed and call `render()`
   (items are held by reference - mutation is the cheapest animation path).
4. **Layers are z-order.** Lower layer numbers draw first (underneath).
   Defaults: grid lines 0, shapes/images 1, text 2. Any integer works.
5. **All interaction is opt-in.** Every `eventHandlers` flag defaults to
   `false`. A map that should pan/zoom/click MUST set
   `eventHandlers: { drag: true, zoom: true, click: true }` explicitly.
6. **Culling is automatic.** Off-viewport items are skipped, and above 500
   items an R-tree spatial index kicks in. You can pass 100k items to a draw
   call; do not write your own visibility filtering.

## Minimal working examples

### Vanilla web (the wrapper div MUST contain a `<canvas>` child)

```html
<div id="map"><canvas></canvas></div>
```

```ts
import { CanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const config: CanvasTileEngineConfig = {
    scale: 48,                                // px per tile (required)
    size: { width: 800, height: 500 },        // canvas px (required)
    backgroundColor: "#0f172a",
    eventHandlers: { drag: true, zoom: "pointer", click: true, hover: true },
};

const engine = new CanvasTileEngine(
    document.getElementById("map") as HTMLDivElement,
    config,
    new RendererCanvas(),
    { x: 0, y: 0 },                           // initial world center
);

engine.drawGridLines(1, 1, "#1e293b", 0);
engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#22c55e" } }, 1);
engine.onClick = (coords) => console.log("tile:", coords.snapped);
engine.render();                              // one explicit first paint
```

### React web

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
import { useMemo } from "react";

export function Map() {
    const engine = useCanvasTileEngine();
    // Keep items referentially stable - inline literals re-register every render
    const tiles = useMemo(() => [{ x: 0, y: 0, size: 1, style: { fillStyle: "#22c55e" } }], []);

    return (
        <CanvasTileEngine
            engine={engine}
            renderer={new RendererCanvas()}
            config={{ scale: 48, size: { width: 800, height: 500 }, eventHandlers: { drag: true, zoom: true, click: true } }}
            onClick={(coords) => console.log(coords.snapped)}
        >
            <CanvasTileEngine.GridLines cellSize={1} strokeStyle="#1e293b" layer={0} />
            <CanvasTileEngine.Rect items={tiles} layer={1} />
        </CanvasTileEngine>
    );
}
```

### Server (Node.js, no DOM)

```ts
import { renderToBuffer } from "@canvas-tile-engine/renderer-server";

const png = await renderToBuffer({
    config: { scale: 40, size: { width: 480, height: 320 }, backgroundColor: "#0b1021" },
    pixelRatio: 2,
    draw: (engine) => {
        engine.drawGridLines(1, 1, "#1e2a45", 0);
        engine.drawRect({ x: 0, y: 0, size: 0.9, style: { fillStyle: "#4ade80" } }, 1);
    },
});
```

## Critical rules (violating these is the top source of broken output)

- **Vanilla mount**: the wrapper element passed to the constructor must
  already contain a `<canvas></canvas>` child. React/RN packages handle this
  for you.
- **First paint**: call `engine.render()` once after initial draw
  registration (vanilla/server). React components request renders themselves.
- **Events default off**: no `eventHandlers` config means a completely inert
  canvas.
- **Zoom limits**: `minScale` defaults to `scale * 0.5` and `maxScale` to
  `scale * 2`. If the user wants deep zooming, set them explicitly. In
  responsive modes the minimum adapts to the container: `preserve-viewport`
  treats `minScale` as a zoom-out factor of the base scale, `preserve-scale`
  lowers it so finite `bounds` stay fully viewable at any width. `maxScale`
  stays absolute (px-per-tile quality cap; lifted only if the base scale
  exceeds it).
- **Fixed boards MUST set the center**: a board of cells `0..N-1` is centered
  at `(N-1)/2`, not `N/2` and not the default `(0, 0)`. Use the `center`
  returned by `gridToSize` (core >= 0.5): `const { center, ...board } =
  gridToSize({...})` and pass `center` to the constructor / `center` prop.
  On older versions compute it manually: `{ x: (columns-1)/2, y: (rows-1)/2 }`.
  Without this the board renders mostly off-screen or half a cell off.
- **React props are mount-only**: `config`, `renderer`, and `center` are read
  once. Changing them later is ignored - use runtime APIs
  (`engine.setBounds`, `engine.updateCoords`, ...) or remount with a `key`.
- **React items stability**: `items` props are compared by reference. Inline
  array literals cause re-registration (and spatial index rebuilds) every
  render. Use `useMemo` or state.
- **Paint tools must disable drag**: while a pointer-paint mode is active,
  call `engine.setEventHandlers({ drag: false, hover: true })`, otherwise
  dragging pans the camera while painting.
- **Static caches never auto-invalidate**: `drawStatic*` snapshots items into
  an offscreen canvas keyed by `cacheKey`. Changing item data requires
  `clearStaticCache(cacheKey)` + re-register.
- **Do not roll your own culling, spatial index, pan/zoom math, or DPR
  handling** - the engine does all of it.

## Reference files (read the ones relevant to the task)

| File | Contents |
| :-- | :-- |
| [references/core-api.md](references/core-api.md) | Engine construction, full config reference with defaults, every engine method signature, image loader, `gridToSize`, exported types. |
| [references/drawing.md](references/drawing.md) | Every draw primitive and its item shape, layers, handles, origin/anchoring, rotation, static caching, custom draw functions. |
| [references/events.md](references/events.md) | Every callback, the 3-space coordinate payload (world/canvas/viewport, raw/snapped), runtime event switching, paint/selection patterns. |
| [references/react.md](references/react.md) | `useCanvasTileEngine` handle, all 12 compound components with exact props, lifecycle rules, image loading, pitfalls. |
| [references/react-native.md](references/react-native.md) | RN component, Skia types, layout sizing, touch behavior, custom Skia drawing, platform differences. |
| [references/server.md](references/server.md) | `renderToBuffer`, low-level `RendererServer`, fonts, output formats, differences from browser renderers. |
| [references/sprites.md](references/sprites.md) | `sprite` source rects, `SpriteSheet`, `SpriteAnimator`, the React `<Sprite>` component. |
| [references/performance.md](references/performance.md) | Renderer choice, culling/spatial index internals, static caches, WebGL specifics (`invalidateTexture`, overlay layering caveat). |
| [references/recipes.md](references/recipes.md) | Complete end-to-end builds: game map, minimap sync, pixel painter, RN board, OG-image endpoint, responsive fullscreen map. |

For a full app build, the typical reading order is: this file, then
[core-api](references/core-api.md) + [drawing](references/drawing.md) +
[events](references/events.md), then the platform file, then copy the nearest
recipe from [recipes](references/recipes.md) and adapt it.
