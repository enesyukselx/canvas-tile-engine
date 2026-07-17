---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

Add `engine.fitBounds(bounds, options?)`: fit a world-space rectangle into the viewport by centering on it and picking the largest scale that keeps the whole area visible, clamped to the scale limits (including runtime `setScaleLimits`). Options: `padding` (world units, default 0), `durationMs` (default 500, 0 = instant — animates center and scale together), `onComplete`. Rejects non-finite bounds, `min >= max` axes, and negative padding with a `ConfigValidationError`. Exposed on the React and React Native engine handles. Not related to `setBounds`, which restricts camera movement.
