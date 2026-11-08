---
"@canvas-tile-engine/core": patch
---

`itemsBounds` now accepts the same item sources as the draw calls: readonly arrays and `ItemCollection`s, whose current items are read at call time. Passing a collection or a `readonly` array used to be a TypeScript error, and in plain JavaScript a collection threw "items is not iterable".
