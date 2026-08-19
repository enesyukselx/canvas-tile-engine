---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": patch
"@canvas-tile-engine/react-native": patch
---

Fix: the config snapshot the React and React Native handles return before the engine mounts no longer contradicts the engine's own defaults.

`engine.getConfig()` answers with a default snapshot until the engine attaches, and that snapshot was a hand-written copy of the defaults that had drifted from what `Config` actually resolves: it reported `eventHandlers.drag: true` and `zoom: "pointer"` where the engine defaults both to off, and `debug.eventHandlers.*: false` where the engine defaults them to on. Code that read the handle before `isReady` — to decide whether panning is enabled, or to initialise a zoom control — got values that flipped the moment the engine mounted. The snapshot was also returned by reference and unfrozen, unlike `Config.get()`'s deeply frozen one, so a consumer mutating it corrupted every later pre-mount call.

The pre-mount snapshot is now produced by the engine's own normalization and is deeply frozen, so no field can disagree with a mounted engine. It still describes an *unconfigured* engine (`scale: 1`, zero size, matching the pre-mount `getSize()`) because the handle cannot see the `config` you pass to the component — so `minScale`/`maxScale` are `0.5`/`2` rather than your scale's limits. Read config-derived values after `isReady`.

`@canvas-tile-engine/core` exports the normalization behind this as `normalizeConfig(config)`: it fills every optional field with its default and returns the deeply frozen snapshot, without validating (`new CanvasTileEngine(...)` still validates what it is given). `normalizeConfig({ scale: 32, size }).minScale` is `16`. It also no longer freezes the `bounds` and `coordinates.shownScaleRange` objects you pass in — those are copied into the snapshot now, matching what `updateBounds` already did.
