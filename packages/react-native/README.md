# @canvas-tile-engine/react-native

[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/react-native)](https://www.npmjs.com/package/@canvas-tile-engine/react-native)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/react-native)](../../LICENSE)

React Native bindings for Canvas Tile Engine, rendered with [`@shopify/react-native-skia`](https://shopify.github.io/react-native-skia/).

The API mirrors [`@canvas-tile-engine/react`](../react): same `useCanvasTileEngine` hook, same `<CanvasTileEngine>` component, same compound draw components, same camera and draw APIs. The differences are the renderer (`RendererSkia`), styling (`ViewStyle`), native touch input behind the same callbacks, and image handles (`SkImage` instead of `HTMLImageElement`).

## Install

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

`@shopify/react-native-skia` is a native module and must be a direct dependency of your app so autolinking includes it in development and release builds. Skia also requires `react-native-reanimated`; follow the Skia installation guide for your React Native setup.

## Quick Start

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
                minScale: 8,
                maxScale: 96,
                size: { width: 0, height: 0 },
                backgroundColor: "#0f172a",
                eventHandlers: { drag: true, zoom: true, click: true },
            }}
            style={{ flex: 1 }}
            onClick={(coords) => console.log("Tapped:", coords.snapped)}
        >
            <CanvasTileEngine.GridLines cellSize={1} strokeStyle="#1e293b" layer={0} />
            <CanvasTileEngine.Circle items={{ x: 0, y: 0, size: 0.8, style: { fillStyle: "#22d3ee" } }} layer={1} />
        </CanvasTileEngine>
    );
}
```

The `config.size` value is only a placeholder. The component measures its wrapping `View` with `onLayout` and resizes the engine to fill it, so `{ width: 0, height: 0 }` is expected.

## Components

The same draw components are available on native:

`Rect`, `Circle`, `Image`, `Sprite`, `GridLines`, `Line`, `Text`, `Path`, `StaticRect`, `StaticCircle`, `StaticImage`, and `DrawFunction`.

For large arrays, keep `items` stable with `useMemo` or state. A new array identity re-registers the draw callback and can rebuild spatial indexes.

## Imperative Access

```tsx
import { useEffect } from "react";
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react-native";
import { RendererSkia } from "@canvas-tile-engine/renderer-skia";

export function ImperativeNativeMap() {
    const engine = useCanvasTileEngine();

    useEffect(() => {
        if (!engine.isReady) return;

        engine.drawGridLines(1, 1, "#334155", 0);
        engine.drawRect({ x: 1, y: 1, size: 1, style: { fillStyle: "#4ade80" } }, 1);
        engine.render();
    }, [engine, engine.isReady]);

    return <CanvasTileEngine engine={engine} renderer={new RendererSkia()} config={config} style={{ flex: 1 }} />;
}
```

## Images And Sprites

Use `engine.loadImage(uri)` to decode a URI into a Skia `SkImage`.

```tsx
import { useEffect, useMemo, useState } from "react";
import { CanvasTileEngine, SpriteSheet, type EngineHandle, type SkImage } from "@canvas-tile-engine/react-native";

function UnitLayer({ engine }: { engine: EngineHandle }) {
    const [img, setImg] = useState<SkImage | null>(null);
    const sheet = useMemo(() => new SpriteSheet({ frameWidth: 32, frameHeight: 32, columns: 8 }), []);
    const frames = useMemo(() => sheet.framesInRow(0, 0, 5), [sheet]);

    useEffect(() => {
        if (engine.isReady) engine.loadImage("https://example.com/unit.png").then(setImg);
    }, [engine, engine.isReady]);

    if (!img) return null;

    return <CanvasTileEngine.Sprite items={{ x: 4, y: 2, size: 1, img }} frames={frames} fps={8} layer={2} />;
}
```

## Web vs Native

| Concern             | React web                                       | React Native                                 |
| ------------------- | ----------------------------------------------- | -------------------------------------------- |
| Renderer            | `RendererCanvas` or `RendererWebGL`             | `RendererSkia`                               |
| Mount               | `<div><canvas /></div>`                         | Skia `<Canvas>` inside a `<View>`            |
| Styling             | `className` / `CSSProperties`                   | `ViewStyle`                                  |
| Images              | `HTMLImageElement`                              | `SkImage`                                    |
| Custom draw context | `CanvasRenderingContext2D` or overlay context   | `SkCanvas`                                   |
| Input               | DOM mouse/touch/wheel behind the same callbacks | Native touch input behind the same callbacks |

Everything else - hook handle, draw components, layers, culling, camera math, coordinate callbacks, and sprite helpers - is shared.

## Notes

- `config`, `center`, and `renderer` are read when the native engine is created. Remount with a new `key` to apply a new full config or renderer.
- Use `engine.setEventHandlers`, `engine.setBounds`, `engine.updateCoords`, `engine.goCoords`, `engine.setScale`, `zoomIn`, and `zoomOut` for runtime changes.
- `onDraw` and `DrawFunction` receive a Skia `SkCanvas`.
- Static draw helpers record and replay Skia pictures, which is useful for thousands of non-changing items.

## Documentation

- React package: [`@canvas-tile-engine/react`](../react)
- Skia renderer: [`@canvas-tile-engine/renderer-skia`](../renderer-skia)
- Repository: [github.com/enesyukselx/canvas-tile-engine](https://github.com/enesyukselx/canvas-tile-engine)

## License

MIT
