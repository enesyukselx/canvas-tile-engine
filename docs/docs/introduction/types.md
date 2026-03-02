---
sidebar_position: 5
---

# Types Reference

All types are exported from both packages and can be imported directly:

```typescript
// From core package (vanilla JS)
import { Rect, Circle, Text, Path, ImageItem, Coords } from "@canvas-tile-engine/core";

// From React package
import { Rect, Circle, Text, Path, ImageItem, Coords } from "@canvas-tile-engine/react";
```

## Drawing Types

### `Rect`

Rectangle/square shape definition. Supports rotation and border radius.

```typescript
type Rect = {
    x: number;
    y: number;
    size?: number;
    origin?: {
        mode?: "cell" | "self";
        x?: number; // 0 to 1
        y?: number; // 0 to 1
    };
    style?: { fillStyle?: string; strokeStyle?: string; lineWidth?: number };
    rotate?: number;
    radius?: number | number[];
};
```

| Property | Type                 | Default                            | Description                     |
| :------- | :------------------- | :--------------------------------- | :------------------------------ |
| `x`, `y` | `number`             | **Required**                       | World coordinates               |
| `size`   | `number`             | `1`                                | Size in grid units              |
| `origin` | `object`             | `{ mode: "cell", x: 0.5, y: 0.5 }` | Anchor point                    |
| `style`  | `object`             | `{}`                               | Fill and stroke styling         |
| `rotate` | `number`             | `0`                                | Rotation in degrees (clockwise) |
| `radius` | `number \| number[]` | -                                  | Border radius in pixels         |

---

### `Circle`

Circle shape definition. Does not support rotation or border radius.

```typescript
type Circle = {
    x: number;
    y: number;
    size?: number;
    origin?: {
        mode?: "cell" | "self";
        x?: number;
        y?: number;
    };
    style?: { fillStyle?: string; strokeStyle?: string; lineWidth?: number };
};
```

| Property | Type     | Default                            | Description             |
| :------- | :------- | :--------------------------------- | :---------------------- |
| `x`, `y` | `number` | **Required**                       | World coordinates       |
| `size`   | `number` | `1`                                | Diameter in grid units  |
| `origin` | `object` | `{ mode: "cell", x: 0.5, y: 0.5 }` | Anchor point            |
| `style`  | `object` | `{}`                               | Fill and stroke styling |

---

### `Text`

Text element with position, content, and font styling. Extends the DrawObject pattern.

```typescript
type Text = {
    x: number;
    y: number;
    text: string;
    size?: number;
    origin?: {
        mode?: "cell" | "self";
        x?: number;
        y?: number;
    };
    style?: {
        fillStyle?: string;
        fontFamily?: string;
        textAlign?: CanvasTextAlign;
        textBaseline?: CanvasTextBaseline;
    };
    rotate?: number;
};
```

| Property | Type     | Default                            | Description                                 |
| :------- | :------- | :--------------------------------- | :------------------------------------------ |
| `x`, `y` | `number` | **Required**                       | World coordinates                           |
| `text`   | `string` | **Required**                       | Text content to render                      |
| `size`   | `number` | `1`                                | Font size in world units (scales with zoom) |
| `origin` | `object` | `{ mode: "cell", x: 0.5, y: 0.5 }` | Anchor point                                |
| `style`  | `object` | `{}`                               | Font styling options                        |
| `rotate` | `number` | `0`                                | Rotation in degrees (clockwise)             |

**Style Options:**

| Property       | Type                 | Default        | Description          |
| :------------- | :------------------- | :------------- | :------------------- |
| `fillStyle`    | `string`             | -              | Text color           |
| `fontFamily`   | `string`             | `"sans-serif"` | Font family          |
| `textAlign`    | `CanvasTextAlign`    | `"left"`       | Horizontal alignment |
| `textBaseline` | `CanvasTextBaseline` | `"top"`        | Vertical baseline    |

---

### `Line`

Line between two points. Style is passed separately to the draw method.

```typescript
type Line = {
    from: Coords;
    to: Coords;
};
```

