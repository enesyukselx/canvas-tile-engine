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

Text element with position and content.

```typescript
type Text = {
    coords: Coords;
    text: string;
};
```

| Property | Type     | Description                   |
| :------- | :------- | :---------------------------- |
| `coords` | `Coords` | Position in world coordinates |
| `text`   | `string` | Text content to render        |

---

### `Line`

Line between two points.

```typescript
type Line = {
    from: Coords;
    to: Coords;
    style: { strokeStyle?: string; lineWidth?: number };
};
```

| Property | Type     | Description    |
| :------- | :------- | :------------- |
| `from`   | `Coords` | Starting point |
| `to`     | `Coords` | Ending point   |
| `style`  | `object` | Stroke styling |

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

Image element with position, size, and rotation.

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
};
```

| Property | Type               | Default                            | Description                     |
| :------- | :----------------- | :--------------------------------- | :------------------------------ |
| `x`, `y` | `number`           | **Required**                       | World coordinates               |
| `size`   | `number`           | `1`                                | Size in grid units              |
| `origin` | `object`           | `{ mode: "cell", x: 0.5, y: 0.5 }` | Anchor point                    |
| `rotate` | `number`           | `0`                                | Rotation in degrees (clockwise) |
| `img`    | `HTMLImageElement` | **Required**                       | Loaded image object             |

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

### `onClickCallback`

Callback for click events.

```typescript
type onClickCallback = (
    coords: { raw: Coords; snapped: Coords },
    mouse: { raw: Coords; snapped: Coords },
    client: { raw: Coords; snapped: Coords }
) => void;
```

| Parameter | Description                                             |
| :-------- | :------------------------------------------------------ |
| `coords`  | World coordinates (raw = exact, snapped = grid-aligned) |
| `mouse`   | Mouse position relative to canvas                       |
| `client`  | Mouse position relative to viewport                     |

---

### `onHoverCallback`

Callback for hover events. Same signature as `onClickCallback`.

```typescript
type onHoverCallback = onClickCallback;
```

---

### `onDrawCallback`

Callback for custom drawing after all layers are rendered.

```typescript
type onDrawCallback = (
    ctx: CanvasRenderingContext2D,
    info: { scale: number; width: number; height: number; coords: Coords }
) => void;
```

| Parameter     | Description                               |
| :------------ | :---------------------------------------- |
| `ctx`         | Canvas 2D rendering context               |
| `info.scale`  | Current zoom scale                        |
| `info.width`  | Canvas width in pixels                    |
| `info.height` | Canvas height in pixels                   |
| `info.coords` | Top-left world coordinate of the viewport |
