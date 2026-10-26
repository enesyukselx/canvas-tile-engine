---
"@canvas-tile-engine/core": patch
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/renderer-skia": patch
---

Reject invalid grid intervals synchronously with a `RangeError` in the engine and every renderer's draw API. `cellSize` must be a positive finite number, preventing negative intervals from hanging grid rendering. A rejected same-id registration leaves the previous draw intact; positive fractional intervals remain supported.
