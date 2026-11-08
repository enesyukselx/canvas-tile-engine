---
"@canvas-tile-engine/core": patch
"@canvas-tile-engine/react": patch
"@canvas-tile-engine/react-native": patch
---

Document that the grid line width is in screen pixels. The `drawGridLines` JSDoc now describes `lineWidth`, `strokeStyle` and `layer`, and `<GridLines lineWidth>` gets the same note: unlike the world-unit `lineWidth` of rects, lines and paths, a grid line width does not scale with zoom, and a width below 1 draws a fainter hairline instead of a thinner line. The JSDoc example `drawGridLines(50)`, which drew a line every 50 world units, now shows a 1-unit grid. No runtime change.
