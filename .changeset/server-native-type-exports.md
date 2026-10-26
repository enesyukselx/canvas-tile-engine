---
"@canvas-tile-engine/renderer-server": patch
---

Keep Image, Canvas, and SKRSContext2D type-only in the bundled declarations, matching the runtime exports. TypeScript now rejects using these convenience types as constructors or values from renderer-server; import native constructors directly from @napi-rs/canvas. Add packed-package TypeScript, ESM, and CommonJS contract checks.
