# Spritesheet and Animation Reference

The `sprite` field on `ImageItem`, `SpriteSheet` and `SpriteAnimator` (from
`@canvas-tile-engine/core`, also re-exported by the React/RN bindings), and
the React/RN `<Sprite>` component. All four renderers (canvas, webgl, skia,
server) draw sprites identically.

Contents:

- [1. `sprite`: draw a region of an image](#1-sprite-draw-a-region-of-an-image)
- [2. `SpriteSheet`: grid math](#2-spritesheet-grid-math)
- [3. `SpriteAnimator`: playback](#3-spriteanimator-playback)
- [Reduced motion](#reduced-motion)
- [React / React Native: `<Sprite>` component](#react--react-native-sprite-component)

Three layers, each building on the previous:

1. `sprite` - a source rectangle on any `ImageItem` (the primitive)
2. `SpriteSheet` - maps grid positions like `(col, row)` to source rectangles
3. `SpriteAnimator` - flips through frames over time

## 1. `sprite`: draw a region of an image

```ts
const img = await engine.images.load("/assets/dragon.png");

// Draw the 144x128 frame located at pixel (288, 0) of the sheet
engine.drawImage({
    x: 5, y: 3, size: 2,
    img,
    sprite: { x: 288, y: 0, w: 144, h: 128 },   // SpriteRect, in SHEET PIXELS
});
```

When `sprite` is set, only that region draws and the aspect ratio derives
from the frame, not the whole image. `drawStaticImage` accepts it too, but
the static cache freezes whichever frame was set at build time.

## 2. `SpriteSheet`: grid math

A pure calculator - holds no image reference.

```ts
import { SpriteSheet } from "@canvas-tile-engine/core";

// A 432x512 sheet: 3 columns x 4 rows of 144x128 frames
const sheet = new SpriteSheet({ frameWidth: 144, frameHeight: 128, columns: 3 });
const img = await engine.images.load("/assets/dragon.png");

engine.drawImage({ x: 5, y: 3, img, sprite: sheet.frame(2, 1) });        // (col, row)
engine.drawImage({ x: 7, y: 3, img, sprite: sheet.frameByIndex(7) });    // linear index
const walk = sheet.framesInRow(0, 0, 2); // (row, startCol, endCol): (0,0), (1,0), (2,0)
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
| `framesInRow(row, startCol, endCol)` | `SpriteRect[]` | Consecutive frames of one row, `endCol` INCLUSIVE - the usual animation input. |

Traps: `framesInRow` takes the ROW first, unlike `frame(col, row)`; a
four-frame row is `framesInRow(row, 0, 3)`, and `endCol < startCol` throws.
The constructor throws on non-positive frame sizes or a non-integer
`columns`, `frame` on negative positions, `frameByIndex` without `columns`.
Positions are not checked against the image size.

WebGL note: at frame edges, zooming can sample a sliver of the neighboring
frame (texture bleeding). Author sheets with a few pixels of `spacing` and
pass it to `SpriteSheet` if this shows up.

## 3. `SpriteAnimator`: playback

Fires its callback ONLY when the frame index changes, so repaints happen at
the animation's fps, not 60fps.

```ts
import { SpriteAnimator, SpriteSheet } from "@canvas-tile-engine/core";

const sheet = new SpriteSheet({ frameWidth: 144, frameHeight: 128, columns: 3 });
const img = await engine.images.load("/assets/dragon.png");
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

Options: `frames: SpriteRect[]` (required, non-empty), `fps: number`
(required, > 0), `loop: boolean` (default `true`); the constructor throws on
an invalid `frames` or `fps`.

| Method | Description |
| :-- | :-- |
| `start(onFrame, onComplete?)` | Start (or restart) playback; `onFrame(frame, index)` fires immediately with the first frame. `onComplete` fires when a non-looping run ends. |
| `stop()` | Stop; the last applied frame stays drawn. |
| `isRunning()` | Whether playback is scheduled. |
| `frameAt(elapsedMs)` / `frameIndexAt(elapsedMs)` | Pure timing math - the frame for a given elapsed time (tests, manual stepping). |

Frame callbacks may call `stop()` or `start()` safely, including during the
immediate first frame; that cancels the old run's remaining frames and
`onComplete`. `onComplete` may also start a new run. Without
`requestAnimationFrame` (server), `start` applies the first frame only and,
for `loop: false`, calls `onComplete` right away.

One-shot effect (explosion etc.):

```ts
const boom = new SpriteAnimator({ frames: explosionFrames, fps: 12, loop: false });
boom.start(
    (frame) => { item.sprite = frame; engine.render(); },
    () => { engine.removeDrawHandle(handle); engine.render(); },  // clean up after
);
```

Animation is just "mutate item + render", so it works identically on every
renderer. Multiple items can share one animator callback to flip in sync
(set `item.sprite` on each); use one animator per timing group otherwise.

## Reduced motion

`SpriteAnimator` and `<Sprite>` ignore `accessibility.reducedMotion`
(core >= 0.12) - it only makes camera animations instant. To honor it, check
`engine.getReducedMotion()` before starting and show a still frame instead
(`playing={!engine.getReducedMotion()}` in React). It is poll-only: no event
reports an OS-level change, so re-check whenever you (re)start. Config and
the `setReducedMotion` API: [core-api.md](core-api.md#accessibility-and-reduced-motion).

## React / React Native: `<Sprite>` component

Wraps `drawImage` + `SpriteAnimator` declaratively; render it inside
`<CanvasTileEngine>` like any draw component.

```tsx
import { CanvasTileEngine, SpriteSheet, type ImageItem } from "@canvas-tile-engine/react";
import { useMemo } from "react";

const sheet = new SpriteSheet({ frameWidth: 144, frameHeight: 128, columns: 3 });

function Dragons({ img, playing }: { img: HTMLImageElement; playing: boolean }) {
    // items and frames are compared by reference: keep both stable
    const frames = useMemo(() => sheet.framesInRow(0, 0, 2), []);
    const items = useMemo<ImageItem[]>(
        () => [{ x: 5, y: 3, size: 2, img, sprite: frames[0] }], // sprite = still frame
        [img, frames],
    );
    return (
        <CanvasTileEngine.Sprite
            items={items}          // all items of one Sprite flip in sync; cloned, never mutated
            frames={frames}
            fps={8}
            loop={true}            // default true
            playing={playing}      // default true
            layer={2}
            onComplete={() => {}}  // non-looping animations only
        />
    );
}
```

Frame shown, by `playing` state:

| Situation | Frame on screen |
| :-- | :-- |
| Mounted with `playing={false}` | each item's own `sprite` field (the whole image if unset) - NOT `frames[0]` |
| `playing` true -> false | the last shown frame stays |
| `playing` false -> true, or new `frames`/`fps`/`loop` | restarts at `frames[0]` |
| New `items` array | re-cloned (back to each item's own `sprite`); if playing, restarts at `frames[0]` |

So give items `sprite: frames[0]` (as above) when they can mount paused.
`<Sprite>` also takes `hitTest` and `clip` like `<Image>`. For a fixed
(non-animated) sheet frame, use `<Image>` with the item's `sprite` field
instead. For independent timing per unit, render one `<Sprite>` per timing
group.
