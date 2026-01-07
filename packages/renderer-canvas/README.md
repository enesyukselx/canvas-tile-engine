# @canvas-tile-engine/renderer-canvas

[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/renderer-canvas)](https://www.npmjs.com/package/@canvas-tile-engine/renderer-canvas)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@canvas-tile-engine/renderer-canvas)](https://bundlephobia.com/package/@canvas-tile-engine/renderer-canvas)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/renderer-canvas)](../../LICENSE)

Canvas2D renderer for [Canvas Tile Engine](https://github.com/ArdaGnsrn/canvas-tile-engine). This package provides the default rendering implementation using the HTML Canvas 2D API.

## Install

```bash
npm install @canvas-tile-engine/renderer-canvas
```

## Usage

### With Core (Vanilla JS/TS)

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const engine = new CanvasTileEngine(
    wrapper,
    config,
    new RendererCanvas(),
    { x: 0, y: 0 }
);
```

### With React

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

function App() {
    const engine = useCanvasTileEngine();

    return (
        <CanvasTileEngine
            engine={engine}
            config={config}
            renderer={new RendererCanvas()}
        >
            {/* children */}
        </CanvasTileEngine>
    );
}
```

## Features

- Full support for all drawing primitives (rect, circle, image, text, path, line)
- Static caching for large datasets (offscreen canvas)
- Layer-based rendering with configurable draw order
- Coordinate overlay and debug HUD
- High DPI (retina) display support

## Custom Drawing

When using `addDrawFunction` or `onDraw`, cast the context to `CanvasRenderingContext2D`:

```ts
engine.addDrawFunction((ctx, coords, config) => {
    const context = ctx as CanvasRenderingContext2D;

    context.fillStyle = "red";
    context.fillRect(0, 0, 100, 100);
}, 2);

engine.onDraw = (ctx, info) => {
    const context = ctx as CanvasRenderingContext2D;

    context.strokeStyle = "blue";
    context.strokeRect(0, 0, info.width, info.height);
};
```

## Architecture

This renderer implements the `IRenderer` interface from `@canvas-tile-engine/core`:

```
@canvas-tile-engine/core
        │
        ▼
   IRenderer ◄─── Interface
        │
        ▼
┌─────────────────┐
│ RendererCanvas  │ ◄─── This package
│   (Canvas2D)    │
└─────────────────┘
```

## Documentation

Full documentation: [canvastileengine.dev](https://canvastileengine.dev)

## License

MIT
