---
"@canvas-tile-engine/core": patch
---

Keep the world point beneath a moving pinch midpoint stable when zooming and panning together in pointer zoom mode. Apply the previous-to-current midpoint transform with the effective zoom scale before constraining camera bounds, including at zoom limits. Center zoom mode continues to ignore midpoint movement.
