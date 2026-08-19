---
sidebar_position: 7
---

# Image Loader

Every renderer provides an image loader through `engine.images`. The returned image type depends on the renderer.

| Renderer | `engine.images.load()` resolves to |
| :-- | :-- |
| Canvas2D / WebGL | `HTMLImageElement` |
| Server | `@napi-rs/canvas` `Image` |
| Skia | `SkImage` |

## API

```ts
const image = await engine.images.load("/assets/tree.png", 1);

engine.images.get("/assets/tree.png");
engine.images.has("/assets/tree.png");
engine.images.clear();

const unsubscribe = engine.images.onLoad(() => {
    engine.render();
});
unsubscribe();
```

| Method | Description |
| :-- | :-- |
| `load(src, retry = 1)` | Loads and caches an image. Concurrent calls for the same `src` share one in-flight promise. |
| `get(src)` | Returns a cached image without loading. |
| `has(src)` | Checks whether a source is cached. |
| `clear()` | Clears cached images and listeners. |
| `onLoad(cb)` | Subscribes to successful image loads. Returns an unsubscribe function. |

## CORS and `crossOrigin`

In the browser, the Canvas2D and WebGL renderers request images with `crossOrigin="anonymous"` by default. That makes every image request a CORS request, so a host that does not send an `Access-Control-Allow-Origin` header fails the load outright instead of merely tainting the canvas.

If your tiles or sprites come from a plain bucket, a CDN, or a third-party tile server that does not send that header, pass `crossOrigin: null` to the renderer:

```ts
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const engine = new CanvasTileEngine(wrapper, config, new RendererCanvas({ crossOrigin: null }));
```

| Value | Effect |
| :-- | :-- |
| `"anonymous"` (default) | CORS request without credentials. The host must send `Access-Control-Allow-Origin`. |
| `"use-credentials"` | CORS request that carries cookies. |
| `null` | No `crossorigin` attribute; an ordinary image request that never fails on a missing CORS header. |

:::warning WebGL needs CORS-clean images
`RendererWebGL` uploads images to the GPU, which the browser refuses for a tainted image. With `crossOrigin: null`, any cross-origin image is skipped at draw time and logged to the console. Only opt out on WebGL if every image is same-origin — otherwise serve the images with an `Access-Control-Allow-Origin` header.

`RendererCanvas` never reads pixels back, so opting out is safe there. Tainting still blocks `canvas.toDataURL()` / `getImageData()` if you call them on the engine canvas yourself.
:::

The server and Skia renderers do not use CORS and ignore this option.

## Drawing Images

```ts
const tree = await engine.images.load("/assets/tree.png");

engine.drawImage({ x: 2, y: 3, size: 1.5, img: tree }, 2);
engine.render();
```

Batch related images in one call:

```ts
const [grass, water] = await Promise.all([
    engine.images.load("/assets/grass.png"),
    engine.images.load("/assets/water.png"),
]);

engine.drawImage(
    [
        { x: 0, y: 0, size: 1, img: grass },
        { x: 1, y: 0, size: 1, img: water },
    ],
    1,
);
engine.render();
```

## Spritesheet Frames

Every `ImageItem` can draw a sub-rectangle of a larger sheet:

```ts
import { SpriteSheet } from "@canvas-tile-engine/core";

const img = await engine.images.load("/assets/units.png");
const sheet = new SpriteSheet({ frameWidth: 32, frameHeight: 32, columns: 8 });

engine.drawImage({ x: 4, y: 2, size: 1, img, sprite: sheet.frame(0, 0) }, 2);
engine.render();
```

Use [Spritesheet & Animation](./spritesheet.md) for animated frame updates.
