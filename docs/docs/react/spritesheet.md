---
sidebar_position: 9
---

# Spritesheet & Animation

A spritesheet packs many frames into a single image: one network request, one decode, and on WebGL a single texture for all frames. The React package supports it in two ways:

-   **Fixed frame** — pass a `sprite` rect on any `<Image>` item
-   **Animation** — the `<Sprite>` component flips through frames at a given fps

`SpriteSheet` (the frame calculator) and the sprite types are re-exported from `@canvas-tile-engine/react`, so no direct core import is needed.

## Fixed Frames with `<Image>`

Every `ImageItem` accepts an optional `sprite` property — a pixel rectangle inside the sheet. Use `SpriteSheet` to compute it from a grid position:

```tsx
import { CanvasTileEngine, SpriteSheet } from "@canvas-tile-engine/react";

// A 432x512 sheet with 3 columns x 4 rows of 144x128 frames
const sheet = new SpriteSheet({ frameWidth: 144, frameHeight: 128, columns: 3 });

<CanvasTileEngine.Image
    items={{ x: 2, y: 3, size: 1.5, img: dragonSheet, sprite: sheet.frame(0, 2) }}
    layer={2}
/>;
```

See the [core Spritesheet guide](../js/spritesheet.md) for `SpriteSheet` options (`margin`, `spacing`, `frameByIndex`, ...).

## Animation with `<Sprite>`

`<Sprite>` draws its items cropped to the current animation frame and re-renders at the animation's fps. All items of one `<Sprite>` share the animation and flip in sync.

```tsx
import { useMemo, useState } from "react";
import { CanvasTileEngine, SpriteSheet, useCanvasTileEngine } from "@canvas-tile-engine/react";

const sheet = new SpriteSheet({ frameWidth: 144, frameHeight: 128, columns: 3 });

function FlyingDragon({ img }: { img: HTMLImageElement }) {
    const engine = useCanvasTileEngine();
    const [playing, setPlaying] = useState(true);

    // Keep items and frames referentially stable
    const item = useMemo(() => ({ x: 5, y: 3, size: 2, img }), [img]);
    const frames = useMemo(() => sheet.framesInRow(0, 0, 2), []);

    return (
        <CanvasTileEngine
            engine={engine}
            config={config}
            renderer={new RendererCanvas()}
            onClick={() => setPlaying((prev) => !prev)}
        >
            <CanvasTileEngine.Sprite items={item} frames={frames} fps={8} playing={playing} />
        </CanvasTileEngine>
    );
}
```

**Props:**

| Prop         | Type                       | Default      | Description                                                       |
| :----------- | :------------------------- | :----------- | :----------------------------------------------------------------- |
| `items`      | `ImageItem \| ImageItem[]` | **Required** | Items to draw. Cloned internally — your objects are never mutated. |
| `frames`     | `SpriteRect[]`             | **Required** | Animation frames in play order, e.g. `sheet.framesInRow(0, 0, 4)`. |
| `fps`        | `number`                   | **Required** | Playback speed in frames per second.                               |
| `loop`       | `boolean`                  | `true`       | Restart from the first frame after the last one.                   |
| `playing`    | `boolean`                  | `true`       | Toggle playback. Re-enabling restarts from the first frame.        |
| `layer`      | `number`                   | `1`          | Rendering layer.                                                   |
| `onComplete` | `() => void`               | -            | Fired when a non-looping animation reaches its last frame.         |

:::warning Referential stability
Like `<Image>`, the `items` and `frames` props are compared **by reference**. Create them with `useMemo`/`useState` — an inline literal re-registers the draw callback (and restarts the animation) on every render.
:::

:::tip One `<Sprite>` per animation
Items inside a single `<Sprite>` animate in sync (one internal animator, one render per tick). Use separate `<Sprite>` components for independently-timed animations.
:::

```tsx
// One-shot effect: remove from the tree when finished
{exploding && (
    <CanvasTileEngine.Sprite
        items={explosionItem}
        frames={explosionFrames}
        fps={12}
        loop={false}
        onComplete={() => setExploding(false)}
    />
)}
```

:::info Full example
See `examples/react/spritesheet` in the repository for a complete runnable demo.

```bash
pnpm dev:example --example=react-spritesheet
```

:::
