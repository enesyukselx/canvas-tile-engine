---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/react-native": patch
---

Make disabled interactions actually leave platform defaults alone. DOM renderers no longer call `preventDefault` unconditionally: with `zoom` off the mouse wheel scrolls the page again, with `rightClick` off the browser context menu opens, and with `click`/`drag`/`zoom`/`hover` all off touch gestures scroll the page instead of being captured (taps still reach mouse callbacks via the browser's synthetic mouse events). The React Native wrapper now claims the gesture responder only while an interaction is enabled or an `onMouseDown`/`onMouseUp` callback is set, so parent scroll views keep receiving touches. Checks run per event, so `setEventHandlers()` toggles keep working.
