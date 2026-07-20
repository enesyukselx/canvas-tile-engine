---
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

Re-export more core APIs from the React and React Native bindings

Both bindings now re-export the imperative/type surface consumers previously had to reach into `@canvas-tile-engine/core` for:

- `DrawHandle` — the return type of `engine.drawRect`/`drawCircle`/etc., needed to store a handle in a variable for the hover/selection/minimap swap patterns (`let handle: DrawHandle | undefined`).
- `LineStyle` — the `<Line>` `style` prop / `engine.drawLine(items, style, layer)` argument type, for shared or state-driven line styles.
- `PathCommand` + `pathCommandsBounds` — for building free-form path command lists programmatically and computing their world bounds (e.g. to `fitBounds` to a path).
- `onRightClickCallback`, `onZoomCallback`, `onWheelCallback`, `WheelInfo` — completing the event-callback type family (the click/hover/mouse aliases were already exported), for typing handlers extracted out of JSX.

Purely additive — importing these from `@canvas-tile-engine/core` still works.
