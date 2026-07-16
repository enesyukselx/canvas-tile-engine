---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-webgl": patch
---

`onMouseDown`/`onMouseUp` and drag now react to the primary (left) mouse button only. Previously every button fired them: right-button and middle-button drags panned the camera, and paint-style tools built on `onMouseDown` reacted to right clicks. Right clicks stay on the `onRightClick` path; the middle button is left to the browser.
