---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/renderer-skia": patch
---

Keep partially visible dynamic shapes and labels on screen by culling against conservative painted bounds, including origins, rotation, stroke width, and measured text. Use the same bounds above and below the spatial-index threshold, update pixel-sized bounds when zoom changes, and respect live style decorations.
