---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
---

feat: `responsive: "fill"` — the mode that hands both axes to the container

- New responsive mode alongside `"preserve-scale"` and `"preserve-viewport"`. The wrapper gets `width: 100%` and `height: 100%`, the scale stays fixed, and the visible world area follows the container on both axes. This is the mode a canvas embedded in a panel, grid cell, or split pane needs: the existing modes each pin the height (`"preserve-scale"` to `config.size.height`, `"preserve-viewport"` to the configured width/height ratio), so neither could fill a box whose height is decided by the layout.
- `config.size` only seeds the first frame in this mode. `engine.resize()` and `eventHandlers.resize` stay ignored while any responsive mode is active, unchanged.
- Scale limits follow the `"preserve-scale"` rule, now with the height participating: with finite `bounds`, a shorter container lowers the minimum limit through the vertical fit as well as the horizontal one, so "minScale shows the whole board" survives a resize in either direction.
- The container must have a definite height, because the wrapper cannot supply one — the canvas inside it is absolutely positioned, so its content height is zero (a flex or grid child also needs `min-height: 0`). A collapsed container would otherwise render a silently blank canvas, so a zero-height first measurement warns once.
- Purely additive: existing configs are untouched, and the renderers pick the mode up through the shared DOM sizing watcher with no per-renderer branching.
