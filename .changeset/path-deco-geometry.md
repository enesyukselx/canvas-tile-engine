---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-webgl": patch
"@canvas-tile-engine/renderer-skia": patch
"@canvas-tile-engine/renderer-server": patch
---

fix: path decorations can no longer change painted stroke width or corner radius

`PathDecorationStyle` excludes `lineWidth*`/`cornerRadius*` because hit-test geometry resolves at registration time — but that guard is type-level only, and TypeScript's excess-property check does not fire on non-literal returns (or in plain JS). A width or corner radius smuggled into a `styleOf` decoration was applied when painting while hit testing kept the registration-time values: a silent visual/interaction desync. Renderers now resolve geometry-feeding values (stroke width, corner radius) from the registration-time `item.style` only — the same layer hit testing reads — so the desync is structurally impossible. Decoration color, dash, and fill behavior are unchanged.
