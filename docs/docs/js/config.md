---
sidebar_position: 2
---

# Config Reference

`CanvasTileEngine` accepts a single config object when you create an instance. This page explains which fields are required, what each option does, and the defaults applied by the engine.

## Required fields

| Field         | Type   | Description                                  |
| ------------- | ------ | -------------------------------------------- |
| `scale`       | number | Base zoom level (world units per tile/cell). |
| `size.width`  | number | Viewport width in pixels at creation time.   |
| `size.height` | number | Viewport height in pixels at creation time.  |

## Optional fields and defaults

| Field                          | Type           | Description                                                                | Default                     |
| ------------------------------ | -------------- | -------------------------------------------------------------------------- | --------------------------- |
| `renderer`                     | `"canvas"`     | Rendering backend (only canvas today).                                     | `"canvas"`                  |
| `backgroundColor`              | string         | Canvas background color.                                                   | `#ffffff`                   |
| `minScale`                     | number         | Lowest allowed zoom; clamped (must be > 0).                                | —                           |
| `maxScale`                     | number         | Highest allowed zoom; clamped (must be > 0).                               | —                           |
| `size.minWidth` / `minHeight`  | number         | Min viewport size in px.                                                   | `100`                       |
| `size.maxWidth` / `maxHeight`  | number         | Max viewport size in px.                                                   | `Infinity`                  |
| `eventHandlers.click`          | boolean        | Enable click events.                                                       | `false`                     |
| `eventHandlers.hover`          | boolean        | Enable hover events.                                                       | `false`                     |
| `eventHandlers.drag`           | boolean        | Enable dragging/panning.                                                   | `false`                     |
| `eventHandlers.zoom`           | boolean        | Enable wheel zoom.                                                         | `false`                     |
| `eventHandlers.resize`         | boolean        | Allow manual resize.                                                       | `false`                     |
| `coordinates.enabled`          | boolean        | Show coordinate overlay.                                                   | `false`                     |
| `coordinates.shownScaleRange`  | `{ min, max }` | When to show overlay.                                                      | `{ min: 0, max: Infinity }` |
| `cursor.default`               | string         | CSS cursor while idle.                                                     | `"default"`                 |
| `cursor.move`                  | string         | CSS cursor while dragging.                                                 | `"move"`                    |
| `debug.enabled`                | boolean        | Master debug toggle.                                                       | `false`                     |
| `debug.grid.enabled`           | boolean        | Draw debug grid.                                                           | `false`                     |
| `debug.grid.color`             | string         | Grid color.                                                                | `"rgba(255,255,255,0.25)"`  |
| `debug.grid.lineWidth`         | number         | Grid line width.                                                           | `1`                         |
| `debug.hud.enabled`            | boolean        | Show HUD.                                                                  | `false`                     |
| `debug.hud.topLeftCoordinates` | boolean        | HUD: show top-left coords.                                                 | `false`                     |
| `debug.hud.coordinates`        | boolean        | HUD: show center coords.                                                   | `false`                     |
| `debug.hud.scale`              | boolean        | HUD: show scale.                                                           | `false`                     |
| `debug.hud.tilesInView`        | boolean        | HUD: show tiles in view.                                                   | `false`                     |
| `debug.eventHandlers.click`    | boolean        | Debug-time click handling/logging; off disables click while debug is on.   | `true`                      |
| `debug.eventHandlers.hover`    | boolean        | Debug-time hover handling/logging; off disables hover while debug is on.   | `true`                      |
| `debug.eventHandlers.drag`     | boolean        | Debug-time drag handling/logging; off disables drag while debug is on.     | `true`                      |
| `debug.eventHandlers.zoom`     | boolean        | Debug-time zoom handling/logging; off disables zoom while debug is on.     | `true`                      |
| `debug.eventHandlers.resize`   | boolean        | Debug-time resize handling/logging; off disables resize while debug is on. | `true`                      |

:::info
If an event handler is `false`, related callbacks will not fire.
:::

## Type import

```ts
import type { CanvasTileEngineConfig } from "@canvas-tile-engine/core";
```

## Example

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";

const el = document.getElementById("canvas");

const config = {
    scale: 50,
    minScale: 30,
    maxScale: 80,
    size: { width: 600, height: 500, minWidth: 400, minHeight: 300 },
    backgroundColor: "#2f5d2f",
    eventHandlers: { drag: true, zoom: true, click: true, hover: true, resize: true },
    coordinates: { enabled: true, shownScaleRange: { min: 30, max: 100 } },
    cursor: { default: "grab", move: "grabbing" },
    debug: {
        enabled: true,
        grid: { enabled: true, color: "rgba(0,0,0,0.3)", lineWidth: 1 },
        hud: { enabled: true, coordinates: true, scale: true },
    },
} satisfies CanvasTileEngineConfig;

const engine = new CanvasTileEngine(el, config);

engine.render();
```
