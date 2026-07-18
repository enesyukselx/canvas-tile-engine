---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
"@canvas-tile-engine/renderer-skia": minor
"@canvas-tile-engine/renderer-server": minor
---

`sizePx` on Circle/Image and `flipX`/`flipY` on ImageItem

`sizePx` is the marker-pattern analog of Text's `fontPx`: a fixed screen-pixel size (circle diameter / image box), independent of zoom, taking precedence over the world-unit `size`. Hit testing resolves it against the live camera scale, and culling accounts for pixel items' world extent growing as the camera zooms out. `drawStaticCircle`/`drawStaticImage` ignore `sizePx` on every renderer — static caches replay at a recorded scale, so pixel sizing cannot hold there.

`flipX`/`flipY` mirror an image around its draw box center — a true mirror, which no rotation can produce (one right-facing sprite serves both directions). They combine with `rotate` (mirror first, rotation second) and spritesheet `sprite` frames, work in static image draws, and don't affect hit geometry.
