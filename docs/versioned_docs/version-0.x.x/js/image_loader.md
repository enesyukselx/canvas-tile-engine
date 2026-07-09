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
