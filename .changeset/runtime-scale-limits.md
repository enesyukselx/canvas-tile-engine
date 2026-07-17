---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

Add `engine.setScaleLimits(minScale, maxScale)` for adjusting the min/max zoom limits at runtime, alongside `setScale` and `setEventHandlers`. All zooming (gestures and programmatic) clamps to the new range, and the current scale is clamped into it immediately (firing `onZoom` when it changes). Invalid limits (non-positive, non-finite, or `minScale > maxScale`) throw a `ConfigValidationError`. The React and React Native engine handles expose the new method.
