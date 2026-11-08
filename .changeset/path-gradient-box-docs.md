---
"@canvas-tile-engine/core": patch
---

Correct the `PathStyle.fillStyle` documentation: a path gradient's `"box"` units are relative to the path's conservative box (every vertex and control point, plus the full circle of each arc), not a tight bounding box. Curves and partial arcs can sit well inside that box and show only part of the ramp; use `units: "world"` to place it exactly.
