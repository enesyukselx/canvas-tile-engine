# @canvas-tile-engine/renderer-skia

[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/renderer-skia)](https://www.npmjs.com/package/@canvas-tile-engine/renderer-skia)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/renderer-skia)](../../LICENSE)

React Native Skia renderer for Canvas Tile Engine. It implements the same `IRenderer` contract as the DOM renderers, but draws primitives onto a Skia `SkCanvas`.

Most apps should install [`@canvas-tile-engine/react-native`](../react-native) instead of mounting this renderer directly. The React Native package wires the Skia `<Canvas>`, layout measurement, touch gestures, tap detection, and render presentation for you.

## Install

For app usage through the React Native bindings:

```bash
npx expo install @shopify/react-native-skia
npm install @canvas-tile-engine/core @canvas-tile-engine/react-native @canvas-tile-engine/renderer-skia
```

For bare React Native:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react-native @canvas-tile-engine/renderer-skia @shopify/react-native-skia
cd ios && pod install
```

`@shopify/react-native-skia` is a native module and must be a direct dependency of the app. On Expo, prefer `npx expo install @shopify/react-native-skia` so the installed version matches your SDK.

## Recommended Usage

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react-native";
import { RendererSkia } from "@canvas-tile-engine/renderer-skia";

export function Map() {
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
            <CanvasTileEngine.Circle
                items={{ x: 0, y: 0, size: 0.8, style: { fillStyle: "#22d3ee" } }}
                layer={1}
            />
        </CanvasTileEngine>
    );
}
```

## How It Works

- Primitives (`drawRect`, `drawCircle`, `drawImage`, `drawText`, `drawLine`, `drawPath`, `drawGridLines`) are recorded into a Skia picture and presented by the host.
- Colors are parsed by Skia, so common CSS-style color strings work without a DOM parser.
- Images are decoded to `SkImage` through the renderer image loader (`engine.images.load(uri)` or the native hook's `engine.loadImage(uri)`).
- Static draw helpers record non-changing item sets into Skia pictures keyed by `cacheKey`, then replay them under the current camera transform.
- The debug HUD is offset from the top so it stays visible below status bars and notches.

## Mount Contract

If you are building your own host instead of using `@canvas-tile-engine/react-native`, provide a `SkiaMount`:

```ts
import type { SkCanvas } from "@canvas-tile-engine/renderer-skia";

interface SkiaMount {
    getSize(): { width: number; height: number };
    getDpr(): number;
    present(paint: (canvas: SkCanvas) => void): void;
}
```

Then pass the mount to the core engine:

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererSkia } from "@canvas-tile-engine/renderer-skia";

const renderer = new RendererSkia();
const engine = new CanvasTileEngine(mount, config, renderer, { x: 0, y: 0 });

engine.drawGridLines(1);
engine.render();
```

The host is responsible for forwarding normalized gesture input to the renderer's `dispatch*` methods and for resizing the engine when layout changes. This is why most apps should use the React Native package.

## Custom Drawing

`addDrawFunction` and `onDraw` receive a Skia `SkCanvas`.

```ts
engine.addDrawFunction((canvas) => {
    // Draw with @shopify/react-native-skia APIs here.
}, 2);
```

## Documentation

- React Native bindings: [`@canvas-tile-engine/react-native`](../react-native)
- Core engine: [`@canvas-tile-engine/core`](../core)
- Skia docs: [shopify.github.io/react-native-skia](https://shopify.github.io/react-native-skia/)

## License

MIT
