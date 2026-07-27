---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
---

Internal refactor: the Canvas2D drawing pipeline (CanvasDraw, Layer, CoordinateOverlayRenderer, applyLineWidth) moved to the private `@canvas-tile-engine/renderer-shared` package and is bundled into each renderer, removing the duplicated ~1100-line copies. Both renderers now run byte-identical drawing code. No behavior change.
