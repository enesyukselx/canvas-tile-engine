---
"@canvas-tile-engine/react": patch
"@canvas-tile-engine/renderer-canvas": patch
---

Publish internal `@canvas-tile-engine/core` dependency as a caret range (`^x.y.z`) instead of an exact pin, so core patch/minor updates flow to consumers without requiring a re-release of dependent packages.
