---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-webgl": patch
---

Internal refactor: the Canvas2D drawing pipeline (CanvasDraw, Layer, CoordinateOverlayRenderer, DebugOverlay, applyLineWidth) moved to the private `@canvas-tile-engine/renderer-shared` package and is bundled into each renderer, removing the duplicated copies. renderer-canvas and renderer-server now run byte-identical drawing code, and renderer-webgl's 2D overlay (coordinate overlay, debug HUD, layer management) uses the same shared modules. No behavior change.
