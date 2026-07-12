---
"@canvas-tile-engine/core": minor
---

Add `engine.hitTest(point)` and `engine.hitTestFirst(point)` - item-level hit testing for rect, circle, and image items (including the `drawStatic*` variants), answering "which item is under this pointer?" without hand-written lookup maps or manual 0.5-cell offset math.

- Pass `coords.raw` from event callbacks; origin anchoring, image aspect-fit, and rotation are handled internally.
- Results are `{ item, kind, layer, handle, index }`, ordered by visual priority: higher layer first, then later registration, then later item within a draw call. `index` maps back into the items array passed to the draw call.
- Optional `{ layer }` filter; draw calls with 500+ items are queried through a spatial index, so hover-frequency hit testing stays cheap at scale.
- Implemented entirely in core via a registry maintained by the draw delegations - no renderer changes, works identically on every platform.
- Limitations (v1): Line, Path, and Text items are not hit-testable; like rendering, item position mutations require re-registration to be reflected.
