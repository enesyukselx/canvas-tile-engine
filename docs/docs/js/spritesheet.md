---
sidebar_position: 9
---

# Spritesheet & Animation

A spritesheet packs many frames into a single image. Instead of loading dozens of separate files, you load **one sheet** (one network request, one decode, one texture on WebGL) and draw sub-regions of it per item.

Support comes in three layers, each building on the previous one:

1. **`sprite`** — a source rectangle on any `ImageItem` (the primitive)
2. **`SpriteSheet`** — maps grid positions like `(col, row)` to source rectangles
3. **`SpriteAnimator`** — flips through frames over time

All renderers (`renderer-canvas`, `renderer-webgl`, `renderer-skia`, `renderer-server`) support sprites with identical results.

## Drawing a Sheet Region (`sprite`)

Every `ImageItem` accepts an optional `sprite` property — a pixel rectangle inside the image. When set, only that region is drawn, and the aspect ratio is derived from the frame instead of the whole image.

```typescript
const sheet = await engine.images.load("/assets/dragon.png");

// Draw the 144x128 frame located at pixel (288, 0) of the sheet
engine.drawImage({
    x: 5,
    y: 3,
    size: 2,
    img: sheet,
    sprite: { x: 288, y: 0, w: 144, h: 128 },
});
```

| Property | Type     | Description                                  |
| :------- | :------- | :------------------------------------------- |
| `x`, `y` | `number` | Top-left corner of the frame in sheet pixels. |
| `w`, `h` | `number` | Frame size in sheet pixels.                   |

:::tip
`sprite` also works with `drawStaticImage` for cached static content — but note that animation is not possible on the static path, since the cache freezes whatever frame was set at build time.
:::

## Grid Sheets (`SpriteSheet`)

Most sheets are uniform grids. `SpriteSheet` does the pixel math for you — it holds no image reference, it is a pure calculator.

```typescript
import { SpriteSheet } from "@canvas-tile-engine/core";

// A 432x512 sheet with 3 columns x 4 rows of 144x128 frames
const sheet = new SpriteSheet({ frameWidth: 144, frameHeight: 128, columns: 3 });

// By grid position
engine.drawImage({ x: 5, y: 3, img, sprite: sheet.frame(2, 1) });

// By linear index (left-to-right, top-to-bottom; requires `columns`)
engine.drawImage({ x: 7, y: 3, img, sprite: sheet.frameByIndex(7) });
```

**Options:**

| Option        | Type     | Default      | Description                                        |
| :------------ | :------- | :----------- | :-------------------------------------------------- |
| `frameWidth`  | `number` | **Required** | Width of a single frame in pixels.                  |
| `frameHeight` | `number` | **Required** | Height of a single frame in pixels.                 |
| `columns`     | `number` | -            | Number of columns; needed for `frameByIndex`.       |
| `margin`      | `number` | `0`          | Outer offset from the sheet edges.                  |
| `spacing`     | `number` | `0`          | Gap between adjacent frames.                        |

**Methods:**

| Method                              | Returns        | Description                                          |
| :---------------------------------- | :------------- | :---------------------------------------------------- |
| `frame(col, row)`                   | `SpriteRect`   | Source rect of the frame at a grid position.          |
| `frameByIndex(index)`               | `SpriteRect`   | Source rect by linear index.                          |
| `framesInRow(row, startCol, endCol)`| `SpriteRect[]` | Consecutive frames of one row — ideal for animations. |

:::tip WebGL & frame bleeding
On the WebGL renderer, zooming can sample a sliver of the neighboring frame at frame edges (texture bleeding). If you see this, author your sheet with a few pixels of `spacing` between frames and pass it to `SpriteSheet`.
:::

## Animation (`SpriteAnimator`)

`SpriteAnimator` plays a list of frames at a fixed fps. Its callback fires **only when the frame index changes**, so renders happen at the animation's fps — not at 60fps.

```typescript
import { SpriteAnimator, SpriteSheet } from "@canvas-tile-engine/core";

const sheet = new SpriteSheet({ frameWidth: 144, frameHeight: 128, columns: 3 });

const item = { x: 5, y: 3, size: 2, img, sprite: sheet.frame(0, 0) };
engine.drawImage(item);

const animator = new SpriteAnimator({
    frames: sheet.framesInRow(0, 0, 2), // frames (0,0) -> (2,0)
    fps: 8,
});

animator.start((frame) => {
    item.sprite = frame; // mutate the drawn item...
    engine.render();     // ...and repaint
});
```

Because the callback just mutates the item and re-renders, animation works identically on **every renderer** — there is no renderer-specific animation code.

**`SpriteAnimation` options:**

| Option   | Type           | Default      | Description                                   |
| :------- | :------------- | :----------- | :--------------------------------------------- |
| `frames` | `SpriteRect[]` | **Required** | Frames in play order.                          |
| `fps`    | `number`       | **Required** | Playback speed in frames per second.           |
| `loop`   | `boolean`      | `true`       | Restart from the first frame after the last.   |

**Methods:**

| Method                          | Description                                                             |
| :------------------------------ | :----------------------------------------------------------------------- |
| `start(onFrame, onComplete?)`   | Start playback; fires immediately with the first frame.                  |
| `stop()`                        | Stop playback; the last applied frame stays drawn.                       |
| `isRunning()`                   | Whether the loop is currently scheduled.                                 |
| `frameAt(elapsedMs)`            | Pure timing math — the frame for a given elapsed time (useful in tests). |

```typescript
// One-shot animation (e.g. an explosion)
const boom = new SpriteAnimator({ frames: explosionFrames, fps: 12, loop: false });
boom.start(
    (frame) => {
        item.sprite = frame;
        engine.render();
    },
    () => engine.removeDrawHandle(handle), // clean up when finished
);
```

:::info Full example
See `examples/vanilla-js-examples/spritesheet` in the repository for a complete runnable demo — four flap-cycle animations from a single dragon sheet, with click-to-pause.

```bash
pnpm dev:example --example=vanilla-js-spritesheet
```

:::
