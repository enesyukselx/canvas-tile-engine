---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
"@canvas-tile-engine/renderer-skia": minor
"@canvas-tile-engine/renderer-server": minor
---

feat: gradient fills — `fillStyle` takes a `Paint`, not just a color string

- `fillStyle` on shapes (`Rect`, `Circle`) and on `PathStyle` now accepts a linear gradient as well as a CSS color string. This is what an area chart, a fading bar, or a shaded zone needed, and what previously had to be faked by drawing the ramp out of many shapes.
- `strokeStyle` and text fills stay color strings, deliberately. A stroke has no box to normalize a gradient axis against, and "along the stroke" and "across the stroke" are equally fair readings of the same axis, so the ambiguity stays out of the API rather than being answered differently by each renderer.
- **Box units are the default and make a gradient object reusable.** `{ from: { x: 0, y: 0 }, to: { x: 0, y: 1 } }` means "top to bottom" for every item that uses it, whatever its size, position, or rotation — a rotated shape's ramp turns with the shape. `units: "world"` places the axis in world coordinates instead, so neighbouring items each show their own slice of one scene-spanning ramp and it moves with the camera.
- Stops are normalized before painting: offsets clamped to `0..1` and sorted ascending, with stops sharing an offset keeping their authored order so a hard color break stays hard. An empty list paints nothing; a single stop paints flat. Both properties are load-bearing rather than defensive — Canvas2D's `addColorStop` throws on an out-of-range offset and Skia's `MakeLinearGradient` expects ascending positions.
- Identical output on all four renderers, arbitrary stop counts and any axis angle included, so swapping `RendererCanvas` for `RendererWebGL` stays the one-line change it is documented to be. WebGL gets there with a ramp texture plus a per-vertex gradient parameter: the parameter is affine in position, so interpolating it is exact however many stops the ramp has, and the stop count never touches the vertex count.
- `drawStatic*` accepts gradients too, with the caveat their cache already carries: it is recorded at one scale, so a `"world"` axis is baked at the scale the cache was built with.
- Core exports the shared resolution helpers the renderers agree through: `isGradient`, `normalizeStops`, `gradientAxisPx`, `gradientT`, and `paintKey`. Keys are structural, so a gradient spec rebuilt inline inside a `styleOf` callback still hits each renderer's cache.

Purely additive: every existing `fillStyle` string renders exactly as before.
