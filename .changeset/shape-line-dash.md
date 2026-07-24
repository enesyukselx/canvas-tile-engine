---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
"@canvas-tile-engine/renderer-skia": minor
"@canvas-tile-engine/renderer-server": minor
---

feat: dashed borders for Rect and Circle

- `DrawObject.style` (used by `drawRect`, `drawCircle`, and their static variants) accepts `lineDash` and `lineDashPx`, completing the stroke unit convention the shapes already follow for `lineWidth`/`lineWidthPx`: `lineDash` is world units and scales with zoom, `lineDashPx` is screen pixels and wins when both are set. Semantics match Canvas2D `setLineDash` (odd-length patterns repeat; empty, negative, or zero-sum patterns fall back to solid) — the same contract `Line` and `Path` styles already use.
- All four renderers apply the pattern to shape borders: Canvas2D and server via `setLineDash` around the stroke, Skia via a dash path effect on the stroke paint, WebGL by tessellating the border into dash sub-segments on the CPU — the dash phase flows continuously around rect corners and circle outlines.
- Because the fields live on `DrawObject.style`, they are also available in `styleOf` decorations: a dashed selection or hover outline is a paint-time state change, no re-registration.
- Static draw variants support dashed borders too. World-unit `lineDash` holds everywhere; `lineDashPx` follows the same static-path rules as `lineWidthPx` (Canvas2D/server caches rebuild per scale so it stays pixel-accurate; Skia pictures bake it at the record scale — use dynamic draws when a zoom-independent px pattern must hold).
