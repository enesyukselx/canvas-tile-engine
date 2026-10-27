---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
---

Render static caches (`drawStaticRect`, `drawStaticCircle`, `drawStaticImage`) at the device pixel ratio, so static layers are as crisp as dynamic draws on HiDPI screens and in `pixelRatio: 2` server images instead of being upscaled from a CSS-resolution bitmap. The ratio (`devicePixelRatio` in the browser, `pixelRatio` on the server) is recorded at registration, like the scale; re-register after it changes. The 16384px offscreen cap now applies to the physical size, so a cache that would exceed it falls back to dynamic drawing.
