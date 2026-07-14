---
sidebar_position: 5
---

# Types Reference

Core types are exported from `@canvas-tile-engine/core` and re-exported by the React packages where useful.

```ts
import type { Rect, Circle, Text, Line, Path, ImageItem, Coords } from "@canvas-tile-engine/core";
import type { EngineHandle } from "@canvas-tile-engine/react";
```

## Draw Objects

### `Coords`

```ts
type Coords = {
    x: number;
    y: number;
};
```

### `Rect`

```ts
type Rect = {
    x: number;
    y: number;
    size?: number;
    origin?: { mode?: "cell" | "self"; x?: number; y?: number };
    style?: { fillStyle?: string; strokeStyle?: string; lineWidth?: number; lineWidthPx?: number };
    rotate?: number;
    radius?: number | number[];
};
```

`size`, `radius`, and `style.lineWidth` are world units and scale with zoom, so borders and corner rounding stay proportional to the shape. `style.lineWidthPx` is a zoom-independent width in screen pixels and takes precedence over `lineWidth` (the same pattern as `Text`'s `size`/`fontPx`). `rotate` is degrees, clockwise.

### `Circle`

```ts
type Circle = {
    x: number;
    y: number;
    size?: number;
    origin?: { mode?: "cell" | "self"; x?: number; y?: number };
    style?: { fillStyle?: string; strokeStyle?: string; lineWidth?: number; lineWidthPx?: number };
};
```

### `Text`

```ts
type Text = {
    x: number;
    y: number;
    text: string;
    size?: number;
    origin?: { mode?: "cell" | "self"; x?: number; y?: number };
    style?: {
        fillStyle?: string;
        fontFamily?: string;
        textAlign?: "center" | "end" | "left" | "right" | "start";
        textBaseline?: "alphabetic" | "bottom" | "hanging" | "ideographic" | "middle" | "top";
    };
    rotate?: number;
};
```

`size` is a world-unit text size. Renderers currently draw the actual font at `size * scale * 0.3`, matching the existing Canvas2D behavior.

### `Line` And `Path`

```ts
type Line = {
    from: Coords;
    to: Coords;
};

type Path = Coords[];

type LineStyle = {
    strokeStyle?: string;
    lineWidth?: number; // world units, scales with zoom
    lineWidthPx?: number; // screen pixels, wins over lineWidth
    lineDash?: number[]; // dash pattern in world units, anchored to the world
    lineDashPx?: number[]; // dash pattern in screen pixels, wins over lineDash
};
```

`Path` represents a polyline. Pass `Path[]` to draw multiple polylines in one call. `drawLine` and `drawPath` take a `LineStyle` as their second argument; dash patterns follow Canvas2D `setLineDash` semantics (odd-length patterns repeat) and flow continuously around a `Path`'s corners.

### `ImageItem<TImage>`

```ts
type SpriteRect = {
    x: number;
    y: number;
    w: number;
    h: number;
};

type ImageItem<TImage = HTMLImageElement> = {
    x: number;
    y: number;
    size?: number;
    origin?: { mode?: "cell" | "self"; x?: number; y?: number };
    rotate?: number;
    radius?: number | number[];
    img: TImage;
    sprite?: SpriteRect;
};
```

`TImage` depends on the renderer:

| Renderer | Image type |
| :-- | :-- |
| Canvas2D / WebGL | `HTMLImageElement` |
| Skia / React Native | `SkImage` |
| Server | `@napi-rs/canvas` `Image` |

`sprite` crops a sub-rectangle from a spritesheet image before drawing.

## Sprite Helpers

```ts
type SpriteSheetOptions = {
    frameWidth: number;
    frameHeight: number;
    columns?: number;
    margin?: number;
    spacing?: number;
};

type SpriteAnimation = {
    frames: SpriteRect[];
    fps: number;
    loop?: boolean;
};
```

Use `SpriteSheet` for frame math and `SpriteAnimator` for imperative animation. React and React Native also provide `<CanvasTileEngine.Sprite>`.

## Callback Types

Pointer callbacks share one shape:

```ts
type MouseEventCallback = (
    coords: { raw: Coords; snapped: Coords },
    mouse: { raw: Coords; snapped: Coords },
    client: { raw: Coords; snapped: Coords },
) => void;
```

Aliases:

```ts
type onClickCallback = MouseEventCallback;
type onRightClickCallback = MouseEventCallback;
type onHoverCallback = MouseEventCallback;
type onMouseDownCallback = MouseEventCallback;
type onMouseUpCallback = MouseEventCallback;
type onMouseLeaveCallback = MouseEventCallback;
type onZoomCallback = (scale: number) => void;
```

`coords.raw` is the exact world coordinate. `coords.snapped` is floored to the grid cell.

### `onDrawCallback`

```ts
type onDrawCallback = (
    ctx: unknown,
    info: { scale: number; width: number; height: number; coords: Coords },
) => void;
```

`ctx` is renderer-specific:

- `CanvasRenderingContext2D` for `RendererCanvas`.
- The WebGL renderer's 2D overlay context for `RendererWebGL`.
- `SkCanvas` for `RendererSkia`.
- `SKRSContext2D` for `RendererServer`.

`info.coords` is the top-left world coordinate of the viewport.

## Engine Handles

React packages expose safe handles from `useCanvasTileEngine()`. Methods no-op or return defaults before mount, and `engine.isReady` tells you when the core instance is attached.

Common methods:

```ts
engine.render();
engine.getCenterCoords();
engine.getVisibleBounds();
engine.updateCoords({ x: 0, y: 0 });
engine.goCoords(10, 10, 500);
engine.setScale(64);
engine.zoomIn();
engine.zoomOut();
engine.setBounds({ minX: 0, maxX: 100, minY: 0, maxY: 100 });
engine.setEventHandlers({ drag: false, hover: true });
engine.loadImage("/sprite.png");
```
