---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": patch
"@canvas-tile-engine/react-native": patch
---

Add an optional `data` field to drawable items (`Rect`, `Circle`, `ImageItem`, `Text`) for attaching arbitrary app data, typed through a new `TData` generic parameter (`Rect<TData>`, `ImageItem<TImage, TData>`, ...) that defaults to `unknown` - fully backward compatible.

- The engine and renderers never read `data`; it is carried through so `hitTest` results can identify the hit item via `hit.item.data` instead of the position-based `index`, which goes stale when a filtered or re-ordered items array is re-drawn.
- `hitTest<TData>(point)` / `hitTestFirst<TData>(point)` (core and the React / React Native hook handles) accept a type parameter that types `hit.item.data` on the results - a compile-time assertion, not a runtime check.
- `HitResult` gains a second generic parameter: `HitResult<TImage, TData = unknown>`.
