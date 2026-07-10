# Spritesheet and Animation Reference

Exports from `@canvas-tile-engine/core`: the `sprite` field on `ImageItem`,
`SpriteSheet`, `SpriteAnimator`. All four renderers (canvas, webgl, skia,
server) support sprites with identical results.

Three layers, each building on the previous:

1. `sprite` - a source rectangle on any `ImageItem` (the primitive)
2. `SpriteSheet` - maps grid positions like `(col, row)` to source rectangles
3. `SpriteAnimator` - flips through frames over time

## 1. `sprite`: draw a region of an image

```ts
const sheet = await engine.images.load("/assets/dragon.png");

// Draw the 144x128 frame located at pixel (288, 0) of the sheet
engine.drawImage({
    x: 5, y: 3, size: 2,
    img: sheet,
    sprite: { x: 288, y: 0, w: 144, h: 128 },   // SpriteRect, in SHEET PIXELS
});
```

When `sprite` is set, only that region draws and the aspect ratio derives
from the frame, not the whole image. Also works with `drawStaticImage`, but
the static cache freezes whichever frame was set at build time (no animation
on the static path).

## 2. `SpriteSheet`: grid math

A pure calculator - holds no image reference.

```ts
import { SpriteSheet } from "@canvas-tile-engine/core";

// A 432x512 sheet: 3 columns x 4 rows of 144x128 frames
const sheet = new SpriteSheet({ frameWidth: 144, frameHeight: 128, columns: 3 });

engine.drawImage({ x: 5, y: 3, img, sprite: sheet.frame(2, 1) });        // (col, row)
engine.drawImage({ x: 7, y: 3, img, sprite: sheet.frameByIndex(7) });    // linear index
```

Options:

| Option | Type | Default | Description |
| :-- | :-- | :-- | :-- |
| `frameWidth` | `number` | required | Frame width in sheet pixels. |
| `frameHeight` | `number` | required | Frame height in sheet pixels. |
| `columns` | `number` | - | Column count; required for `frameByIndex`. |
| `margin` | `number` | `0` | Outer offset from the sheet edges. |
| `spacing` | `number` | `0` | Gap between adjacent frames. |

Methods:

| Method | Returns | Description |
| :-- | :-- | :-- |
| `frame(col, row)` | `SpriteRect` | Source rect at a grid position. |
| `frameByIndex(index)` | `SpriteRect` | Left-to-right, top-to-bottom linear index. |
| `framesInRow(row, startCol, endCol)` | `SpriteRect[]` | Consecutive frames of one row - the usual animation input. |

WebGL note: at frame edges, zooming can sample a sliver of the neighboring
frame (texture bleeding). Author sheets with a few pixels of `spacing` and
pass it to `SpriteSheet` if this shows up.

## 3. `SpriteAnimator`: playback

Fires its callback ONLY when the frame index changes, so repaints happen at
the animation's fps, not 60fps.

```ts
import { SpriteAnimator, SpriteSheet } from "@canvas-tile-engine/core";

const sheet = new SpriteSheet({ frameWidth: 144, frameHeight: 128, columns: 3 });
const item = { x: 5, y: 3, size: 2, img, sprite: sheet.frame(0, 0) };
const handle = engine.drawImage(item);
engine.render();

const animator = new SpriteAnimator({
    frames: sheet.framesInRow(0, 0, 2),   // play (0,0) -> (2,0)
    fps: 8,
    loop: true,                           // default true
});

animator.start((frame) => {
    item.sprite = frame;   // mutate the drawn item (held by reference)...
    engine.render();       // ...and repaint
});

// later: animator.stop();
```

Options: `frames: SpriteRect[]` (required), `fps: number` (required),
`loop: boolean` (default `true`).

| Method | Description |
| :-- | :-- |
| `start(onFrame, onComplete?)` | Start playback; fires immediately with the first frame. `onComplete` fires when a non-looping run ends. |
| `stop()` | Stop; the last applied frame stays drawn. |
| `isRunning()` | Whether playback is scheduled. |
| `frameAt(elapsedMs)` | Pure timing math - frame for a given elapsed time (testing). |

One-shot effect (explosion etc.):

```ts
const boom = new SpriteAnimator({ frames: explosionFrames, fps: 12, loop: false });
boom.start(
    (frame) => { item.sprite = frame; engine.render(); },
    () => { engine.removeDrawHandle(handle); engine.render(); },  // clean up after
);
```

Because animation is just "mutate item + render", it works identically on
every renderer - there is no renderer-specific animation code. Multiple items
can share one animator callback to flip in sync (set `item.sprite` on each).

## React / React Native: `<Sprite>` component

Wraps drawImage + SpriteAnimator declaratively:

```tsx
<CanvasTileEngine.Sprite
    items={dragonItems}        // ImageItem | ImageItem[]; keep stable (useMemo).
                               // All items of one Sprite flip frames in sync.
                               // Items are cloned internally - your objects are not mutated.
    frames={frames}            // SpriteRect[]; keep stable (useMemo)
    fps={8}
    loop={true}                // default true
    playing={isPlaying}        // default true; toggling back to true restarts at frame 0
    layer={2}
    onComplete={() => {}}      // non-looping animations only
/>
```

For a fixed (non-animated) sheet frame, use `<Image>` with the item's
`sprite` field instead of `<Sprite>`.

For independent timing per unit, render multiple `<Sprite>` components (or
multiple animators in vanilla), one per timing group.
