---
"@canvas-tile-engine/renderer-webgl": patch
---

Fix wrong and flickering gradient fills in `RendererWebGL` when a frame paints more than 256 distinct gradients. The gradient ramp atlas restarted at 256 rows in the middle of a frame, so fill-only rects and circles still queued for drawing were painted with another item's ramp, and a different set of items was wrong on every frame. Rows are now only dropped between frames; within a frame the atlas grows (up to 1024 rows, or the GPU's texture size limit if smaller), and past that it draws the queued shapes before it restarts. Gradients that differ only in direction or units now share one ramp row, and an unchanged scene no longer re-uploads its ramps every frame.
