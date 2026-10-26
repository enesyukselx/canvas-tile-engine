---
"@canvas-tile-engine/core": patch
"@canvas-tile-engine/react-native": patch
---

Synchronize React Native's native gesture blocker with runtime `setEventHandlers()` changes without waiting for a painted frame. Callback-only interactions now also track adding or removing `onMouseDown` and `onMouseUp` props immediately, and config subscriptions are cleaned up on unmount.
