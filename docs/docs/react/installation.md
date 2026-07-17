---
sidebar_position: 1
---

# Installation

`@canvas-tile-engine/react` provides a React component, a stable engine hook, and declarative draw components.

## Install

Canvas2D:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react @canvas-tile-engine/renderer-canvas
```

WebGL:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react @canvas-tile-engine/renderer-webgl
```

## Basic Setup

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const tiles = [
    { x: 0, y: 0, size: 1, style: { fillStyle: "#22c55e" } },
    { x: 1, y: 0, size: 1, style: { fillStyle: "#38bdf8" } },
];

export function App() {
    const engine = useCanvasTileEngine();

    return (
        <CanvasTileEngine
            engine={engine}
            renderer={new RendererCanvas()}
            config={{
                scale: 48,
                size: { width: 800, height: 500 },
                backgroundColor: "#0f172a",
                eventHandlers: { drag: true, zoom: true, click: true },
            }}
            center={{ x: 0, y: 0 }}
            onClick={(coords) => console.log(coords.snapped)}
        >
            <CanvasTileEngine.GridLines cellSize={1} strokeStyle="#1e293b" layer={0} />
            <CanvasTileEngine.Rect items={tiles} layer={1} />
        </CanvasTileEngine>
    );
}
```

## Renderer Choice

Switch to WebGL by changing the renderer:

```tsx
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";

<CanvasTileEngine engine={engine} config={config} renderer={new RendererWebGL()} />;
```

`config`, `center`, and `renderer` are read when the component mounts. Later prop changes are intentionally ignored. Use runtime APIs for live updates:

```tsx
engine.setBounds({ minX: 0, maxX: 100, minY: 0, maxY: 100 });
engine.setEventHandlers({ drag: false, hover: true });
engine.updateCoords({ x: 10, y: 10 });
engine.goCoords(0, 0, 500);
engine.setScale(64);
engine.goScale(64, 500);
engine.setScaleLimits(16, 256);
```

Remount with a new `key` when you need to apply a new full config or renderer.

## `useCanvasTileEngine`

```tsx
const engine = useCanvasTileEngine();
```

The hook returns a stable handle. Methods are safe before mount: they no-op or return defaults. Use `engine.isReady` when you need the real core instance or image loader.

| Property | Description |
| :-- | :-- |
| `isReady` | `true` after the core engine has mounted. |
| `instance` | The underlying core `CanvasTileEngine` instance, or `null`. |
| `images` | Renderer image loader, available after mount. |

Common methods:

```tsx
engine.render();
engine.getCenterCoords();
engine.getVisibleBounds();
engine.goCoords(10, 10, 500);
engine.resize(1024, 768, 300);
engine.zoomIn();
engine.zoomOut();
engine.loadImage("/sprite.png");
engine.clearLayer(2);
engine.clearAll();
```

## Component Props

| Prop | Type | Description |
| :-- | :-- | :-- |
| `engine` | `EngineHandle` | Required handle from `useCanvasTileEngine()`. |
| `renderer` | `IRenderer` | Required renderer instance. |
| `config` | `CanvasTileEngineConfig` | Required initial config. |
| `center` | `{ x, y }` | Optional initial center. Defaults to `{ x: 0, y: 0 }`. |
| `className` | `string` | Wrapper div class. |
| `style` | `React.CSSProperties` | Wrapper div style. |
| `children` | `ReactNode` | Draw components. |
| `onCoordsChange` | `(coords) => void` | Camera center callback. |
| `onClick` / `onRightClick` / `onHover` | Pointer callbacks | Receive world, canvas, and client coordinate objects. |
| `onMouseDown` / `onMouseUp` / `onMouseLeave` | Pointer callbacks | Useful for drawing tools and mode state. |
| `onDraw` | `onDrawCallback` | Runs after engine layers. Context depends on renderer. |
| `onResize` | `() => void` | Resize callback. |
| `onZoom` | `(scale) => void` | Zoom callback. |

## Declarative And Imperative Drawing

Declarative:

```tsx
<CanvasTileEngine engine={engine} config={config} renderer={new RendererCanvas()}>
    <CanvasTileEngine.GridLines cellSize={1} />
    <CanvasTileEngine.Rect items={rects} layer={1} />
    <CanvasTileEngine.Circle items={markers} layer={2} />
</CanvasTileEngine>
```

Imperative:

```tsx
useEffect(() => {
    if (!engine.isReady) return;

    engine.drawGridLines(1, 1, "#334155", 0);
    engine.drawRect(rects, 1);
    engine.render();
}, [engine, engine.isReady, rects]);
```

:::note
If you remount the component with a `key` (for example to swap `renderer` or `config`), depend on `engine.instance` instead of `engine.isReady`. During a remount `isReady` returns to `true` within the same effect flush, so effects keyed on it do not re-run, while `engine.instance` changes identity with every new engine. Draw calls made while no engine is mounted are dropped and log a dev-only console warning.
:::

For declarative draw components, keep large `items` arrays stable with `useMemo` or state. A new array identity re-registers the draw callback and can rebuild spatial indexes.
