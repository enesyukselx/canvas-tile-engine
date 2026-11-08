---
"@canvas-tile-engine/core": patch
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/renderer-skia": patch
---

Handle non-finite positions the same way on every renderer. Positions must be finite: an item whose `x` or `y` is `NaN` or infinite now paints nothing and never hits, and the rest of its draw call is unaffected. The same applies to a line with such an endpoint and to a `points` path with such a vertex, which is skipped as a whole. Before:

- On the server, `drawStaticCircle` with an item at `NaN` aborted the Node process with a native `@napi-rs/canvas` panic.
- One such item broke its whole static draw. On React Native Skia the `drawStatic*` layer painted nothing at all. On Canvas2D and the server the cache bitmap became `NaN`-sized, or the cache was disabled for an infinite position.
- A `points` path with a bad vertex drew differently per renderer: Canvas2D dropped just that vertex, Skia the whole path, WebGL the segments around it. An infinite line endpoint was not culled.
- One `NaN` position in a hit-test registration of more than 500 items hid every other item from `hitTest`, and `hitTestRect` could match items at `NaN`.
