---
sidebar_position: 3
---

# Renderers

Canvas Tile Engine uses a modular renderer architecture. The core engine handles camera, coordinates, and events, while renderers handle platform-specific drawing operations.

## Available Renderers

### RendererCanvas (Canvas2D)

The default renderer using the HTML Canvas 2D API. Best for most use cases.

```bash
npm install @canvas-tile-engine/renderer-canvas
```

```typescript
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const engine = new CanvasTileEngine(wrapper, config, new RendererCanvas());
```

**Features:**
- Full support for all drawing primitives (rect, circle, image, text, path, line)
- Static caching for large datasets
- Layer-based rendering
- Coordinate overlay and debug HUD

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    @canvas-tile-engine/core             │
│  ┌─────────┐  ┌────────────┐  ┌───────────────────┐    │
│  │ Camera  │  │ Coordinate │  │ GestureProcessor  │    │
│  │         │  │ Transformer│  │                   │    │
│  └─────────┘  └────────────┘  └───────────────────┘    │
│                        │                                │
│                        ▼                                │
│              ┌─────────────────┐                       │
│              │   IRenderer     │  ◄── Interface        │
│              └─────────────────┘                       │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────┐
│ RendererCanvas  │ │RendererWebGL│ │   Custom    │
│   (Canvas2D)    │ │  (Future)   │ │  Renderer   │
└─────────────────┘ └─────────────┘ └─────────────┘
```

## Renderer Interface

All renderers implement the `IRenderer` interface from `@canvas-tile-engine/core`:

```typescript
interface IRenderer {
    // Lifecycle
    init(deps: RendererDependencies): void;
    render(): void;
    resize(width: number, height: number): void;
    destroy(): void;

    // Draw API
    getDrawAPI(): IDrawAPI;

    // Image Loader
    getImageLoader(): IImageLoader;

    // Events
    setupEvents(): void;
}
```

## Draw API Interface

The `IDrawAPI` interface defines all drawing operations:

```typescript
interface IDrawAPI {
    // Custom draw function (ctx type depends on renderer)
    addDrawFunction(
        fn: (ctx: unknown, coords: Coords, config: Required<CanvasTileEngineConfig>) => void,
        layer?: number
    ): DrawHandle;

    // Drawing primitives
    drawRect(items: Rect | Rect[], layer?: number): DrawHandle;
    drawCircle(items: Circle | Circle[], layer?: number): DrawHandle;
    drawLine(items: Line | Line[], style?: LineStyle, layer?: number): DrawHandle;
    drawText(items: Text | Text[], layer?: number): DrawHandle;
    drawImage(items: ImageItem | ImageItem[], layer?: number): DrawHandle;
    drawPath(items: Path | Path[], style?: LineStyle, layer?: number): DrawHandle;
    drawGridLines(cellSize: number, style: { lineWidth: number; strokeStyle: string }, layer?: number): DrawHandle;

    // Static caching (pre-rendered offscreen canvas)
    drawStaticRect(items: Rect[], cacheKey: string, layer?: number): DrawHandle;
    drawStaticCircle(items: Circle[], cacheKey: string, layer?: number): DrawHandle;
    drawStaticImage(items: ImageItem[], cacheKey: string, layer?: number): DrawHandle;

    // Layer management
    removeDrawHandle(handle: DrawHandle): void;
    clearLayer(layer: number): void;
    clearAll(): void;
    clearStaticCache(cacheKey?: string): void;
}
```

| Method | Description |
| :----- | :---------- |
| `addDrawFunction` | Register custom draw callback with raw context access |
| `drawRect` | Draw rectangles with fill, stroke, rotation, border radius |
| `drawCircle` | Draw circles with fill and stroke |
| `drawLine` | Draw lines between two points |
| `drawText` | Draw text with font styling |
| `drawImage` | Draw images with rotation support |
| `drawPath` | Draw polylines through multiple points |
| `drawGridLines` | Draw grid lines at specified cell size |
| `drawStatic*` | Pre-render items to offscreen canvas for performance |
| `removeDrawHandle` | Remove a specific draw callback by its handle |
| `clearLayer` | Remove all draw callbacks from a layer |
| `clearAll` | Remove all draw callbacks |
| `clearStaticCache` | Clear pre-rendered caches |

## Custom Drawing

When using `onDraw` or `addDrawFunction`, the context type depends on the renderer:

```typescript
// With RendererCanvas, ctx is CanvasRenderingContext2D
engine.onDraw = (ctx, info) => {
    const context = ctx as CanvasRenderingContext2D;

    context.fillStyle = "rgba(255, 0, 0, 0.5)";
    context.fillRect(0, 0, info.width, info.height);
};

engine.addDrawFunction((ctx, coords, config) => {
    const context = ctx as CanvasRenderingContext2D;

    context.strokeStyle = "blue";
    context.strokeRect(100, 100, 50, 50);
}, 2);
```

:::tip
The `ctx` parameter is typed as `unknown` to support different renderer backends.
Cast it to the appropriate type for your renderer.
:::

## Creating a Custom Renderer

You can create custom renderers by implementing the `IRenderer` interface:

```typescript
import { IRenderer, IDrawAPI, IImageLoader, RendererDependencies } from "@canvas-tile-engine/core";

class MyCustomRenderer implements IRenderer {
    private deps!: RendererDependencies;

    init(deps: RendererDependencies): void {
        this.deps = deps;
        // Initialize your renderer
    }

    render(): void {
        // Render a frame
    }

    getDrawAPI(): IDrawAPI {
        // Return your draw API implementation
    }

    getImageLoader(): IImageLoader {
        // Return your image loader implementation
    }

    // ... implement other methods
}

// Use it
const engine = new CanvasTileEngine(wrapper, config, new MyCustomRenderer());
```
