---
"@canvas-tile-engine/react": patch
"@canvas-tile-engine/react-native": patch
---

Pass `styleOf: undefined` from declarative draw components (`Rect`, `Circle`, `Text`, `Line`, `Path`) when the `styleOf` prop is omitted. Previously an unconditional ref-reading wrapper function was always passed, causing renderers to treat the registration as having live bounds and bypass their R-Tree spatial index for 500+ item collections.
