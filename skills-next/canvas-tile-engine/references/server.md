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
- [Preview a scene from the command line](#preview-a-scene-from-the-command-line)

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

## Preview a scene from the command line

The package ships a `cte-render` bin that renders a preview module to an
image, so you can look at what a scene draws in any project: browser,
React, React Native or server. The usual workflow is in
[SKILL.md: Verify by rendering](../SKILL.md#verify-by-rendering).

```bash
# Any project: npx fetches the latest package (and its core peer) on the fly.
# Keep @latest: without it, an older renderer-server installed in the project
# (no bin before the core 0.12 release) shadows the download.
npx -y @canvas-tile-engine/renderer-server@latest map.preview.mjs -o /tmp/map.png --grid --coords

# A project that depends on renderer-server (core >= 0.12): use its own copy.
# --no stops npx from downloading an unrelated package if the bin is missing.
npx --no cte-render map.preview.mjs -o /tmp/map.png --grid --coords
pnpm exec cte-render map.preview.mjs -o /tmp/map.png --grid --coords
```

The preview module is an ES module that exports `config`, `center` and
`draw`, either as named exports or as one default-exported object. They mean
the same as the `renderToBuffer` options; the pixel ratio, format and
quality come from the flags instead (a module export for them is ignored
with a note).

```js
// map.preview.mjs
export const config = { scale: 40, size: { width: 480, height: 320 }, backgroundColor: "#0f172a" };
export const center = { x: 1.5, y: 1.5 }; // item space, default { x: 0, y: 0 }
const tiles = [{ x: 0, y: 0, size: 1, style: { fillStyle: "#22c55e" } }]; // the app's items
export async function draw(engine) {
    engine.drawGridLines(1, 1, "#1e293b", 0);
    engine.drawRect(tiles, 1);
    const marker = await engine.images.load("./assets/marker.png"); // relative to the working directory
    engine.drawImage({ x: 2, y: 1, size: 1, img: marker }, 2);
}
```

- `.mjs` always works, and `.mts` works on Node 22.18 or newer (23.6+ on
  the 23 line), which strips the types itself: erasable syntax only,
  type-only names imported with `import type`, and relative imports with
  their file extension. `.js` and `.ts` follow the nearest package.json
  `type`, so they load as ES modules only in a `"type": "module"` package.
  Prefer `.mjs` or `.mts`.
- A preview that imports the app's own data needs those modules to load in
  plain Node under the same rules: no path aliases, no CSS/asset imports, no
  browser globals at import time. When that fails, copy the items into the
  preview module.
- `draw` receives a server engine: use the imperative draw calls. A React
  `<CanvasTileEngine.Rect items={tiles} layer={1} />` becomes
  `engine.drawRect(tiles, 1)`; the other components map the same way.
  Use `export function draw`, not `export default function draw`.

The engine starts from the module's `config` and `center`, as the app does,
so `config.bounds` clamping and `gridAligned` snapping of the initial
center match the app. The camera flags then apply before `draw` runs (so
`draw` sees them, e.g. in `getVisibleBounds()`) and again after it, so they
win over `fitBounds` / `setCenter` / `setScale` calls inside `draw`.

| Option | Effect |
| :-- | :-- |
| `-o, --out <file>` | Output path; the extension picks the format (`.png`, `.jpg`/`.jpeg`, `.webp`). Default `<module name>.png` in the working directory. |
| `--grid` | One-cell grid lines above every layer: shows which cell each item sits in. |
| `--coords` | Coordinate overlay with cell numbers on the edges, at any scale. |
| `--center <x,y>` | Moves the camera like `engine.setCenter` (item space): `config.bounds` still clamps it, `gridAligned` does not snap it. Negative x: `--center=-3,4`. |
| `--scale <px>` | Zooms like `engine.setScale`, even outside the zoom limits (a note says the app cannot zoom that far). |
| `--size <WxH>` | Resizes the viewport (CSS pixels) and keeps the center. Works on a `responsive` config too. |
| `--pixel-ratio <n>` | Output pixel ratio, default 1. |
| `--quality <0-100>` | JPEG/WebP quality. |
| `--font <file[=family]>` | Register a font before rendering; repeatable. |

On success it prints the file, the final camera and the visible range in
item space:

```text
Wrote /tmp/map.png (480x320 px, png)
Center (1.5, 1.5), scale 40 px per unit (limits 20 to 80)
Visible x -4.5 to 7.5, y -2.5 to 5.5 (item space: integers are cell centers)
```

A `note:` on stderr flags a module center that `config.bounds` or
`config.gridAligned` moved, a `--center` that `config.bounds` clamped, and
a `--scale` outside the zoom limits (`minScale`/`maxScale`, by default half
and twice `scale`). Exit codes: `0` rendered, `1` the module or the render
failed (config validation errors, a rejected promise in `draw`, or a `draw`
that never finishes), `2` bad command line. The command exits after
writing the image even if the module left timers or sockets open.

Limits: the image comes from the Canvas2D drawing code that
`renderer-canvas` also uses. WebGL draws text and custom drawing above all
shapes, and React Native Skia can differ in details. Nothing interactive
runs: no events, no animation (a `SpriteAnimator` shows its first frame),
and `styleOf` / `visibleOf` see the state the module sets up. Text needs
fonts: on a machine without system fonts pass `--font`.
