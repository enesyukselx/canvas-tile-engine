# @canvas-tile-engine/renderer-server

[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/renderer-server)](https://www.npmjs.com/package/@canvas-tile-engine/renderer-server)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/renderer-server)](../../LICENSE)

Headless **server-side (Node.js) renderer** for [Canvas Tile Engine](https://github.com/enesyukselx/canvas-tile-engine). It draws maps to an image `Buffer` (PNG / JPEG / WebP) with **no browser and no DOM**, using [`@napi-rs/canvas`](https://github.com/Brooooooklyn/canvas) for the underlying Canvas2D surface.

There is no interaction, no animation loop, and no event handling — a single `render()` produces one frame you can encode. It reuses the exact same Canvas2D drawing pipeline as `@canvas-tile-engine/renderer-canvas` (culling, spatial index, origin, rotation, static caching), so server output matches the browser.

## Use cases

- Open Graph / social share images
- Email and PDF map thumbnails
- CDN tile pre-rendering
- SEO / SSR previews
- Visual snapshot tests (deterministic PNG output)

## Install

```bash
npm install @canvas-tile-engine/renderer-server @canvas-tile-engine/core
```

`@napi-rs/canvas` ships prebuilt native binaries for common platforms, so no compiler toolchain is required.

## Quick start (one-shot helper)

The `renderToBuffer` helper wires up the engine and renderer, runs your draw callback, renders one frame, and encodes the result:

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
    pixelRatio: 2, // @2x / retina output
    draw: (engine) => {
        engine.drawGridLines(1, 1, "#1e2a45", 0);
        engine.drawRect({ x: 0, y: 0, size: 0.9, radius: 6, style: { fillStyle: "#4ade80" } }, 1);
        engine.drawCircle({ x: 2, y: 2, size: 1.4, style: { fillStyle: "#22d3ee" } }, 1);
    },
});

await writeFile("map.png", png);
```

The `draw` callback may be `async` — useful when you need to load images first:

```ts
const png = await renderToBuffer({
    config: { scale: 32, size: { width: 512, height: 512 } },
    draw: async (engine) => {
        const sprite = await engine.images.load("./assets/tile.png");
        engine.drawImage({ x: 0, y: 0, size: 1, img: sprite }, 1);
    },
});
```

## Low-level usage (engine + renderer)

For full control, construct the engine yourself and pull the buffer off the renderer:

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererServer, SERVER_MOUNT } from "@canvas-tile-engine/renderer-server";

const renderer = new RendererServer({ pixelRatio: 1 });
const engine = new CanvasTileEngine(SERVER_MOUNT, config, renderer, { x: 0, y: 0 });

engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#0ff" } }, 1);
engine.render();

const png = renderer.toBuffer("png"); // sync
const jpeg = await renderer.encode("jpeg", 80); // async, non-blocking

engine.destroy();
```

`SERVER_MOUNT` is a shared, opaque mount marker — headless mode never touches the DOM, and the renderer creates its own backing canvas.

## Fonts

System fonts are **not guaranteed** in headless environments (containers, CI, serverless). Register the fonts your maps rely on before rendering, then reference the family via `style.fontFamily` on text items:

```ts
import { registerFont } from "@canvas-tile-engine/renderer-server";

registerFont("./fonts/Inter.ttf", "Inter");

// later
engine.drawText({ x: 0, y: 0, text: "Hello", style: { fontFamily: "Inter" } }, 2);
```

`GlobalFonts` from `@napi-rs/canvas` is also re-exported for advanced control.

## Output API

| Method | Returns | Notes |
| --- | --- | --- |
| `renderer.toBuffer(format?, quality?)` | `Buffer` | Synchronous encode |
| `renderer.encode(format?, quality?)` | `Promise<Buffer>` | Async, avoids blocking the event loop |
| `renderer.getCanvas()` | `Canvas` | Underlying `@napi-rs/canvas` canvas |
| `renderer.getContext()` | `SKRSContext2D` | Underlying 2D context |

`format` is `"png" | "jpeg" | "webp"` (default `"png"`). `quality` is `0–100` for `jpeg`/`webp` (ignored for `png`).

## Custom drawing

In `addDrawFunction` / `onDraw`, the context is the `@napi-rs/canvas` `SKRSContext2D`:

```ts
import type { SKRSContext2D } from "@canvas-tile-engine/renderer-server";

engine.addDrawFunction((ctx, coords, config) => {
    const context = ctx as SKRSContext2D;
    context.fillStyle = "red";
    context.fillRect(0, 0, 100, 100);
}, 2);
```

## Notes & limitations

- **DPR / `pixelRatio`** is owned by the renderer (there is no `window` on the server). The logical world/viewport size stays as configured; only the exported image's physical resolution is scaled.
- **No debug HUD**: the FPS/debug overlay is browser-only and is not rendered here. The coordinate overlay (`config.coordinates`) is supported.
- **Static caching works** on the server via an injected offscreen-canvas factory, mirroring the browser renderer.

## Architecture

Implements the generic `IRenderer<TMount, TImage>` interface from `@canvas-tile-engine/core`, parameterized as `IRenderer<ServerMount, Image>`:

```
@canvas-tile-engine/core
        │
        ▼
   IRenderer ◄─── Interface (generic over mount/image)
        │
        ▼
┌──────────────────┐
│  RendererServer  │ ◄─── This package
│ (@napi-rs/canvas)│
└──────────────────┘
```

## Documentation

Full documentation: [canvastileengine.dev](https://canvastileengine.dev)

## License

MIT
