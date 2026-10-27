---
"@canvas-tile-engine/renderer-skia": patch
---

Paint each frame straight onto the canvas the host presents instead of first recording the scene into a separate picture and replaying it. Normal frames no longer pay for an extra picture recording and replay. The scene is still cached as a picture only while the debug HUD's FPS counter runs, so its ticks repaint the readout without redrawing the map.
