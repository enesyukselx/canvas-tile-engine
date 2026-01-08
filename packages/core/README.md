# @canvas-tile-engine/core

[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/core)](https://www.npmjs.com/package/@canvas-tile-engine/core)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@canvas-tile-engine/core)](https://bundlephobia.com/package/@canvas-tile-engine/core)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/core)](../../LICENSE)

Lightweight, framework-agnostic library for building interactive 2D grid-based maps and visualizations. Handles camera controls, coordinate transformations, layer-based rendering, and event handling.

## Install

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-canvas
```

## Quick Start

```html
<div id="wrapper">
    <canvas></canvas>
</div>
```

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const engine = new CanvasTileEngine(
    document.getElementById("wrapper") as HTMLDivElement,
    {
        scale: 50,
        size: { width: 800, height: 600 },
        backgroundColor: "#337426",
        eventHandlers: { drag: true, zoom: true, click: true },
    },
    new RendererCanvas(),
    { x: 0, y: 0 }
);

engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#f9c74f" } });
engine.render();

engine.onClick = (coords) => console.log("Clicked:", coords.snapped);
```

## Architecture

The core package is renderer-agnostic. You inject a renderer that implements the `IRenderer` interface:

```ts
// Canvas2D
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
new CanvasTileEngine(wrapper, config, new RendererCanvas());

// Custom renderer
new CanvasTileEngine(wrapper, config, new MyCustomRenderer());
```

## Documentation

Full API reference and examples: [canvastileengine.dev](https://canvastileengine.dev/docs/js/installation)

## License

MIT
