---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

**Breaking:** removed all deprecated APIs

- `getCenterCoords()` / `updateCoords()` / `goCoords()` are gone — use `getCenter()` / `setCenter()` / `goCenter()` (same behavior, renamed in the previous release).
- `drawPath`'s legacy bare-coordinates form (`Coords[]` / `Coords[][]` with a call-level style argument) is gone — pass `PathItem` objects: `drawPath({ points, style }, layer)`. The React/React Native `Path` component loses its `style` prop the same way (`PathItem` carries its own style), and the deprecated `Path = Coords[]` type alias is no longer exported.
