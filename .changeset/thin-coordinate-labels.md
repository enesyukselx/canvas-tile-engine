---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/renderer-skia": patch
---

Thin out coordinate overlay labels when zoomed out instead of drawing one per cell. Once neighboring labels would crowd each other, each axis labels only every 2nd, 5th, 10th, 20th, ... coordinate, so the labels stay legible and the per-frame text count is bounded by the viewport size rather than growing with the visible world span (previously about 14,000 labels per frame at scale 0.1 on an 800x600 canvas). Labels stay on their coordinates while panning, and views where every label already fits are unchanged.