| Property | Type     | Description    |
| :------- | :------- | :------------- |
| `from`   | `Coords` | Starting point |
| `to`     | `Coords` | Ending point   |

---

### `Path`

Array of coordinates forming a continuous path.

```typescript
type Path = Coords[];
```

**Example:**

```typescript
const path: Path = [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 5 },
    { x: 0, y: 5 },
];
```

---

### `ImageItem`

Image element with position, size, rotation, and optional spritesheet clipping.

```typescript
type ImageItem = {
    x: number;
    y: number;
    size?: number;
    origin?: {
        mode?: "cell" | "self";
        x?: number;
        y?: number;
    };
    rotate?: number;
    img: HTMLImageElement;
    clip?: { x: number; y: number; w: number; h: number };
};
```

| Property | Type               | Default                            | Description                     |
| :------- | :----------------- | :--------------------------------- | :------------------------------ |
| `x`, `y` | `number`           | **Required**                       | World coordinates               |
| `size`   | `number`           | `1`                                | Size in grid units              |
| `origin` | `object`           | `{ mode: "cell", x: 0.5, y: 0.5 }` | Anchor point                    |
| `rotate` | `number`           | `0`                                | Rotation in degrees (clockwise) |
| `img`    | `HTMLImageElement` | **Required**                       | Loaded image object             |
| `clip`   | `{ x, y, w, h }`  | -                                  | Source rectangle for spritesheet cropping (pixel coordinates within the image) |

---

## Utility Types

### `Coords`

Basic 2D coordinate object used throughout the engine.

```typescript
type Coords = {
    x: number;
    y: number;
};
```

---

### `DrawObject`

Base type that `Rect` extends. You can use this for generic drawing operations.

```typescript
type DrawObject = {
    x: number;
    y: number;
    size?: number;
    origin?: {
        mode?: "cell" | "self";
        x?: number;
        y?: number;
    };
    style?: { fillStyle?: string; strokeStyle?: string; lineWidth?: number };
    rotate?: number;
    radius?: number | number[];
};
```

---

## Callback Types

### `MouseEventCallback`

Callback for mouse events.

```typescript
type MouseEventCallback = (
    coords: { raw: Coords; snapped: Coords },
    mouse: { raw: Coords; snapped: Coords },
    client: { raw: Coords; snapped: Coords }
) => void;

type onClickCallback = MouseEventCallback;
type onRightClickCallback = MouseEventCallback;
type onHoverCallback = MouseEventCallback;
type onMouseDownCallback = MouseEventCallback;
type onMouseUpCallback = MouseEventCallback;
type onMouseLeaveCallback = MouseEventCallback;
```

| Parameter | Description                                             |
| :-------- | :------------------------------------------------------ |
| `coords`  | World coordinates (raw = exact, snapped = grid-aligned) |
| `mouse`   | Mouse position relative to canvas                       |
| `client`  | Mouse position relative to viewport                     |

### `onDrawCallback`

Callback for custom drawing after all layers are rendered.

```typescript
type onDrawCallback = (ctx: unknown, info: { scale: number; width: number; height: number; coords: Coords }) => void;
```

| Parameter     | Description                                             |
| :------------ | :------------------------------------------------------ |
| `ctx`         | Rendering context (type depends on renderer being used) |
| `info.scale`  | Current zoom scale                                      |
| `info.width`  | Canvas width in pixels                                  |
| `info.height` | Canvas height in pixels                                 |
| `info.coords` | Top-left world coordinate of the viewport               |

**Example usage with Canvas2D renderer:**

```typescript
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const engine = new CanvasTileEngine(wrapper, config, new RendererCanvas());

engine.onDraw = (ctx) => {
    // Cast to the appropriate context type for your renderer
    const context = ctx as CanvasRenderingContext2D;

    context.fillStyle = "red";
    context.fillRect(info.width / 2 - 5, info.height / 2 - 5, 10, 10);
};
```

:::tip
The `ctx` parameter is typed as `unknown` to support different renderer backends.
When using `RendererCanvas`, cast it to `CanvasRenderingContext2D`.
:::
