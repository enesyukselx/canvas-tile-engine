---
sidebar_position: 2
---

# Installation

Choose the package that matches your framework.

## Core (Vanilla JavaScript)

For vanilla JavaScript/TypeScript projects:

```bash
npm install @canvas-tile-engine/core
```

**Basic usage:**

```typescript
import { CanvasTileEngine } from "@canvas-tile-engine/core";

const wrapper = document.getElementById("wrapper") as HTMLDivElement;
const engine = new CanvasTileEngine(wrapper, config, { x: 0, y: 0 });
```

:::info
The third parameter of the `CanvasTileEngine` class is not required.  
If omitted, its default value is `(0, 0)`.
:::

## React

React wrapper with hooks and components:

```bash
npm install @canvas-tile-engine/react
```

**Basic usage:**

```tsx
import { CanvasTileMap, useCanvasTileEngine } from "@canvas-tile-engine/react";

function App() {
    const engine = useCanvasTileEngine();

    return (
        <CanvasTileMap
            engine={engine}
            config={config}
            center={{ x: 0, y: 0 }}
            onClick={(coords) => console.log(coords)}
        />
    );
}
```
