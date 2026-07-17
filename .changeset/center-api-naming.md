---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

Rename the view-center APIs for consistency with the `getScale`/`setScale`/`goScale` family: `getCenter()` (was `getCenterCoords`), `setCenter()` (was `updateCoords`), and `goCenter()` (was `goCoords`). The old names keep working as deprecated aliases — no breaking change — and will be removed in a future major version. The React and React Native engine handles expose both sets.
