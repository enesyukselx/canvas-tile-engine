---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
"@canvas-tile-engine/renderer-skia": minor
"@canvas-tile-engine/renderer-server": minor
---

feat: `measureText` — how much room a string takes, without drawing it

- `engine.measureText(text, { fontPx, fontFamily?, fontWeight? })` returns `{ width, ascent, descent }` in screen pixels, and `engine.clearTextMetricsCache()` drops the cache. Both are on the React and React Native handles too. This is where every text layout starts: the widest tick label decides an axis margin, a caption centers on half its width, a name either fits its box or gets truncated — all of which previously came down to guessing from `text.length`.
- Core carries no drawing context and text width is a font question, so this could not be a pure helper there. It is a renderer capability the engine delegates to, and all four renderers already had the underlying call.
- **`width` is the advance width** — where the next glyph would start — because that is the number layout wants. `ascent`/`descent` are ink extents from the baseline, both positive, measured for that string rather than the font, so `"acme"` reports a smaller ascent than `"Acme"` and `"gyp"` a non-zero descent. Mixing the two conventions is the trap: Canvas2D's `width` is advance while its bounding box is ink, and Skia is the other way round.
- Skia measures with y growing downward from the baseline, which makes the ink top negative; that is normalized to the same positive ascent every other renderer reports.
- Canvas2D measures on a lazily created 1×1 offscreen surface rather than the drawing context, since measurement happens outside the frame loop where no context is in hand — font metrics belong to the font, not the surface. WebGL measures on the 2D overlay it draws text on, so a measurement and the drawn string come from the same place.
- **Fonts must be ready to measure.** A webfont still loading, a server font not yet registered with `registerFont`, or an unresolved native typeface all measure against a fallback face and return numbers that look plausible and are wrong. Measure after fonts load, or call `clearTextMetricsCache()` once they arrive.
- Measurements are cached per string, size, family and weight, so calling this in a layout loop every frame costs one platform call per distinct string. The weight belongs in the key because a bold string is wider; without it the cache would serve the regular measurement for both.
