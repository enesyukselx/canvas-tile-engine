---
"@canvas-tile-engine/core": patch
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/renderer-skia": patch
---

fix: handle a path `arc` with a negative `radius`, and any non-finite path command value, the same way on every renderer. A `drawPath` item whose `commands` hold a negative arc radius or a `NaN`/infinite number now paints nothing and never hits. That includes items added later through an `ItemCollection` and commands edited in place. A zero radius stays valid.

Before, each renderer did something different with the same item:

- In the browser, Canvas2D threw `IndexSizeError` from `arc()` on every frame. The rest of the frame never painted (later layers, `onDraw`, overlays), and the canvas state stack leaked.
- On the server, an arc with a `NaN` or infinite center aborted the whole Node process with a native `@napi-rs/canvas` panic. A negative radius dropped only the arc.
- WebGL filled a coarse copy of the arc mirrored through its center.
- Skia dropped the arc for a negative radius and the whole path for a non-finite value.
- Hit tests matched the mirrored shape.

`pathCommandsBounds` and `pathItemBounds` return `null` for such a list, so `itemsBounds` skips it, and `flattenPathCommands` returns no subpaths. `traceCommands` traces nothing for it, and never hands `arc()` a negative radius or a non-finite value. A rounded `points` path with a `NaN` vertex no longer aborts the server either: the corners next to it join straight.
