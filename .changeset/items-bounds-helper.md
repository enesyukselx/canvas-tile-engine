---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

feat: itemsBounds — the rectangle `fitBounds`/`fitScale` ask for

- New pure helper `itemsBounds(items)`: the world rectangle enclosing a list of items, or `null` for an empty list. Every drawable item shape fits as-is (`Rect`, `Circle`, `Text`, `ImageItem`) — an item covers `width ?? size` by `height ?? size` world units (default 1) centered on its anchor, the same box the renderers draw. Replaces the hand-rolled min/max reduce every "fit to selection" flow needed: `engine.fitBounds(itemsBounds(selected), { paddingPx: 24 })`.
- Deliberately camera-independent, so it leaves out `origin` offsets and `rotate` (both stay within half an item of the box — add `padding` for slack) and `sizePx` (pixel sizes have no world extent without a camera scale).
- Re-exported from `@canvas-tile-engine/react` and `@canvas-tile-engine/react-native` alongside `gridToSize`/`fitScale` (with the `BoundedItem` type).
