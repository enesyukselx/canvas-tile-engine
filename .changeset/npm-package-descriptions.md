---
"@canvas-tile-engine/core": patch
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/renderer-skia": patch
---

Describe each package accurately on npm. `core` and `renderer-canvas` had the same description and keywords, and the WebGL and Skia renderers reused that template, so npm search could not tell the engine from its renderers. `core` is now described as the renderer-agnostic engine, and each renderer as a renderer that is used together with `@canvas-tile-engine/core`, each with its own keywords.
