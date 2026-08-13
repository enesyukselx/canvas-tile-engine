---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

`fitBounds` now reports what it did instead of failing silently. It returns `{ scale, fitted }`: the scale the fit targets after clamping, and whether the whole rectangle actually ends up visible. `fitted` is `false` only when `minScale` floors the fit — the area needs a smaller scale than the configured minimum, so the view shows less than was asked for and nothing previously signalled that. Clamping at `maxScale` still leaves the rectangle fully visible, so it stays `true`.

The new `FitBoundsResult` type is exported from all three packages. On the React and React Native handles `fitBounds` returns `undefined` before mount, where there is no engine to fit. Existing callers that ignore the return value are unaffected.
