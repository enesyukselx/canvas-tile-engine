---
"@canvas-tile-engine/react": patch
"@canvas-tile-engine/react-native": patch
---

Fix declarative children silently drawing nothing after a `key` remount.

The children gate used `engine.isReady`, which reads the shared handle. During a key-driven remount the old engine is still attached at render time, so children mounted immediately and their draw effects ran in the null-instance window between the old engine's destroy and the new engine's creation (child effects fire before parent effects) — every registration was dropped into a dummy handle and the new canvas stayed blank with no error. The gate is now component-local state that starts `false` on every mount, so children always mount after their own engine exists, exactly like the first-mount path.

Draw calls that arrive while no engine is mounted now also log a dev-only `console.warn` instead of failing silently. For imperative setups that must survive remounts, depend on `engine.instance` (changes identity per engine) rather than `engine.isReady` (collapses back to `true` within the remount flush).
