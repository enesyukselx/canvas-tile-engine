---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
---

A gradient fill with no stops now paints nothing on the server instead of throwing. `@napi-rs/canvas` rejects an empty gradient at fill time ("Get shader of linear gradient failed"), which aborted the render or the static cache build. Both renderers now resolve an empty stop list to a transparent fill, which is what a browser paints it as, so browser output is unchanged. Strokes and outlines draw as before.
