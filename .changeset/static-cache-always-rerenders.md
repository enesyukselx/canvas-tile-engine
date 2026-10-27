---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-skia": patch
---

Render a fresh static cache on every `drawStaticRect`, `drawStaticCircle`, and `drawStaticImage` call. When a `cacheKey` was registered again through the draw API without a `clearStaticCache` in between, the Canvas2D and server renderers reused the previous bitmap if the bounds and scale matched, and the Skia renderer always reused the previous picture, so the new items never appeared. Engine users were not affected, because the engine clears the cache before re-registering a key. The cache is still rendered once at the camera scale active at registration and scaled on zoom; register again to re-render it.
