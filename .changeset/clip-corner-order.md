---
"@canvas-tile-engine/core": patch
---

fix: a draw `clip` now accepts its corners in any order, like `hitTestRect`. An axis given max-first (`{ minX: 7, maxX: 1, ... }`) is swapped before the clip reaches the renderer and the hit tester. Before, the renderers disagreed on such a clip: Canvas2D, server and Skia painted the sorted rectangle, WebGL dropped its GPU-drawn primitives (rects, circles, images, lines, paths, grid lines) but still painted text and custom draws, and hit tests never matched on any renderer. A clip edge that is `NaN`, infinite or not a number now throws a `ConfigValidationError`, before anything is registered or an existing registration with the same id is replaced.
