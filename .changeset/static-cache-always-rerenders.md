---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
---

Render a fresh static cache on every `drawStaticRect`, `drawStaticCircle`, and `drawStaticImage` call. The draw API used to reuse the previous bitmap when a `cacheKey` was registered again at the same bounds and scale without a `clearStaticCache` in between, so the new items never appeared. Engine users were not affected, because the engine clears the cache before re-registering a key. The cache is still rendered once at the camera scale active at registration and scaled on zoom; register again to re-render it.
