---
sidebar_position: 1
---

# Server Rendering

`@canvas-tile-engine/renderer-server` renders Canvas Tile Engine scenes to image `Buffer` values in Node.js. It uses `@napi-rs/canvas` and does not require a browser or DOM.

Use it for Open Graph images, thumbnails, email/PDF previews, CDN pre-rendering, and visual snapshot tests.

## Install

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-server
```

## One-Shot Rendering

`renderToBuffer` creates the engine and renderer, runs your draw callback, renders one frame, encodes it, and destroys the engine.

```ts
import { renderToBuffer } from "@canvas-tile-engine/renderer-server";
import { writeFile } from "node:fs/promises";

const png = await renderToBuffer({
    config: {
        scale: 40,
        size: { width: 480, height: 320 },
        backgroundColor: "#0b1021",
    },
    center: { x: 2, y: 1 },
    pixelRatio: 2,
    format: "png",
    draw: (engine) => {
        engine.drawGridLines(1, 1, "#1e2a45", 0);
        engine.drawRect({ x: 0, y: 0, size: 0.9, radius: 6, style: { fillStyle: "#4ade80" } }, 1);
        engine.drawCircle({ x: 2, y: 2, size: 1.4, style: { fillStyle: "#22d3ee" } }, 1);
    },
});

await writeFile("map.png", png);
```

The `draw` callback may be async:

```ts
const png = await renderToBuffer({
    config: { scale: 32, size: { width: 512, height: 512 } },
    draw: async (engine) => {
        const tile = await engine.images.load("./assets/tile.png");
        engine.drawImage({ x: 0, y: 0, size: 1, img: tile }, 1);
    },
});
```

## Output Options

| Option | Default | Description |
| :-- | :-- | :-- |
| `center` | `{ x: 0, y: 0 }` | Initial world center. |
| `pixelRatio` | `1` | Physical output scale. Logical `config.size` stays unchanged. |
| `format` | `"png"` | `"png"`, `"jpeg"`, or `"webp"`. |
| `quality` | - | `0-100` for JPEG/WebP. Ignored for PNG. |

## Low-Level API

Use `RendererServer` directly when you need to keep the engine around, resize manually, or decide when to encode.

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererServer, SERVER_MOUNT } from "@canvas-tile-engine/renderer-server";

const renderer = new RendererServer({ pixelRatio: 1 });
const engine = new CanvasTileEngine(SERVER_MOUNT, config, renderer, { x: 0, y: 0 });

engine.drawGridLines(1, 1, "#334155", 0);
engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#22d3ee" } }, 1);
engine.render();

const png = renderer.toBuffer("png");
const jpeg = await renderer.encode("jpeg", 80);

engine.destroy();
```

| Method | Description |
| :-- | :-- |
| `renderer.toBuffer(format?, quality?)` | Synchronous encode to `Buffer`. |
| `renderer.encode(format?, quality?)` | Async encode to `Buffer`; better for request handlers. |
| `renderer.getCanvas()` | Accesses the underlying `@napi-rs/canvas` canvas. |
| `renderer.getContext()` | Accesses the underlying `SKRSContext2D`. |

## Fonts

Register fonts in headless environments before drawing text.

```ts
import { registerFont } from "@canvas-tile-engine/renderer-server";

registerFont("./fonts/Inter.ttf", "Inter");

engine.drawText(
    { x: 0, y: 0, text: "Hello", size: 1, style: { fontFamily: "Inter", fillStyle: "#fff" } },
    2,
);
```

`GlobalFonts` is also re-exported for advanced font management.

## Behavior Notes

- No DOM events, interaction callbacks, or browser animation loop run on the server.
- `config.coordinates` is supported.
- Static draw helpers use an offscreen `@napi-rs/canvas` cache.
- `onDraw` and `addDrawFunction` receive `SKRSContext2D`.
- `engine.images.load()` accepts paths, `file://` URLs, `http(s)` URLs, and `data:` URIs supported by `@napi-rs/canvas`.
