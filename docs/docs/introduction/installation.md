---
sidebar_position: 2
---

# Installation

Install the core engine plus the renderer or binding for your target platform.

## Vanilla Web

Canvas2D:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-canvas
```

WebGL:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-webgl
```

Minimal setup:

```ts
import { CanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const config: CanvasTileEngineConfig = { scale: 48, size: { width: 800, height: 500 } };

const wrapper = document.getElementById("map") as HTMLDivElement;
const engine = new CanvasTileEngine(wrapper, config, new RendererCanvas(), { x: 0, y: 0 });
```

The wrapper must contain a `<canvas>` element for `RendererCanvas` and `RendererWebGL`.

## React Web

Canvas2D:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react @canvas-tile-engine/renderer-canvas
```

WebGL:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react @canvas-tile-engine/renderer-webgl
```

```tsx
import { CanvasTileEngine, useCanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const config: CanvasTileEngineConfig = { scale: 48, size: { width: 800, height: 500 } };

function App() {
    const engine = useCanvasTileEngine();

    return <CanvasTileEngine engine={engine} renderer={new RendererCanvas()} config={config} />;
}
```

## React Native

Expo:

```bash
npx expo install @shopify/react-native-skia
npm install @canvas-tile-engine/core @canvas-tile-engine/react-native @canvas-tile-engine/renderer-skia
```

Bare React Native:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react-native @canvas-tile-engine/renderer-skia @shopify/react-native-skia
cd ios && pod install
```

`@shopify/react-native-skia` is a native module and must be a direct dependency of the app.

## Server Rendering

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-server
```

The server renderer uses `@napi-rs/canvas` and renders PNG, JPEG, or WebP buffers in Node.js.

## Local Development

This repository uses pnpm workspaces and Turborepo.

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

Run an example from the workspace:

```bash
pnpm --filter vanilla-js-game-map dev
pnpm --filter react-game-map dev
pnpm --filter react-responsive-game-map dev
pnpm --filter react-pixel-paint dev
pnpm --filter react-spritesheet dev
pnpm --filter renderer-server-game-map start
```
