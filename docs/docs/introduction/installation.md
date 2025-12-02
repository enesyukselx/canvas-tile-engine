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

const wrapper = document.getElementById("map") as HTMLDivElement;
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
import { CanvasTileMap } from "@canvas-tile-engine/react";

function App() {
    return <CanvasTileMap config={config} center={{ x: 0, y: 0 }} onClick={(coords) => console.log(coords)} />;
}
```

## Vue

Vue 3 component:

```bash
npm install @canvas-tile-engine/vue
```

**Basic usage:**

```ts
<template>
    <CanvasTileMap :config="config" :center="{ x: 0, y: 0 }" @click="handleClick" />
</template>

<script setup>
import { CanvasTileMap } from "@canvas-tile-engine/vue";
</script>
```

## Svelte

Svelte component:

```bash
npm install @canvas-tile-engine/svelte
```

**Basic usage:**

```ts
<script>
    import { CanvasTileMap } from "@canvas-tile-engine/svelte";
</script>

<CanvasTileMap
    {config}
    center={{ x: 0, y: 0 }}
    on:click={handleClick}
/>
```
