---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-webgl": patch
---

Fix: a responsive map (`preserve-viewport` or `preserve-scale`) mounted while its wrapper measures 0x0 — a hidden tab, a collapsed accordion, a not-yet-opened modal, a flex parent on first paint — no longer permanently corrupts the camera with `NaN`.

`ResponsiveWatcher.start()` now skips its initial sizing pass when the wrapper's measured size is degenerate, instead of deriving a scale of 0 and having `Camera.setCenter` divide by it. The zero check is mode-aware: `preserve-viewport` derives the wrapper's height from its width and is itself what assigns that height, so a zero height on first measurement is normal there and only a zero width is treated as hidden; `preserve-scale` requires both dimensions. The `ResizeObserver` it already installs picks up the initial sizing once the wrapper transitions to a real size, using the same mode-aware check. `applySize` also gained a matching defensive guard.
