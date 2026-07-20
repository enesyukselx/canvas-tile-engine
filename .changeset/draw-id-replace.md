---
"@canvas-tile-engine/core": minor
---

feat: id-based draw registration replace

- Every engine draw method (`drawRect`, `drawCircle`, `drawImage`, `drawText`, `drawPath`, `drawLine`, `drawGridLines`, `addDrawFunction`) now accepts an optional `options: { id }` last parameter. Re-registering with the same `id` atomically replaces the previous registration (draw callback plus hit-test entries) instead of accumulating alongside it, making state-driven redraw code idempotent without handle bookkeeping. Ids share one namespace across draw kinds and layers; within a layer, a replaced registration re-enters at the end of the draw order.
- Static draw methods (`drawStaticRect`/`drawStaticCircle`/`drawStaticImage`) treat their `cacheKey` as the registration id: calling again with the same key replaces the previous registration and invalidates its offscreen cache. Previously both registrations accumulated, and a stale cache could be blitted when the new items had unchanged world bounds and scale.
- Removing a static registration (`removeDrawHandle`, `clearLayer`) now also drops its offscreen cache, and `clearAll` clears all static caches — no more orphaned caches or stale reuse after re-registering the same key.
