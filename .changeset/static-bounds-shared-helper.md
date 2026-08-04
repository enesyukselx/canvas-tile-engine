---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
---

Internal refactor: the static cache's world-bounds computation now comes from core's `itemsBounds` helper instead of an inline min/max loop. Same math, same one-world-unit padding for origin and rotation. No behavior change.
