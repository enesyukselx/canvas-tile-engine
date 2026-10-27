---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": patch
"@canvas-tile-engine/react-native": patch
---

Throw the documented `ConfigValidationError` for invalid config and runtime arguments. The constructor, `setScale`, `goScale`, `setScaleLimits`, `setBounds`, `setCenter`, `goCenter`, `fitBounds`, `fitScale`, `setAccessibility` and `setReducedMotion` already promised it in their JSDoc but threw a plain `Error`. The class is a new export of core, re-exported by the React and React Native bindings, so `error instanceof ConfigValidationError` now works. Messages are unchanged and keep the `[CanvasTileEngine] Invalid config:` prefix, but `error.name` changes from `"Error"` to `"ConfigValidationError"`. `drawGridLines` still throws a `RangeError` for an invalid `cellSize`.
