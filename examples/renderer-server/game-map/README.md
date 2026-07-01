# renderer-server · game-map

Headless (Node.js) port of the [vanilla-js game-map example](../../vanilla-js-examples/game-map), rendered with [`@canvas-tile-engine/renderer-server`](../../../packages/renderer-server).

Instead of an interactive browser app, this is a **one-shot script** that renders two snapshots to PNG files:

- `output/main-map.png` — villages/terrain images (`drawImage`), owner circles (`drawCircle`), grid lines, a coordinate overlay, and a custom center marker (`addDrawFunction`).
- `output/mini-map.png` — a static-cached rect map (`drawStaticRect`), grid lines, and the main viewport rectangle drawn via `onDraw`.

Everything runs with no DOM: images are loaded from disk with `@napi-rs/canvas` (`.webp` decoded natively), and both maps are exported at `pixelRatio: 2`.

## Run

```bash
pnpm install
pnpm --filter renderer-server-game-map start
```

The PNGs are written to `output/`.

## What it demonstrates

- Loading images from the filesystem via `engine.images.load(path)`
- Viewport culling on a large dataset (10k objects)
- Static caching (`drawStaticRect`) working server-side
- Custom drawing with the native `SKRSContext2D` (`addDrawFunction` / `onDraw`)
- Coordinate overlay and `pixelRatio` (retina) output
