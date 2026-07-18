---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
"@canvas-tile-engine/renderer-skia": minor
"@canvas-tile-engine/renderer-server": minor
---

Path v2 phase 2: free-form `commands` — curves, arcs, subpaths, holes

`PathItem` gains a Canvas2D-style `commands` list (`moveTo` / `lineTo` / `arc` / `quadraticCurveTo` / `bezierCurveTo` / `closePath`; world units, angles in degrees) as the free-form alternative to the `points` polyline. Each `moveTo` starts a new subpath, so one item can be an outline plus holes: under `evenodd` any overlapping subpath punches a hole, under `nonzero` a hole winds opposite its outer ring — Canvas2D `fill()` semantics on every renderer (Canvas2D/server/Skia replay natively; WebGL flattens through a shared core implementation with a 2× scale-bucket cache and fills via multi-ring stencil winding).

Hit testing follows the same geometry: filled command paths hit on their interior with holes excluded, curves hit on the actual flattened curve, strokes on every subpath. `closed` and `cornerRadius` remain `points`-form sugar — with `commands`, use `closePath` and explicit arcs.
