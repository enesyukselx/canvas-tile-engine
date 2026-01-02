---
sidebar_position: 1
---

# Installation

This page covers how to use `@canvas-tile-engine/react` inside React applications.

## Install

```bash
npm install @canvas-tile-engine/react
```

## Basic Setup

The React package provides a declarative API using compound components. Here's a minimal example:

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";

function App() {
    const engine = useCanvasTileEngine();

    const config = {
        scale: 50,
        size: { width: 800, height: 600 },
        eventHandlers: {
            drag: true,
            zoom: true,
        },
    };

    return (
        <CanvasTileEngine engine={engine} config={config}>
            <CanvasTileEngine.GridLines cellSize={1} strokeStyle="rgba(0,0,0,0.2)" />
            <CanvasTileEngine.Rect items={{ x: 5, y: 5, size: 1, style: { fillStyle: "#0077be" } }} layer={1} />
        </CanvasTileEngine>
    );
}
```

## The `useCanvasTileEngine` Hook

The `useCanvasTileEngine` hook creates an engine handle that manages the lifecycle of the canvas engine.

```tsx
const engine = useCanvasTileEngine();
```

### Engine Handle Properties

| Property   | Type                       | Description                                  |
| :--------- | :------------------------- | :------------------------------------------- |
| `isReady`  | `boolean`                  | Whether the engine is initialized and ready. |
| `instance` | `CanvasTileEngine \| null` | The underlying core engine instance.         |

### Engine Handle Methods

Once `engine.isReady` is `true`, you can access all core engine methods:

```tsx
useEffect(() => {
    if (engine.isReady) {
        // Access core engine methods
        engine.goCoords(10, 10, 500);
        engine.render();
    }
}, [engine.isReady]);
```

## Declarative vs Imperative API

### Declarative (Recommended)

Use compound components as children of `CanvasTileEngine`:

```tsx
<CanvasTileEngine engine={engine} config={config}>
    <CanvasTileEngine.GridLines cellSize={1} />
    <CanvasTileEngine.Rect items={rectangles} layer={1} />
    <CanvasTileEngine.Circle items={circles} layer={2} />
</CanvasTileEngine>
```

### Imperative

For dynamic scenarios, use the engine handle directly:

```tsx
useEffect(() => {
    if (engine.isReady) {
        engine.drawGridLines(1);
        engine.drawRect(rectangles, 1);
        engine.render();
    }
}, [engine.isReady, rectangles]);
```

## Component Props

| Prop             | Type                     | Default          | Description                        |
| :--------------- | :----------------------- | :--------------- | :--------------------------------- |
| `engine`         | `EngineHandle`           | **Required**     | Engine handle from the hook.       |
| `config`         | `CanvasTileEngineConfig` | **Required**     | Engine configuration.              |
| `center`         | `{ x, y }`               | `{ x: 0, y: 0 }` | Initial center coordinates.        |
| `className`      | `string`                 | -                | CSS class for the wrapper div.     |
| `style`          | `CSSProperties`          | -                | Inline styles for the wrapper div. |
| `children`       | `ReactNode`              | -                | Draw components.                   |
| `onCoordsChange` | `(coords) => void`       | -                | Camera position change callback.   |
| `onClick`        | `onClickCallback`        | -                | Click event callback.              |
| `onHover`        | `onHoverCallback`        | -                | Hover event callback.              |
| `onMouseDown`    | `() => void`             | -                | Mouse down callback.               |
| `onMouseUp`      | `() => void`             | -                | Mouse up callback.                 |
| `onMouseLeave`   | `() => void`             | -                | Mouse leave callback.              |
| `onDraw`         | `onDrawCallback`         | -                | Post-draw callback.                |
| `onResize`       | `() => void`             | -                | Resize callback.                   |

## Configuration

The `config` prop accepts the same configuration as the core engine:

```tsx
const config = {
    scale: 50, // Pixels per grid unit
    minScale: 10, // Minimum zoom
    maxScale: 200, // Maximum zoom
    backgroundColor: "#f0f0f0", // Canvas background
    size: {
        width: 800,
        height: 600,
    },
    eventHandlers: {
        click: true,
        hover: true,
        drag: true,
        zoom: true,
        resize: true,
    },
    bounds: {
        // Optional camera bounds
        minX: -100,
        maxX: 100,
        minY: -100,
        maxY: 100,
    },
};
```
