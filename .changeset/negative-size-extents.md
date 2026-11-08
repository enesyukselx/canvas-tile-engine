---
"@canvas-tile-engine/core": patch
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/renderer-skia": patch
---

Handle negative and `NaN` sizes the same way on every renderer. Sizes must be zero or positive: a negative or `NaN` `size`, `width`, `height`, `sizePx`, `widthPx` or `heightPx` now empties the whole item, so it paints nothing (no fill, no border) and never hits. Before, each renderer did something different. Browser Canvas2D threw `IndexSizeError` for a negative circle size on every frame, and `drawStaticCircle` threw at registration. On the server, `drawStaticCircle` with a `NaN` size aborted the Node process with a native `@napi-rs/canvas` panic. WebGL drew a broken outline for a negative rect. Images were mirrored on the server and WebGL and missing on React Native. Hit tests matched some negative items and missed others. To grow a bar the other way, keep its extent positive and move its `origin`.

Related fixes:

- An item whose size resolves to 0 now never hits, even with `padding`. A rect with one zero side and a positive other side is unchanged: it still strokes as a line.
- WebGL no longer leaves a faint dot for a circle of size 0.
- A `NaN` size in a hit-test registration of more than 500 items no longer hides the other items from `hitTest`.
