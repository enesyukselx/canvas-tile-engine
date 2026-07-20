---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
"@canvas-tile-engine/renderer-skia": minor
"@canvas-tile-engine/renderer-server": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

feat: styleOf — paint-time decoration without re-registration

- The dynamic engine draw methods (`drawRect`, `drawCircle`, `drawText`, `drawLine`, `drawPath`) accept an optional `styleOf` callback in their `options`. It runs per item on every frame at paint time; the returned fields overlay the item's own `style` for that frame (`undefined` leaves the item untouched). Because it resolves at paint time it reads external state live: mutate a selection/hover set and call `render()` — items are never re-registered and the spatial index never rebuilds, turning selection updates from O(n) alloc + index rebuild into an O(1) state change plus repaint.
- Decoration types are narrowed where style feeds hit-test geometry: `Line` and `PathItem` decorations exclude `lineWidth`/`lineWidthPx` (and `cornerRadius`/`cornerRadiusPx` for paths), which are resolved at registration time. Rect/circle/text decorations allow the full style. For `drawLine`, `styleOf` overlays the call-level `style` per item — also the first way to give individual lines their own color.
- React and React Native: the `Rect`, `Circle`, `Text`, `Line`, and `Path` components accept a `styleOf` prop. It is read through a ref, so its identity may change on every render at no cost (inline arrows are fine); a change only repaints. `useMemo` discipline now applies to `items` (geometry) only. The imperative `EngineHandle` draw methods also accept the new `options` parameter (including `id`).
- Static draw methods intentionally do not support `styleOf`: caches replay a recorded picture, so per-frame decoration cannot apply. Changing styles is dynamic content — use the dynamic methods with `styleOf`, or an overlay registration.
