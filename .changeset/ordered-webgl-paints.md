---
"@canvas-tile-engine/renderer-webgl": patch
---

Preserve per-item fill and stroke order for rectangles, circles, and paths. Batch only consecutive compatible paints so later fills correctly cover or blend over earlier outlines.
