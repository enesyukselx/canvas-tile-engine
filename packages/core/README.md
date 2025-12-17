# @canvas-tile-engine/core

Lightweight, framework-agnostic library for building interactive 2D grid-based maps and visualizations. Handles camera controls, coordinate transformations, layer-based rendering, and event handling.

## Install

```bash
npm install @canvas-tile-engine/core
```

## Quick Start

```html
<div id="wrapper">
    <canvas></canvas>
</div>
```

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";

const engine = new CanvasTileEngine(
    document.getElementById("wrapper"),
    {
        scale: 50,
        size: { width: 800, height: 600 },
        backgroundColor: "#337426",
        eventHandlers: { drag: true, zoom: true, click: true },
    },
    { x: 0, y: 0 }
);

engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#f9c74f" } });
engine.render();

engine.onClick = (coords) => console.log("Clicked:", coords.snapped);
```

## Documentation

Full API reference and examples: [https://www.canvastileengine.dev/docs/js/installation](https://www.canvastileengine.dev/docs/js/installation)

## License

MIT
