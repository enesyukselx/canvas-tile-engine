# @canvas-tile-engine/core

[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/core)](https://www.npmjs.com/package/@canvas-tile-engine/core)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@canvas-tile-engine/core)](https://bundlephobia.com/package/@canvas-tile-engine/core)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/core)](../../LICENSE)

The renderer-agnostic engine behind Canvas Tile Engine. Use it when you want direct TypeScript control over a zoomable 2D grid surface without React or another UI wrapper.

`@canvas-tile-engine/core` owns the camera, coordinate math, event callbacks, layers, draw helpers, static caches, sprites, and viewport culling. You bring a renderer: Canvas2D, WebGL, React Native Skia, server-side Node.js, or your own implementation of the `IRenderer` contract.

## Install

Canvas2D web app:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-canvas
```

Other renderer choices:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-webgl
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-server
```

## Quick Start

```html
<div id="map">
    <canvas></canvas>
</div>
```

```ts
import { CanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const wrapper = document.getElementById("map") as HTMLDivElement;

const config: CanvasTileEngineConfig = {
    scale: 48,
    size: { width: 800, height: 500 },
    backgroundColor: "#0f172a",
    eventHandlers: { drag: true, zoom: true, hover: true, click: true },
    coordinates: { enabled: true, shownScaleRange: { min: 16, max: 96 } },
};

const engine = new CanvasTileEngine(wrapper, config, new RendererCanvas(), { x: 0, y: 0 });

engine.drawGridLines(1, 1, "#1e293b", 0);
engine.drawRect({ x: 0, y: 0, size: 1, radius: 4, style: { fillStyle: "#22c55e" } }, 1);
engine.drawText(
    {
        x: 0,
        y: -1,
        text: "Spawn",
        size: 0.35,
        style: { fillStyle: "#e2e8f0", fontFamily: "sans-serif", textAlign: "center" },
    },
    2,
);

engine.onClick = (coords) => {
    console.log("Clicked tile:", coords.snapped);
};

engine.render();
```

## What Core Handles

- Camera state: pan, zoom, bounds, smooth movement, resize-aware center updates.
- Coordinate transforms: screen/pointer coordinates to raw and snapped world coordinates.
- Event callbacks: click, right-click, hover, mouse/touch down, mouse/touch up, leave, zoom, resize.
- Layered drawing: lower layers draw first, higher layers draw on top.
- Draw helpers: rect, circle, image, text, line, path, grid lines, static rect/circle/image, and custom draw functions.
- Performance basics: viewport culling, RBush spatial indexing for large item sets, and static draw caches where the renderer supports them.
- Sprite utilities: `SpriteSheet` frame calculation and `SpriteAnimator` frame scheduling.

## Renderers

Core does not draw by itself. It delegates to an injected renderer:

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";

new CanvasTileEngine(wrapper, config, new RendererCanvas());
new CanvasTileEngine(wrapper, config, new RendererWebGL());
new CanvasTileEngine(wrapper, config, new MyCustomRenderer());
```

Official renderers:

| Package | Surface |
| --- | --- |
| [`@canvas-tile-engine/renderer-canvas`](../renderer-canvas) | HTML Canvas2D |
| [`@canvas-tile-engine/renderer-webgl`](../renderer-webgl) | WebGL with a 2D overlay |
| [`@canvas-tile-engine/renderer-skia`](../renderer-skia) | React Native Skia |
| [`@canvas-tile-engine/renderer-server`](../renderer-server) | Headless Node.js image buffers |

## Useful APIs

| API | Purpose |
| --- | --- |
| `engine.render()` | Render the current scene. |
| `engine.updateCoords({ x, y })` | Move the camera center immediately. |
| `engine.goCoords(x, y, durationMs)` | Animate the camera center. |
| `engine.setScale(scale)` / `zoomIn()` / `zoomOut()` | Control zoom programmatically. |
| `engine.getVisibleBounds()` | Read the visible world bounds for culling, lazy loading, or UI state. |
| `engine.setBounds(bounds)` | Clamp camera movement. |
| `engine.setEventHandlers(partial)` | Enable or disable interactions at runtime. |
| `engine.clearLayer(layer)` / `clearAll()` | Replace dynamic content safely. |
| `engine.images.load(src)` | Load platform-specific image handles through the active renderer. |

## Sprites

```ts
import { SpriteSheet, SpriteAnimator } from "@canvas-tile-engine/core";

const sheet = new SpriteSheet({ frameWidth: 32, frameHeight: 32, columns: 8 });
const player = { x: 4, y: 2, size: 1, img, sprite: sheet.frame(0, 0) };

engine.drawImage(player, 2);

const animator = new SpriteAnimator({ frames: sheet.framesInRow(0, 0, 5), fps: 8 });
animator.start((frame) => {
    player.sprite = frame;
    engine.render();
});
```

## Documentation

- Full docs: [canvastileengine.dev](https://canvastileengine.dev/docs/js/installation)
- Repository: [github.com/enesyukselx/canvas-tile-engine](https://github.com/enesyukselx/canvas-tile-engine)
- Issues: [GitHub Issues](https://github.com/enesyukselx/canvas-tile-engine/issues)

## License

MIT
