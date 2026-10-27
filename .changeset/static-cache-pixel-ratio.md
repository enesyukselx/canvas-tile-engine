---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
---

Render static caches (`drawStaticRect`, `drawStaticCircle`, `drawStaticImage`) at the device pixel ratio, so static layers are as crisp as dynamic draws on HiDPI screens and in `pixelRatio: 2` server images instead of being upscaled from a CSS-resolution bitmap. When the browser's `devicePixelRatio` changes (browser zoom, another monitor), a static layer re-records itself once on the next frame. A cache that would exceed 16384 px a side or ~16.7M px in area at the device ratio (iOS Safari's canvas limit) is recorded at a lower ratio, never below 1; only a cache too large even at ratio 1 falls back to dynamic drawing, as before.
