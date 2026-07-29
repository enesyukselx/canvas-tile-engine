---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

feat: itemsBounds — the rectangle `fitBounds`/`fitScale` ask for

- New pure helper `itemsBounds(items)`: the world rectangle enclosing a list of items, or `null` when nothing in the list has bounds. Replaces the hand-rolled min/max reduce every "fit to selection" flow needed. Returns `Bounds | null`, so the call is guarded: `const b = itemsBounds(selected); if (b) engine.fitBounds(b, { paddingPx: 24 });` — an empty selection should not move the camera.
- Every item kind fits in one list, mixed freely, so `hitTest`/`hitTestRect` results go straight in with no filtering: `Rect`/`Circle`/`Text`/`ImageItem` contribute `width ?? size` by `height ?? size` world units (default 1) centered on the anchor, `Line` its two endpoints, `PathItem` its vertex box (`points`) or control-point hull (`commands`). Items that draw nothing — a path with fewer than two points, an empty command list — are skipped rather than counted.
- `pathItemBounds(item)` is exported as the single-path building block.
- Deliberately camera-independent, so it leaves out `origin` offsets and `rotate` (both stay within half an item of the box — add `padding` for slack), `sizePx`/`fontPx` (pixel sizes have no world extent without a camera scale), and measured text: a `Text` item contributes its `size` box, not its glyph extents, because core carries no font metrics.
- Re-exported from `@canvas-tile-engine/react` and `@canvas-tile-engine/react-native` alongside `gridToSize`/`fitScale` (with the `BoundedItem` type).
