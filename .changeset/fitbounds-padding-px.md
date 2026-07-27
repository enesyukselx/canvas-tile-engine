---
"@canvas-tile-engine/core": minor
---

feat: fitBounds paddingPx — screen-pixel fit margin

`fitBounds` options accept `paddingPx`, a screen-pixel margin kept free on every side of the viewport. The existing world-unit `padding` grows the fitted area, so its visual margin scales with the content — frame a 10x larger board and the padding must be manually scaled 10x to keep the same look. `paddingPx` shrinks the viewport instead: "24px of air" frames a 3-cell selection and a 10k-cell board identically, which is what fit-to-selection UI almost always wants (and how map libraries specify fit padding).

Follows the engine-wide unit convention (`lineWidth`/`lineWidthPx`, `hitTest`'s `padding`/`paddingPx`): plain value is world units, the `*Px` variant is screen pixels and wins when both are set. Validation matches `padding` (non-negative finite, `ConfigValidationError` otherwise); a `paddingPx` too large for the viewport clamps to at least 1px of fit area per axis and the result rides the scale limits.
