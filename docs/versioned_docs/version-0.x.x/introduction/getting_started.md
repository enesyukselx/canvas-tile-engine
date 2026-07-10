---
sidebar_position: 1
---

# Getting Started

Canvas Tile Engine is a renderer-agnostic TypeScript engine for zoomable 2D grid surfaces: maps, game boards, editors, minimaps, pixel tools, and dense spatial dashboards.

The core package owns camera state, coordinate transforms, gestures, layers, culling, sprite helpers, and the draw API. Renderer packages decide where the frame is drawn: HTML Canvas2D, WebGL, React Native Skia, or a headless Node.js image buffer.

## Package Map

| Package | Use it for |
| :-- | :-- |
| `@canvas-tile-engine/core` | Framework-agnostic engine, camera, events, drawing, sprites, and renderer contracts. |
| `@canvas-tile-engine/react` | React web component, hook, and declarative draw components. |
| `@canvas-tile-engine/react-native` | React Native component and hook backed by Skia. |
| `@canvas-tile-engine/renderer-canvas` | HTML Canvas2D renderer. Best default for browser apps. |
| `@canvas-tile-engine/renderer-webgl` | WebGL renderer for batched GPU drawing of dynamic geometry and images. |
| `@canvas-tile-engine/renderer-skia` | React Native Skia renderer used by the native package. |
| `@canvas-tile-engine/renderer-server` | Node.js renderer for PNG, JPEG, and WebP buffers without a browser. |

## Install

Vanilla web with Canvas2D:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-canvas
```

React web:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react @canvas-tile-engine/renderer-canvas
```

React Native:

```bash
npx expo install @shopify/react-native-skia
npm install @canvas-tile-engine/core @canvas-tile-engine/react-native @canvas-tile-engine/renderer-skia
```

Server rendering:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-server
```

## AI Agent Skill

Canvas Tile Engine ships an [Agent Skill](https://github.com/enesyukselx/canvas-tile-engine/tree/master/skills) that teaches AI coding agents (Claude Code, Cursor, Codex, and compatible tools) the full engine API, so they can build tile maps, game boards, minimaps, and pixel editors with these packages on the first try.

Install with the skills CLI (works across agents):

```bash
npx skills add enesyukselx/canvas-tile-engine
```

Or as a Claude Code plugin:

```
/plugin marketplace add enesyukselx/canvas-tile-engine
/plugin install canvas-tile-engine@canvas-tile-engine
```

Manual copy into a project:

```bash
npx degit enesyukselx/canvas-tile-engine/skills/canvas-tile-engine .claude/skills/canvas-tile-engine
```

## Quick Start

HTML wrapper:

```html
<div id="map">
    <canvas></canvas>
</div>
```

Engine setup:

```ts
import { CanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const wrapper = document.getElementById("map") as HTMLDivElement;

const config: CanvasTileEngineConfig = {
    scale: 48,
    size: { width: 800, height: 500 },
    backgroundColor: "#0f172a",
    eventHandlers: { drag: true, zoom: "pointer", hover: true, click: true },
    coordinates: { enabled: true, shownScaleRange: { min: 16, max: 96 } },
};

const engine = new CanvasTileEngine(wrapper, config, new RendererCanvas(), { x: 0, y: 0 });

engine.drawGridLines(1, 1, "#1e293b", 0);
engine.drawRect({ x: 0, y: 0, size: 1, radius: 4, style: { fillStyle: "#22c55e" } }, 1);
engine.drawText(
    {
        x: 0,
        y: -1,
        text: "Spawn",
        size: 0.35,
        style: { fillStyle: "#e2e8f0", fontFamily: "sans-serif", textAlign: "center" },
    },
    2,
);

engine.onClick = (coords) => {
    console.log("Clicked tile:", coords.snapped);
};

engine.render();
```

## React Quick Start

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const tiles = [
    { x: 0, y: 0, size: 1, style: { fillStyle: "#22c55e" } },
    { x: 1, y: 0, size: 1, style: { fillStyle: "#38bdf8" } },
];

export function Map() {
    const engine = useCanvasTileEngine();

    return (
        <CanvasTileEngine
            engine={engine}
            renderer={new RendererCanvas()}
            config={{
                scale: 48,
                size: { width: 800, height: 500 },
                eventHandlers: { drag: true, zoom: true, click: true },
            }}
            center={{ x: 0, y: 0 }}
            onClick={(coords) => console.log(coords.snapped)}
        >
            <CanvasTileEngine.GridLines cellSize={1} strokeStyle="#1e293b" layer={0} />
            <CanvasTileEngine.Rect items={tiles} layer={1} />
        </CanvasTileEngine>
    );
}
```

## Next Steps

- Install the package for your platform: [Installation](./installation.md).
- Choose a renderer: [Renderers](./renderers.md).
- Learn the config object: [Configuration](./config.md).
- Use the imperative web API: [JavaScript](../js/installation.md).
- Use declarative React components: [React](../react/installation.md).
- Build native maps: [React Native](../react-native/installation.md).
- Generate image buffers: [Server Rendering](../server/rendering.md).
