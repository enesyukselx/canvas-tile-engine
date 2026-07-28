---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
"@canvas-tile-engine/renderer-skia": minor
"@canvas-tile-engine/renderer-server": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

Add `visibleOf` and `interactiveOf` per-item callbacks alongside `styleOf`.

- `visibleOf(item)`: return `false` to skip an item for the frame — it is neither painted nor hit-testable. Like `styleOf`, it reads external state live: mutate a filter set and call `render()` without re-registering or rebuilding the spatial index. Available on `drawRect`, `drawCircle`, `drawText`, `drawLine`, `drawPath`, and `drawImage` (dynamic draws only, like `styleOf`).
- `interactiveOf(item)`: return `false` to keep an item out of `hitTest`/`hitTestFirst`/`hitTestRect` while it stays painted — the per-item counterpart of `hitTest: false`. Queries fall through to items below it. Items hidden by `visibleOf` never hit-test, regardless of this callback. Available on the hit-tested kinds (`drawRect`, `drawCircle`, `drawImage`, `drawLine`, `drawPath`).

`drawImage` gains an options object (`ImageDrawOptions`) carrying `id`, `hitTest`, and the two new callbacks; it still has no `styleOf` — images carry no `style`, appearance changes go through item fields like `opacity` (read live at paint time).

The React and React Native `Rect`, `Circle`, `Image`, `Line`, `Text`, and `Path` components accept matching `visibleOf`/`interactiveOf` props (`Text`: `visibleOf` only), read through refs like `styleOf` so identity changes never re-register.
