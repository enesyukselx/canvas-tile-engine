---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
"@canvas-tile-engine/renderer-skia": minor
"@canvas-tile-engine/renderer-server": minor
---

Rounded Path corners via `LineStyle.cornerRadius` (world units, scales with zoom) and `cornerRadiusPx` (screen pixels, wins) — the metro-map look for polylines. Interior vertices round through tangent arcs with per-corner radius clamping (short segments never overlap); geometry comes from one shared core helper so all renderers round identically (Canvas2D/server `arcTo`, Skia `arcToTangent`, WebGL CPU flattening). Dashing follows the arcs on every renderer. `Line` items are unaffected (single segments have no corners).
