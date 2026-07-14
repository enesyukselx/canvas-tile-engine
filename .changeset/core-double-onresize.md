---
"@canvas-tile-engine/core": patch
---

Fix `onResize` firing twice after a programmatic `resize()`. The engine mirrors the callback into the renderer, whose resize completion already invokes it; the engine no longer invokes it a second time from its own completion handler. Watcher-driven (responsive/resize-event) notifications are unaffected.
