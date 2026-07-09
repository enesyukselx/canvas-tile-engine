# @canvas-tile-engine/renderer-canvas

[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/renderer-canvas)](https://www.npmjs.com/package/@canvas-tile-engine/renderer-canvas)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@canvas-tile-engine/renderer-canvas)](https://bundlephobia.com/package/@canvas-tile-engine/renderer-canvas)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/renderer-canvas)](../../LICENSE)

The default HTML Canvas2D renderer for Canvas Tile Engine. It is the simplest browser renderer to start with and supports the full public draw API: shapes, images, spritesheet frames, text, lines, paths, grid lines, static caches, custom draw functions, event handling, resize handling, coordinate overlays, and debug HUDs.

## Install

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-canvas
```

With React:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react @canvas-tile-engine/renderer-canvas
```

## Quick Start

```html
<div id="map">
    <canvas></canvas>
</div>
```

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const engine = new CanvasTileEngine(
    document.getElementById("map") as HTMLDivElement,
    {
        scale: 48,
        size: { width: 800, height: 500 },
        backgroundColor: "#0f172a",
        eventHandlers: { drag: true, zoom: true, hover: true, click: true },
    },
    new RendererCanvas(),
    { x: 0, y: 0 },
);

engine.drawGridLines(1, 1, "#1e293b", 0);
engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#22c55e" } }, 1);
engine.render();
```

## With React

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

export function Map() {
    const engine = useCanvasTileEngine();

    return (
        <CanvasTileEngine engine={engine} config={config} renderer={new RendererCanvas()}>
            <CanvasTileEngine.GridLines cellSize={1} layer={0} />
            <CanvasTileEngine.Rect items={tiles} layer={1} />
        </CanvasTileEngine>
    );
}
```

## Features

- Complete draw primitive support: rect, circle, image, text, line, path, grid, and custom draw functions.
- Static caches with offscreen canvas for large non-changing rect, circle, and image layers.
- Layer-based rendering with deterministic draw order.
- DOM mouse, touch, wheel, right-click, hover, drag, zoom, and resize handling.
- High-DPI canvas sizing.
- Coordinate overlay and debug HUD support.
- Image loading through `engine.images.load(src)` / React's `engine.loadImage(src)`.

## Custom Drawing

`addDrawFunction` registers custom drawing in the layer stack and receives the Canvas2D context.

```ts
engine.addDrawFunction((ctx, coords, config) => {
    const context = ctx as CanvasRenderingContext2D;

    context.fillStyle = "#f97316";
    context.fillRect(12, 12, 80, 24);
}, 2);
```

## When To Use It

Use `RendererCanvas` as the default choice for web apps, documentation examples, tooling, editors, and medium-sized scenes. If you are drawing very large dynamic geometry layers, try [`@canvas-tile-engine/renderer-webgl`](../renderer-webgl). If you need image output on Node.js, use [`@canvas-tile-engine/renderer-server`](../renderer-server).

## Documentation

- Core engine: [`@canvas-tile-engine/core`](../core)
- React bindings: [`@canvas-tile-engine/react`](../react)
- Full docs: [canvastileengine.dev](https://canvastileengine.dev)

## License

MIT
