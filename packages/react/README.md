# @canvas-tile-engine/react

[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/react)](https://www.npmjs.com/package/@canvas-tile-engine/react)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@canvas-tile-engine/react)](https://bundlephobia.com/package/@canvas-tile-engine/react)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/react)](../../LICENSE)

React bindings for Canvas Tile Engine — build interactive 2D grid-based maps with declarative components.

## Install

```bash
npm install @canvas-tile-engine/react @canvas-tile-engine/renderer-canvas
```

## Quick Start

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const config = {
    scale: 50,
    size: { width: 800, height: 600 },
    backgroundColor: "#337426",
    eventHandlers: { drag: true, zoom: true, click: true },
};

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
            <CanvasTileEngine.Rect items={[{ x: 0, y: 0, size: 1, style: { fillStyle: "#f9c74f" } }]} layer={0} />
            <CanvasTileEngine.GridLines cellSize={10} layer={1} />
        </CanvasTileEngine>
    );
}
```

## Architecture

The React package wraps `@canvas-tile-engine/core` with declarative components. You inject a renderer via the `renderer` prop:

```tsx
// Canvas2D
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
<CanvasTileEngine engine={engine} config={config} renderer={new RendererCanvas()} />

// Custom renderer
<CanvasTileEngine engine={engine} config={config} renderer={new MyCustomRenderer()} />
```

## Documentation

Full API reference and examples: [canvastileengine.dev](https://canvastileengine.dev/docs/react/installation)

## License

MIT
