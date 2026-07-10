# Canvas Tile Engine

[![core](https://img.shields.io/npm/v/@canvas-tile-engine/core?label=core)](https://www.npmjs.com/package/@canvas-tile-engine/core)
[![react](https://img.shields.io/npm/v/@canvas-tile-engine/react?label=react)](https://www.npmjs.com/package/@canvas-tile-engine/react)
[![react-native](https://img.shields.io/npm/v/@canvas-tile-engine/react-native?label=react-native)](https://www.npmjs.com/package/@canvas-tile-engine/react-native)
[![canvas](https://img.shields.io/npm/v/@canvas-tile-engine/renderer-canvas?label=canvas)](https://www.npmjs.com/package/@canvas-tile-engine/renderer-canvas)
[![webgl](https://img.shields.io/npm/v/@canvas-tile-engine/renderer-webgl?label=webgl)](https://www.npmjs.com/package/@canvas-tile-engine/renderer-webgl)
[![skia](https://img.shields.io/npm/v/@canvas-tile-engine/renderer-skia?label=skia)](https://www.npmjs.com/package/@canvas-tile-engine/renderer-skia)
[![server](https://img.shields.io/npm/v/@canvas-tile-engine/renderer-server?label=server)](https://www.npmjs.com/package/@canvas-tile-engine/renderer-server)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/core)](./LICENSE)

Build zoomable 2D maps, game boards, editors, minimaps, and data-heavy grid views with one renderer-agnostic TypeScript engine.

Canvas Tile Engine gives you the hard parts of a tile surface out of the box: camera movement, pan/zoom gestures, coordinate transforms, layered drawing, pointer events, viewport culling, static caches, and renderer adapters for web, native, and server output.

Start with Canvas2D. Swap to WebGL when you want batched GPU primitives. Reuse the same React component model in React Native with Skia. Render PNG/JPEG/WebP snapshots on the server with no browser.

## Why It Exists

- Grid-first API for maps, strategy games, pixel tools, editors, dashboards, and spatial UIs.
- Camera controls, bounds, smooth movement, resize handling, and pointer-to-world coordinate math are already wired.
- Draw rects, circles, images, sprites, grid lines, lines, text, paths, static layers, and custom draw functions.
- Use the core engine directly or render declaratively with React and React Native components.
- Keep large static scenes responsive with spatial indexing, viewport culling, and renderer-level caching.
- Choose the surface that fits the job: Canvas2D, WebGL, React Native Skia, or headless Node.js image output.

## Packages

| Package | Use it for |
| --- | --- |
| [`@canvas-tile-engine/core`](./packages/core) | Framework-agnostic engine, camera, events, coordinates, layers, draw API, sprites, and spatial indexing. |
| [`@canvas-tile-engine/react`](./packages/react) | Declarative React bindings with compound draw components and a reusable engine hook. |
| [`@canvas-tile-engine/react-native`](./packages/react-native) | React Native bindings with the same component API, mounted through Skia gestures and layout. |
| [`@canvas-tile-engine/renderer-canvas`](./packages/renderer-canvas) | Default HTML Canvas2D renderer with full primitive support, static caches, debug HUD, and high-DPI output. |
| [`@canvas-tile-engine/renderer-webgl`](./packages/renderer-webgl) | Drop-in WebGL renderer for batched GPU drawing of geometry, images, paths, lines, and grids. |
| [`@canvas-tile-engine/renderer-skia`](./packages/renderer-skia) | React Native Skia renderer used by the native package. |
| [`@canvas-tile-engine/renderer-server`](./packages/renderer-server) | Headless Node.js renderer for deterministic PNG/JPEG/WebP buffers, OG images, thumbnails, and snapshot tests. |

## Install

Vanilla web with Canvas2D:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-canvas
```

React web:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react @canvas-tile-engine/renderer-canvas
```

WebGL renderer:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-webgl
```

React Native with Skia on Expo:

```bash
npx expo install @shopify/react-native-skia
npm install @canvas-tile-engine/core @canvas-tile-engine/react-native @canvas-tile-engine/renderer-skia
```

Bare React Native:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react-native @canvas-tile-engine/renderer-skia @shopify/react-native-skia
cd ios && pod install
```

Server-side image rendering:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-server
```

## Quick Start

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
    size: { width: 800, height: 500, minWidth: 320, minHeight: 240 },
    backgroundColor: "#0f172a",
    eventHandlers: { drag: true, zoom: true, hover: true, click: true },
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

## React

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
            config={{
                scale: 48,
                size: { width: 800, height: 500 },
                eventHandlers: { drag: true, zoom: true, click: true },
            }}
            renderer={new RendererCanvas()}
            center={{ x: 0, y: 0 }}
            onClick={(coords) => console.log(coords.snapped)}
        >
            <CanvasTileEngine.Rect items={tiles} layer={1} />
            <CanvasTileEngine.GridLines cellSize={1} layer={0} />
        </CanvasTileEngine>
    );
}
```

Switch to WebGL by changing only the renderer:

```tsx
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";

<CanvasTileEngine engine={engine} config={config} renderer={new RendererWebGL()} />;
```

## React Native

The native package mirrors the React API: same hook, same `<CanvasTileEngine>` component, same draw components. The renderer changes from Canvas2D/WebGL to Skia.

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react-native";
import { RendererSkia } from "@canvas-tile-engine/renderer-skia";

export function NativeMap() {
    const engine = useCanvasTileEngine();

    return (
        <CanvasTileEngine
            engine={engine}
            renderer={new RendererSkia()}
            config={{
                scale: 32,
                size: { width: 0, height: 0 },
                eventHandlers: { drag: true, zoom: true, click: true },
            }}
            style={{ flex: 1 }}
        >
            <CanvasTileEngine.GridLines cellSize={1} layer={0} />
            <CanvasTileEngine.Circle items={[{ x: 0, y: 0, size: 0.8, style: { fillStyle: "#22d3ee" } }]} layer={1} />
        </CanvasTileEngine>
    );
}
```

## Server Rendering

Generate map images in Node.js for Open Graph cards, email/PDF thumbnails, CDN pre-rendering, or visual snapshot tests.

```ts
import { renderToBuffer } from "@canvas-tile-engine/renderer-server";
import { writeFile } from "node:fs/promises";

const png = await renderToBuffer({
    config: {
        scale: 40,
        size: { width: 480, height: 320 },
        backgroundColor: "#0b1021",
    },
    center: { x: 2, y: 1 },
    pixelRatio: 2,
    draw: (engine) => {
        engine.drawGridLines(1, 1, "#1e2a45", 0);
        engine.drawRect({ x: 0, y: 0, size: 0.9, radius: 6, style: { fillStyle: "#4ade80" } }, 1);
        engine.drawCircle({ x: 2, y: 2, size: 1.4, style: { fillStyle: "#22d3ee" } }, 1);
    },
});

await writeFile("map.png", png);
```

## Examples

Clone the repo and build the workspace once:

```bash
pnpm install
pnpm build
```

Then run an example:

```bash
pnpm --filter vanilla-js-game-map dev
pnpm --filter react-game-map dev
pnpm --filter react-responsive-game-map dev
pnpm --filter react-pixel-paint dev
pnpm --filter react-spritesheet dev
pnpm --filter renderer-server-game-map start
```

For package watch mode during local development, run `pnpm dev:lib` in a separate terminal before starting an example.

## Documentation

- Full docs: [canvastileengine.dev](https://canvastileengine.dev)
- Core API: [`packages/core`](./packages/core)
- React API: [`packages/react`](./packages/react)
- React Native API: [`packages/react-native`](./packages/react-native)
- Server renderer: [`packages/renderer-server`](./packages/renderer-server)

## AI Agent Skill

This repository ships an [Agent Skill](./plugins/canvas-tile-engine) that teaches AI coding agents (Claude Code and compatible tools) the full Canvas Tile Engine API, so they can build tile maps, game boards, minimaps, and pixel editors with these packages on the first try.

Install in Claude Code:

```
/plugin marketplace add enesyukselx/canvas-tile-engine
/plugin install canvas-tile-engine@canvas-tile-engine
```

Manual install (any skills-compatible agent):

```bash
npx degit enesyukselx/canvas-tile-engine/plugins/canvas-tile-engine/skills/canvas-tile-engine .claude/skills/canvas-tile-engine
```

See [plugins/canvas-tile-engine](./plugins/canvas-tile-engine) for details.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

This repository uses pnpm workspaces and Turborepo. Package tasks live in each package, and root scripts delegate through `turbo run`.

## License

MIT
