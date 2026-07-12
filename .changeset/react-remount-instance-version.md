---
"@canvas-tile-engine/react": patch
"@canvas-tile-engine/react-native": patch
---

Fix imperative draw effects keyed on `engine.instance` never re-firing after a `key` remount.

`_setInstance` drove re-renders through a boolean `isReady` state. A key remount calls it twice in one flush (`null`, then the new engine), so the boolean collapses back to `true` — React treats the update as a no-op, discards the re-render, and skips consumer effects entirely, **even ones whose deps (`engine.instance`) changed**. The new engine ended up with zero registered draws: a blank canvas at full fps. Declarative children were unaffected (fixed in #117); this completes the story for the imperative path the docs recommend.

The hook now bumps a monotonically increasing counter per `_setInstance` call, so the post-remount render always commits and effects depending on `engine.instance` re-fire.
