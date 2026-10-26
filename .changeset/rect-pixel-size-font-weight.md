---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
"@canvas-tile-engine/renderer-skia": minor
"@canvas-tile-engine/renderer-server": minor
---

feat: pixel sizing for `Rect` and `fontWeight` for text

Two gaps in the same corner of the item API, both about a value that should not scale with zoom.

- **`Rect.sizePx` / `widthPx` / `heightPx`.** Rect was the only anchored primitive without a pixel size — `Circle` has `sizePx`, `ImageItem` has `sizePx`, `Text` has `fontPx` — so a marker that must stay a fixed size on screen could not be a rectangle. Because Rect already carries `width`/`height`, the per-axis fields come along too: a shared-only `sizePx` would just move the asymmetry. Resolution order per axis is pixels before world units and specific before shared: `widthPx` → `sizePx` → `width` → `size`. Hit testing follows the drawn box on both axes, and culling re-evaluates it per frame because a pixel-sized box grows in world units as the camera zooms out.
- **`Text.style.fontWeight`.** Accepts `"normal"`, `"bold"`, and the numeric `100`–`900`. Canvas2D's font shorthand also takes the relative `bolder`/`lighter`, but Skia has no equivalent, so they are excluded rather than silently ignored on native. An unset weight is omitted from the font shorthand entirely rather than emitted as `"normal"` — the CSS shorthand resets every property it does not list, so an unconditional weight would change what existing callers get.

Both are additive; existing items render exactly as before.

The `drawStatic*` variants ignore the pixel sizes, matching how `drawStaticCircle` already ignores a circle's `sizePx`: a cache is recorded at one scale and blitted afterwards, so a screen size cannot hold across zooms. On WebGL, where statics are aliases of the dynamic path, `drawStaticRect` strips the fields itself so the four renderers stay identical and the hit box (registered with `ignoreSizePx`) keeps matching what is drawn.

New core helpers `resolveBoxPx`, `resolveBoxWorld` and `maxPxExtent` are exported alongside the existing `resolveSizePx`/`resolveSizeWorld` pair.
