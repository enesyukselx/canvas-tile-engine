---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/renderer-skia": minor
---

Add platform-neutral selection tools with single/modifier selection, rectangle selection, group translation, grid snapping, locked/selectable rules, stable snapshots, and transaction lifecycle hooks. ItemCollection adapters preserve draw registrations and update geometry incrementally.

Add additive input subscriptions and active tool management, preserving existing callbacks while captured tool gestures suppress camera pan. Browser and native transports retain pointer metadata and cancel previews on interrupted input, pinch, tool replacement, or disposal. Re-export the API through both bindings and update native touch ownership when tools change.
