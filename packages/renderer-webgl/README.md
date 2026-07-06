# @canvas-tile-engine/renderer-webgl

[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/renderer-webgl)](https://www.npmjs.com/package/@canvas-tile-engine/renderer-webgl)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@canvas-tile-engine/renderer-webgl)](https://bundlephobia.com/package/@canvas-tile-engine/renderer-webgl)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/renderer-webgl)](../../LICENSE)

GPU-accelerated WebGL renderer for [Canvas Tile Engine](https://github.com/enesyukselx/canvas-tile-engine). It implements the same `IRenderer` contract as `@canvas-tile-engine/renderer-canvas`, so it is a drop-in replacement: swap the renderer instance and everything else (config, draw API, events) stays the same.

## Install

```bash
npm install @canvas-tile-engine/renderer-webgl
```

## Usage

### With Core (Vanilla JS/TS)

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";

const engine = new CanvasTileEngine(wrapper, config, new RendererWebGL(), { x: 0, y: 0 });
```

### With React

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";

function App() {
    const engine = useCanvasTileEngine();

    return <CanvasTileEngine engine={engine} config={config} renderer={new RendererWebGL()} />;
}
```

## How it works

The renderer paints onto **two stacked canvases** inside the wrapper:

1. **WebGL canvas (bottom)** — all geometry primitives (`drawRect`, `drawCircle`, `drawImage`, `drawLine`, `drawPath`, `drawGridLines`) are rendered on the GPU. Each layer flushes as a single batched draw call, so painting thousands of tiles costs only a handful of GL calls.
    - Filled shapes use a signed-distance rounded-box shader, which anti-aliases edges and renders sharp rects, rounded rects and circles from one program.
    - Lines, grid lines, paths and shape strokes are expanded into triangle strips with a configurable pixel width.
    - Images are uploaded as textures (cached per image) and drawn as textured quads.
2. **2D overlay canvas (top, transparent)** — text (`drawText`), the coordinate overlay, the debug HUD and user-supplied draw functions (`addDrawFunction`, `engine.onDraw`) are painted with the Canvas2D API. This keeps the public draw API byte-for-byte compatible with the Canvas2D renderer.

### Differences from the Canvas2D renderer

- **Layer ordering across surfaces.** Because text and user draw functions live on the upper 2D canvas, they always composite **above** every WebGL primitive, regardless of their layer index. Ordering _within_ each surface is preserved.
- **Static caches.** `drawStaticRect`, `drawStaticCircle` and `drawStaticImage` delegate to their dynamic counterparts — with WebGL a full layer already renders in a single batched draw call, so the offscreen pre-render cache is unnecessary.
- **Texture caching.** Image sources are uploaded to the GPU once and cached. Dimension changes (a resized canvas, a swapped `img.src` with different size) are detected and re-uploaded automatically, but mutating a source's pixels at the same size requires calling `renderer.invalidateTexture(source)` — the Canvas2D renderer always paints the source's current pixels.
- **Requires WebGL.** The renderer prefers WebGL 2 and falls back to WebGL 1. If neither is available, `init()` throws; use `RendererCanvas` as a fallback.

## License

MIT
