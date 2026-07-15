---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
"@canvas-tile-engine/renderer-skia": minor
"@canvas-tile-engine/renderer-server": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

Custom draw callbacks receive ready-made coordinate transform helpers, so user code never re-derives the `(world - topLeft) * scale` formula or the cell-center offset. `addDrawFunction` callbacks (and the React/RN `DrawFunction` children) get a fourth `transform` argument with `worldToScreen(x, y)` (item-space in, integers are cell centers) and `screenToWorld(x, y)` (raw corner-space out, like event `coords.raw`); existing three-argument callbacks keep working.

**BREAKING:** `onDraw` now uses the same signature as `addDrawFunction`: `(ctx, coords, config, transform)` instead of `(ctx, info)`. Migration: `info.scale` → `config.scale`, `info.width`/`info.height` → `config.size.width`/`config.size.height`, `info.coords` → the `coords` argument.
