---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-webgl": patch
---

Default each text item's color to black after resolving `styleOf`, matching Skia. Text without `fillStyle` no longer inherits the frame background or a previous label's color. Explicit item colors and paint-time overrides are preserved.
