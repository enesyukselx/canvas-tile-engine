---
sidebar_position: 2
---

# Installation

Choose the package that matches your framework.

## Core (Vanilla JavaScript)

For vanilla JavaScript/TypeScript projects:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-canvas
```

**Basic usage:**

```typescript
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const wrapper = document.getElementById("wrapper") as HTMLDivElement;
const engine = new CanvasTileEngine(wrapper, config, new RendererCanvas(), { x: 0, y: 0 });
```

:::info
The fourth parameter (center coordinates) of the `CanvasTileEngine` class is not required.
If omitted, its default value is `{ x: 0, y: 0 }`.
:::

## React

React wrapper with hooks and components:

```bash
npm install @canvas-tile-engine/react @canvas-tile-engine/renderer-canvas
```

**Basic usage:**

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

function App() {
    const engine = useCanvasTileEngine();

    return (
        <CanvasTileEngine
            engine={engine}
            renderer={new RendererCanvas()}
            config={config}
            center={{ x: 0, y: 0 }}
            onClick={(coords) => console.log(coords)}
        />
    );
}
```
