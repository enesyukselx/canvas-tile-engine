# @canvas-tile-engine/renderer-webgl

[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/renderer-webgl)](https://www.npmjs.com/package/@canvas-tile-engine/renderer-webgl)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@canvas-tile-engine/renderer-webgl)](https://bundlephobia.com/package/@canvas-tile-engine/renderer-webgl)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/renderer-webgl)](../../LICENSE)

GPU-accelerated WebGL renderer for Canvas Tile Engine. It implements the same renderer contract as `@canvas-tile-engine/renderer-canvas`, so most apps switch by changing only the renderer instance.

Use it when your scene has many dynamic primitives and you want batched GPU drawing while keeping the same core engine, config, event callbacks, layers, and draw helpers.

## Install

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-webgl
```

With React:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react @canvas-tile-engine/renderer-webgl
```

## Quick Start

```html
<div id="map">
    <canvas></canvas>
</div>
```

```ts
import { CanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";

const wrapper = document.getElementById("map") as HTMLDivElement;

const config: CanvasTileEngineConfig = {
    scale: 48,
    size: { width: 800, height: 500 },
    backgroundColor: "#0f172a",
    eventHandlers: { drag: true, zoom: true, hover: true, click: true },
};

const engine = new CanvasTileEngine(wrapper, config, new RendererWebGL(), { x: 0, y: 0 });

engine.drawGridLines(1, 1, "#1e293b", 0);
engine.drawRect({ x: 0, y: 0, size: 1, radius: 4, style: { fillStyle: "#22c55e" } }, 1);
engine.drawCircle({ x: 2, y: 1, size: 0.8, style: { fillStyle: "#38bdf8" } }, 1);
engine.render();
```

## With React

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";

export function Map() {
    const engine = useCanvasTileEngine();

    return (
        <CanvasTileEngine engine={engine} config={config} renderer={new RendererWebGL()}>
            <CanvasTileEngine.GridLines cellSize={1} layer={0} />
            <CanvasTileEngine.Rect items={tiles} layer={1} />
        </CanvasTileEngine>
    );
}
```

## How It Works

`RendererWebGL` creates two stacked canvases inside the wrapper:

| Surface           | Draws                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| WebGL canvas      | Rects, circles, images, lines, paths, grid lines, and shape strokes.         |
| 2D overlay canvas | Text, coordinate overlay, debug HUD, `addDrawFunction`, and `engine.onDraw`. |

Geometry is batched by layer. Filled rects, rounded rects, and circles use shader-based rendering; lines and paths are expanded into triangles; images are uploaded as cached GPU textures.

## Differences From Canvas2D

- Text and user custom draw functions live on the upper 2D overlay, so they composite above every WebGL primitive even if their layer number is lower. Ordering within each surface is preserved.
- `drawStaticRect`, `drawStaticCircle`, and `drawStaticImage` delegate to dynamic drawing. A WebGL layer is already batched, so the Canvas2D offscreen static cache is usually unnecessary.
- Image sources are uploaded to the GPU and cached. Dimension changes are detected automatically, but if you mutate pixels at the same size, call `renderer.invalidateTexture(source)`.
- The renderer prefers WebGL 2 and falls back to WebGL 1. If neither is available, `init()` throws.

## Canvas Fallback

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";

let engine;

try {
    engine = new CanvasTileEngine(wrapper, config, new RendererWebGL(), center);
} catch {
    engine = new CanvasTileEngine(wrapper, config, new RendererCanvas(), center);
}
```

## Texture Invalidation

```ts
const renderer = new RendererWebGL();
const engine = new CanvasTileEngine(wrapper, config, renderer);

// Later, after mutating an image/canvas source without changing dimensions:
renderer.invalidateTexture(source);
engine.render();
```

## Documentation

- Canvas2D renderer: [`@canvas-tile-engine/renderer-canvas`](../renderer-canvas)
- Core engine: [`@canvas-tile-engine/core`](../core)
- Full docs: [canvastileengine.dev](https://canvastileengine.dev)

## License

MIT
