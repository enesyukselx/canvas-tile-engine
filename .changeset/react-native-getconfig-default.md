---
"@canvas-tile-engine/react-native": minor
---

`engine.getConfig()` now returns a default config snapshot before the engine mounts instead of `undefined`, matching `@canvas-tile-engine/react` — its return type no longer includes `undefined`. Internally the handle hook, engine context, and compound draw components now come from the private `@canvas-tile-engine/react-shared` package shared with `@canvas-tile-engine/react` (bundled into dist, no new dependency).
