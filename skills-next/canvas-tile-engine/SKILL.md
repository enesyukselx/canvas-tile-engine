---
name: canvas-tile-engine
description: >-
  Build apps with the @canvas-tile-engine npm packages: zoomable/pannable 2D
  tile maps, game boards, minimaps, pixel editors, seat pickers, heatmaps,
  spritesheet animations, and data-heavy grid UIs. Use when a task involves any
  @canvas-tile-engine package (core, react, react-native, renderer-canvas,
  renderer-webgl, renderer-skia, renderer-server) or when building an
  interactive tile/grid canvas surface in vanilla JS, React, React Native, or
  server-side PNG/JPEG/WebP image rendering. This library is NOT in LLM
  training data - always follow this skill instead of guessing the API.
---

# Canvas Tile Engine

A renderer-agnostic TypeScript engine for zoomable 2D grid surfaces. The core
package owns the camera, coordinate transforms, gestures, layers, culling,
hit testing, sprites, and the draw API. Renderer packages decide where pixels
go: HTML Canvas2D, WebGL, React Native Skia, or a headless Node.js image.

This skill describes `@canvas-tile-engine/core@0.12.x` and the packages
released with it. Check the project's installed version first (its
`package.json`); features marked `core >= 0.12` or `core >= 0.11` need at
least that version. Do not invent API from memory: everything public is in
this file and `references/`. If something is missing, read the installed
package's `.d.ts` files before using it.

## Package selection (decide first)

| You are building | Install | Read |
| :-- | :-- | :-- |
| Vanilla JS/TS web app | `@canvas-tile-engine/core` + `@canvas-tile-engine/renderer-canvas` | [core-api](references/core-api.md), [drawing](references/drawing.md), [events](references/events.md) |
| Heavy web scene (50k+ dynamic items) | `@canvas-tile-engine/core` + `@canvas-tile-engine/renderer-webgl` | the above + [performance](references/performance.md) |
| React web app | the vanilla pair + `@canvas-tile-engine/react` | [react](references/react.md) |
| React Native app | `@canvas-tile-engine/core` + `@canvas-tile-engine/react-native` + `@canvas-tile-engine/renderer-skia` + `@shopify/react-native-skia` | [react-native](references/react-native.md) |
| Server-side images (OG images, thumbnails, snapshots) | `@canvas-tile-engine/core` + `@canvas-tile-engine/renderer-server` | [server](references/server.md) |

`@canvas-tile-engine/core` is a peer dependency of every other package:
always install it explicitly. `RendererCanvas` and `RendererWebGL` are drop-in
swaps; default to Canvas2D and switch to WebGL only for very heavy dynamic
scenes (one layering caveat in [performance](references/performance.md)).

## Mental model (read before writing any code)

