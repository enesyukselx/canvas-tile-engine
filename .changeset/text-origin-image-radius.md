---
"@canvas-tile-engine/core": patch
"@canvas-tile-engine/react": patch
"@canvas-tile-engine/react-native": patch
---

Fix: `Text` and `ImageItem` inherited `origin` and `radius` from `DrawObject` without any renderer reading them, so both fields typechecked and silently did nothing — `{ x, y, text: "A", origin: { mode: "self", x: 0, y: 0 } }` and `{ x, y, img, radius: 8 }` looked like they should work but were dropped on every renderer. `Text` now omits `origin` and `ImageItem` now omits `radius`, matching the pattern `Circle` already used for `rotate`/`radius`. Type-only change; if either is meant to be supported later, that's a separate feature.
