---
"@canvas-tile-engine/renderer-skia": patch
---

Fix: `drawStaticRect` sized its picture cull rect from `size` alone, so a rect with per-axis `width`/`height` recorded outside its own bounds — `drawStaticRect([{ x: 0, y: 0, width: 8, height: 2 }])` painted 25px past the left edge at scale 10. Skia may quick-reject or clip against that rect, and the Canvas2D static cache already accounted for `width`/`height`, so the two renderers disagreed on the same input. Both now derive the box from the shared `itemsBounds` helper.
