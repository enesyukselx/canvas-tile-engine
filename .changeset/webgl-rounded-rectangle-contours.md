---
"@canvas-tile-engine/renderer-webgl": patch
---

Render WebGL rectangle borders along their rounded contour, including continuous dashes and rotation. Normalize corner radii against each adjacent horizontal or vertical edge, and preserve valid asymmetric radii larger than half the short edge in every fill shader. Match Canvas2D validation for invalid radii, avoid overflow with large finite radii, and blend translucent rounded strokes only once per pixel even when the width exceeds a corner radius. Handle collapsed rectangles without duplicate solid strokes and keep dash phase on their returning edge.