1. **World units, and integers are cell CENTERS.** Item `x`/`y`/`size` are
   world (tile) units and `config.scale` is pixels per world unit. Cell `k`
   spans `[k - 0.5, k + 0.5]`, so a board of cells `0..N-1` is centered at
   `(N-1)/2` (not `N/2`) and, as an area, spans `-0.5..N-0.5`. Pointer events
   and a few APIs use a corner space offset by half a cell: read
   [Coordinate spaces](references/core-api.md#coordinate-spaces) before
   passing event coordinates into anything. Style values (`lineWidth`,
   `radius`, text `size`) are world units too; `*Px` variants pin a screen
   size ([drawing](references/drawing.md)).
2. **Retained draw model.** `engine.drawRect(...)` does not paint. It
   registers a callback on a layer that re-runs every frame and returns a
   `DrawHandle`. Call `engine.render()` once after the first registrations;
   pan, zoom and resizes re-render by themselves.
3. **Re-registering accumulates unless you pass an id.** `drawRect(items,
   layer, { id: "units" })` replaces the previous registration with that id
   (draw + hit-test entries). Without an id, every call adds another copy.
   Static draws use their `cacheKey` as the id.
4. **Decoration is not geometry.** Selection, hover, highlight and filters go
   through `styleOf` / `visibleOf` / `interactiveOf` in the draw options:
   they read your state live on every frame, so you mutate state and call
   `render()` - no new arrays, no re-registration. Geometry changes
   (position, size, line width) re-register with the same id. Rules per
   primitive: [drawing](references/drawing.md#styleof-visibleof-interactiveof).
5. **Layers are z-order.** Lower numbers paint first (defaults: grid 0,
   shapes/images 1, text 2). Inside one draw call, array order is paint order.
6. **All interaction is opt-in.** Every `eventHandlers` flag defaults to
   `false`; a map that should pan, zoom and click needs
   `eventHandlers: { drag: true, zoom: true, click: true }`. An interactive
   web surface also becomes a keyboard tab stop (core >= 0.12): give it an
   `accessibility.label`.
7. **Culling is automatic.** Off-screen items are skipped and an R-tree kicks
   in above 500 items. Pass 100k items straight to a draw call.

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
    accessibility: { label: "World map" },    // core >= 0.12
};

const engine = new CanvasTileEngine(
    document.getElementById("map") as HTMLDivElement,
    config,
    new RendererCanvas(),
    { x: 0, y: 0 },                           // initial world center (item space)
);

engine.drawGridLines(1, 1, "#1e293b", 0);
engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#22c55e" } }, 1);
engine.onClick = (coords) => console.log("cell:", coords.snapped);
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
            config={{
                scale: 48,
                size: { width: 800, height: 500 },
                eventHandlers: { drag: true, zoom: true, click: true },
                accessibility: { label: "World map" },
            }}
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

- **Vanilla mount**: the wrapper element must already contain a
  `<canvas></canvas>` child. React/RN do this for you.
- **First paint**: call `engine.render()` once after the initial
  registrations (vanilla/server). React components request renders
  themselves.
- **Fixed boards set the center**: cells `0..N-1` are centered at
  `(N-1)/2`. Use the `center` from `gridToSize` and pass it to the
  constructor / `center` prop; otherwise the board renders half a cell off
  or mostly off-screen.
- **Pointer coordinates**: pass `coords.raw` straight to `hitTest*`;
  `coords.snapped` is the cell (the value you'd put in an item's `x`). Do not
  pass `coords.raw` to `setCenter`/`goCenter`/`fitBounds` - that is half a cell
  off. `config.bounds` is corner space, unlike `fitBounds` and `clip`
  ([details](references/core-api.md#coordinate-spaces)).
- **Zoom limits**: `minScale`/`maxScale` default to `scale * 0.5` and
  `scale * 2`. Set them explicitly for deep zooming (`fitScale` computes a
  "whole map visible" minimum). Responsive modes adapt the minimum at
  runtime, so read the live range from `engine.getConfig()` after mount
  ([responsive modes](references/core-api.md#responsive-modes-browser-renderers-only)).
- **React props are mount-only**: `config`, `renderer` and `center` are read
  once. Use runtime APIs (`setEventHandlers`, `setCenter`, `setBounds`,
  `setAccessibility`, ...) or remount with a `key`.
- **React items stability**: `items` props compare by reference. Memoize
  them or keep them in state; inline arrays re-register every render.
- **Paint tools disable drag**: in a paint mode call
  `engine.setEventHandlers({ drag: false, hover: true })`, or dragging pans
  while painting. `onMouseDown`/`onMouseUp` need no flag.
- **Static draws are snapshots**: `drawStatic*` records the items once at the
  current scale; calling again with the same `cacheKey` re-records. On
  Canvas2D/server the bitmap softens when zooming in past the recorded scale
  ([static caching](references/drawing.md#static-caching-drawstaticrect--drawstaticcircle--drawstaticimage)).
- **Line/Path decorations cannot change width**: `styleOf` on lines and paths
  is color/dash only (the hit corridor depends on width). Re-register to
  change widths.
- **Do not roll your own** culling, spatial index, pan/zoom math, DPR
  handling or coordinate conversion - the engine does all of it.

## Troubleshooting

| Symptom | Usual cause |
| :-- | :-- |
| Blank canvas (vanilla) | No `<canvas>` child in the wrapper, no `engine.render()`, or `responsive: "fill"` with a parent that has no height. |
| Board off-screen or half a cell off | Center not set, `N/2` instead of `(N-1)/2`, or `coords.raw` passed to `goCenter`/`fitBounds`. |
| Clicks, drags or wheel do nothing | `eventHandlers` flags not set, or (React) `config` changed after mount - use `engine.setEventHandlers`. |
| Hover/click lands on the neighbor cell | `coords.snapped` passed to `hitTest` (use `coords.raw`). |
| Shapes duplicate or memory grows | Re-registering without an `id`. |
| React map is laggy | Inline `items` arrays or recreated style objects every render. |
| Dragging pans while painting | `drag` still enabled in paint mode. |
| Static layer is blurry when zoomed in | Canvas2D static bitmap; re-register at the new scale or draw dynamically. |
| Images never appear | CORS: see `crossOrigin` in [core-api](references/core-api.md#cors-on-the-browser-renderers). |
| Text or custom drawing sits above WebGL shapes regardless of layer | Expected on WebGL: its 2D overlay always composites on top ([performance](references/performance.md)). |
| An extra tab stop or arrow keys pan after upgrading | Interactive surfaces are focusable since 0.12; opt out with `accessibility: { focusable: false }`. |

## Where to find it

| Task | Go to |
| :-- | :-- |
| Config fields and defaults | [core-api: Full config reference](references/core-api.md#full-config-reference) |
| Which coordinate space an API takes | [core-api: Coordinate spaces](references/core-api.md#coordinate-spaces) |
| Fit the view to content, zoom limits | [core-api: fitScale](references/core-api.md#fitscale---content-driven-scale-limits), [itemsBounds](references/core-api.md#itemsbounds---the-rectangle-fitboundsfitscale-ask-for) |
| Keep the camera inside the world | [core-api: Camera bounds](references/core-api.md#camera-bounds) |
| Accessible name, keyboard, reduced motion | [core-api: Accessibility](references/core-api.md#accessibility-and-reduced-motion), [events: Keyboard](references/events.md#keyboard-camera-control) |
| Which flag enables which callback | [events: Flags](references/events.md#flags-and-the-callbacks-they-gate) |
| Click or hover an item | [events: hitTest pattern](references/events.md#pattern-item-click--hover-via-hittest) |
| Selection/hover highlight, filters | [drawing: styleOf](references/drawing.md#styleof-visibleof-interactiveof) |
| Shapes, text, images, lines, paths | [drawing: Primitives](references/drawing.md#primitives) |
| Confine a layer to a region | [drawing: Clipping](references/drawing.md#clipping-a-registration) |
| HUD, legend, labels pinned to the screen | [drawing: Screen-fixed overlays](references/drawing.md#screen-fixed-overlays-hud-legend-labels-pinned-to-the-viewport) |
| Paint tool | [events: click-drag painting](references/events.md#pattern-click-drag-painting), [recipes: pixel painter](references/recipes.md#3-pixel-painter-react) |
| Minimap | [recipes: minimap](references/recipes.md#2-main-map--synced-minimap-react) |
| 50k+ items, heatmaps | [performance](references/performance.md), [recipes: heatmap](references/recipes.md#9-heavy-heatmap-on-webgl-vanilla) |
| Spritesheet animation | [sprites](references/sprites.md) |
| PNG/JPEG/WebP on the server | [server](references/server.md) |

## Reference files

| File | Contents |
| :-- | :-- |
| [core-api.md](references/core-api.md) | Coordinate spaces, construction, full config reference, every engine method, image loading, utilities, exported types. |
| [drawing.md](references/drawing.md) | Retained draw model, ids, `styleOf`/`visibleOf`/`interactiveOf`, every primitive, origin, gradients, clipping, static caches, custom drawing, screen-fixed overlays. |
| [events.md](references/events.md) | Flags, callback payloads, keyboard control, runtime mode switching, interaction patterns. |
| [react.md](references/react.md) | `useCanvasTileEngine` handle, the compound components and their props, lifecycle rules, types, pitfalls. |
| [react-native.md](references/react-native.md) | RN component, sizing boards to the screen, touch behavior, Skia types and custom drawing, platform differences. |
| [server.md](references/server.md) | `renderToBuffer`, `RendererServer`, fonts, output formats, HTTP endpoint pattern. |
| [sprites.md](references/sprites.md) | `sprite` source rects, `SpriteSheet`, `SpriteAnimator`, the `<Sprite>` component. |
| [performance.md](references/performance.md) | What the engine already optimizes, renderer choice, WebGL specifics, static caches, budgets. |
| [recipes.md](references/recipes.md) | Complete builds to copy and adapt: game map, minimap, pixel painter, fixed board, responsive map, sprites, server image, RN board, WebGL heatmap. |

For a full app: read this file, then [core-api](references/core-api.md) +
[drawing](references/drawing.md) + [events](references/events.md) (the
sections you need), then the platform file, then copy the nearest recipe
from [recipes](references/recipes.md) and adapt it.
