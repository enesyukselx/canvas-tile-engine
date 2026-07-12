# @canvas-tile-engine/react-native

## 0.1.3

### Patch Changes

- c9a1fe3: Fix imperative draw effects keyed on `engine.instance` never re-firing after a `key` remount.

  `_setInstance` drove re-renders through a boolean `isReady` state. A key remount calls it twice in one flush (`null`, then the new engine), so the boolean collapses back to `true` — React treats the update as a no-op, discards the re-render, and skips consumer effects entirely, **even ones whose deps (`engine.instance`) changed**. The new engine ended up with zero registered draws: a blank canvas at full fps. Declarative children were unaffected (fixed in #117); this completes the story for the imperative path the docs recommend.

  The hook now bumps a monotonically increasing counter per `_setInstance` call, so the post-remount render always commits and effects depending on `engine.instance` re-fire.

- c9a1fe3: Fix declarative children (notably `GridLines` and `DrawFunction`) disappearing after Fast Refresh.

  `useCanvasTileEngine` built its handle with `useMemo`, which React treats as a discardable cache — Fast Refresh invalidates it, producing a new handle identity. That remounted the engine instance, and because child effects run before parent effects, every child's draw registration landed on a not-yet-created engine and was dropped. Components whose props changed identity afterwards (e.g. `items` arrays re-set by app effects) silently re-registered; components with only primitive or ref-held props (`GridLines`, `DrawFunction`) stayed blank.

  The handle now lives in a `useRef`, guaranteeing one identity for the component's whole lifetime. As a side effect, editing app code no longer destroys and recreates the engine, so camera position and zoom survive Fast Refresh too.

## 0.1.2

### Patch Changes

- 7a61024: Fix declarative children silently drawing nothing after a `key` remount.

  The children gate used `engine.isReady`, which reads the shared handle. During a key-driven remount the old engine is still attached at render time, so children mounted immediately and their draw effects ran in the null-instance window between the old engine's destroy and the new engine's creation (child effects fire before parent effects) — every registration was dropped into a dummy handle and the new canvas stayed blank with no error. The gate is now component-local state that starts `false` on every mount, so children always mount after their own engine exists, exactly like the first-mount path.

  Draw calls that arrive while no engine is mounted now also log a dev-only `console.warn` instead of failing silently. For imperative setups that must survive remounts, depend on `engine.instance` (changes identity per engine) rather than `engine.isReady` (collapses back to `true` within the remount flush).

- Updated dependencies [79db244]
  - @canvas-tile-engine/core@0.6.0
  - @canvas-tile-engine/renderer-skia@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [35f9532]
  - @canvas-tile-engine/core@0.5.0
  - @canvas-tile-engine/renderer-skia@0.1.1
