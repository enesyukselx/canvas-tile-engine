# @canvas-tile-engine/react-native

[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/react-native)](https://www.npmjs.com/package/@canvas-tile-engine/react-native)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/react-native)](../../LICENSE)

React Native bindings for [Canvas Tile Engine](https://github.com/enesyukselx/canvas-tile-engine), rendered with [Skia](https://shopify.github.io/react-native-skia/).

The API is **1:1 with [`@canvas-tile-engine/react`](../react)** — same `useCanvasTileEngine` hook, same `<CanvasTileEngine>` component with the same compound draw components (`Rect`, `Circle`, `Image`, `GridLines`, `Line`, `Text`, `Path`, `StaticRect`, `StaticCircle`, `StaticImage`, `DrawFunction`), same context. You can copy a screen from the web package and the only things to change are the **renderer** (`RendererSkia` instead of `RendererCanvas`), `style` (a `ViewStyle` instead of `className`/CSS), and images (`SkImage` instead of `HTMLImageElement`).

## Install

```bash
npm install @canvas-tile-engine/react-native @canvas-tile-engine/renderer-skia @shopify/react-native-skia
```

> `@shopify/react-native-skia` requires `react-native-reanimated`. Follow its [installation guide](https://shopify.github.io/react-native-skia/docs/getting-started/installation).

## Usage

### Declarative (compound components)

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react-native";
import { RendererSkia } from "@canvas-tile-engine/renderer-skia";

function Map() {
    const engine = useCanvasTileEngine();

    return (
        <CanvasTileEngine
            engine={engine}
            renderer={new RendererSkia()}
            config={{ size: { width: 0, height: 0 }, scale: 32, minScale: 8, maxScale: 64 }}
            style={{ flex: 1 }}
        >
            <CanvasTileEngine.GridLines cellSize={1} layer={0} />
            <CanvasTileEngine.Circle items={markers} layer={2} />
        </CanvasTileEngine>
    );
}
```

### Imperative

```tsx
function Map() {
    const engine = useCanvasTileEngine();

    useEffect(() => {
        if (engine.isReady) {
            engine.drawGridLines(1);
            engine.render();
        }
    }, [engine.isReady]);

    return <CanvasTileEngine engine={engine} renderer={new RendererSkia()} config={config} style={{ flex: 1 }} />;
}
```

The `config.size` you pass is a placeholder — the component measures its `View` via `onLayout` and sizes the engine to fill it, so `{ width: 0, height: 0 }` is fine.

## How it differs from the web package

|              | `@canvas-tile-engine/react`        | `@canvas-tile-engine/react-native`  |
| ------------ | ---------------------------------- | ----------------------------------- |
| Renderer     | `RendererCanvas` / `RendererWebGL` | `RendererSkia`                      |
| Mount        | `<div><canvas/></div>`             | Skia `<Canvas>` inside a `<View>`   |
| Styling      | `className` / `CSSProperties`      | `ViewStyle`                         |
| Images       | `HTMLImageElement`                 | `SkImage` (`engine.loadImage(uri)`) |
| `onDraw` ctx | `CanvasRenderingContext2D`         | `SkCanvas`                          |
| Gestures     | DOM mouse/touch/wheel              | touch pan + pinch (tap = click)     |

Everything else — the hook handle, draw components, layers, culling, camera/coordinate math — is identical.

## License

MIT
