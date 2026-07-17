---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
"@canvas-tile-engine/renderer-skia": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

Add an `onWheel` callback for wheel (desktop) and pinch (touch) zoom gestures. Unlike `onZoom`, which reports the resulting scale, `onWheel` reports the input gesture itself: the standard `coords`/`mouse`/`client` payload (the pinch midpoint on touch) plus `{ deltaY, direction, source }`, and it fires even when the scale is clamped at a limit. `deltaY` is negative when zooming in; for pinch it is synthesized as the wheel delta that would produce the same zoom factor, so both sources read on one axis. Requires `eventHandlers.zoom`; no new config flag. Exposed as an engine property, on all interactive renderers, and as an `onWheel` prop in the React and React Native components.
