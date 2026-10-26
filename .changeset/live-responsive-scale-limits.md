---
"@canvas-tile-engine/core": patch
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-webgl": patch
---

Return live camera scale limits from `getConfig()` after responsive sizing while retaining authored scale and size internally, preventing repeated-resize drift. Preserve-viewport resizing now honors runtime `setScaleLimits()` replacements and keeps the adapted range ordered when a replacement minimum exceeds the original base scale.
