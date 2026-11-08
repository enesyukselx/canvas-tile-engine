# @canvas-tile-engine/react

[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/react)](https://www.npmjs.com/package/@canvas-tile-engine/react)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@canvas-tile-engine/react)](https://bundlephobia.com/package/@canvas-tile-engine/react)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/react)](../../LICENSE)

Declarative React bindings for Canvas Tile Engine. Build interactive maps, editors, boards, minimaps, and spatial UIs with React components while keeping the core engine available through a hook.

The React package wraps `@canvas-tile-engine/core` with a stable engine handle and compound draw components such as `Rect`, `Circle`, `Image`, `Sprite`, `GridLines`, `Line`, `Text`, `Path`, `StaticRect`, `StaticCircle`, `StaticImage`, and `DrawFunction`.

## Install

Canvas2D:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react @canvas-tile-engine/renderer-canvas
```

WebGL:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react @canvas-tile-engine/renderer-webgl
```

## Quick Start

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
                backgroundColor: "#0f172a",
                eventHandlers: { drag: true, zoom: true, hover: true, click: true },
            }}
            center={{ x: 0, y: 0 }}
            onClick={(coords) => console.log("Clicked:", coords.snapped)}
        >
            <CanvasTileEngine.GridLines cellSize={1} strokeStyle="#1e293b" layer={0} />
            <CanvasTileEngine.Rect items={tiles} layer={1} />
            <CanvasTileEngine.Text
                items={{ x: 0, y: -1, text: "Spawn", size: 0.35, style: { fillStyle: "#e2e8f0" } }}
                layer={2}
            />
        </CanvasTileEngine>
    );
}
```

`scale` is the zoom level in screen pixels per world unit, so at `scale: 48` a `size: 1` cell is 48 px wide. Sizes, `radius`, and shape `lineWidth` are world units and zoom with the camera; fields ending in `Px` and the `GridLines` line width are screen pixels.

## Renderer Choice

The renderer is a prop, so switching from Canvas2D to WebGL is intentionally small:

```tsx
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";

<CanvasTileEngine engine={engine} config={config} renderer={new RendererWebGL()} />;
```

`config`, `center`, and `renderer` are read when the component mounts. Use runtime APIs such as `engine.setBounds`, `engine.setEventHandlers`, `engine.resize`, `engine.setCenter`, and `engine.goCenter` for live updates, or remount the component with a new `key` to apply a new full config or renderer.

## Components

| Component                                  | Draws                                    |
| ------------------------------------------ | ---------------------------------------- |
| `CanvasTileEngine.Rect` / `StaticRect`     | Dynamic or cached rectangles.            |
| `CanvasTileEngine.Circle` / `StaticCircle` | Dynamic or cached circles.               |
| `CanvasTileEngine.Image` / `StaticImage`   | Images or spritesheet source rectangles. |
| `CanvasTileEngine.Sprite`                  | Animated spritesheet frames.             |
| `CanvasTileEngine.GridLines`               | Infinite grid lines in world space.      |
| `CanvasTileEngine.Line`                    | Line segments between world points.      |
| `CanvasTileEngine.Path`                    | Polylines through world points.          |
| `CanvasTileEngine.Text`                    | Text positioned in world space.          |
| `CanvasTileEngine.DrawFunction`            | Custom renderer-specific drawing.        |

For large arrays, keep `items` stable with `useMemo` or state. A new array identity re-registers the draw callback and can rebuild spatial indexes.

## Imperative Access

`useCanvasTileEngine()` returns a safe handle. Methods no-op before mount, `isReady` tells you when the real engine is attached, and `engine.instance` is the attached engine (`null` before mount).

Key imperative effects on `engine.instance`: it changes with every new engine, so the effect also runs again after a `key` remount, while an effect keyed on `isReady` does not. Keep the effect idempotent by removing what it drew in a cleanup: it can run twice as the engine attaches, and without a cleanup every run adds its draws again, so they paint and hit-test more than once.

```tsx
import { useEffect } from "react";
import { CanvasTileEngine, useCanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const config: CanvasTileEngineConfig = { scale: 48, size: { width: 800, height: 500 } };

export function ImperativeMap() {
    const engine = useCanvasTileEngine();

    useEffect(() => {
        if (!engine.instance) return;

        const grid = engine.drawGridLines(1, 1, "#334155", 0);
        const dot = engine.drawCircle({ x: 2, y: 1, size: 0.8, style: { fillStyle: "#f97316" } }, 1);
        engine.render();

        return () => {
            engine.removeDrawHandle(grid);
            engine.removeDrawHandle(dot);
        };
    }, [engine, engine.instance]);

    return <CanvasTileEngine engine={engine} config={config} renderer={new RendererCanvas()} />;
}
```

The component and the core engine class share the name `CanvasTileEngine`. Import the component from this package; the class is re-exported here as `CanvasTileEngineCore`, which is the type of `engine.instance`.

## Images And Sprites

```tsx
import { useEffect, useMemo, useState } from "react";
import { CanvasTileEngine, SpriteSheet, type EngineHandle } from "@canvas-tile-engine/react";

function UnitLayer({ engine }: { engine: EngineHandle }) {
    const [img, setImg] = useState<HTMLImageElement | null>(null);
    const sheet = useMemo(() => new SpriteSheet({ frameWidth: 32, frameHeight: 32, columns: 8 }), []);
    const frames = useMemo(() => sheet.framesInRow(0, 0, 5), [sheet]);

    useEffect(() => {
        if (engine.isReady) engine.loadImage("/unit.png").then(setImg);
    }, [engine, engine.isReady]);

    if (!img) return null;

    return <CanvasTileEngine.Sprite items={{ x: 4, y: 2, size: 1, img }} frames={frames} fps={8} layer={2} />;
}
```

## Documentation

- Full docs: [canvastileengine.dev](https://www.canvastileengine.dev/docs/react/installation)
- Core package: [`@canvas-tile-engine/core`](../core)
- React Native equivalent: [`@canvas-tile-engine/react-native`](../react-native)

## License

MIT
