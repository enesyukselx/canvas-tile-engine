---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

`hitTestRect` — marquee/box-selection region queries

`engine.hitTestRect(rect, { layer?, mode? })` returns every item whose geometry intersects (default) or lies fully inside (`mode: "contain"`) a world rectangle, in the same visual-priority order as `hitTest`. Corners may be passed in any order — build them from drag-start/end `coords.raw` values. Geometry is tested exactly: circles as discs (not bounding boxes), rotated rects/images as convex quads, lines as segments, and paths against their flattened subpaths with filled interiors counting and holes excluded. Both React handles expose the same method (empty before mount).
