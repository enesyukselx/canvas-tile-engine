# Server Rendering Reference

Package: `@canvas-tile-engine/renderer-server`. Renders scenes to image
`Buffer`s in Node.js via `@napi-rs/canvas` - no browser, no DOM, no JSDOM.
Use for Open Graph images, thumbnails, email/PDF previews, CDN pre-rendering,
and visual snapshot tests.

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/renderer-server
```

Works in CommonJS and ESM projects.

## Preferred API: `renderToBuffer` (one-shot)

Creates engine + renderer, runs your draw callback, renders one frame,
encodes, destroys the engine, returns the buffer.

```ts
import { renderToBuffer } from "@canvas-tile-engine/renderer-server";
import { writeFile } from "node:fs/promises";

const png = await renderToBuffer({
    config: {
        scale: 40,
        size: { width: 480, height: 320 },
        backgroundColor: "#0b1021",
        coordinates: { enabled: true },          // overlay is supported on server
    },
    center: { x: 2, y: 1 },     // default { x: 0, y: 0 }
    pixelRatio: 2,              // default 1; physical output scale, logical size unchanged
    format: "png",              // "png" (default) | "jpeg" | "webp"
    quality: 90,                // 0-100, JPEG/WebP only, ignored for PNG
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
        const tile = await engine.images.load("./assets/tile.png");
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
engine.render();                                   // explicit render required here

const png = renderer.toBuffer("png");              // sync encode
const jpeg = await renderer.encode("jpeg", 80);    // async encode (prefer in request handlers)

engine.updateCoords({ x: 50, y: 50 });             // camera moves re-render automatically
const secondView = await renderer.encode("png");

engine.destroy();
```

| Method | Description |
| :-- | :-- |
| `renderer.toBuffer(format?, quality?)` | Synchronous encode to `Buffer`. |
| `renderer.encode(format?, quality?)` | Async encode; keeps the event loop free. |
| `renderer.getCanvas()` | Underlying `@napi-rs/canvas` Canvas. |
| `renderer.getContext()` | Underlying `SKRSContext2D`. |

`SERVER_MOUNT` is the mount sentinel - always pass it as the wrapper
argument; there is no DOM element on the server.

## Fonts

Headless environments have no system font fallback guarantees. Register
fonts before drawing text:

```ts
import { registerFont, GlobalFonts } from "@canvas-tile-engine/renderer-server";

registerFont("./fonts/Inter.ttf", "Inter");

engine.drawText(
    { x: 0, y: 0, text: "Hello", size: 1, style: { fontFamily: "Inter", fillStyle: "#fff" } },
    2,
);
```

`GlobalFonts` (re-exported from `@napi-rs/canvas`) is available for advanced
font management.

## Behavior notes (differences from browser renderers)

- No DOM events, no interaction callbacks, no animation loop, no FPS HUD.
  `eventHandlers` and `responsive` are ignored.
- `config.coordinates` (coordinate overlay) IS supported.
- Static draw helpers (`drawStatic*`) work via an offscreen `@napi-rs/canvas`
  cache.
- `onDraw` and `addDrawFunction` receive `SKRSContext2D` (API-compatible
  with `CanvasRenderingContext2D` for common operations).
- `engine.images.load()` accepts filesystem paths, `file://` URLs,
  `http(s)://` URLs, and `data:` URIs.
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

Same shape works in a Next.js route handler (`return new Response(png,
{ headers: { "Content-Type": "image/png" } })`). Use `engine.getVisibleBounds()`
inside `draw` to fetch/draw only the region the image will show.
