---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/renderer-skia": patch
---

Add command-based History with grouped transactions, cancellation, undo/redo, bounded retention, disposal, and an adapter for custom application stores. Collection helpers record incremental changes across one or several typed ItemCollections, compact update-only gestures, and restore exact item identity, keys, and order. Observer errors after commit preserve stack consistency; failed multi-command replays compensate completed changes.

Add ItemCollection.insertAt for positional insertion and preserve renderer paint order and dense hit indices when history restores a removed item. Updates and appends remain incremental; middle insertion rebuilds painted-order culling on its next query. Re-export the app-facing History API from React and React Native.
