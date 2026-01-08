---
sidebar_position: 1
---

# Installation

This page shows the quickest way to add Canvas Tile Engine to a plain JS/TS project.

## Install

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-canvas
```

```bash
yarn add @canvas-tile-engine/core @canvas-tile-engine/renderer-canvas
```

```bash
pnpm add @canvas-tile-engine/core @canvas-tile-engine/renderer-canvas
```

## Quick start

```html
<div id="canvas">
    <canvas />
</div>
```

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const el = document.getElementById("canvas") as HTMLDivElement;
const engine = new CanvasTileEngine(
    el,
    {
        scale: 50,
        size: {
            width: 500,
            height: 500,
        },
    },
    new RendererCanvas()
);

engine.drawRect({ x: 10, y: 5 });

engine.drawCircle([
    { x: 1, y: 1, size: 0.7 },
    { x: 7, y: 4, style: { fillStyle: "red" } },
]);

engine.render();
```
