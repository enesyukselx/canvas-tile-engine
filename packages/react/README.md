# @canvas-tile-engine/react

React bindings for Canvas Tile Engine — build interactive 2D grid-based maps with declarative components.

## Install

```bash
npm install @canvas-tile-engine/react
```

## Quick Start

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";

const config = {
    scale: 50,
    size: { width: 800, height: 600 },
    backgroundColor: "#337426",
    eventHandlers: { drag: true, zoom: true, click: true },
};

function App() {
    const engine = useCanvasTileEngine();

    return (
        <CanvasTileEngine
            engine={engine}
            config={config}
            center={{ x: 0, y: 0 }}
            onClick={(coords) => console.log("Clicked:", coords.snapped)}
        >
            <CanvasTileEngine.Rect items={[{ x: 0, y: 0, size: 1, style: { fillStyle: "#f9c74f" } }]} layer={0} />
            <CanvasTileEngine.GridLines cellSize={10} layer={1} />
        </CanvasTileEngine>
    );
}
```

## Documentation

Full API reference and examples: [https://www.canvastileengine.dev/docs/react/installation](https://www.canvastileengine.dev/docs/react/installation)

## License

MIT
