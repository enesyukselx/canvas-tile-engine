---
"@canvas-tile-engine/renderer-webgl": patch
---

Very short gradient axes now paint the same on WebGL as on the other renderers:

- An axis of 1/32768 px or less, but not zero, paints the gradient's last stop flat, as Canvas2D in a browser, the server and React Native Skia do. WebGL drew a hard step there instead. A longer short axis is still a hard step at the axis position, first stop before it and last stop after, as on every renderer.
- On GPUs whose `mediump` floats are half precision (common on mobile), the gradient parameter handed to the GPU is kept within that range. A very short axis, or a very large shape, used to push it past what such a GPU can store, which can paint the wrong color or none at all. The ramp stays centered where it was and widens by at most a pixel per 16384px of distance from the axis. GPUs with full-precision `mediump` floats, typical on desktop, paint exactly as before.
