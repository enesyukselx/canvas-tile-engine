---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
"@canvas-tile-engine/renderer-skia": minor
"@canvas-tile-engine/renderer-server": minor
---

feat: per-item Line style

- `Line` items accept an optional `style?: LineStyle`, overriding the call-level `drawLine` style per item — mixed-style batches no longer need one `drawLine` call per style, and the last primitive without item-level styling joins the Rect/Circle/Path/Text convention. The call-level style stays as the batch default; `styleOf` decorations still overlay both at paint time.
- Because item styles are registration-time (unlike paint-time `styleOf` decorations), they may change `lineWidth`/`lineWidthPx`: hit testing resolves the item's own stroke width, so a thick line gets a matching hit area — the first way to give individual lines their own width. Renderers resolve the painted width from these same registration-time layers only, so a width smuggled past the decoration types at runtime (JS callers, non-literal returns) can never desync the painted stroke from the hit corridor.
- Styles overlay unit pair by unit pair via the new shared `overlayLineStyle` helper (exported from core): a layer that sets either field of a pair (`lineWidth`/`lineWidthPx`, `lineDash`/`lineDashPx`) replaces the whole pair, so an item's world-unit value is never shadowed by the batch's `*Px` value. This also fixes a latent `styleOf` merge bug where a dash decoration could be shadowed by a call-level `lineDashPx`.
- Renderer batching is preserved: runs of lines on the shared batch style still collapse into a single stroke (Canvas2D/server); items with their own style stroke solo, exactly like decorated items already did. WebGL maps overrides onto its per-instance color/width/dash; Skia mutates and restores the shared stroke paint.
