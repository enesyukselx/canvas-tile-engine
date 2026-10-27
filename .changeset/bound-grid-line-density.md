---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/renderer-skia": patch
---

Bound the number of grid lines drawn when zoomed out. When lines would be less than 2px apart on screen, every renderer now draws only every 2nd, 4th, 8th, ... line, keeping the count proportional to the viewport size instead of growing with 1 / scale (previously 10,000 lines per axis per frame at scale 0.1 with `cellSize` 1 on a 1000px canvas). The remaining lines stay on multiples of `cellSize`, so they do not shift while panning, and grids at least 2px apart draw exactly as before.
