---
"@canvas-tile-engine/core": minor
---

Add `padding` and `paddingPx` to `HitTestOptions` - generous touch targets for `hitTest`/`hitTestFirst` without invisible helper items.

- `padding` (world units) expands every tested item's hit geometry outward: circles gain radius, rect/image boxes grow on every side (in the item's rotated frame, so rotation keeps working).
- `paddingPx` (screen pixels) is zoom-independent: the engine converts it with the current scale at query time, so targets stay finger-sized at any zoom. Combined additively with `padding`.
- The spatial-index query on the 500+ item path widens by the padding too, so no edge candidates are missed.
- Negative values are treated as 0. React and React Native handles pick the options up automatically (`HitTestOptions` is re-exported from core).
