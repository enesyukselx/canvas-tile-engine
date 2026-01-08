# Canvas Tile Engine

[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/core?label=core)](https://www.npmjs.com/package/@canvas-tile-engine/core)
[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/react?label=react)](https://www.npmjs.com/package/@canvas-tile-engine/react)
[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/renderer-canvas?label=renderer-canvas)](https://www.npmjs.com/package/@canvas-tile-engine/renderer-canvas)
[![npm downloads](https://img.shields.io/npm/dm/@canvas-tile-engine/core)](https://www.npmjs.com/package/@canvas-tile-engine/core)
[![npm downloads](https://img.shields.io/npm/dm/@canvas-tile-engine/react)](https://www.npmjs.com/package/@canvas-tile-engine/react)
[![npm downloads](https://img.shields.io/npm/dm/@canvas-tile-engine/renderer-canvas)](https://www.npmjs.com/package/@canvas-tile-engine/renderer-canvas)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@canvas-tile-engine/core)](https://bundlephobia.com/package/@canvas-tile-engine/core)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@canvas-tile-engine/react)](https://bundlephobia.com/package/@canvas-tile-engine/react)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@canvas-tile-engine/renderer-canvas)](https://bundlephobia.com/package/@canvas-tile-engine/renderer-canvas)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/core)](./LICENSE)

Canvas Tile Engine is a lightweight library for building interactive 2D grid-based maps and visualizations. It handles camera controls, coordinate transformations, rendering, and user interactions—so you can focus on your content.

-   Pan, zoom, and smooth camera animations
-   Grid-based coordinate system with automatic transformations
-   Event handling (click, hover, drag, zoom)
-   Layer-based rendering with drawing helpers (`drawRect`, `drawImage`, `drawGridLines`, `drawStatic*`)
-   Modular renderer architecture (Canvas2D, WebGL, custom)
-   Optional coordinate/debug HUD for quick visibility
-   Optimized for large datasets: spatial indexing (R-Tree) + viewport culling to skip off-screen work, static draw caches.

## Install

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-canvas
```

## Quickstart

```html
<div id="wrapper">
    <canvas></canvas>
</div>
```

```ts
import { CanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const wrapper = document.getElementById("wrapper") as HTMLDivElement;

const config: CanvasTileEngineConfig = {
    scale: 50,
    size: { width: 500, height: 500, minWidth: 200, minHeight: 200 },
    backgroundColor: "#337426",
    eventHandlers: { drag: true, zoom: true, hover: true, click: true },
    coordinates: { enabled: true, shownScaleRange: { min: 30, max: 80 } },
};

const engine = new CanvasTileEngine(wrapper, config, new RendererCanvas(), { x: 0, y: 0 });
engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#f9c74f" } });
engine.render();

engine.onClick = (coords) => {
    console.log("Clicked tile:", coords.snapped);
};
```

For detailed core API reference, see [packages/core/README.md](./packages/core/README.md).

## React

For React applications, use the `@canvas-tile-engine/react` package:

```bash
npm install @canvas-tile-engine/react @canvas-tile-engine/renderer-canvas
```

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
            center={{ x: 0, y: 0 }}
            onClick={(coords) => console.log("Clicked:", coords.snapped)}
        >
            <CanvasTileEngine.Rect items={tiles} layer={0} />
            <CanvasTileEngine.GridLines cellSize={10} layer={1} />
        </CanvasTileEngine>
    );
}
```

See the full React documentation: [packages/react/README.md](./packages/react/README.md)

## Renderers

| Package                                                           | Description       |
| :---------------------------------------------------------------- | :---------------- |
| [@canvas-tile-engine/renderer-canvas](./packages/renderer-canvas) | Canvas2D renderer |

## Documentation

Full guide, API docs, and examples: [canvastileengine.dev](https://canvastileengine.dev)

## License

MIT
