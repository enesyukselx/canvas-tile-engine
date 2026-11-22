# Server Rendering Reference

Package: `@canvas-tile-engine/renderer-server`. Renders scenes to image
`Buffer`s in Node.js via `@napi-rs/canvas` - no browser, no DOM, no JSDOM.
Use for Open Graph images, thumbnails, email/PDF previews, CDN pre-rendering,
and visual snapshot tests.

Contents:

- [Install and types](#install-and-types)
- [Preferred API: `renderToBuffer` (one-shot)](#preferred-api-rendertobuffer-one-shot)
- [Low-level API: `RendererServer`](#low-level-api-rendererserver)
- [Fonts](#fonts)
- [Behavior notes (differences from browser renderers)](#behavior-notes-differences-from-browser-renderers)
- [Pattern: HTTP image endpoint](#pattern-http-image-endpoint)

## Install and types

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-server
```

Works in CommonJS and ESM projects. TypeScript: install `typescript` and
`@types/node`. A Node-only config (`lib: ["ES2022"]`, `types: ["node"]`,
`strict: true`, even `skipLibCheck: false`) is supported; do not add DOM libs
or browser shims. `RendererServer` keeps the native mount/image types
inferred in the engine constructor and the `renderToBuffer` callback; for
standalone annotations use core's `ImageItem<Image>`. Without DOM types,
unparameterized core mount/image types default to `unknown`.

Runtime exports: `RendererServer`, `SERVER_MOUNT`, `renderToBuffer`,
`registerFont`, `GlobalFonts`. `Image`, `Canvas` and `SKRSContext2D` are
TYPE-only exports - never `new Image()` / `new Canvas()` from this package.
For constructors or `createCanvas`, add `@napi-rs/canvas` as a direct
dependency and import from it.

```ts
import type { Image, Canvas, SKRSContext2D } from "@canvas-tile-engine/renderer-server";
```

## Preferred API: `renderToBuffer` (one-shot)

Creates engine + renderer, runs your draw callback, renders one frame,
encodes, destroys the engine (also on error), returns the buffer.

```ts
import { renderToBuffer } from "@canvas-tile-engine/renderer-server";
import { writeFile } from "node:fs/promises";

const png = await renderToBuffer({
    config: {
        scale: 40,
        size: { width: 480, height: 320 },
        backgroundColor: "#0b1021",
        coordinates: { enabled: true }, // overlay is supported on server
    },
    center: { x: 2, y: 1 }, // default { x: 0, y: 0 }
    pixelRatio: 2, // default 1; physical output scale, logical size unchanged
    format: "png", // "png" (default) | "jpeg" | "webp"
    quality: 90, // 0-100, JPEG/WebP only, ignored for PNG
    draw: (engine) => {
        engine.drawGridLines(1, 1, "#1e2a45", 0);
        engine.drawRect({ x: 0, y: 0, size: 0.9, radius: 0.12, style: { fillStyle: "#4ade80" } }, 1);
        engine.drawCircle({ x: 2, y: 2, size: 1.4, style: { fillStyle: "#22d3ee" } }, 1);
    },
});
await writeFile("map.png", png);
```

The `draw` callback receives the full engine and MAY be async (await image
loads inside it):

```ts
const png = await renderToBuffer({
    config: { scale: 32, size: { width: 512, height: 512 } },
    draw: async (engine) => {
        const tile = await engine.images.load("./assets/tile.png"); // relative to process.cwd()
        engine.drawImage({ x: 0, y: 0, size: 1, img: tile }, 1);
    },
});
```

Do NOT call `engine.render()` inside `draw` - `renderToBuffer` renders after
the callback resolves.

## Low-level API: `RendererServer`

Keep the engine alive across multiple renders/encodes:

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererServer, SERVER_MOUNT } from "@canvas-tile-engine/renderer-server";

const renderer = new RendererServer({ pixelRatio: 1 });
const engine = new CanvasTileEngine(SERVER_MOUNT, config, renderer, { x: 0, y: 0 });

engine.drawGridLines(1, 1, "#334155", 0);
engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#22d3ee" } }, 1);
engine.render(); // explicit render required here

const png = renderer.toBuffer("png"); // sync encode
const jpeg = await renderer.encode("jpeg", 80); // async encode (prefer in request handlers)

engine.setCenter({ x: 50, y: 50 }); // camera moves re-render automatically
const secondView = await renderer.encode("png");

engine.destroy();
```

| Method                                 | Description                              |
| :------------------------------------- | :--------------------------------------- |
| `renderer.toBuffer(format?, quality?)` | Synchronous encode to `Buffer`.          |
| `renderer.encode(format?, quality?)`   | Async encode; keeps the event loop free. |
| `renderer.getCanvas()`                 | Underlying `@napi-rs/canvas` Canvas.     |
| `renderer.getContext()`                | Underlying `SKRSContext2D`.              |

`SERVER_MOUNT` is the mount sentinel - always pass it as the wrapper
argument; there is no DOM element on the server. `engine.canvas` is
`undefined` here; use `renderer.getCanvas()`.

## Fonts

Headless environments (containers, CI, serverless) have no guaranteed system
fonts. Register every font you draw with once at startup, before the first
render, then reference its family in `style.fontFamily`:

```ts
import { fileURLToPath } from "node:url";
import { registerFont } from "@canvas-tile-engine/renderer-server";

// Absolute path: a relative one resolves against process.cwd(), not this file
const fontPath = fileURLToPath(new URL("./fonts/Inter.ttf", import.meta.url));
if (!registerFont(fontPath, "Inter")) {
    throw new Error(`Font failed to register: ${fontPath}`);
}

engine.drawText({ x: 0, y: 0, text: "Hello", size: 1, style: { fontFamily: "Inter", fillStyle: "#fff" } }, 2);
```

- `registerFont(path: string, family?: string): boolean` takes a
  `.ttf`/`.otf`/`.woff2` file; `family` is the name to use in `fontFamily`
  (default: the font's own family name).
- It returns `false` on failure (missing file, unreadable font) and NEVER
  throws - check the result, or a bad path fails silently.
- CommonJS: `path.resolve(__dirname, "fonts/Inter.ttf")`.
- `GlobalFonts` (re-exported from `@napi-rs/canvas`) is available for
  advanced font management.

## Behavior notes (differences from browser renderers)

- No DOM events, no interaction callbacks, no animation loop, no FPS HUD.
  `eventHandlers` and `responsive` are ignored. `SpriteAnimator` applies its
  first frame only ([sprites.md](sprites.md#3-spriteanimator-playback)).
- `config.coordinates` (coordinate overlay) IS supported.
- `drawStatic*` caches a bitmap at the registration scale, like Canvas2D
  ([drawing.md](drawing.md#static-caching-drawstaticrect--drawstaticcircle--drawstaticimage)).
- `onDraw` and `addDrawFunction` receive `SKRSContext2D` (API-compatible
  with `CanvasRenderingContext2D` for common operations).
- `engine.images.load()` accepts filesystem paths (relative ones resolve
  against `process.cwd()`), `file://` URLs, `http(s)://` URLs, and `data:`
  URIs.
- `pixelRatio` belongs to the renderer (constructor or `renderToBuffer`
  option) - there is no `devicePixelRatio` on the server. Output pixel size =
  `config.size * pixelRatio`.

## Pattern: HTTP image endpoint

```ts
// Express
app.get("/og/:x/:y", async (req, res) => {
    const png = await renderToBuffer({
        config: { scale: 24, size: { width: 1200, height: 630 }, backgroundColor: "#0f172a" },
        center: { x: Number(req.params.x), y: Number(req.params.y) },
        pixelRatio: 1,
        draw: (engine) => {
            engine.drawGridLines(1, 1, "#1e293b", 0);
            engine.drawRect(tilesForRegion(engine.getVisibleBounds()), 1);
        },
    });
    res.type("png").send(png);
});
```

Same shape works in a Next.js route handler:
`return new Response(png, { headers: { "Content-Type": "image/png" } })`.
Use `engine.getVisibleBounds()` inside `draw` to fetch/draw only the region
the image will show.
