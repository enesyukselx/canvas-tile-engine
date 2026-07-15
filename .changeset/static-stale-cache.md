---
"@canvas-tile-engine/react": patch
"@canvas-tile-engine/react-native": patch
---

Fix Static components showing a stale cache when `items` changes under the same `cacheKey`. Renderers rebuild static caches only on a cache miss (Canvas2D also on bounds/scale change), so style-only or interior-position changes replayed the old bitmap/picture. `StaticRect`, `StaticCircle`, and `StaticImage` now clear the cache whenever the `items` array identity changes, matching the documented "rebuild when items change" behavior.
