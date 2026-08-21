---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
"@canvas-tile-engine/renderer-skia": minor
"@canvas-tile-engine/renderer-server": minor
---

feat: `clip` — confine a draw registration to a world rectangle

- Every draw method takes `clip` in its options, and every React/React Native draw component takes it as a prop: a world rectangle the registration is confined to. Nothing it draws paints outside, and nothing outside it hit-tests. That covers a chart's plot area, a minimap frame, or any "this layer belongs inside that box" region — none of which could be expressed before without dropping into `addDrawFunction` and calling `ctx.clip` by hand, which only clips one of the four renderers (on WebGL that context is the text overlay, so the GPU primitives ignored it entirely).
- **World (item) space**, the same coordinates `fitBounds` and `hitTestRect` take, so a clip pans and zooms with the scene. For a chart plot area that is the behavior you want: the axes drawn outside the clip keep their position relative to the data, and panning cannot smear the series across them.
- Applies to every draw kind, `drawGridLines`, the `drawStatic*` variants and `addDrawFunction` included.
- **Hit testing follows the clip**, or clipped-away items would stay clickable. Point queries reject before any geometry work; marquee queries are narrowed to the overlap rather than skipped when they miss, so a selection half inside the clip cannot reach what is cut away. `padding`/`paddingPx` deliberately do not widen a clip: they grow an item's own tap target, and a target that is not drawn has nothing to grow.
- Axis-aligned rectangles only. An arbitrary shape would need the stencil buffer on WebGL, where path fills already live, so the scope stops at what all four renderers can do identically.
- The React `clip` prop is compared **by value**, unlike `items`, so an inline object literal does not re-register the draw call on every render.

Purely additive: a registration without a `clip` behaves exactly as before.

Internally each renderer supplies a clip adapter to the shared layer manager, which applies it inside the `save()`/`restore()` pair every draw callback already runs in. The layer manager stays free of coordinate math because the renderers genuinely need different spaces — CSS pixels for a Canvas2D or Skia path clip, device pixels measured from the bottom for a WebGL scissor. WebGL cuts on both of its surfaces: the scissor for batched primitives, an ordinary path clip for the 2D overlay that carries text and custom drawing.
