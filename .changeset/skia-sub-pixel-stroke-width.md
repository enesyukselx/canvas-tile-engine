---
"@canvas-tile-engine/renderer-skia": patch
---

Draw zero and sub-pixel stroke widths the way the other renderers do. Skia passed every stroke width straight to the paint, so a width of 0 drew a 1px hairline where Canvas2D, the server renderer and WebGL draw nothing, a negative width kept the previous stroke's width, and a width below 1 drew a thin line instead of a 1px line at reduced opacity. Grid lines, rect and circle outlines (dynamic and static), lines and path outlines now use the shared rule: a width of 1px or more is unchanged, a narrower one draws a 1px line with its color's alpha scaled by the width, and 0 or less draws nothing. A zero or negative grid width also skips its line calls entirely.
