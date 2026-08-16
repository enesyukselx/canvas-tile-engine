---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-webgl": patch
---

Fix: a responsive map (`preserve-viewport` or `preserve-scale`) mounted while its wrapper measures 0x0 — a hidden tab, a collapsed accordion, a not-yet-opened modal, a flex parent on first paint — no longer permanently corrupts the camera with `NaN`.

`ResponsiveWatcher.start()` now skips its initial sizing pass when the wrapper's measured width or height is zero, instead of dividing by zero (`preserve-viewport`) or otherwise applying a degenerate size. The `ResizeObserver` it already installs picks up the initial sizing once the wrapper transitions to a real size, so the map renders correctly as soon as it becomes visible. `applySize` also gained a defensive zero-size guard.
