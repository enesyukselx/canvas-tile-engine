---
"@canvas-tile-engine/renderer-skia": patch
"@canvas-tile-engine/renderer-webgl": patch
---

Fix: the renderers' color caches no longer grow without bound, so `styleOf` can compute a color string per frame the way it is documented to.

Both renderers memoize parsed colors keyed on the raw CSS string, and both only dropped that map on destroy. That is right for a fixed palette, but the natural way to write a pulse, a heat map, or a fade is a computed string — a `styleOf` returning `fillStyle: "hsl(" + item.data.load * 120 + ", 70%, 50%)"` — and every distinct value it ever produced stayed resident for the renderer's lifetime. A 60fps animation over a large item set added tens of thousands of entries per minute.

- Both caches are now a fixed-capacity LRU. The bound is sized per renderer — 4096 entries in `renderer-webgl`, 8192 in `renderer-skia`, where a miss is a native call rather than an inline parse — so it clears the working set even when `styleOf` gives every cell on screen its own color. A palette that is touched every frame stays resident; computed one-off colors cost a fixed amount of memory instead of one permanent entry each.
- `renderer-webgl` additionally parses the `#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa`, `rgb()`/`rgba()`, and `hsl()`/`hsla()` forms inline, in both the legacy comma and the modern space/slash syntaxes. Those were previously normalized by painting onto a 1x1 canvas and reading the pixel back — a GPU-to-CPU sync per new color, per frame, which the bound alone would have made more frequent. Everything else (named colors, `color-mix()`, `oklch()`, ...) still goes through the canvas, unchanged.

Colors render the same. The inline path keeps full float precision where the pixel readback quantized to 8 bits per channel, so an `hsl()` or fractional-alpha value can differ from the old result by less than 1/255.
