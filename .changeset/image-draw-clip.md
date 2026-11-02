---
"@canvas-tile-engine/core": patch
---

fix: `drawImage` now forwards `clip` to the renderer. Clipped dynamic image registrations previously hit-tested inside the clip but still painted outside it; static images and every other draw kind were unaffected.
