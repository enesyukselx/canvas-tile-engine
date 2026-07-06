# @canvas-tile-engine/renderer-skia

[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/renderer-skia)](https://www.npmjs.com/package/@canvas-tile-engine/renderer-skia)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/renderer-skia)](../../LICENSE)

React Native (Skia) renderer for [Canvas Tile Engine](https://github.com/enesyukselx/canvas-tile-engine). It implements the same `IRenderer` contract as the DOM renderers, drawing primitives with [`@shopify/react-native-skia`](https://shopify.github.io/react-native-skia/).

Most apps should not use this package directly — use [`@canvas-tile-engine/react-native`](../react-native), which wires the Skia `<Canvas>`, layout and gestures to this renderer for you.

## Install

```bash
npm install @canvas-tile-engine/renderer-skia @shopify/react-native-skia
```

## How it works

-   Primitives (`drawRect`, `drawCircle`, `drawImage`, `drawText`, `drawLine`, `drawPath`, `drawGridLines`) are drawn onto an `SkCanvas` that the host records into a frame `SkPicture` once per camera change.
-   Colors are parsed by Skia (`Skia.Color`), so any CSS-style color string works without a DOM parser.
-   Images are decoded to `SkImage` via the package's `SkiaImageLoader` (`engine.images.load(uri)`).
-   The renderer is platform-agnostic about mounting: the host implements the `SkiaMount` contract (size, dpr, `present(paint)`), and forwards normalized touch input via the renderer's `dispatch*` methods.

### Differences from the Canvas2D renderer

-   **Static caches** (`drawStaticRect/Circle/Image`) record the item set once into an `SkPicture` (keyed by `cacheKey`) and replay it per frame under the camera transform — per-frame cost is independent of item count, making them the right choice for thousands of non-changing items.
-   **Coordinate overlay and debug HUD** are not yet implemented for Skia.
-   Drawing happens in logical (dp) units; Skia handles device pixel ratio for you.

## Mount contract

```ts
import type { SkCanvas } from "@shopify/react-native-skia";

interface SkiaMount {
    getSize(): { width: number; height: number };
    getDpr(): number;
    present(paint: (canvas: SkCanvas) => void): void;
}
```

## License

MIT
