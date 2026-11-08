---
"@canvas-tile-engine/renderer-webgl": patch
---

fix: a clip with an axis given max-first no longer blanks WebGL's GPU-drawn primitives. The scissor used to collapse to nothing for such a clip while the text overlay was still clipped to the sorted rectangle; both now cut on the sorted rectangle, as Canvas2D does. The engine already sorts every clip before it reaches a renderer (see `@canvas-tile-engine/core`), so this matters for code that calls the renderer's draw API directly.
