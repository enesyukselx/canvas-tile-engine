---
sidebar_position: 1
---

# Installation

This page shows the quickest way to add `@canvas-tile-engine/core` to a plain JS/TS project.

## Install

```bash
npm install @canvas-tile-engine/core
```

```bash
yarn add @canvas-tile-engine/core
```

```bash
pnpm add @canvas-tile-engine/core
```

## Quick start

```html
<div id="canvas">
    <canvas />
</div>
```

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";

const el = document.getElementById("canvas");
const engine = new CanvasTileEngine(el, {
    scale: number;
    size: {
        width: number;
        height: number;
    };
});

//
engine.drawRect({x: 10, y: 5})

engine.drawCircle([
  { x: 1, y: 1, size: 0.7 },
  { x: 7, y: 4, style: {
    fillStyle: "red"
  }}
])

engine.render();
```
