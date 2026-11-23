---
"@canvas-tile-engine/renderer-skia": patch
---

Fix gradient fills on React Native Skia so they paint like the other renderers:

- A gradient no longer takes on the opacity of the solid fill or text label drawn before it. Skia scales a shader by its paint's alpha, and the shared fill paint kept whatever alpha the last color left on it, so a translucent overlay or label faded every gradient drawn after it (from the next frame on, when it sat on a higher layer), and a `"transparent"` fill hid them.
- A gradient with no stops paints nothing, and one with a single stop paints that color flat, as documented. Native Skia throws for fewer than two colors, which aborted the whole frame, or the `drawStatic*` registration.
- `units: "world"` gradients on `drawStaticRect` and `drawStaticCircle` are no longer shifted by the camera position at registration time.
- `units: "world"` gradients on rotated rects stay fixed in the world instead of turning with the shape. `"box"` gradients still turn with it.
