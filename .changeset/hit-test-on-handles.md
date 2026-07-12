---
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

Expose `hitTest` / `hitTestFirst` on the `useCanvasTileEngine()` handle. Like the other handle methods they are safe before mount (empty array / `undefined`), so no null checks or `engine.instance` escape hatch needed. Results are typed with the platform image handle (`HTMLImageElement` / `SkImage`).
