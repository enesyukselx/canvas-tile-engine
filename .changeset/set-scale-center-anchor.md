---
"@canvas-tile-engine/core": minor
---

**Behavior change:** `setScale` is now anchored at the viewport center, matching `goScale`, `zoomIn`, and `zoomOut`. Previously it anchored at the top-left corner, so the view drifted toward the bottom-right when zooming in — `setScale(n)` and `goScale(n, 0)` produced different views. They are now equivalent. If you relied on the old top-left anchoring, re-position with `setCenter` after the scale change.
