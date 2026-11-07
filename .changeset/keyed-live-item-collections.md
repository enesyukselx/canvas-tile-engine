---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
"@canvas-tile-engine/renderer-skia": minor
"@canvas-tile-engine/renderer-server": minor
---

Add keyed `ItemCollection` sources for dynamic rect, circle, image, text, line, and path drawings. Insert, update, remove, and batch items without replacing the draw registration, with incremental spatial-cache updates and synchronous hit testing. Collection hit results include a stable key.

Add coalesced `requestRender()` scheduling with automatic repaint after collection changes and lifecycle-safe subscription cleanup. React and React Native components and handles accept collections and share the engine's repaint scheduler. Existing single-item, array, static, and sprite inputs remain compatible; custom renderers opt into collection updates through `IDrawAPI.applyDrawChanges`.
