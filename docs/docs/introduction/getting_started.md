---
sidebar_position: 1
---

# Getting Started

`Canvas Tile Engine` is a lightweight library for building interactive 2D grid-based maps and visualizations. It handles camera controls, coordinate transformations, rendering, and user interactions - so you can focus on your content.

**Features:**

-   Pan, zoom, and smooth camera animations
-   Grid-based coordinate system with automatic transformations
-   Event handling (click, hover, drag, zoom)
-   Layer-based rendering with drawing helpers
-   Modular renderer architecture (Canvas2D, WebGL, etc.)

## Installation

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-canvas
```

## Architecture

Canvas Tile Engine uses a modular architecture that separates core logic from rendering:

-   **@canvas-tile-engine/core** - Framework-agnostic engine handling camera, coordinates, and events
-   **@canvas-tile-engine/renderer-canvas** - Canvas2D renderer implementation

The renderer is injected into the engine, allowing different rendering backends:

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

// Inject the Canvas2D renderer
const engine = new CanvasTileEngine(wrapper, config, new RendererCanvas());
```

## Quick Start

HTML wrapper (must contain a `<canvas>`):

```html
<div id="wrapper">
    <canvas></canvas>
</div>
```

Initialize, draw, and render:

```ts
import { CanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const wrapper = document.getElementById("wrapper") as HTMLDivElement;

const config: CanvasTileEngineConfig = {
    scale: 50,
    size: { width: 500, height: 500, minWidth: 200, minHeight: 200 },
    backgroundColor: "#337426",
    eventHandlers: { drag: true, zoom: true, hover: true, click: true },
    coordinates: { enabled: true, shownScaleRange: { min: 30, max: 80 } },
};

const engine = new CanvasTileEngine(wrapper, config, new RendererCanvas(), { x: 0, y: 0 });

// Draw a yellow tile
engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#f9c74f" } });

// Handle click events
engine.onClick = (coords) => {
    console.log("Clicked tile:", coords.snapped);
};

// Render the frame
engine.render();
```

That's it! You now have a draggable, zoomable grid map with click detection.

## What's happening?

-   **Config** sets up canvas size, zoom level (`scale`), and enables interactions
-   **Renderer** handles all platform-specific drawing (Canvas2D in this case)
-   **Engine** manages the camera, coordinates, and events - delegating rendering to the injected renderer
-   **Drawing** uses world coordinates - the engine handles screen transformations
-   **Events** provide both raw and grid-snapped coordinates
