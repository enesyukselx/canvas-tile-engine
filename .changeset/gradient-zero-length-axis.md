---
"@canvas-tile-engine/core": patch
"@canvas-tile-engine/renderer-server": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/renderer-skia": patch
---

A gradient fill whose axis has zero length (`from` and `to` on the same point) now paints nothing on every renderer, whatever its stops. That is the Canvas2D rule and what a browser already did. Before, the server and React Native Skia painted the last stop flat and WebGL painted the first stop flat. Core's `gradientT` and `LinearGradient` documentation now states this instead of claiming the first stop is painted.
