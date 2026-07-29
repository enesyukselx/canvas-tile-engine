---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

feat: fitScale — content-driven scale limits

- New pure config-time helper `fitScale(bounds, size, options?)`: the scale (pixels per world unit) at which a world rectangle exactly fits a viewport — the `gridToSize` of free-form content. Derive `scale`/`minScale` from content bounds instead of hand-tuning constants that need recalibration whenever the content size changes; only `maxScale` stays a deliberate choice (a content-resolution quality cap no bounds can imply). Options mirror `fitBounds`: `padding` (world units) or `paddingPx` (screen pixels, wins). The result is unclamped — apply your own min/max policy.
- `fitBounds` now delegates its target-scale computation to the same shared implementation, so a scale derived from `fitScale` is exactly the scale `fitBounds` targets before scale-limit clamping — the two cannot drift.
- Re-exported from `@canvas-tile-engine/react` and `@canvas-tile-engine/react-native` alongside `gridToSize` (with the `FitScaleOptions` type).
