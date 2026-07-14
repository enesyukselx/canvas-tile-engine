---
"@canvas-tile-engine/react-native": patch
---

Fix `onClick` firing twice for a stationary tap. The binding forwarded the lifted pointer through both the engine's touch-end click path and its own tap dispatch; touch-end is now dispatched without the changed pointer, `onMouseUp` is raised via `dispatchPointerUp`, and click is owned solely by the binding's tap detection.
