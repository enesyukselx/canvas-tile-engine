---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/renderer-skia": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/react": patch
"@canvas-tile-engine/react-native": patch
---

Declare `@canvas-tile-engine/core` only as a peer dependency (`>=0.12.0`) instead of also listing it under `dependencies`. The renderers and bindings now always use the app's own copy of core, so a core release outside the old caret range can no longer install a second copy that the renderer is wired to instead of the app's engine. Apps must install `@canvas-tile-engine/core` themselves, which the installation docs already require. The minimum is 0.12.0 because these releases import core APIs added in that version.
