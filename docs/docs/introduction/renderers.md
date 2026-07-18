---
sidebar_position: 3
---

# Renderers

The core engine does not draw by itself. It delegates drawing, image loading, event binding, resize behavior, and platform-specific output to an injected renderer.

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const engine = new CanvasTileEngine(wrapper, config, new RendererCanvas(), { x: 0, y: 0 });
```

## Official Renderers

| Renderer | Package | Target | Notes |
| :-- | :-- | :-- | :-- |
| `RendererCanvas` | `@canvas-tile-engine/renderer-canvas` | Browser Canvas2D | Default web renderer. Full primitive support, DOM events, high-DPI sizing, static offscreen caches. |
| `RendererWebGL` | `@canvas-tile-engine/renderer-webgl` | Browser WebGL | GPU batches rects, circles, images, lines, paths, and grids. Text and custom draw functions use a 2D overlay. |
| `RendererSkia` | `@canvas-tile-engine/renderer-skia` | React Native Skia | Used through `@canvas-tile-engine/react-native`; records frames as Skia pictures. |
| `RendererServer` | `@canvas-tile-engine/renderer-server` | Node.js | Headless output to PNG, JPEG, or WebP `Buffer`. No DOM events. |

## Switching Renderers

Canvas2D to WebGL usually only changes the renderer instance:

```ts
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";

new CanvasTileEngine(wrapper, config, new RendererCanvas());
new CanvasTileEngine(wrapper, config, new RendererWebGL());
```

React uses the same pattern:

```tsx
import { CanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";

<CanvasTileEngine engine={engine} config={config} renderer={new RendererWebGL()} />;
```

## Feature Notes

| Capability | Canvas2D | WebGL | Skia | Server |
| :-- | :-- | :-- | :-- | :-- |
| Rect/circle/image/text/line/path/grid | Yes | Yes | Yes | Yes |
| Browser mouse/touch/wheel events | Yes | Yes | No | No |
| Native touch events | No | No | Via React Native host | No |
| Static cache behavior | Offscreen canvas cache | Delegates to dynamic batched drawing | SkPicture cache | Offscreen canvas cache |
| Custom draw context | `CanvasRenderingContext2D` | 2D overlay context | `SkCanvas` | `SKRSContext2D` |
| Image type | `HTMLImageElement` | `HTMLImageElement` / `TexImageSource` | `SkImage` | `@napi-rs/canvas` `Image` |

:::info WebGL overlay ordering
`RendererWebGL` draws geometry on the WebGL canvas and text/custom drawing/debug/coordinate overlay on a stacked 2D canvas. Text and custom draw functions therefore composite above WebGL primitives even when their layer number is lower. Ordering within each surface is still layer-based.
:::

## Renderer Interface

Renderers implement `IRenderer<TMount, TImage>` from `@canvas-tile-engine/core`.

```ts
interface IRenderer<TMount = HTMLDivElement, TImage = HTMLImageElement> {
    init(deps: RendererDependencies<TMount>): void;
    render(): void;
    resize(width: number, height: number): void;
    resizeWithAnimation(width: number, height: number, durationMs: number, onComplete?: () => void): void;
    destroy(): void;
    getDrawAPI(): IDrawAPI<TImage>;
    getImageLoader(): IImageLoader<TImage>;
    setupEvents(): void;
}
```

The draw API is platform-agnostic and returns `DrawHandle` values that can be removed later.

```ts
interface IDrawAPI<TImage = HTMLImageElement> {
    addDrawFunction(
        fn: (ctx: unknown, coords: Coords, config: Required<CanvasTileEngineConfig>) => void,
        layer?: number,
    ): DrawHandle;
    drawRect(items: Rect | Rect[], layer?: number): DrawHandle;
    drawCircle(items: Circle | Circle[], layer?: number): DrawHandle;
    drawLine(items: Line | Line[], style?: LineStyle, layer?: number): DrawHandle;
    drawText(items: Text | Text[], layer?: number): DrawHandle;
    drawImage(items: ImageItem<TImage> | ImageItem<TImage>[], layer?: number): DrawHandle;
    drawPath(items: PathItem[], layer?: number): DrawHandle;
    drawGridLines(cellSize: number, style: { lineWidth: number; strokeStyle: string }, layer?: number): DrawHandle;
    drawStaticRect(items: Rect[], cacheKey: string, layer?: number): DrawHandle;
    drawStaticCircle(items: Circle[], cacheKey: string, layer?: number): DrawHandle;
    drawStaticImage(items: ImageItem<TImage>[], cacheKey: string, layer?: number): DrawHandle;
    removeDrawHandle(handle: DrawHandle): void;
    clearLayer(layer: number): void;
    clearAll(): void;
    clearStaticCache(cacheKey?: string): void;
}
```

## Choosing A Renderer

Start with `RendererCanvas` unless you already know you need another backend.

- Use `RendererCanvas` for browser apps, editors, docs, and medium-sized scenes.
- Use `RendererWebGL` when dynamic geometry or image layers are too heavy for Canvas2D.
- Use `@canvas-tile-engine/react-native` with `RendererSkia` for native mobile maps.
- Use `renderToBuffer` or `RendererServer` for OG images, thumbnails, snapshot tests, and pre-rendered assets.
