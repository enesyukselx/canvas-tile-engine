---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-skia": patch
---

Keep large rotated, anchored, and thick-stroked static shapes fully inside their caches. Compute painted bounds for rectangles, circles, and aspect-fitted images, including sprite frames, and align the cache to the recording pixel grid with an antialiasing guard.
