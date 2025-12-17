---
sidebar_position: 3
---

# Configuration

The `CanvasTileEngineConfig` object controls the initial state and behavior of the engine.

## Core Settings

These are the fundamental settings required to initialize the engine.

| Property          | Type     | Default       | Description                                                      |
| :---------------- | :------- | :------------ | :--------------------------------------------------------------- |
| `scale`           | `number` | **Required**  | The initial zoom level (pixels per grid unit).                   |
| `size`            | `object` | **Required**  | The dimensions of the canvas. See [Size Options](#size-options). |
| `backgroundColor` | `string` | `"#ffffff"`   | The background color of the canvas.                              |
| `minScale`        | `number` | `scale * 0.5` | Minimum allowed zoom level.                                      |
| `maxScale`        | `number` | `scale * 2`   | Maximum allowed zoom level.                                      |

### Size Options

Define the canvas dimensions and constraints.

| Property    | Type     | Default      | Description                           |
| :---------- | :------- | :----------- | :------------------------------------ |
| `width`     | `number` | **Required** | Initial width in pixels.              |
| `height`    | `number` | **Required** | Initial height in pixels.             |
| `minWidth`  | `number` | `100`        | Minimum width allowed during resize.  |
| `minHeight` | `number` | `100`        | Minimum height allowed during resize. |
| `maxWidth`  | `number` | `Infinity`   | Maximum width allowed during resize.  |
| `maxHeight` | `number` | `Infinity`   | Maximum height allowed during resize. |

## Interactions

Control how the user interacts with the map via `eventHandlers`.

| Handler  | Default | Description                                         |
| :------- | :------ | :-------------------------------------------------- |
| `drag`   | `false` | Enable panning by dragging the map.                 |
| `zoom`   | `false` | Enable zooming with the mouse wheel.                |
| `click`  | `false` | Enable click events on grid cells.                  |
| `hover`  | `false` | Enable hover events and tracking.                   |
| `resize` | `false` | Automatically resize canvas when container changes. |

```typescript
// Example usage
eventHandlers: {
  drag: true,
  zoom: true,
  click: true
}
```

## Map Boundaries

Restrict camera movement to a specific area of the world. This is useful for preventing users from scrolling beyond your map limits.

| Property | Type     | Default     | Description                                |
| :------- | :------- | :---------- | :----------------------------------------- |
| `minX`   | `number` | `-Infinity` | Minimum X coordinate the camera can reach. |
| `maxX`   | `number` | `Infinity`  | Maximum X coordinate the camera can reach. |
| `minY`   | `number` | `-Infinity` | Minimum Y coordinate the camera can reach. |
| `maxY`   | `number` | `Infinity`  | Maximum Y coordinate the camera can reach. |

```typescript
// Example: Restrict map to a 200x200 grid centered at origin
bounds: {
  minX: -100,
  maxX: 100,
  minY: -100,
  maxY: 100
}

// Example: Only restrict horizontal movement
bounds: {
  minX: 0,
  maxX: 500,
  minY: -Infinity,
  maxY: Infinity
}
```

:::tip Runtime Updates
You can change boundaries at runtime using `engine.setBounds()`. See [Camera Controls](/docs/js/events#setbounds) for details.
:::

## Visual Customization

### Coordinate Overlay

Display X/Y axes numbers on the edges of the screen.

| Property          | Type           | Default | Description                                           |
| :---------------- | :------------- | :------ | :---------------------------------------------------- |
| `enabled`         | `boolean`      | `false` | Show the coordinate numbers.                          |
| `shownScaleRange` | `{ min, max }` | `All`   | Only show coordinates when zoom is within this range. |

### Cursors

Customize the mouse cursor for different states.

| State     | Default     | Description                              |
| :-------- | :---------- | :--------------------------------------- |
| `default` | `"default"` | The standard cursor.                     |
| `move`    | `"move"`    | The cursor shown while dragging the map. |

## Debugging

Built-in tools to help you develop. Enable via the `debug` object.

| Feature                  | Default                    | Description                                            |
| :----------------------- | :------------------------- | :----------------------------------------------------- |
| `enabled`                | `false`                    | Master switch for all debug features.                  |
| `grid.enabled`           | `false`                    | Draw a grid overlay.                                   |
| `grid.color`             | `"rgba(255,255,255,0.25)"` | Grid line color.                                       |
| `grid.lineWidth`         | `1`                        | Grid line width.                                       |
| `hud.enabled`            | `false`                    | Show HUD panel.                                        |
| `hud.topLeftCoordinates` | `false`                    | Display top-left world coords.                         |
| `hud.coordinates`        | `false`                    | Display center coords.                                 |
| `hud.scale`              | `false`                    | Display current scale.                                 |
| `hud.tilesInView`        | `false`                    | Display visible tile counts.                           |
| `hud.fps`                | `false`                    | Display current FPS (continuously updated).            |
| `eventHandlers.*`        | `true`                     | Debug-time overrides for click/hover/drag/zoom/resize. |

## Full TypeScript Type

For reference, here is the complete type definition:

```typescript
export type CanvasTileEngineConfig = {
    renderer?: "canvas";
    scale: number;
    maxScale?: number;
    minScale?: number;
    backgroundColor?: string;
    size: {
        width: number;
        height: number;
        minWidth?: number;
        minHeight?: number;
        maxWidth?: number;
        maxHeight?: number;
    };
    eventHandlers?: {
        click?: boolean;
        hover?: boolean;
        drag?: boolean;
        zoom?: boolean;
        resize?: boolean;
    };
    coordinates?: {
        enabled?: boolean;
        shownScaleRange?: { min: number; max: number };
    };
    cursor?: {
        default?: string;
        move?: string;
    };
    debug?: {
        enabled?: boolean;
        grid?: {
            enabled?: boolean;
            color?: string;
            lineWidth?: number;
        };
        hud?: {
            enabled?: boolean;
            topLeftCoordinates?: boolean;
            coordinates?: boolean;
            scale?: boolean;
            tilesInView?: boolean;
        };
        eventHandlers?: {
            click?: boolean;
            hover?: boolean;
            drag?: boolean;
            zoom?: boolean;
            resize?: boolean;
        };
    };
};
```
