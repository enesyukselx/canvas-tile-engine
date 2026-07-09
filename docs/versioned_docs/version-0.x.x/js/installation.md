---
sidebar_position: 1
---

# Installation

Use the core package directly when you want imperative control from plain JavaScript or TypeScript.

## Canvas2D

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-canvas
```

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
    eventHandlers: { drag: true, zoom: true, click: true },
};

const engine = new CanvasTileEngine(wrapper, config, new RendererCanvas(), { x: 0, y: 0 });

engine.drawGridLines(1, 1, "#1e293b", 0);
engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#22c55e" } }, 1);
engine.render();
```

## WebGL

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-webgl
```

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";

const engine = new CanvasTileEngine(wrapper, config, new RendererWebGL());
```

If you need a fallback for browsers without WebGL:

```ts
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";

let engine: CanvasTileEngine;

try {
    engine = new CanvasTileEngine(wrapper, config, new RendererWebGL());
} catch {
    engine = new CanvasTileEngine(wrapper, config, new RendererCanvas());
}
```

## Constructor

```ts
new CanvasTileEngine(wrapper, config, renderer, center?)
```

| Argument | Description |
| :-- | :-- |
| `wrapper` | Platform mount. For DOM renderers this is a wrapper containing a `<canvas>`. |
| `config` | `CanvasTileEngineConfig`. |
| `renderer` | Renderer instance, such as `new RendererCanvas()` or `new RendererWebGL()`. |
| `center` | Optional initial world center. Defaults to `{ x: 0, y: 0 }`. |
