---
"@canvas-tile-engine/react": patch
"@canvas-tile-engine/react-native": patch
---

Fix the imperative examples and the dropped-draw warning, which led to duplicate registrations, and warn in development when it happens.

The `@example Imperative API` on `<CanvasTileEngine>` (web and React Native) and the `useCanvasTileEngine` example drew in an effect keyed on `engine.isReady` without an `id`. Such an effect can run twice as the engine attaches: on the web it runs in the commit that attaches the engine and again on the re-render that follows, so the grid was registered, painted and hit-tested twice from the first frame. The examples now key the effect on `engine.instance` (so it also runs for a new engine after a `key` remount) and draw with an `id`, so a second run replaces the first registration. The dev warning logged when a draw call is dropped before mount now gives the same advice: return early while `engine.instance` is null, list it in the deps, and pass an `id` or remove the returned handle in the effect's cleanup.

In development, the engine handle now also warns once per engine when the same items (or the same grid) are registered on the same layer twice without an `id` and without removing the first registration, which is what an effect written in the old style does as the engine attaches. Production behavior is unchanged.
