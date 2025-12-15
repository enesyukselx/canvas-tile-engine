---
sidebar_position: 6
---

# Debugging Tools

The engine comes with built-in debugging tools to help you visualize the grid, monitor performance, and track camera state. These tools are rendered on top of all other layers.

## Enabling Debug Mode

Debug features are controlled via the `debug` object in the configuration.

```typescript
const config = {
    // ...
    debug: {
        enabled: true,
        hud: {
            enabled: true,
            coordinates: true,
            scale: true,
            tilesInView: true,
            fps: true,
        },
    },
};
```

## Heads-Up Display (HUD)

Displays real-time information about the engine state in the top-right corner of the canvas.

| Property             | Type      | Default | Description                                                               |
| :------------------- | :-------- | :------ | :------------------------------------------------------------------------ |
| `enabled`            | `boolean` | `false` | Toggles the HUD panel.                                                    |
| `topLeftCoordinates` | `boolean` | `false` | Shows the world coordinates of the top-left corner of the viewport.       |
| `coordinates`        | `boolean` | `false` | Shows the world coordinates of the center of the viewport.                |
| `scale`              | `boolean` | `false` | Shows the current zoom level (pixels per grid unit).                      |
| `tilesInView`        | `boolean` | `false` | Shows how many tiles fit horizontally and vertically in the current view. |
| `fps`                | `boolean` | `false` | Shows the current frames per second (continuously updated).               |

### HUD Example Output

When enabled, the HUD panel might look like this:

```text
TopLeft: 10.50, 5.20
Coords: 15.00, 10.00
Scale: 32.00
Tiles in view: 25 x 19
FPS: 60
```

:::tip
The HUD is rendered using a semi-transparent black background with bright green text (`#00ff99`) for high visibility on any background.
:::
