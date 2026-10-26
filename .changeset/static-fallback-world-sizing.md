---
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-server": patch
---

Keep static rectangle, circle, and image sizes in world units when an oversized or unavailable offscreen cache falls back to dynamic rendering. Ignore `sizePx`, `widthPx`, and `heightPx` on the fallback path just as cached drawing and static hit testing do, without changing the original items.
