# @canvas-tile-engine/renderer-server

[![npm version](https://img.shields.io/npm/v/@canvas-tile-engine/renderer-server)](https://www.npmjs.com/package/@canvas-tile-engine/renderer-server)
[![license](https://img.shields.io/npm/l/@canvas-tile-engine/renderer-server)](../../LICENSE)

Headless Node.js renderer for Canvas Tile Engine. It draws a map into an image `Buffer` with no browser and no DOM, using [`@napi-rs/canvas`](https://github.com/Brooooooklyn/canvas) under the hood.

Use it for Open Graph images, email/PDF thumbnails, CDN tile pre-rendering, SEO previews, and deterministic visual snapshot tests. A single `render()` produces one frame that can be encoded as PNG, JPEG, or WebP.

## Install

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-server
```

`@napi-rs/canvas` ships prebuilt native binaries for common platforms, so most installs do not need a compiler toolchain.

### Node-only TypeScript

With `typescript` and `@types/node` installed, strict Node consumers can use
`lib: ["ES2022"]`, `types: ["node"]`, and `skipLibCheck: false`. No DOM library
or browser ambient declarations are needed. `renderToBuffer` and the low-level
engine constructor infer native image types from `RendererServer`.

For standalone image annotations, use core's `ImageItem<Image>` with `Image`
from `@napi-rs/canvas`. Unparameterized core mount/image types default to
`unknown` outside DOM projects; browser defaults remain unchanged. The server's
native canvas is available through `renderer.getCanvas()`; `engine.canvas`
is `undefined`.

## Quick Start

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
    draw: (engine) => {
        engine.drawGridLines(1, 1, "#1e2a45", 0);
        engine.drawRect({ x: 0, y: 0, size: 0.9, radius: 6, style: { fillStyle: "#4ade80" } }, 1);
        engine.drawCircle({ x: 2, y: 2, size: 1.4, style: { fillStyle: "#22d3ee" } }, 1);
    },
});

await writeFile("map.png", png);
```

The `draw` callback can be async, which is useful for image loading:

```ts
const png = await renderToBuffer({
    config: { scale: 32, size: { width: 512, height: 512 } },
    draw: async (engine) => {
        const sprite = await engine.images.load("./assets/tile.png");
        engine.drawImage({ x: 0, y: 0, size: 1, img: sprite }, 1);
    },
});
```

## Low-Level Usage

Use `RendererServer` directly when you need to keep the engine around, resize manually, or choose when to encode.

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererServer, SERVER_MOUNT } from "@canvas-tile-engine/renderer-server";

const renderer = new RendererServer({ pixelRatio: 1 });
const engine = new CanvasTileEngine(SERVER_MOUNT, config, renderer, { x: 0, y: 0 });

engine.drawGridLines(1, 1, "#334155", 0);
engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#0ff" } }, 1);
engine.render();

const png = renderer.toBuffer("png");
const jpeg = await renderer.encode("jpeg", 80);

engine.destroy();
```

`SERVER_MOUNT` is an opaque mount marker. The server renderer ignores the DOM and creates its own in-memory canvas.

## Output API

| Method                                 | Returns           | Notes                                |
| -------------------------------------- | ----------------- | ------------------------------------ |
| `renderer.toBuffer(format?, quality?)` | `Buffer`          | Synchronous encode.                  |
| `renderer.encode(format?, quality?)`   | `Promise<Buffer>` | Async encode; better for servers.    |
| `renderer.getCanvas()`                 | `Canvas`          | Underlying `@napi-rs/canvas` canvas. |
| `renderer.getContext()`                | `SKRSContext2D`   | Underlying 2D context.               |

`format` is `"png"`, `"jpeg"`, or `"webp"` and defaults to `"png"`. `quality` is `0-100` for JPEG/WebP and is ignored for PNG.

## Fonts

System fonts are not guaranteed in CI, containers, or serverless runtimes. Register the fonts your map needs before rendering text:

```ts
import { registerFont } from "@canvas-tile-engine/renderer-server";

registerFont("./fonts/Inter.ttf", "Inter");

engine.drawText({ x: 0, y: 0, text: "Hello", style: { fontFamily: "Inter" } }, 2);
```

`GlobalFonts` from `@napi-rs/canvas` is re-exported for advanced font management.

## Behavior Notes

- No DOM events, interaction callbacks, or animation loop run on the server.
- `pixelRatio` belongs to the renderer. The logical viewport size stays as configured; the physical output resolution is scaled.
- Browser debug FPS HUD is not rendered. Coordinate overlay (`config.coordinates`) is supported.
- Static caches work through an injected offscreen canvas factory, mirroring the Canvas2D renderer.
- `onDraw` and `addDrawFunction` receive the native `SKRSContext2D` context.

## Custom Drawing

`Image`, `Canvas`, and `SKRSContext2D` are convenience **type-only** exports.
Use `import type` for annotations. They are not runtime values or constructors
from this package. Import native constructors directly from `@napi-rs/canvas`
(add it as a direct dependency when importing it in your application):

```ts
import type { Image, Canvas } from "@canvas-tile-engine/renderer-server";
import { Image as NativeImage, createCanvas } from "@napi-rs/canvas";

const image: Image = new NativeImage();
const canvas: Canvas = createCanvas(256, 256);
```

```ts
import type { SKRSContext2D } from "@canvas-tile-engine/renderer-server";

engine.addDrawFunction((ctx) => {
    const context = ctx as SKRSContext2D;
    context.fillStyle = "#f97316";
    context.fillRect(12, 12, 80, 24);
}, 2);
```

## Documentation

For contributors, `pnpm test:package` from the repository root builds and packs
core and renderer-server, then checks a temporary consumer against those tarballs.
It verifies type-only/native type compatibility, rejected value usage, named
runtime exports, and PNG rendering in NodeNext ESM/CommonJS and bundler mode.
Third-party dependencies reuse the workspace lockfile installation; no registry
download or package publication is performed by this check.

- Core engine: [`@canvas-tile-engine/core`](../core)
- Browser Canvas2D renderer: [`@canvas-tile-engine/renderer-canvas`](../renderer-canvas)
- Full docs: [canvastileengine.dev](https://canvastileengine.dev)

## License

MIT
