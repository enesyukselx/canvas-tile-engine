# Performance Reference

## What the engine already does (do not reimplement)

- **Viewport culling**: every draw callback skips items outside the camera
  view (plus a small buffer). Passing 100k items to `drawRect` is fine; only
  visible ones are painted.
- **Spatial indexing**: above 500 items per draw call, an R-tree
  (`SpatialIndex`, RBush-backed) is built once at registration and queried
  per frame instead of linear scanning.
- **Style batching** (Canvas2D): consecutive items with the same
  fill/stroke style avoid redundant context state changes.
- **High-DPI**: browser renderers scale the backing store by
  `devicePixelRatio` automatically.
- **Render-on-demand**: frames render on camera changes and explicit
  `render()` calls - there is no wasteful continuous loop. `SpriteAnimator`
  repaints at the animation fps only.

Consequences for generated code:

- Prefer ONE `drawRect(bigArray)` over many `drawRect(singleItem)` calls -
  the spatial index and style batching work per call.
- The index is built from item positions at registration time. If item
  positions change, re-register (new handle / layer swap). If only styles
  change, use `styleOf` (paint-time overlay, zero rebuild; core >= 0.10) or
  mutation + `render()`; sprite frame changes are mutation + `render()`.
- Keep item arrays referentially stable in React - a new array identity
  rebuilds the index. The `styleOf` prop is exempt (read through a ref).

## Choosing a renderer

| Scene | Renderer |
| :-- | :-- |
| Typical maps/boards/editors, up to tens of thousands of culled items | `RendererCanvas` (default) |
| Very heavy dynamic scenes (50k-200k+ items visible or churning) | `RendererWebGL` |
| Everything static and visible at once (minimap) | `RendererCanvas` + `drawStatic*` |
| React Native | `RendererSkia` (via the react-native package) |
| Node.js | `RendererServer` |

`RendererCanvas` -> `RendererWebGL` is a one-line swap; the public API is
identical.

### WebGL specifics

- Rects, circles, images, lines, paths, and grid lines are batched GPU draw
  calls. Text, the coordinate overlay, the debug HUD, `addDrawFunction`, and
  `onDraw` are painted on a transparent 2D overlay canvas stacked on top.
- **Layering caveat**: overlay content (text, custom draw functions) ALWAYS
  composites above every GPU primitive, regardless of layer index. Within
  each surface, layer order is preserved. Fine for labels-on-top UIs; if
  custom drawing must sit UNDER primitives, use `RendererCanvas`.
- `drawStatic*` are aliases of the dynamic path (GPU batching is already
  cheap); `clearStaticCache` is a no-op. Code stays portable.
- Images become GPU textures cached by source. If you mutate an image/canvas
  source in place at the same size (e.g. redraw an offscreen canvas), call
  `renderer.invalidateTexture(source)` to force a re-upload. Not needed when
  drawing different image objects.
- Spritesheet edges can bleed when zooming; author sheets with `spacing`
  (see [sprites.md](sprites.md)).
- WebGL context loss is handled automatically (resources rebuild on
  restore).

## Static caches (Canvas2D / Skia / server)

`drawStaticRect/Circle/Image(items, cacheKey, layer)` pre-render all items to
an offscreen canvas once, then blit the visible region per frame.

- Use when the item set is static AND mostly visible (minimaps, fixed-zoom
  overviews). Do not use for content that changes.
- Invalidation (core >= 0.10): re-register with the same `cacheKey` - it
  replaces the old registration and rebuilds the cache. On older cores it is
  manual: `clearStaticCache(cacheKey)` after data changes, then re-register.
- Offscreen dimension cap: 16384px. World extent * scale beyond that falls
  back safely.

## Practical budgets (rough, from the repo's own examples)

- Canvas2D handles typical game maps (a few thousand visible items + grid +
  labels) at 60fps.
- 100k+ item minimaps are smooth with `drawStatic*` on Canvas2D.
- 100k+ dynamic items on the main view is WebGL territory.

## Checklist for a fast app

1. One draw call per dataset, not per item.
2. Stable arrays (React: `useMemo`/state; vanilla: keep the same array and
   mutate for animation).
3. Static caches for minimap/overview layers; `cacheKey` per dataset.
4. Selection/hover tint on registered items via `styleOf` (mutate the
   selection set + `render()`; zero re-registration, core >= 0.10). Overlay
   visuals (a hover cursor cell) on their own layer with a registration id
   (`drawRect(item, layer, { id: "hover" })`) or a single swapped
   `DrawHandle` - never accumulate handles per mouse move.
5. `SpriteAnimator` for frame animation (fps-gated repaints) instead of a
   60fps `requestAnimationFrame` loop.
6. Enable only needed `eventHandlers`; `hover` fires on every pointer move.
7. Text is the most expensive primitive everywhere - avoid thousands of
   visible labels; gate them by zoom via the `coordinates.shownScaleRange`
   pattern (draw labels only when `engine.getScale()` is high enough, and
   redraw on `onZoom`).
