---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
"@canvas-tile-engine/renderer-skia": minor
"@canvas-tile-engine/renderer-server": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

New `Polygon` draw item: filled/stroked closed shapes (`engine.drawPolygon`, `<CanvasTileEngine.Polygon>`) for zones, lakes, territories, and selection regions. Unlike Line/Path, polygons are first-class items — per-item style (world/px outline width pair), a `data` field, and hit testing (`kind: "polygon"`, ray-cast point-in-polygon with edge-distance padding, spatial-indexed for 500+ items). Concave rings fill correctly on every renderer; WebGL triangulates once at registration via the new earcut dependency and reuses the flat-color line pipeline (no new shader).
