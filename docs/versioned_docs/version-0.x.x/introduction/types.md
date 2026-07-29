---
sidebar_position: 5
---

# Types Reference

These types are defined in `@canvas-tile-engine/core` and re-exported by the `@canvas-tile-engine/react` and `@canvas-tile-engine/react-native` bindings (which also add `EngineHandle`). Import them from whichever package your app already depends on — a React or React Native app does not need a direct `core` dependency for types.

```ts
// Vanilla / server: import from core
import type { Rect, Circle, Text, Line, PathItem, PathStyle, ImageItem, Coords } from "@canvas-tile-engine/core";

// React / React Native: import the same types (plus EngineHandle) from the binding
import type { Rect, PathItem, PathCommand, LineStyle, DrawHandle, EngineHandle } from "@canvas-tile-engine/react";
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

type PathItem<TData = unknown> = {
    commands?: PathCommand[]; // free-form Canvas2D-style commands (curves, arcs, holes)
    points?: Coords[]; // polyline vertices in world units (one of the two required)
    closed?: boolean; // join the last point back to the first (points form)
    fillRule?: "nonzero" | "evenodd"; // fill rule, default "nonzero"
    style?: PathStyle; // per-item fill/stroke/dash/corner styling
    data?: TData; // app data, returned on hitTest results
};

type LineStyle = {
    strokeStyle?: string;
    lineWidth?: number; // world units, scales with zoom
    lineWidthPx?: number; // screen pixels, wins over lineWidth
    lineDash?: number[]; // dash pattern in world units, anchored to the world
    lineDashPx?: number[]; // dash pattern in screen pixels, wins over lineDash
};
```

`PathItem` describes a free-form path (open polyline, closed outline, or filled shape); `PathStyle` extends the `LineStyle` fields with `fillStyle` and `cornerRadius`/`cornerRadiusPx`. `drawLine` takes a `LineStyle` as its second argument; dash patterns follow Canvas2D `setLineDash` semantics (odd-length patterns repeat) and flow continuously around path corners.

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

### `DrawOptions`

```ts
type DrawOptions = {
    id?: string;
};
```

Optional last parameter of every draw method. `id` gives the registration a stable identity: re-registering with the same id replaces the previous registration (draw callback plus hit-test entries) instead of accumulating. Ids share one namespace across draw kinds and layers; static draw methods use their `cacheKey` as the id instead.

### `StyleOf` and Decoration Styles

```ts
type StyleOf<TItem, TStyle> = (item: TItem) => TStyle | undefined;

type ShapeDecorationStyle = NonNullable<DrawObject["style"]>; // Rect / Circle
type TextDecorationStyle = NonNullable<Text["style"]>;
type LineDecorationStyle = Omit<LineStyle, "lineWidth" | "lineWidthPx">;
type PathDecorationStyle = Omit<PathStyle, "lineWidth" | "lineWidthPx" | "cornerRadius" | "cornerRadiusPx">;
```

The dynamic draw methods additionally accept `styleOf` in their options (`RectDrawOptions`, `CircleDrawOptions`, `TextDrawOptions`, `LineDrawOptions`, `PathDrawOptions` — each extends `DrawOptions`). The callback runs per item on every frame at paint time; returned fields overlay the item's own `style` for that frame, `undefined` leaves it untouched. Line and path decorations exclude stroke width (and corner radius), because those feed hit-test geometry resolved at registration time.

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

### `onWheelCallback` And `WheelInfo`

Fires for wheel (desktop) and pinch (touch) zoom gestures (requires `eventHandlers.zoom`). The first three arguments match the pointer callbacks; a fourth describes the gesture:

```ts
type onWheelCallback = (
    coords: { raw: Coords; snapped: Coords },
    mouse: { raw: Coords; snapped: Coords },
    client: { raw: Coords; snapped: Coords },
    wheel: WheelInfo,
) => void;

type WheelInfo = {
    deltaY: number; // negative = zoom in; synthesized for pinch
    direction: "in" | "out";
    source: "wheel" | "pinch";
};
```

### `onDrawCallback`

```ts
type onDrawCallback = (
    ctx: unknown,
    coords: Coords, // top-left world coordinate of the viewport
    config: Required<CanvasTileEngineConfig>, // live scale and size
    transform: DrawTransform, // { worldToScreen, screenToWorld }
) => void;
```

The signature mirrors `addDrawFunction` callbacks, so custom drawing code can
move between the two hooks unchanged.

`ctx` is renderer-specific:

- `CanvasRenderingContext2D` for `RendererCanvas`.
- The WebGL renderer's 2D overlay context for `RendererWebGL`.
- `SkCanvas` for `RendererSkia`.
- `SKRSContext2D` for `RendererServer`.

## Engine Handles

React packages expose safe handles from `useCanvasTileEngine()`. Methods no-op or return defaults before mount, and `engine.isReady` tells you when the core instance is attached.

Common methods:

```ts
engine.render();
engine.getCenter();
engine.getVisibleBounds();
engine.setCenter({ x: 0, y: 0 });
engine.goCenter(10, 10, 500);
engine.setScale(64);
engine.goScale(64, 500);
engine.zoomIn();
engine.zoomOut();
engine.setBounds({ minX: 0, maxX: 100, minY: 0, maxY: 100 });
engine.setEventHandlers({ drag: false, hover: true });
engine.loadImage("/sprite.png");
```
