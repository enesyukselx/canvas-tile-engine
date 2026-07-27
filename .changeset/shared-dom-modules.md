---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-webgl": patch
---

Internal refactor: DOM plumbing modules (EventBinder, ImageLoader, SizeController, ResizeWatcher, ResponsiveWatcher, initStyles) moved to the private `@canvas-tile-engine/renderer-shared` package and bundled into each renderer, removing duplicated copies. No behavior change.
