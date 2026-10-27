---
"@canvas-tile-engine/core": patch
---

Correct the `clip` option's documentation: it takes item-space coordinates like `fitBounds` and `itemsBounds`, not the raw pointer coordinates that `hitTest` and `hitTestRect` take.
