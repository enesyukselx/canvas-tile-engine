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

## TypeScript without DOM types

Node-only projects can use strict declaration checking without adding the DOM
library or ambient browser declarations:

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "lib": ["ES2022"],
        "types": ["node"],
        "strict": true,
        "skipLibCheck": false
    }
}
```

Install `typescript` and `@types/node` as development dependencies. Both
`renderToBuffer` and `new CanvasTileEngine(SERVER_MOUNT, config, renderer)` infer
the native image type. Use `renderer.getCanvas()` for the native canvas;
`engine.canvas` is `undefined` on the server.

Core's unparameterized mount/image types default to `unknown` when DOM types are
absent. For standalone image annotations, supply `ImageItem<Image>` with `Image`
from `@napi-rs/canvas`. Browser consumers retain their existing `HTMLDivElement`,
`HTMLImageElement`, and `HTMLCanvasElement` types when their project includes DOM.

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
        engine.drawRect({ x: 0, y: 0, size: 0.9, radius: 0.12, style: { fillStyle: "#4ade80" } }, 1);
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

| Option       | Default          | Description                                                   |
| :----------- | :--------------- | :------------------------------------------------------------ |
| `center`     | `{ x: 0, y: 0 }` | Initial world center.                                         |
| `pixelRatio` | `1`              | Physical output scale. Logical `config.size` stays unchanged. |
| `format`     | `"png"`          | `"png"`, `"jpeg"`, or `"webp"`.                               |
| `quality`    | -                | `0-100` for JPEG/WebP. Ignored for PNG.                       |

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

| Method                                 | Description                                            |
| :------------------------------------- | :----------------------------------------------------- |
| `renderer.toBuffer(format?, quality?)` | Synchronous encode to `Buffer`.                        |
| `renderer.encode(format?, quality?)`   | Async encode to `Buffer`; better for request handlers. |
| `renderer.getCanvas()`                 | Accesses the underlying `@napi-rs/canvas` canvas.      |
| `renderer.getContext()`                | Accesses the underlying `SKRSContext2D`.               |

## Native Types and Constructors

`Image`, `Canvas`, and `SKRSContext2D` are **type-only** exports from
`@canvas-tile-engine/renderer-server`. Use them with `import type` for annotations;
`new Image()` or `new Canvas()` imported from this package is not supported.
For native constructors or factories, add `@napi-rs/canvas` as a direct dependency
and import the runtime values from it:

```ts
import type { Image, Canvas, SKRSContext2D } from "@canvas-tile-engine/renderer-server";
import { Image as NativeImage, createCanvas } from "@napi-rs/canvas";

const image: Image = new NativeImage();
const canvas: Canvas = createCanvas(256, 256);
const context: SKRSContext2D = canvas.getContext("2d");
```

`RendererServer`, `SERVER_MOUNT`, `renderToBuffer`, `registerFont`, and
`GlobalFonts` are the package's runtime exports in both ESM and CommonJS.

## Fonts

Register fonts in headless environments before drawing text.

```ts
import { registerFont } from "@canvas-tile-engine/renderer-server";

registerFont("./fonts/Inter.ttf", "Inter");

engine.drawText({ x: 0, y: 0, text: "Hello", size: 1, style: { fontFamily: "Inter", fillStyle: "#fff" } }, 2);
```

`GlobalFonts` is also re-exported for advanced font management.

## Behavior Notes

- No DOM events, interaction callbacks, or browser animation loop run on the server.
- `config.coordinates` is supported.
- Static draw helpers use an offscreen `@napi-rs/canvas` cache.
- `onDraw` and `addDrawFunction` receive `SKRSContext2D`.
- `engine.images.load()` accepts paths, `file://` URLs, `http(s)` URLs, and `data:` URIs supported by `@napi-rs/canvas`.

## Command-Line Preview

The package ships a `cte-render` command that renders a preview module to an image. It is a quick way to look at a scene from any project, including browser and React Native apps, and it gives AI coding agents a picture of what their drawing code does.

```bash
# Any project: npx fetches the latest package and its core peer
npx -y @canvas-tile-engine/renderer-server@latest map.preview.mjs -o map.png --grid --coords

# A project that depends on renderer-server: use the installed copy
npx --no cte-render map.preview.mjs -o map.png --grid --coords
```

Keep `@latest` in the first form: without it, an older renderer-server installed in the project, which has no command, takes precedence over the download. In the second form, `--no` stops npx from installing an unrelated package when the command is missing; with pnpm, run `pnpm exec cte-render`.

The preview module exports `config`, `center`, and `draw`, either as named exports or as one default-exported object. They mean the same as the `renderToBuffer` options. The pixel ratio, format, and quality come from the `--pixel-ratio`, `--out`, and `--quality` flags instead.

```js
// map.preview.mjs
export const config = { scale: 40, size: { width: 480, height: 320 }, backgroundColor: "#0f172a" };
export const center = { x: 1.5, y: 1.5 };
export function draw(engine) {
    engine.drawRect({ x: 0, y: 0, size: 0.9, style: { fillStyle: "#4ade80" } }, 1);
}
```

`.mjs` modules always work. `.mts` modules work on Node 22.18 or newer (23.6 or newer on the 23 line), which strips the types itself: use erasable syntax only, `import type` for type-only names, and file extensions on relative imports. `.js` and `.ts` files follow the nearest `package.json` `type`, so they load as ES modules only in a `"type": "module"` package.

The engine starts from the module's `config` and `center`, as the app does, so `config.bounds` and `config.gridAligned` treat the initial center the same way. The camera flags apply before `draw` runs and again after it, so they win over camera moves made in `draw`.

| Option                   | Description                                                                                                       |
| :----------------------- | :---------------------------------------------------------------------------------------------------------------- |
| `-o, --out <file>`       | Output path. The extension picks the format: `.png`, `.jpg`/`.jpeg`, or `.webp`. Default `<module name>.png`.      |
| `--grid`                 | Draws one-cell grid lines above every layer.                                                                      |
| `--coords`               | Shows the coordinate overlay at any scale.                                                                        |
| `--center <x,y>`         | Moves the camera like `engine.setCenter`: `config.bounds` clamps it, `gridAligned` does not snap it. Write `--center=-3,4` for a negative x. |
| `--scale <px>`           | Zooms like `engine.setScale`, even outside `minScale`/`maxScale`, with a note.                                    |
| `--size <WxH>`           | Resizes the viewport in CSS pixels and keeps the center, also for a `responsive` config.                          |
| `--pixel-ratio <n>`      | Output pixel ratio. Default `1`.                                                                                  |
| `--quality <0-100>`      | JPEG/WebP quality.                                                                                                |
| `--font <file[=family]>` | Registers a font before rendering. Repeatable.                                                                    |

After rendering, the command prints the output file, the final camera, and the visible range in world units. Notes on stderr point out a center that `config.bounds` or `config.gridAligned` moved and a `--scale` outside the zoom limits. It exits with `0` on success, `1` when the module or the render fails (including a rejected promise or a `draw` that never finishes), and `2` for a bad command line. It exits after writing the image even if the module left timers or sockets open.

The image comes from the same Canvas2D drawing code as `@canvas-tile-engine/renderer-canvas`. The WebGL renderer draws text and custom drawing above all shapes, and React Native Skia can differ in details. No events or animations run.

## Accessibility

`config.accessibility.reducedMotion` is accepted and has no observable effect here. Server rendering produces a single frame, and Node has no `requestAnimationFrame`, so every animation API already resolves instantly. Nothing pushes a platform signal, so `"auto"` resolves to `false` and `engine.getReducedMotion()` reflects only the configured preference.
